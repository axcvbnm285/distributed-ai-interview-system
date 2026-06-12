const express = require("express");
const authMiddleware =
require("../middleware/auth.middleware");

const {
  createRoom,
  getRoom,
  joinRoom,
  getParticipants
} = require("../controllers/roomController");

const router = express.Router();

router.post("/",authMiddleware, createRoom);
router.get("/:roomCode", authMiddleware, getRoom);
router.post(
  "/:roomCode/join",
  authMiddleware,
  joinRoom
);
router.get(
  "/:roomCode/participants",
  authMiddleware,
  getParticipants
);

module.exports = router;