
function addTd(tr,tdInside){
  var td = document.createElement("td")
  td.appendChild(tdInside)
  tr.appendChild(td)
}

function prettyTypedItem(itemName,item){
  var wholeSpan = document.createElement("span")
  var namePart = document.createElement("b")
  var nameSpan = document.createElement("span")
  namePart.appendChild(document.createTextNode(itemName))
  nameSpan.appendChild(namePart)
  nameSpan.appendChild(document.createTextNode(" (" + item.type + ")"))
  wholeSpan.appendChild(nameSpan)
  var descPart = document.createElement("p")
  descPart.appendChild(document.createTextNode(item.description))
  wholeSpan.appendChild(descPart)
  return wholeSpan
}

window.onload = () => {
  const esTable = document.getElementById("earsketchDocs")
  // This is loaded via script tag due to same-origin policy issues
  ESApiDoc["simple setEffect"] = ESApiDoc.setEffect[0]
  ESApiDoc["complex setEffect"] = ESApiDoc.setEffect[1]
  delete ESApiDoc.setEffect
  Object.keys(ESApiDoc).forEach(k => {
    var thisRow = document.createElement("tr")

    var functionNametd = document.createElement("td")
    functionNametd.appendChild(document.createTextNode(k))

    var descPara = document.createElement("p")
    descPara.appendChild(document.createTextNode(ESApiDoc[k].description))
    functionNametd.appendChild(descPara)

    thisRow.appendChild(functionNametd)

    var parameterList = document.createElement("ul")
    if(ESApiDoc[k].parameters){
      Object.keys(ESApiDoc[k].parameters).forEach(pk => {
        var thisParam = document.createElement("li")
        thisParam.appendChild(prettyTypedItem(pk,ESApiDoc[k].parameters[pk]))
        parameterList.appendChild(thisParam)
      })
      addTd(thisRow,parameterList)
    }else{addTd(thisRow,document.createTextNode("No parameters"))}
    if(ESApiDoc[k].returns){
      addTd(thisRow,prettyTypedItem("Returns",ESApiDoc[k].returns))
    }else{addTd(thisRow,document.createTextNode("No return value"))}

    esTable.appendChild(thisRow)
  })
}

fetch(new Request("https://earsketch.gatech.edu/EarSketchWS/services/audio/getaudiotags",{cache: "force-cache"}))
  .then(r => r.json())
  .then(tags => {
    const tagTable = document.getElementById("tagDocs")
    tags.audioTags.forEach(tag => {
      const thisRow = document.createElement("tr")

      addTd(thisRow,document.createTextNode(tag.file_key))
      addTd(thisRow,document.createTextNode(tag.instrument + " (" + tag.genre + ")"))
      addTd(thisRow,document.createTextNode(tag.tempo))

      tagTable.appendChild(thisRow)
    })
  })
