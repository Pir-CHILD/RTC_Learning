// https://github.com/mdn/samples-server/blob/master/s/webrtc-from-chat/chatserver.js

import * as ws from "ws";

// Output logging information to console
const printLog = (text) => {
  let time = new Date();

  console.log("[" + time.toLocaleTimeString + "] " + text);
};

// const webSocketServer = new ws.Server({ port: 6503 });
const serverInfo = { port: 6503, path: "0.0.0.0" }; // path, 允许的源路径
const wsServer = new ws.WebSocketServer(
  { port: serverInfo.port, clientTracking: true },
  () => printLog("Server is listening on " + String(serverInfo.port))
);

if (!wsServer) {
  printLog("ERROR: Unable to create WebSocket server!");
}

// Used for managing the text chat user list
const connectionArray = [];
let nextID = Date.now(); // 自己生成的 ID

// Refuse some origin
const originIsAllowed = (origin) => true;

// Check all users have unique name
function isUsernameUnique(name) {
  let isUnique = true;
  for (let i = 0; i < connectionArray.length; i++) {
    if (name === connectionArray[i].username) {
      isUnique = false;
      break;
    }
  }

  return isUnique;
}

// Sends a message (JSON) to a single user by the username
const sendToOneUser = (target, msgString) => {
  connectionArray.find((conn) => conn.username === target).send(msgString);
};

// Get the connection by ID
function getConnectionForID(id) {
  let connect = null;

  for (let i = 0; i < connectionArray.length; i++) {
    if (connectionArray[i].clientID === id) {
      connect = connectionArray[i];
      break;
    }
  }

  return connect;
}

// userList contains the names of all connected users. Used to ramp
// up newly logged-in users and to handle name change notifications.
function makeUserListMsg() {
  let userListMsg = {
    type: "userlist",
    users: [],
  };
  // const userList = [];

  for (let i = 0; i < connectionArray.length; i++) {
    userListMsg.users.push(connectionArray[i].username);
  }

  return userListMsg;
}

// Sends a "userlist" message to all chat members. This is a cheesy way
// to ensure that every join/drop is reflected everywhere. It would be more
// efficient to send simple join/drop messages to each user, but this is
// good enough for this simple example.
function sendUserListToAll() {
  const userListMsg = makeUserListMsg();
  const userListMsgStr = JSON.stringify(userListMsg);

  for (let i = 0; i < connectionArray.length; i++) {
    connectionArray[i].send(userListMsgStr);
  }
}

wsServer.on("connection", (ws, request) => {
  printLog("Rcv request: " + JSON.stringify(request.headers));
  printLog("Connection accepted from " + ws.url);
  // connectionArray.push(ws);

  // Tell to client the conn is established.
  // ws.on("open", () => {ws.send("hello")});

  // Add the new connection to our list of connections.
  ws.clientID = nextID;
  nextID++;

  // Send the new client its token; it send back a "username" message to
  // tell us what username they want to use.
  let msg = {
    type: "ID",
    id: ws.clientID,
  };
  ws.send(JSON.stringify(msg));

  ws.on("message", (data, isBinary) => {
    let content = JSON.parse(data.toString());
    printLog("Received Message: " + content);

    switch (content.type) {
      // Username change request
      case "USERNAME":
        let requestName = content.name;
        let nameUnique = isUsernameUnique(requestName);
        let nameChangeMsg = {
          type: "USERNAME",
          name: requestName,
        };

        printLog("[USERNAME]Change username: " + requestName);

        if (nameUnique) {
          nameChangeMsg.code = 3001; // name unique
          nameChangeMsg.info = "Username changed.";
          printLog("Change success.");
        } else {
          nameChangeMsg.code = 4001; // name repeat
          nameChangeMsg.info = "Username repeat, please send a new one.";
          printLog("Change fail, Code: " + nameChangeMsg.code.toString());
        }

        ws.send(JSON.stringify(nameChangeMsg));
        break;

      // Client info
      case "INFO":
        let cpuInfo = content.cpu;
        let gpuInfo = content.gpu;
        let memoryInfo = content.memory;

        printLog(
          "[INFO]Client info: " +
            "\nCPU: " +
            cpuInfo +
            "\nGPU: " +
            gpuInfo +
            "\nMemory: " +
            memoryInfo
        );

        let infoMsg = {
          type: "INFO",
          code: 1001,
          info: "OK",
        };

        ws.send(JSON.stringify(infoMsg));
        break;
    }
  });

  //FIXME: what code and reason?
  ws.on("close", (code, reason) => {
    printLog(
      "[DISCONNECT]Client IP: " +
        ws.url +
        "\nCODE: " +
        code +
        "\nREASON: " +
        reason
    );
  });
});
