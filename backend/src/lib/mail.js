const nodemailer = require("nodemailer");

function parseBoolean(value) {
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

function getMailConfig() {
  const service = process.env.SMTP_SERVICE;
  const host = process.env.SMTP_HOST;
  const parsedPort = Number.parseInt(process.env.SMTP_PORT || "587", 10);
  const port = Number.isFinite(parsedPort) ? parsedPort : 587;
  const secure = parseBoolean(process.env.SMTP_SECURE);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM || user;

  if ((!service && !host) || !user || !pass || !from) {
    return null;
  }

  return {
    service,
    host,
    port,
    secure,
    user,
    pass,
    from,
  };
}

let transporter;

function getTransporter() {
  const config = getMailConfig();
  if (!config) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: config.service || undefined,
      host: config.service ? undefined : config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  return transporter;
}

function isMailConfigured() {
  return Boolean(getMailConfig());
}

async function sendPasswordResetEmail({ to, name, resetLink, expiresInMinutes }) {
  const config = getMailConfig();
  const activeTransporter = getTransporter();

  if (!config || !activeTransporter) {
    const error = new Error("Password reset email service is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const subject = "Reset your InterviewFlow password";
  const greetingName = name || "there";

  await activeTransporter.sendMail({
    from: config.from,
    to,
    subject,
    text: [
      `Hi ${greetingName},`,
      "",
      "We received a request to reset your InterviewFlow password.",
      `Use this link within ${expiresInMinutes} minutes:`,
      resetLink,
      "",
      "If you did not request this, you can safely ignore this email.",
    ].join("\n"),
    html: [
      `<p>Hi ${greetingName},</p>`,
      "<p>We received a request to reset your InterviewFlow password.</p>",
      `<p><a href="${resetLink}">Reset your password</a></p>`,
      `<p>This link expires in ${expiresInMinutes} minutes.</p>`,
      "<p>If you did not request this, you can safely ignore this email.</p>",
    ].join(""),
  });
}

module.exports = {
  isMailConfigured,
  sendPasswordResetEmail,
};
