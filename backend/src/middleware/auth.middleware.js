const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "Token missing" });

    const token   = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role }
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Only allow INTERVIEWER role
const interviewerOnly = (req, res, next) => {
  if (req.user?.role !== "INTERVIEWER") {
    return res.status(403).json({ message: "Only interviewers can perform this action" });
  }
  next();
};

module.exports = { authMiddleware, interviewerOnly };
