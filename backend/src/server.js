const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/routes");
const roomRoutes = require("./routes/room.routes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Create HTTP Server
const server = http.createServer(app);

// Create Socket.io Server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket Events
io.on("connection", (socket) => {

  console.log(
    "User Connected:",
    socket.id
  );

  socket.on(
    "join-room",
    (roomCode) => {

      socket.join(roomCode);

      console.log(
        `${socket.id} joined room ${roomCode}`
      );

    }
  );

  socket.on(
    "send-message",
    (data) => {

      console.log(data);

      io.to(data.roomCode)
        .emit(
          "receive-message",
          data
        );

    }
  );

  socket.on("disconnect", () => {

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
  res.send("Interview Platform API Running");
});

// Start Server
server.listen(3001, () => {
  console.log("Server running on port 3001");
});