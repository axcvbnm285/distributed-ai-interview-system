const prisma = require("../lib/prisma");

const { v4: uuidv4 } = require("uuid");

exports.createRoom = async (req, res) => {
  try {

    const interviewerId =req.user.userId;

    const room = await prisma.room.create({
      data: {
        roomCode: uuidv4().slice(0, 8),
        interviewerId,
      },
    });

    res.status(201).json(room);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Failed to create room",
    });

  }
};
exports.getRoom = async (req, res) => {

  try {

    const { roomCode } = req.params;

    const room = await prisma.room.findUnique({
      where: {
        roomCode
      }
    });

    if (!room) {
      return res.status(404).json({
        message: "Room not found"
      });
    }

    res.json(room);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Server Error"
    });

  }
};
exports.joinRoom = async (req, res) => {

  try {

    const { roomCode } = req.params;

    const userId = req.user.userId;

    const room = await prisma.room.findUnique({
      where: {
        roomCode
      }
    });

    if (!room) {
      return res.status(404).json({
        message: "Room not found"
      });
    }

    const existingParticipant =
      await prisma.participant.findFirst({
        where: {
          roomId: room.id,
          userId: userId
        }
      });

    if (existingParticipant) {
      return res.status(400).json({
        message: "Already joined"
      });
    }

    const participant =
      await prisma.participant.create({
        data: {
          roomId: room.id,
          userId: userId
        }
      });

    res.status(201).json({
      message: "Joined room",
      participant
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Server Error"
    });

  }

};

exports.getParticipants = async (req, res) => {
  try {

    const { roomCode } = req.params;

    const room = await prisma.room.findUnique({
      where: {
        roomCode
      },
      include: {
        participants: {
          include: {
            user: true
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({
        message: "Room not found"
      });
    }

    res.json(room.participants);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Server Error"
    });

  }
};