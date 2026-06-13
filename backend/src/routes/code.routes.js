const express =
require("express");

const router =
express.Router();

const {
  runCode
} =
require(
  "../controllers/code.controller"
);

router.post(
  "/run",
  runCode
);

module.exports = router;