const { io } = require("socket.io-client");

const socket = io("http://localhost:3001");

socket.on("connect", () => {

  console.log(
    "Connected:",
    socket.id
  );

  socket.emit(
    "join-room",
    "0802a37a"
  );

  socket.emit(
    "send-message",
    {
      roomCode: "0802a37a",
      sender: "Abhinav",
      message: "Hello World"
    }
  );

});

socket.on(
  "receive-message",
  (data) => {

    console.log(
      "Received:",
      data
    );

  }
);