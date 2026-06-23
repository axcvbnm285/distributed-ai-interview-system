const bcrypt = require("bcrypt");
const jwt    = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("../lib/prisma");
const { isMailConfigured, sendPasswordResetEmail } = require("../lib/mail");

const parsedBcryptRounds = Number.parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
const BCRYPT_ROUNDS = Number.isFinite(parsedBcryptRounds) ? parsedBcryptRounds : 12;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";
const parsedResetTtlMinutes = Number.parseInt(process.env.PASSWORD_RESET_TTL_MINUTES || "60", 10);
const PASSWORD_RESET_TTL_MINUTES = Number.isFinite(parsedResetTtlMinutes) ? parsedResetTtlMinutes : 60;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const PASSWORD_RULE_MESSAGE = "Password must be at least 8 characters and include uppercase, lowercase, and a number.";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeName(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeRole(value) {
  return normalizeText(value).toUpperCase();
}

function isValidEmail(email) {
  return EMAIL_REGEX.test(email);
}

function isStrongPassword(password) {
  return PASSWORD_REGEX.test(password);
}

function buildFrontendUrl() {
  return normalizeText(process.env.FRONTEND_URL) || "http://localhost:5173";
}

function ensureJwtSecret() {
  if (!process.env.JWT_SECRET) {
    const error = new Error("JWT_SECRET is not configured.");
    error.statusCode = 500;
    throw error;
  }
}

function createAuthToken(user) {
  ensureJwtSecret();

  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, algorithm: "HS256" }
  );
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

exports.register = async (req, res) => {
  try {
    const name = normalizeName(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const role = normalizeRole(req.body?.role);

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ message: "Name must be between 2 and 80 characters." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: PASSWORD_RULE_MESSAGE });
    }

    if (!["INTERVIEWER", "INTERVIEWEE"].includes(role)) {
      return res.status(400).json({ message: "Role must be INTERVIEWER or INTERVIEWEE" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
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
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!isValidEmail(email) || !password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = createAuthToken(user);

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.forgotPassword = async (req, res) => {
  const successMessage = "If an account exists for that email, a password reset link has been sent.";

  try {
    if (!isMailConfigured()) {
      return res.status(503).json({ message: "Password reset email service is not configured." });
    }

    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return res.json({ message: successMessage });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const resetLink = `${buildFrontendUrl()}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetLink,
        expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
      });
    } catch (error) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
        },
      });
      throw error;
    }

    res.json({ message: successMessage });
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({
      message: err.statusCode ? err.message : "Failed to process forgot password request.",
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const token = normalizeText(req.body?.token);
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!token) {
      return res.status(400).json({ message: "Reset token is required." });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: PASSWORD_RULE_MESSAGE });
    }

    const tokenHash = hashResetToken(token);

    const user = await prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Reset link is invalid or has expired." });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });

    res.json({ message: "Password reset successful. Please sign in." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to reset password." });
  }
};
