//1.import http package for create server
const http  = require('http');
//2.import socket.io
const {Server} = require('socket.io');

// #region OldCode 
const express = require('express');
const { connect } = require('http2');
const app = express()
const port  =  3000;
app.use(express.json());
// #endregion 


//3. create server instance
const server = http.createServer(app)
//4. convert this server to socket.io server
const io = new Server(server, { cors: {
    origin: "*", // You can restrict this in production
  },})


//5. Establish  socket connection
io.on("connection",(socket)=>{
    console.log("Client Connected: ", socket.id);
    //get the event continuously by its name
    socket.on("locationUpdate", (data)=>{
        //get the data from event locationUpdate
        console.log("Location Update: ",data)
    })
    //in case client is disconnect
    socket.on("disconnect", () => {
        console.log("❌ Client disconnected:", socket.id);
      });

})


// Start server
server.listen(port, () => {
    console.log(`Server is running with Socket.IO on port ${port}`);
  });
