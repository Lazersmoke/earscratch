const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// effectTracks[0] is "master" track for effects only so (invariant) tracks[0]==null
var tracks = [];
var effectTracks = [];

const trackGainNodes = []
const masterGainNode = audioCtx.createGain()

const localLibrary = {}
function getAudioDataFromEarSketch(filekey,getTempo = 120){
  const libraryKey = filekey + "-TEMPO" + getTempo
  if(localLibrary[libraryKey]){return localLibrary[libraryKey]}
  // Uses verbatim-ish earsketch url so we avoid stepping on any toes
  const url = "https://earsketch.gatech.edu/EarSketchWS/services/audio/getaudiosample?key=" + filekey + "&tempo=" + getTempo + "&audioquality=1"
  localLibrary[libraryKey] = fetch(new Request(url,{cache: "force-cache"}))
    .then(r => r.arrayBuffer())
    .then(r => audioCtx.decodeAudioData(r))
  return localLibrary[libraryKey]
}

var tempo = 120
const BEATS_PER_MEASURE = 4
function secondsPerMeasure(){
  return BEATS_PER_MEASURE / (tempo / 60)
}

// This code is attatched to the start of every user script
var codePrelude = `
// Print to output window
function print(outputText){
  document.getElementById("codeOutput").value += outputText
}

function println(outputText){
  print(outputText + "\\n")
}

// EarSketch functions
function init(){}
function finish(){}

function setTempo(newTempo){
  tempo = newTempo
}

// Recursively build up the beat
function makeBeat(fileKeys,track,startMeasure,beatPattern){
  if(beatPattern.length == 0){return}
  // Support fileKeys being only one file key (the common case)
  if(!Array.isArray(fileKeys)){fileKeys = [fileKeys]}
  if(beatPattern[0] == "-"){
    var beatLength = 0
    var i = 0
    for(i = 0; beatPattern[i] == "-"; i++){
      beatLength += secondsPerMeasure()/16
    }
    return makeBeat(fileKeys,track,startMeasure + beatLength,beatPattern.slice(i))
  }
  if(beatPattern[0] == "+"){
    println("Bad beat pattern starts with + so we don't know which sound to play")
    return
  }
  // Loop variable tells us how much to remove from beatPattern for recursion
  var i, beatLength = 0
  // Compute how long this sound is held; any combination like 0++++000++0+ is allowed
  for(i = 0; beatPattern[i] == beatPattern[0] || beatPattern[i] == "+"; i++){
    beatLength += secondsPerMeasure()/16
  }
  // The numbers are indices of fileKeys
  fitMedia(fileKeys[Number(beatPattern[0])],track,startMeasure,startMeasure + beatLength)
  return makeBeat(fileKeys,track,startMeasure + beatLength,beatPattern.slice(i))
}

function setEffect(trackNumber,effectType,effectParameter,effectStartValue,effectStartLocation = 0,effectEndValue,effectEndLocation){
  if(!(effectType == "VOLUME" && effectParameter == "GAIN")){
    println("Earsketch setEffect() for effect other than VOLUME/GAIN is not implemented")
    return
  }
  if(!effectTracks[trackNumber]){effectTracks[trackNumber] = []}
  effectTracks[trackNumber].push({timing: [secondsPerMeasure() * effectStartLocation,secondsPerMeasure() * effectEndLocation], effectRange: [effectStartValue,effectEndValue].map(dbToFloat)})
}

function fitMedia(fileKey,trackNumber,startMeasure,endMeasure){
  if(!tracks[trackNumber]){tracks[trackNumber] = []}
  tracks[trackNumber].push({timing: [secondsPerMeasure() * startMeasure,secondsPerMeasure() * endMeasure], fileKey: fileKey, currentTempo: tempo})
}

// Effect keys
// TODO: load these from EarSketch and implement all of them
FILTER = "FILTER"
FILTER_FREQ = "FILTER_FREQ"
VOLUME = "VOLUME"
GAIN = "GAIN"

// Python "compatibility"
int = Number
False = false
True = true
readInput = prompt

`;

// Get the big list of audio tags from EarSketch, and throw them as constant definitions in the code prelude
// so that things like fitMedia(SOME_AUDIO_TAG, ...) will use the constant as a string
fetch(new Request("https://earsketch.gatech.edu/EarSketchWS/services/audio/getaudiotags",{cache: "force-cache"}))
  .then(r => r.json())
  .then(json => json.audioTags.forEach(tag => {codePrelude += tag.file_key + "=\"" + tag.file_key + "\";"}))

