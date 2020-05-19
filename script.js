var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var source;

var localLibrary = {}

// tracks[0] is "master" track for effects only (invariant)
var tracks = [];

function getTestAudioData(){
  //CIARA_SET_KICK_1
  getAudioDataFromEarSketch("CIARA_SET_KICK_1",120)
}

function getAudioDataFromEarSketch(filekey,tempo = 120){
  if(localLibrary[filekey + "-TEMPO" + tempo]){
    return
  }
  localLibrary[filekey + "-TEMPO" + tempo] = "pending"
  // Uses verbatim-ish earsketch code so we avoid stepping on any toes
  source = audioCtx.createBufferSource();
  grabURL("https://earsketch.gatech.edu/EarSketchWS/services/audio/getaudiosample?key=" + filekey + "&tempo=" + tempo + "&audioquality=1","arraybuffer", resp => {
    audioCtx.decodeAudioData(resp,buffer => {
      localLibrary[filekey + "-TEMPO" + tempo] = buffer
      if(Object.keys(localLibrary).every(k => localLibrary[k] != "pending")){
        doneLoading()
      }
    },e =>console.log("Error with decoding audio data" + e.err))
  })
}

function doneLoading(){
  alert("Loading complete!")
}

// Typical clip event in track: {timing: [tlow,thigh], fileKey: "key"}


const REMOVE_PYTHON_COMMENTS = true

function preprocessCode(codeInput){
  if(REMOVE_PYTHON_COMMENTS){
    return codePrelude + codeInput.split("\n").filter(line => !line.match(/\s*#/) && !line.startsWith("from earsketch import")).join("\n")
  }
  return codePrelude + codeInput
}

var audioTags = JSON.parse(localStorage.getItem("esAudioTags"))
var codePrelude = `

const BEATS_PER_MEASURE = 4
const BEATS_PER_MINUTE = 120
const SECONDS_PER_MEASURE = BEATS_PER_MEASURE / (BEATS_PER_MINUTE / 60)

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

var esTempo = 120
function setTempo(tempo){
  println("Tempo is now " + tempo)
  esTempo = tempo
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
      beatLength += SECONDS_PER_MEASURE/16
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
    beatLength += SECONDS_PER_MEASURE/16
  }
  fitMedia(fileKeys[Number(currentFK)],track,startMeasure,startMeasure + beatLength)
  return makeBeat(fileKeys,track,startMeasure + beatLength,beatPattern.slice(i))
}

function setEffect(a,b,c,d,e){
  println("Earsketch setEffect() stub called")
}

function fitMedia(fileKey,trackNumber,startMeasure,endMeasure){
  var startTime = SECONDS_PER_MEASURE * startMeasure
  var endTime = SECONDS_PER_MEASURE * endMeasure
  if(!tracks[trackNumber]){tracks[trackNumber] = []}
  tracks[trackNumber].push({timing: [startTime,endTime], fileKey: fileKey})
}
// Effect stub stuff
VOLUME = ""
GAIN = ""
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
  document.getElementById("codeOutput").value = ""
  tracks = []
  try{
    Function(preprocessCode(document.getElementById("codeInput").value))()
  }catch(err){
    document.getElementById("trackOutput").value = err
    return
  }

  document.getElementById("trackOutput").value = "Tracks:\n\n"

  tracks.forEach(track => {
    document.getElementById("trackOutput").value += JSON.stringify(track) + "\n"
  })
  preLoad()
}

function preLoad(){
  tracks.forEach(t => t.forEach(c => getAudioDataFromEarSketch(c.fileKey)))
}

function serializeTracks(){
  const startTime = audioCtx.currentTime + 0.25
  var serialTracks = []
  tracks.forEach((track,trackNum) => {
    var sortedTrack = track.sort((a,b) => {return a.timing[0] - b.timing[0]})

    var i = 0
    const handleEnd = event => {
      const timings = sortedTrack[i].timing
      var source = audioCtx.createBufferSource()
      source.buffer = localLibrary[sortedTrack[i].fileKey + "-TEMPO" + 120];
      source.start(startTime + timings[0])
      source.stop(startTime + timings[1])
      source.addEventListener("ended",handleEnd)
      source.connect(audioCtx.destination);
      source.loop = true;
      i++
      console.log("Just set i=" + i + " in track #" + trackNum + " and will stop at " + (startTime + timings[1]))
    }
    handleEnd(null)
    //source.addEventListener("ended", handleEnd)
    //source.dispatchEvent(new Event("ended"))
  })
}
