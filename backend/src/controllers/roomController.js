const prisma = require("../lib/prisma");
const { v4: uuidv4 } = require("uuid");

const ROOM_HISTORY_INCLUDE = {
  participants: {
    orderBy: { joinedAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  },
};

function mapRoomHistory(room) {
  const interviewees = room.participants
    .filter((participant) => participant.user.role === "INTERVIEWEE")
    .map((participant) => ({
      id: participant.user.id,
      name: participant.user.name,
      email: participant.user.email,
      role: participant.user.role,
      joinedAt: participant.joinedAt,
    }));

  return {
    id: room.id,
    roomCode: room.roomCode,
    status: room.status,
    createdAt: room.createdAt,
    notes: room.notes || "",
    interviewees,
  };
}

async function getOwnedRoom(roomCode, interviewerId, include = {}) {
  return prisma.room.findFirst({
    where: { roomCode, interviewerId },
    include,
  });
}

// POST /rooms — INTERVIEWER only
exports.createRoom = async (req, res) => {
  try {
    const interviewerId = req.user.userId;
    const room = await prisma.room.create({
      data: { roomCode: uuidv4().slice(0, 8), interviewerId },
    });
    res.status(201).json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create room" });
  }
};

// GET /rooms/:roomCode
exports.getRoom = async (req, res) => {
  try {
    const room = await prisma.room.findUnique({
      where: { roomCode: req.params.roomCode },
      include: { interviewer: { select: { id: true, name: true, role: true } } },
    });
    if (!room) return res.status(404).json({ message: "Room not found" });

    const response = {
      id: room.id,
      roomCode: room.roomCode,
      interviewerId: room.interviewerId,
      status: room.status,
      createdAt: room.createdAt,
      interviewer: room.interviewer,
    };

    if (room.interviewerId === req.user.userId) {
      response.notes = room.notes || "";
    }

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// POST /rooms/:roomCode/join — any authenticated user
exports.joinRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const userId = req.user.userId;

    const room = await prisma.room.findUnique({ where: { roomCode } });
    if (!room) return res.status(404).json({ message: "Room not found" });

    const existing = await prisma.participant.findFirst({
      where: { roomId: room.id, userId },
    });
    if (existing) return res.json({ message: "Already in room" });

    const participant = await prisma.participant.create({
      data: { roomId: room.id, userId },
    });

    res.status(201).json({ message: "Joined room", participant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// GET /rooms/:roomCode/participants
exports.getParticipants = async (req, res) => {
  try {
    const room = await prisma.room.findUnique({
      where: { roomCode: req.params.roomCode },
      include: { participants: { include: { user: { select: { id: true, name: true, role: true } } } } },
    });
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room.participants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// GET /rooms/history — INTERVIEWER only
exports.getInterviewHistory = async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      where: { interviewerId: req.user.userId },
      include: ROOM_HISTORY_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    res.json(rooms.map(mapRoomHistory));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load interview history" });
  }
};

// GET /rooms/:roomCode/notes — INTERVIEWER only
exports.getRoomNotes = async (req, res) => {
  try {
    const room = await getOwnedRoom(req.params.roomCode, req.user.userId, ROOM_HISTORY_INCLUDE);
    if (!room) return res.status(404).json({ message: "Room not found" });

    res.json(mapRoomHistory(room));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load room notes" });
  }
};

// PUT /rooms/:roomCode/notes — INTERVIEWER only
exports.updateRoomNotes = async (req, res) => {
  try {
    const room = await getOwnedRoom(req.params.roomCode, req.user.userId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    const notes = typeof req.body.notes === "string" ? req.body.notes : "";

    const updatedRoom = await prisma.room.update({
      where: { id: room.id },
      data: { notes },
      select: {
        roomCode: true,
        notes: true,
      },
    });

    res.json(updatedRoom);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save room notes" });
  }
};
