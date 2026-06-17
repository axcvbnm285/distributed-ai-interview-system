const express = require("express");
const router = express.Router();
const { runCode, runTests } = require("../controllers/code.controller");

router.post("/run",       runCode);
router.post("/run-tests", runTests);

module.exports = router;
