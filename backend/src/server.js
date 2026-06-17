require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/routes");
const roomRoutes = require("./routes/room.routes");
const codeRoutes =require("./routes/code.routes");
const aiRoutes = require("./routes/ai.routes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/code", codeRoutes);
app.use("/ai", aiRoutes);

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

// roomMeta tracks who the interviewer is per room (from DB via JWT role)
// roomMeta[roomCode] = { interviewer: { socketId, name }, interviewee: { socketId, name } }
const roomMeta = {};

function emitToRoomRole(io, roomCode, roleKey, eventName, payload) {
  const targetSocketId = roomMeta[roomCode]?.[roleKey]?.socketId;
  if (targetSocketId) {
    io.to(targetSocketId).emit(eventName, payload);
    return true;
  }
  return false;
}

// Socket Events
io.on("connection", (socket) => {

  console.log(
    "User Connected:",
    socket.id
  );

  // Join Room
  socket.on(
    "join-room",
    ({ roomCode, username, userId, role }) => {

      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.username = username;
      socket.role     = role; // "INTERVIEWER" | "INTERVIEWEE" from JWT

      // Track room metadata
      if (!roomMeta[roomCode]) {
        roomMeta[roomCode] = { interviewer: null, interviewee: null };
      }

      if (role === "INTERVIEWER") {
        roomMeta[roomCode].interviewer = { socketId: socket.id, name: username };
      } else {
        roomMeta[roomCode].interviewee = { socketId: socket.id, name: username };
      }

      // Emit role back to this socket only
      socket.emit("role-assigned", { role });

      console.log(`${username} joined room ${roomCode} as ${role}`);

      // Participants list
      if (!roomUsers[roomCode]) roomUsers[roomCode] = [];
      if (!roomUsers[roomCode].includes(username)) {
        roomUsers[roomCode].push(username);
      }

      io.to(roomCode).emit("participants-update", roomUsers[roomCode]);
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

  // ── WebRTC Signaling ──

  socket.on("webrtc-join", ({ roomCode }) => {
    socket.to(roomCode).emit("webrtc-user-joined", { socketId: socket.id });
  });

  socket.on("webrtc-offer", ({ to, offer }) => {
    io.to(to).emit("webrtc-offer", { from: socket.id, offer });
  });

  socket.on("webrtc-answer", ({ to, answer }) => {
    io.to(to).emit("webrtc-answer", { from: socket.id, answer });
  });

  socket.on("webrtc-ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("webrtc-ice-candidate", { from: socket.id, candidate });
  });

  socket.on("webrtc-leave", ({ roomCode }) => {
    socket.to(roomCode).emit("webrtc-user-left", { socketId: socket.id });
  });

  // ── Screen Share Signaling ──

  // Interviewer requests interviewee to share screen
  socket.on("screenshare-request", ({ roomCode }) => {
    if (socket.role !== "INTERVIEWER") return;

    const delivered = emitToRoomRole(io, roomCode, "interviewee", "screenshare-request", { from: socket.id });
    if (!delivered) {
      socket.to(roomCode).emit("screenshare-request", { from: socket.id });
    }
    console.log(`[screenshare] request from ${socket.username} in ${roomCode}`);
  });

  // Interviewee accepted — notify interviewer
  socket.on("screenshare-accepted", ({ roomCode }) => {
    if (socket.role !== "INTERVIEWEE") return;

    const delivered = emitToRoomRole(io, roomCode, "interviewer", "screenshare-accepted", { from: socket.id });
    if (!delivered) {
      socket.to(roomCode).emit("screenshare-accepted", { from: socket.id });
    }
  });

  // Interviewee declined — notify interviewer
  socket.on("screenshare-declined", ({ roomCode }) => {
    if (socket.role !== "INTERVIEWEE") return;

    const delivered = emitToRoomRole(io, roomCode, "interviewer", "screenshare-declined", { from: socket.id });
    if (!delivered) {
      socket.to(roomCode).emit("screenshare-declined", { from: socket.id });
    }
  });

  // Screen share stopped (either side)
  socket.on("screenshare-stopped", ({ roomCode }) => {
    const targetRole = socket.role === "INTERVIEWER" ? "interviewee" : "interviewer";
    const delivered = emitToRoomRole(io, roomCode, targetRole, "screenshare-stopped", { from: socket.id });
    if (!delivered) {
      socket.to(roomCode).emit("screenshare-stopped", { from: socket.id });
    }
  });

  // Disconnect
  socket.on("disconnect", () => {

    const roomCode = socket.roomCode;
    const username = socket.username;

    if (roomCode && roomUsers[roomCode]) {
      roomUsers[roomCode] = roomUsers[roomCode].filter(u => u !== username);
      io.to(roomCode).emit("participants-update", roomUsers[roomCode]);
    }

    // Clean up roomMeta when everyone leaves
    if (roomCode && roomMeta[roomCode]) {
      const meta = roomMeta[roomCode];
      if (meta.interviewer?.name === username) meta.interviewer = null;
      if (meta.interviewee?.name === username) meta.interviewee = null;
      // Remove room entirely when empty
      if (!meta.interviewer && !meta.interviewee) {
        delete roomMeta[roomCode];
        delete roomUsers[roomCode];
      }
    }

    console.log("User Disconnected:", socket.id);

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
const PORT = Number(process.env.PORT) || 3001;

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the existing process or run with PORT=${PORT + 1}.`);
    return process.exit(1);
  }

  throw error;
});

server.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});
