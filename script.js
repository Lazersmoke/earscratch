var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var source;

var localLibrary = {}

// effectTracks[0] is "master" track for effects only so (invariant) tracks[0]==null
var tracks = [];
var effectTracks = [];

var trackGainNodes = [audioCtx.createGain()];
//trackGainNodes[0].connect(audioCtx.destination)

function getTestAudioData(){
  //CIARA_SET_KICK_1
  getAudioDataFromEarSketch("CIARA_SET_KICK_1",120)
}

function getAudioDataFromEarSketch(filekey,getTempo = 120){
  if(localLibrary[filekey + "-TEMPO" + getTempo]){
    return
  }
  localLibrary[filekey + "-TEMPO" + getTempo] = "pending"
  // Uses verbatim-ish earsketch code so we avoid stepping on any toes
  source = audioCtx.createBufferSource();
  grabURL("https://earsketch.gatech.edu/EarSketchWS/services/audio/getaudiosample?key=" + filekey + "&tempo=" + getTempo + "&audioquality=1","arraybuffer", resp => {
    audioCtx.decodeAudioData(resp,buffer => {
      localLibrary[filekey + "-TEMPO" + getTempo] = buffer
      if(Object.keys(localLibrary).every(k => localLibrary[k] != "pending")){
        doneLoading()
      }
    },e =>console.log("Error with decoding audio data" + e.err))
  })
}

function doneLoading(){
  document.getElementById("playButton").disabled = false
}

// Typical clip event in track: {timing: [tlow,thigh], fileKey: "key"}

