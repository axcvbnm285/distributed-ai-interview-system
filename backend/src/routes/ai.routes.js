const express = require("express");
const { authMiddleware, interviewerOnly } = require("../middleware/auth.middleware");
const {
  generateInterviewSummary,
  generateQuestion,
  reviewCode,
  generateHint,
} = require("../controllers/ai.controller");

const router = express.Router();

router.post("/summary", authMiddleware, interviewerOnly, generateInterviewSummary);
router.post("/generate-question", authMiddleware, interviewerOnly, generateQuestion);
router.post("/review-code", authMiddleware, reviewCode);
router.post("/hint", authMiddleware, generateHint);

module.exports = router;
