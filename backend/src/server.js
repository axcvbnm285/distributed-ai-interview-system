const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/routes");
const roomRoutes = require("./routes/room.routes");
const codeRoutes =require("./routes/code.routes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/code", codeRoutes);

// Create HTTP Server
const server = http.createServer(app);

// Socket Server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Store online users per room
const roomUsers = {};

// Socket Events
io.on("connection", (socket) => {

  console.log(
    "User Connected:",
    socket.id
  );

  // Join Room
  socket.on(
    "join-room",
    ({ roomCode, username }) => {

      socket.join(roomCode);

      socket.roomCode = roomCode;
      socket.username = username;

      // Create room entry if it doesn't exist
      if (!roomUsers[roomCode]) {
        roomUsers[roomCode] = [];
      }

      // Prevent duplicate users
      if (
        !roomUsers[roomCode].includes(username)
      ) {
        roomUsers[roomCode].push(username);
      }

      console.log(
        "Current Room Users:",
        roomUsers
      );

      io.to(roomCode).emit(
        "participants-update",
        roomUsers[roomCode]
      );

      console.log(
        `${username} joined room ${roomCode}`
      );

    }
  );

  // Send Chat Message
  socket.on(
    "send-message",
    (data) => {

      console.log(
        "Message:",
        data
      );

      io.to(data.roomCode).emit(
        "receive-message",
        data
      );

    }
  );

  socket.on(
  "code-change",
  (data) => {

    socket
      .to(data.roomCode)
      .emit(
        "code-update",
        data.code
      );

  }
);

socket.on(
  "question-change",
  (data) => {

    io.to(data.roomCode)
      .emit(
        "question-update",
        data.question
      );

  }
);

  // Disconnect
  socket.on("disconnect", () => {

    const roomCode =
      socket.roomCode;

    const username =
      socket.username;

    if (
      roomCode &&
      roomUsers[roomCode]
    ) {

      roomUsers[roomCode] =
        roomUsers[roomCode].filter(
          user =>
            user !== username
        );

      io.to(roomCode).emit(
        "participants-update",
        roomUsers[roomCode]
      );

      console.log(
        "Updated Users:",
        roomUsers
      );

    }

    console.log(
      "User Disconnected:",
      socket.id
    );

  });

});

// Routes
app.use("/auth", authRoutes);
app.use("/rooms", roomRoutes);

// Health Check
app.get("/", (req, res) => {
  res.send(
    "Interview Platform API Running"
  );
});

// Start Server
server.listen(3001, () => {
  console.log(
    "Server running on port 3001"
  );
});