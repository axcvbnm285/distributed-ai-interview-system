const express = require("express");
const { authMiddleware, interviewerOnly } = require("../middleware/auth.middleware");
const { generateInterviewSummary } = require("../controllers/ai.controller");

const router = express.Router();

router.post("/summary", authMiddleware, interviewerOnly, generateInterviewSummary);

module.exports = router;
