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
  questionsAsked: {
    orderBy: { askedAt: "desc" },
  },
};

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeQuestionSource(value) {
  const source = normalizeText(value).toUpperCase();
  return ["AI", "BUILTIN", "MANUAL"].includes(source) ? source : "MANUAL";
}

function normalizeQuestionPayload(value) {
  const testCases = Array.isArray(value?.testCases)
    ? value.testCases
        .map((testCase) => ({
          input: typeof testCase?.input === "string" ? testCase.input : "",
          expected: typeof testCase?.expected === "string" ? testCase.expected : "",
        }))
        .filter((testCase) => testCase.input.trim() || testCase.expected.trim())
    : [];

  return {
    title: normalizeText(value?.title),
    difficulty: normalizeText(value?.difficulty) || "Easy",
    description: typeof value?.description === "string" ? value.description.trim() : "",
    starterCode: typeof value?.starterCode === "string" ? value.starterCode : "",
    testCases,
  };
}

function mapRoomQuestion(question) {
  return {
    id: question.id,
    title: question.title,
    difficulty: question.difficulty,
    description: question.description,
    starterCode: question.starterCode || "",
    testCases: Array.isArray(question.testCases) ? question.testCases : [],
    source: question.source || "MANUAL",
    askedAt: question.askedAt,
  };
}

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
    aiSummary: room.aiSummary || "",
    latestAiReview: room.latestAiReview || "",
    latestHint: room.latestHint || "",
    hintCount: room.hintCount || 0,
    questionsAsked: Array.isArray(room.questionsAsked) ? room.questionsAsked.map(mapRoomQuestion) : [],
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
      include: {
        interviewer: { select: { id: true, name: true, role: true } },
        questionsAsked: {
          orderBy: { askedAt: "desc" },
          take: 1,
        },
      },
    });
    if (!room) return res.status(404).json({ message: "Room not found" });

    const response = {
      id: room.id,
      roomCode: room.roomCode,
      interviewerId: room.interviewerId,
      status: room.status,
      createdAt: room.createdAt,
      interviewer: room.interviewer,
      latestQuestion: room.questionsAsked[0] ? mapRoomQuestion(room.questionsAsked[0]) : null,
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

// DELETE /rooms/:roomCode — INTERVIEWER only
exports.deleteRoomHistory = async (req, res) => {
  try {
    const room = await getOwnedRoom(req.params.roomCode, req.user.userId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    await prisma.$transaction([
      prisma.roomQuestion.deleteMany({
        where: { roomId: room.id },
      }),
      prisma.message.deleteMany({
        where: { roomId: room.id },
      }),
      prisma.participant.deleteMany({
        where: { roomId: room.id },
      }),
      prisma.room.delete({
        where: { id: room.id },
      }),
    ]);

    res.json({
      message: "Interview history deleted successfully",
      roomCode: room.roomCode,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete interview history" });
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

// POST /rooms/:roomCode/questions — INTERVIEWER only
exports.saveRoomQuestion = async (req, res) => {
  try {
    const room = await getOwnedRoom(req.params.roomCode, req.user.userId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    const question = normalizeQuestionPayload(req.body?.question);
    if (!question.title) {
      return res.status(400).json({ message: "question.title is required." });
    }

    if (!question.description) {
      return res.status(400).json({ message: "question.description is required." });
    }

    const savedQuestion = await prisma.roomQuestion.create({
      data: {
        roomId: room.id,
        title: question.title,
        difficulty: question.difficulty,
        description: question.description,
        starterCode: question.starterCode,
        testCases: question.testCases,
        source: normalizeQuestionSource(req.body?.source),
      },
    });

    res.status(201).json({ question: mapRoomQuestion(savedQuestion) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save asked question" });
  }
};
