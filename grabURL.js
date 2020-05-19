function grabURL(url,type,cb){
  var xmlHttp = new XMLHttpRequest()
  xmlHttp.responseType = type
  xmlHttp.onreadystatechange = function() { 
    if(xmlHttp.readyState == 4 && xmlHttp.status == 200){
      console.log("Fetched from " + url)
      console.log(xmlHttp.response)
      cb(xmlHttp.response)
    }
  }
  xmlHttp.open("GET", url, true); // true for asynchronous 
  xmlHttp.send(null);
}
