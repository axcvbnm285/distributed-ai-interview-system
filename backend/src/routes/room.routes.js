const express = require("express");
const { authMiddleware, interviewerOnly } = require("../middleware/auth.middleware");
const {
  createRoom,
  getRoom,
  joinRoom,
  getParticipants,
  getInterviewHistory,
  deleteRoomHistory,
  getRoomNotes,
  updateRoomNotes,
  saveRoomQuestion,
} = require("../controllers/roomController");

const router = express.Router();

// Only INTERVIEWER can create a room
router.post("/",                    authMiddleware, interviewerOnly, createRoom);
router.get("/history",              authMiddleware, interviewerOnly, getInterviewHistory);
router.delete("/:roomCode",         authMiddleware, interviewerOnly, deleteRoomHistory);
router.get("/:roomCode",            authMiddleware, getRoom);
router.post("/:roomCode/join",      authMiddleware, joinRoom);
router.get("/:roomCode/participants", authMiddleware, getParticipants);
router.post("/:roomCode/questions", authMiddleware, interviewerOnly, saveRoomQuestion);
router.get("/:roomCode/notes",      authMiddleware, interviewerOnly, getRoomNotes);
router.put("/:roomCode/notes",      authMiddleware, interviewerOnly, updateRoomNotes);

module.exports = router;
