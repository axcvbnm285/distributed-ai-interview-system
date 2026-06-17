const bcrypt = require("bcrypt");
const jwt    = require("jsonwebtoken");
const prisma = require("../lib/prisma");

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!["INTERVIEWER", "INTERVIEWEE"].includes(role)) {
      return res.status(400).json({ message: "Role must be INTERVIEWER or INTERVIEWEE" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user   = await prisma.user.create({
      data: { name, email, password: hashed, role },
    });

    res.status(201).json({ message: "Registered successfully", role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};