function preprocessCode(codeInput){
  if(document.getElementById("pythonCheckbox").checked){
    codeInput = codeInput
      .replace(/^(\s*)def\s*([\w\d]+)\s*\((.*)\)\s*:\s*((?:\n+\1 +[^\n]*)+)/mg,"$1function $2($3){$4}")
      .replace(/^(\s*)(if)([^\n]*):\s*((?:\n+\1 +[^\n]*)+)/mg,"$1$2($3){$4}")
      .replace(/^(\s*)(while)([^\n]*):\s*((?:\n+\1 +[^\n]*)+)/mg,"$1$2($3){$4}")
      .replace(/^(\s*)(else:)\s*((?:\n+\1 +[^\n]*)+)/mg,"$1else{$3}")
      .replace(/^(\s*)(elif)([^\n]*):\s*((?:\n+\1 +[^\n]*)+)/mg,"$1else if ($3){$4}")
      .replace(/ int\(/mg," Number(")
      .replace(/print\s*("[^"]*")/mg,"print($1)")
      .replace(/^(.*if\s*\(.*)and(.*\).*)$/mg,"$1 && $2")
      .replace(/^(.*if\s*\(.*)or(.*\).*)$/mg,"$1 || $2")
      .replace(/^(\s*)for\s*([\w\d]+)\s*in\s*range\s*\(([^,]*),([^,]*)\)\s*:\s*((?:\n+\1 [^\n]*)+)/mg,"$1for(var $2 = $3; $2 <= $4; $2++){$5}")
      .replace(/^(\s*)for\s*([\w\d]+)\s*in\s*range\s*\(([^,]*),([^,]*),([^,]*)\)\s*:\s*((?:\n+\1 [^\n]*)+)/mg,"$1for(var $2 = $3; $2 <= $4; $2 += $5){$6}")
      .split("\n").filter(line => !line.match(/\s*#/) && !line.startsWith("from earsketch import")).join("\n")
    console.log(codeInput)
  }
  return codePrelude + codeInput
}

var audioTags = JSON.parse(localStorage.getItem("esAudioTags"))
var tempo = 120
const BEATS_PER_MEASURE = 4
function secondsPerMeasure(){
  return BEATS_PER_MEASURE / (tempo / 60)
}
var codePrelude = `

function println(outputText){
  print(outputText + "\\n")
}

function print(outputText){
  document.getElementById("codeOutput").value += outputText
}

function init(){
  println("Earsketch init() called")
}

function finish(){
  println("Earsketch finish() called")
}

function setTempo(newTempo){
  println("Tempo is now " + newTempo)
  tempo = newTempo
}

const allNums = "0123456789"
function makeBeat(fileKeys,track,startMeasure,beatPattern){
  if(beatPattern.length == 0){
    return
  }
  if(!Array.isArray(fileKeys)){
    fileKeys = [fileKeys]
  }
  if(beatPattern[0] == "-"){
    var beatLength = 0
    var i = 0
    for(i = 0; beatPattern[i] == "-"; i++){
      beatLength += secondsPerMeasure()/16
    }
    return makeBeat(fileKeys,track,startMeasure + beatLength,beatPattern.slice(i))
  }
  if(beatPattern[0] == "+"){
    println("Bad beat pattern has + in bad spot")
    return
  }
  var currentFK = beatPattern[0]
  var beatLength = 0
  var i = 0;
  for(i = 0; beatPattern[i] == currentFK || beatPattern[i] == "+"; i++){
    beatLength += secondsPerMeasure()/16
  }
  fitMedia(fileKeys[Number(currentFK)],track,startMeasure,startMeasure + beatLength)
  return makeBeat(fileKeys,track,startMeasure + beatLength,beatPattern.slice(i))
}

function setEffect(trackNumber,effectType,effectParameter,effectStartValue,effectStartLocation = 0,effectEndValue,effectEndLocation){
  if(!(effectType == "VOLUME" && effectParameter == "GAIN")){
    println("Earsketch setEffect() for effect other than VOLUME/GAIN is not implemented")
    return
  }
  if(!effectTracks[trackNumber]){effectTracks[trackNumber] = []}
  effectTracks[trackNumber].push({timing: [secondsPerMeasure() * effectStartLocation,secondsPerMeasure() * effectEndLocation], effectType: "VOLUME GAIN", effectRange: [effectStartValue,effectEndValue]})
}

function fitMedia(fileKey,trackNumber,startMeasure,endMeasure){
  if(!tracks[trackNumber]){tracks[trackNumber] = []}
  tracks[trackNumber].push({timing: [secondsPerMeasure() * startMeasure,secondsPerMeasure() * endMeasure], fileKey: fileKey})
}
// Effect stub stuff
FILTER = "FILTER"
FILTER_FREQ = "FILTER_FREQ"
VOLUME = "VOLUME"
GAIN = "GAIN"
False = false
True = true
readInput = prompt
`;
window.onload = function(){
  if(audioTags){
    audioTags.forEach(tag => {codePrelude += tag.file_key + "=\"" + tag.file_key + "\";"})
  }else{
    grabURL("https://earsketch.gatech.edu/EarSketchWS/services/audio/getaudiotags","json", audioTagsES => {
      audioTags = audioTagsES.audioTags
      localStorage.setItem("esAudioTags",JSON.stringify(audioTagsES.audioTags))
    })
  }
}

function runCode(){
  document.getElementById("playButton").disabled = true
  document.getElementById("codeOutput").value = ""
  tracks = []
  const processedCode = preprocessCode(document.getElementById("codeInput").value)
  try{
    Function(processedCode)()
  }catch(err){
    document.getElementById("trackOutput").value = err + " on line " + err.lineNumber + " of the following processed code:\n\n" + processedCode
    return
  }

  document.getElementById("trackOutput").value = "Tracks:\n\n"

  tracks.forEach(track => {
    document.getElementById("trackOutput").value += JSON.stringify(track) + "\n"
  })
  preLoad()
}

function preLoad(){
  tracks.forEach(t => t.forEach(c => getAudioDataFromEarSketch(c.fileKey,tempo)))
  // In case it's all already loaded, we check again
  if(Object.keys(localLibrary).every(k => localLibrary[k] != "pending")){
    doneLoading()
  }
}

// Lifted from EarSketch for compatibility
function dbToFloat(dbValue){
  return (Math.pow(10, (0.05 * dbValue)));
}

function serializeTracks(){
  const startTime = audioCtx.currentTime
  effectTracks.forEach((effectTrack,trackNum) => {
    var sortedTrack = effectTrack.sort((a,b) => {return a.timing[0] - b.timing[0]})
    if(!trackGainNodes[trackNum]){ trackGainNodes[trackNum] = audioCtx.createGain() }
    sortedTrack.forEach(change => {
      if(change.effectRange[1]){ // if lerp
        trackGainNodes[trackNum].gain.setValueAtTime(dbToFloat(change.effectRange[0]),startTime + change.timing[0])
        trackGainNodes[trackNum].gain.linearRampToValueAtTime(dbToFloat(change.effectRange[1]),startTime + change.timing[1])
      }else{
        trackGainNodes[trackNum].gain.setValueAtTime(dbToFloat(change.effectRange[0]),startTime + change.timing[0])
      }
    })
  })

  tracks.forEach((track,trackNum) => {
    var sortedTrack = track.sort((a,b) => {return a.timing[0] - b.timing[0]})

    var i = 0
    const handleEnd = event => {
      const timings = sortedTrack[i].timing
      var source = audioCtx.createBufferSource()
      source.buffer = localLibrary[sortedTrack[i].fileKey + "-TEMPO" + tempo];
      if(!trackGainNodes[trackNum]){ trackGainNodes[trackNum] = audioCtx.createGain() }
      source.connect(trackGainNodes[trackNum])
      trackGainNodes[trackNum].connect(trackGainNodes[0])
      trackGainNodes[0].connect(audioCtx.destination)
      source.start(startTime + timings[0])
      source.stop(startTime + timings[1])
      source.loop = true;
      i++
      if(i < sortedTrack.length){
        source.addEventListener("ended",handleEnd)
      }
      console.log("Just set i=" + i + " in track #" + trackNum + " and will stop at " + (startTime + timings[1]))
    }
    handleEnd(null)
    //source.addEventListener("ended", handleEnd)
    //source.dispatchEvent(new Event("ended"))
  })
}
