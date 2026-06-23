const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const authMiddleware = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "JWT_SECRET is not configured" });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    const token = authHeader.slice(7).trim();
    if (!token) return res.status(401).json({ message: "Authorization token missing" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    if (!decoded?.userId || !decoded?.role) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true },
    });

    if (!user || user.role !== decoded.role) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = { userId: user.id, role: user.role };
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
