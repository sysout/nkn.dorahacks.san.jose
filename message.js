function setup() {
}

const bitcoin = require('bitcoinjs-lib')
const fileType = require('file-type');
const fs = require('fs');

function msg(obj){
  var client = nkn({
    identifier: obj.identifier,
    privateKey: obj.privateKey,
  });

  var conn;
  var msg = document.getElementById("msg");
  var log = document.getElementById("log");
  var img = document.getElementById("fileupload");
  var form = document.getElementById("form");
  var history = [];

  {
    let item = document.createElement("div");
    item.innerText = `using publicKey: ${obj.identifier}.${client.key.publicKey}`;
    log.appendChild(item);
  }

  img.addEventListener('change', encodeImageFileAsURL);
  form.addEventListener('submit', submitForm);
  if (localStorage.getItem("derivePath") === null) {
    localStorage.setItem('derivePath', 0);
  }
  if (localStorage.getItem("history") === null) {
    localStorage.setItem('history', history);
  } else {
    //initilize msg history
    var string = localStorage.getItem('history');
    var historyArr = string.split(',');
    for (var i = 0; i < historyArr.length; i++) {
      var item = document.createElement("div");
      item.innerText = historyArr[i];
      appendLog(item);
    }
  }

  function submitForm(e) {
      e.preventDefault();
      if (!msg.value) {
        return false;
      }
      client.send(
        obj.sendTo,
        JSON.stringify({type: "txt", data: msg.value}),
      );
      var item = document.createElement("div");
      item.innerText = "You: " + msg.value;
      appendLog(item);

      //store to localStorage
      var string = localStorage.getItem('history');
      var historyArr = string.split(',');
      historyArr.push(msg.value);
      string = historyArr.toString();
      localStorage.setItem('history', string);

      msg.value = "";
      return false;
  }

  function encodeImageFileAsURL() {
    file = this.files[0];
    if (file){
      var reader = new FileReader();
      var type = file.type;
      reader.onloadend = function() {
        console.log('RESULT', reader.result);
        client.send(
          obj.sendTo,
          JSON.stringify({type: type, data: reader.result})
        );
      }
      reader.readAsDataURL(file);
    }
  }

  function appendLog(item) {
    var doScroll = log.scrollTop > log.scrollHeight - log.clientHeight - 1;
    log.appendChild(item);
    if (doScroll) {
      log.scrollTop = log.scrollHeight - log.clientHeight;
    }
  }

  var fileMap = {
    "pic1" : "/Users/xiongxiong/Dropbox/1.jpg"
  }

  function sendMsg(sendTo, resp_msg) {
    client.send(
      sendTo,
      JSON.stringify({type: "txt", data: resp_msg})
    );
  }

  function sendAddress(sendTo, resp_msg) {
    client.send(
      sendTo,
      JSON.stringify({type: "bitcoinAddress", data: resp_msg})
    );
  }

  function sendFile(sendTo, file) {
      // read binary data
      console.log("sending " + file + " to " + sendTo);
      let bitmap = fs.readFileSync(file);
      let type = fileType(bitmap)
      // convert binary data to base64 encoded string
      let data = "data:"+type.mime+";base64,"+new Buffer(bitmap).toString('base64');
      client.send(
        sendTo,
        JSON.stringify({type: type.mime, data: data})
      );
  }

  function gotData(name){
     function gotGiphy(giphy){
      console.log(giphy.data.image_url);
      let item = document.createElement("div");
      let div = document.createElement("div");
      div.innerText = name;
      item.appendChild(div);
      let image = new Image();
      item.appendChild(image);
      image.src = giphy.data.image_url;
      document.getElementById("log").appendChild(item);
    }
    return gotGiphy;
  }

  //websocket
    if (window["WebSocket"]) {

      client.on('connect', () => {
        console.log('Connection opened.');
      });

      client.on('message', (src, payload) => {
    	  console.log(src);
    	  console.log(payload);
        var data = JSON.parse(payload);
        if (data.type && data.type.indexOf("/") >= 0){
          var type = data.type.split("/")[0];
        } else {
          var type = data.type;
        }
        if (type === "image"){
          var item = document.createElement("div");
          var image = new Image();
          item.appendChild(image);
          document.getElementById("log").appendChild(item);
          image.src = data.data;
        }
        if (type === "video"){
          var item = document.createElement("div");
          item.innerHTML = "<video class=\"video-js\" controls ></video>"
          document.getElementById("log").appendChild(item);
          item.firstChild.src = data.data;
        }
        if (type === "txt"){
          if (data.data.startsWith("/giphy ")){
            var query = data.data.substr(7).trim().split(/\s+/).join("+");
            loadJSON(`http://api.giphy.com/v1/gifs/random?q=${query}&api_key=dc6zaTOxFJmzC`, gotData(data.data))
          } else if (data.data.startsWith("/buy")){
            var file = data.data.substr(5).trim();
            var resp_msg = "not valid file name"
            if (fileMap[file]){
              var cur = localStorage.getItem('derivePath');
              cur = 1 + parseInt(cur);
              let address0FromXpub = bitcoin.HDNode.fromBase58(
                'xpub6C3NvJRVwM9YmBhKXtF9XyS8FU3bebhLUfbm9cXLX1n5sL8SbPpr2c1uW5VvsrqbvsfyA3baCY2i5pY1k9HXSa2BT6p2CKF2cujzNtctefb')
              let address = address0FromXpub.derivePath("0/"+cur).keyPair.getAddress()
              localStorage.setItem(address, src + " " + file);
              localStorage.setItem('derivePath', cur);
              sendAddress(src, address);
              resp_msg = ">Please pay 600 satoshi to " + address;
              resp_msg += "\n>After the payment, get my picture like this: /paid " + address;
            }
            sendMsg(src, resp_msg);
            {
              var item = document.createElement("div");
              item.innerText = data.data;
              appendLog(item);
            }
            {
              var item = document.createElement("div");
              item.innerText = resp_msg
              appendLog(item);
            }
          } else if (data.data.startsWith("/paid")){
            let address = data.data.substr(6).trim();
            let info = localStorage.getItem(address);
            if (info){
              loadJSON(`https://blockchain.info/q/addressbalance/${address}`, (a,b) => {
                if (parseInt(a) > 600){
                  let idx = info.indexOf(" ");
                  sendFile(info.substr(0, idx), fileMap[info.substr(idx + 1)]);
                } else {
                  sendMsg(src, "not enough satoshi");
                }
              })
            } else {
              console.log("wrong address:" + address);
              sendMsg(src, "invalid address:" + address);
            }
          } else if (data.data.startsWith("/ls") || data.data.startsWith("/help")){
            let resp_msg = "Please pay at least 600 satoshi to buy my pictures:"
            for(var key in fileMap){
              resp_msg += " " + key;
              /* use key/value for intended purpose */
            }
            resp_msg += "\n" + "like: /buy pic1";
            sendMsg(src, resp_msg);
          } else {
            var messages = data.data.split('\n');
            for (var i = 0; i < messages.length; i++) {
        	    var item = document.createElement("div");
        	    item.innerText = messages[i];
        	    appendLog(item);

            }
            //store to localStorage
            var string = localStorage.getItem('history');
            var historyArr = string.split(',');
            historyArr.push(data.data);
            string = historyArr.toString();
            localStorage.setItem('history', string);
            sendMsg(src, "type /help for help");
          }
        }
      });
    } else {
      var item = document.createElement("div");
      item.innerHTML = "<b>Your browser does not support WebSockets.</b>";
      appendLog(item);
    }

}