function preprocessCode(codeInput){
  // Behold, the glorious and most excellent Python to JavaScript conversion regex!!!
  // It's behind a toggle switch because it's likely to be horribly broken in many ways
  // and could definitely break badly on maliciously designed source code
  if(document.getElementById("pythonCheckbox").checked){
    codeInput = codeInput
      .replace(/^(\s*)def\s*([\w\d]+)\s*\((.*)\)\s*:\s*((?:\n+\1 +[^\n]*)+)/mg,"$1function $2($3){$4}")
      .replace(/^(\s*)(if)([^\n]*):\s*((?:\n+\1 +[^\n]*)+)/mg,"$1$2($3){$4}")
      .replace(/^(\s*)(while)([^\n]*):\s*((?:\n+\1 +[^\n]*)+)/mg,"$1$2($3){$4}")
      .replace(/^(\s*)(else:)\s*((?:\n+\1 +[^\n]*)+)/mg,"$1else{$3}")
      .replace(/^(\s*)(elif)([^\n]*):\s*((?:\n+\1 +[^\n]*)+)/mg,"$1else if ($3){$4}")
      .replace(/print\s*("[^"]*")/mg,"print($1)")
      .replace(/^(.*if\s*\(.*)and(.*\).*)$/mg,"$1 && $2")
      .replace(/^(.*if\s*\(.*)or(.*\).*)$/mg,"$1 || $2")
      .replace(/^(\s*)for\s*([\w\d]+)\s*in\s*range\s*\(([^,]*),([^,]*)\)\s*:\s*((?:\n+\1 [^\n]*)+)/mg,"$1for(var $2 = $3; $2 <= $4; $2++){$5}")
      .replace(/^(\s*)for\s*([\w\d]+)\s*in\s*range\s*\(([^,]*),([^,]*),([^,]*)\)\s*:\s*((?:\n+\1 [^\n]*)+)/mg,"$1for(var $2 = $3; $2 <= $4; $2 += $5){$6}")
      .split("\n").filter(line => !line.match(/\s*#/) && !line.match(/\s*from\s*[\w.]+\s*import/)).join("\n")
    console.log(codeInput)
  }
  return codePrelude + codeInput
}

function runCode(){
  // Disable the play button because we might be dealing with unloaded audio resources
  document.getElementById("playButton").disabled = true

  // Clean up from last run
  document.getElementById("codeOutput").value = ""
  tracks = []
  effectTracks = []

  const processedCode = preprocessCode(document.getElementById("codeInput").value)
  try{
    Function(processedCode)()
  }catch(err){
    // Output the entire processed code because we might have messed up the python regex for example
    document.getElementById("trackOutput").value = err + " on line " + err.lineNumber + " of the following processed code:\n\n" + processedCode
    return
  }

  // Now that we know which audio resources and how many tracks we have, do some setup
  document.getElementById("trackOutput").value = "Tracks:\n\n"
  tracks.forEach((track,trackNum) => {
    document.getElementById("trackOutput").value += JSON.stringify(track) + "\n"
    track.forEach(c => getAudioDataFromEarSketch(c.fileKey,c.currentTempo))
    trackGainNodes[trackNum] = audioCtx.createGain()
  })

  // Load the audio resources async, and enable the play button when it's ready
  Promise.all(Object.values(localLibrary)).then(_ => {document.getElementById("playButton").disabled = false})
}

// Lifted from EarSketch for compatibility
function dbToFloat(dbValue){
  return (Math.pow(10, (0.05 * dbValue)));
}

function serializeTracks(){
  const startTime = audioCtx.currentTime
  effectTracks.forEach((effectTrack,trackNum) => {
    const gainNode = trackNum == 0 ? masterGainNode : trackGainNodes[trackNum]
    effectTrack.forEach(change => {
      if(change.timing[1]){ // if lerp
        gainNode.gain.setValueAtTime(change.effectRange[0],startTime + change.timing[0])
        gainNode.gain.linearRampToValueAtTime(change.effectRange[1],startTime + change.timing[1])
      }else{ // if constant
        gainNode.gain.setValueAtTime(change.effectRange[0],startTime + change.timing[0])
      }
    })
  })

  tracks.forEach((track,trackNum) => {
    var sortedTrack = track.sort((a,b) => {return a.timing[0] - b.timing[0]})

    var i = 0
    const handleEnd = event => {
      const timings = sortedTrack[i].timing
      var source = audioCtx.createBufferSource()
      localLibrary[sortedTrack[i].fileKey + "-TEMPO" + sortedTrack[i].currentTempo].then(buf => source.buffer = buf)
      source.connect(trackGainNodes[trackNum])
      trackGainNodes[trackNum].connect(masterGainNode)
      masterGainNode.connect(audioCtx.destination)
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
  })
}
