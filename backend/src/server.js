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

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOrigin(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";

  try {
    return new URL(normalized).origin;
  } catch {
    return normalized.replace(/\/+$/, "");
  }
}

function getAllowedOrigins() {
  const localOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
  ];

  const configuredOrigins = [
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_URL,
  ]
    .flatMap((value) => normalizeText(value).split(","))
    .map(normalizeOrigin)
    .filter(Boolean);

  return new Set([...localOrigins, ...configuredOrigins]);
}

const allowedOrigins = getAllowedOrigins();
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(normalizeOrigin(origin))) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use("/code", codeRoutes);
app.use("/ai", aiRoutes);

// Create HTTP Server
const server = http.createServer(app);

// Socket Server
const io = new Server(server, {
  cors: corsOptions,
});

// Store online users per room
const roomUsers = {};
const roomState = {};
const DEFAULT_WAITING_CODE = "# Waiting for the interviewer to load a question...\n";
const MAX_ROOM_MESSAGES = 100;

// roomMeta tracks who the interviewer is per room (from DB via JWT role)
// roomMeta[roomCode] = { interviewer: { socketId, name }, interviewee: { socketId, name } }
const roomMeta = {};

function ensureRoomState(roomCode) {
  if (!roomState[roomCode]) {
    roomState[roomCode] = {
      currentQuestion: null,
      currentCode: DEFAULT_WAITING_CODE,
      messages: [],
    };
  }

  return roomState[roomCode];
}

function createMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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
      const normalizedRoomCode = normalizeText(roomCode);
      const normalizedUsername = normalizeText(username) || "Anonymous";

      if (!normalizedRoomCode) return;

      socket.join(normalizedRoomCode);
      socket.roomCode = normalizedRoomCode;
      socket.username = normalizedUsername;
      socket.role     = role; // "INTERVIEWER" | "INTERVIEWEE" from JWT
      socket.userId   = userId;

      // Track room metadata
      if (!roomMeta[normalizedRoomCode]) {
        roomMeta[normalizedRoomCode] = { interviewer: null, interviewee: null };
      }

      if (role === "INTERVIEWER") {
        roomMeta[normalizedRoomCode].interviewer = { socketId: socket.id, name: normalizedUsername };
      } else {
        roomMeta[normalizedRoomCode].interviewee = { socketId: socket.id, name: normalizedUsername };
      }

      // Emit role back to this socket only
      socket.emit("role-assigned", { role });

      const state = ensureRoomState(normalizedRoomCode);
      socket.emit("room-state", {
        question: state.currentQuestion,
        code: state.currentCode,
        messages: state.messages,
      });

      console.log(`${normalizedUsername} joined room ${normalizedRoomCode} as ${role}`);

      // Participants list
      if (!roomUsers[normalizedRoomCode]) roomUsers[normalizedRoomCode] = [];
      if (!roomUsers[normalizedRoomCode].includes(normalizedUsername)) {
        roomUsers[normalizedRoomCode].push(normalizedUsername);
      }

      io.to(normalizedRoomCode).emit("participants-update", roomUsers[normalizedRoomCode]);
    }
  );

  // Send Chat Message
  socket.on(
    "send-message",
    ({ roomCode, sender, senderId, message, id, createdAt }) => {
      const normalizedRoomCode = normalizeText(roomCode) || socket.roomCode;
      const normalizedMessage = normalizeText(message);

      if (!normalizedRoomCode || !normalizedMessage) return;

      const nextMessage = {
        id: normalizeText(id) || createMessageId(),
        roomCode: normalizedRoomCode,
        sender: normalizeText(sender) || socket.username || "Anonymous",
        senderId: senderId ?? socket.userId ?? null,
        message: normalizedMessage,
        createdAt: normalizeText(createdAt) || new Date().toISOString(),
      };

      const state = ensureRoomState(normalizedRoomCode);
      state.messages = [...state.messages, nextMessage].slice(-MAX_ROOM_MESSAGES);

      console.log(
        "Message:",
        nextMessage
      );

      io.to(normalizedRoomCode).emit(
        "receive-message",
        nextMessage
      );

    }
  );

  socket.on(
  "code-change",
  (data) => {
    const normalizedRoomCode = normalizeText(data?.roomCode) || socket.roomCode;
    if (!normalizedRoomCode) return;

    const state = ensureRoomState(normalizedRoomCode);
    state.currentCode = typeof data?.code === "string" ? data.code : "";

    socket
      .to(normalizedRoomCode)
      .emit(
        "code-update",
        state.currentCode
      );

  }
);

socket.on(
  "question-change",
  (data) => {
    const normalizedRoomCode = normalizeText(data?.roomCode) || socket.roomCode;
    if (!normalizedRoomCode) return;

    const state = ensureRoomState(normalizedRoomCode);
    state.currentQuestion = data.question;
    state.currentCode = typeof data?.question?.starterCode === "string" && data.question.starterCode
      ? data.question.starterCode
      : DEFAULT_WAITING_CODE;

    io.to(normalizedRoomCode)
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
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

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
