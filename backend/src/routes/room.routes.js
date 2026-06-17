const express = require("express");
const { authMiddleware, interviewerOnly } = require("../middleware/auth.middleware");
const {
  createRoom,
  getRoom,
  joinRoom,
  getParticipants,
  getInterviewHistory,
  getRoomNotes,
  updateRoomNotes,
} = require("../controllers/roomController");

const router = express.Router();

// Only INTERVIEWER can create a room
router.post("/",                    authMiddleware, interviewerOnly, createRoom);
router.get("/history",              authMiddleware, interviewerOnly, getInterviewHistory);
router.get("/:roomCode",            authMiddleware, getRoom);
router.post("/:roomCode/join",      authMiddleware, joinRoom);
router.get("/:roomCode/participants", authMiddleware, getParticipants);
router.get("/:roomCode/notes",      authMiddleware, interviewerOnly, getRoomNotes);
router.put("/:roomCode/notes",      authMiddleware, interviewerOnly, updateRoomNotes);

module.exports = router;
