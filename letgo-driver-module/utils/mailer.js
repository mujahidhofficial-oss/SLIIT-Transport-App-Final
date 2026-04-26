const path = require("path");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");

// Ensure SMTP_* is available even if this module loads before server.js runs dotenv.
dotenv.config({ path: path.join(__dirname, "..", ".env"), override: true });

function boolFromEnv(value, fallback = false) {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return fallback;
  return v === "1" || v === "true" || v === "yes";
}

function buildTransport() {
  const host = String(process.env.SMTP_HOST ?? "").trim();
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = boolFromEnv(process.env.SMTP_SECURE, false);
  const user = String(process.env.SMTP_USER ?? "").trim();
  const pass = String(process.env.SMTP_PASS ?? "").trim().replace(/\s+/g, "");

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    auth: { user, pass },
  });
}

async function sendMail({ to, subject, text, html }) {
  const transporter = buildTransport();
  if (!transporter) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in .env");
  }
  const from = String(process.env.MAIL_FROM ?? process.env.SMTP_USER ?? "").trim();
  if (!from) {
    throw new Error("MAIL_FROM is not configured.");
  }
  return transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

module.exports = {
  sendMail,
};
