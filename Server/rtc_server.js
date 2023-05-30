//#!/usr/bin/env node
//
// WebSocket chat server
// Implemented using Node.js
//
// Requires the websocket module.
//
// WebSocket and WebRTC based multi-user chat sample with two-way video
// calling, including use of TURN if applicable or necessary.
//
// This file contains the JavaScript code that implements the server-side
// functionality of the chat system, including user ID management, message
// reflection, and routing of private messages, including support for
// sending through unknown JSON objects to support custom apps and signaling
// for WebRTC.
//
// Requires Node.js and the websocket module (WebSocket-Node):
//
//  - http://nodejs.org/
//  - https://github.com/theturtle32/WebSocket-Node
//
// To read about how this sample works:  http://bit.ly/webrtc-from-chat
//
// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

import * as ws from "ws";
import * as http from "http";

// Output logging information to console
const printLog = (text) => {
  const time = new Date();

  console.log("[" + time.toLocaleTimeString + "] " + text);
};

// const webSocketServer = new ws.Server({ port: 6503 });
const serverInfo = { port: 6503, path: "0.0.0.0" };
const wsServer = new ws.WebSocketServer(
  { port: serverInfo.port, clientTracking: true, path: serverInfo.path },
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
    if ((name == connectionArray[i].username) === name) {
      isUnique = false;
      break;
    }
  }

  return isUnique;
}

// Sends a message (JSON) to a single user by the username
const sendToOneUser = (target, msgString) => {
  connectionSet.find((conn) => conn.username === target).send(msgString);
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
function makeUserList() {
  const userList = [];

  for (let i = 0; i < connectionArray.length; i++) {
    userList.push(connectionArray[i].username);
  }

  return userList;
}

// Sends a "userlist" message to all chat members. This is a cheesy way
// to ensure that every join/drop is reflected everywhere. It would be more
// efficient to send simple join/drop messages to each user, but this is
// good enough for this simple example.
function sendUserListToAll() {
  const userList = makeUserList();
  const userListMsg = JSON.stringify(userList);

  for (let i = 0; i < connectionArray.length; i++) {
    connectionArray[i].send(userListMsg);
  }
}

// Set up a "connect" message handler on our WebSocket server. This is
// called whenever a user connects to the server's port using the
// WebSocket protocol.
// wsServer.on("request", (request) => {
//   if (!originIsAllowed(request.origin)) {
//     request.reject();
//     printLog("Connection from " + request.origin + " rejected.");
//     return;
//   }

//   // Accept the request and get a connection
//   let connection = request.accept("json", request.origin);

//   // Add the new connection to our list of connections
//   printLog("Connection accepted from " + connection.remoteAddress + ".");
//   connectionArray.push(connection);

//   connection.clientID = nextID;
//   nextID++;

//   // Send the new client its token; it send back a "username" message to
//   // tell us what username they want to use.
//   let msg = {
//     type: "id",
//     id: connection.clientID,
//   };
//   connection.sendUTF(JSON.stringify(msg));

//   // Set up a handler for the "message" event received over WebSocket. This
//   // is a message sent by a client, and may be text to share with other
//   // users, a private message (text or signaling) for one user, or a command
//   // to the server.
//   connection.on("message", function (message) {
//     if (message.type === "utf8") {
//       printLog("Received Message: " + message.utf8Data);

//       // Process incoming data.
//       let sendToClients = true;
//       msg = JSON.parse(message.utf8Data);
//       let connect = getConnectionForID(msg.id);

//       // Take a look at the incoming object and act on it based
//       // on its type. Unknown message types are passed through,
//       // since they may be used to implement client-side features.
//       // Messages with a "target" property are sent only to a user
//       // by that name.
//       switch (msg.type) {
//         // Public, textual message
//         case "message":
//           msg.name = connect.username;
//           msg.text = msg.text.replace(/(<([^>]+)>)/gi, "");
//           break;

//         // Username change
//         case "username":
//           let nameChanged = false;
//           let origName = msg.name;

//           // Ensure the name is unique by appending a number to it
//           // if it's not; keep trying that until it works.
//           while (!isUsernameUnique(msg.name)) {
//             msg.name = origName + appendToMakeUnique;
//             appendToMakeUnique++;
//             nameChanged = true;
//           }

//           // If the name had to be changed, we send a "rejectusername"
//           // message back to the user so they know their name has been
//           // altered by the server.
//           if (nameChanged) {
//             let changeMsg = {
//               id: msg.id,
//               type: "rejectusername",
//               name: msg.name,
//             };
//             connect.sendUTF(JSON.stringify(changeMsg));
//           }

//           // Set this connection's final username and send out the
//           // updated user list to all users. Yeah, we're sending a full
//           // list instead of just updating. It's horribly inefficient
//           // but this is a demo. Don't do this in a real app.
//           connect.username = msg.name;
//           sendUserListToAll();
//           sendToClients = false;
//           break;
//       }

//       // Convert the revised message back to JSON and send it out
//       // to the specified client or all clients, as appropriate. We
//       // pass through any messages not specifically handled
//       // in the select block above. This allows the clients to
//       // exchange signaling and other control objects unimpeded.
//       if (sendToClients) {
//         let msgString = JSON.stringify(msg);

//         // If the message specifies a target username, only send the
//         // message to them. Otherwise, send it to every user.
//         if (msg.target && msg.target !== undefined && msg.target.length !== 0) {
//           sendToOneUser(msg.target, msgString);
//         } else {
//           for (let i = 0; i < connectionArray.length; i++) {
//             connectionArray[i].sendUTF(msgString);
//           }
//         }
//       }
//     }
//   });

//   // Handle the WebSocket "close" event; this means a user has logged off
//   // or has been disconnected.
//   connection.on("close", function (reason, description) {
//     // First, remove the connection from the list of connections.
//     connectionArray = connectionArray.filter(function (el, idx, ar) {
//       return el.connected;
//     });

//     // Now send the updated user list.
//     sendUserListToAll();

//     // Buildand and output log output for close information.
//     let logMessage =
//       "Connection closed: " + connection.remoteAddress + " (" + reason;
//     if (description !== null && description.length !== 0) {
//       logMessage += ": " + description;
//     }
//     logMessage += ")";
//     printLog(logMessage);
//   });
// });

wsServer.on("connection", (ws, request) => {
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
  ws.send(msg, JSON.stringify(msg));

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
