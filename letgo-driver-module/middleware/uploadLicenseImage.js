const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `license-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedExt = [".jpg", ".jpeg", ".png", ".webp"];
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk =
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/webp";
  if (allowedExt.includes(ext) && mimeOk) return cb(null, true);
  cb(new Error("Only JPG, PNG, or WEBP images are allowed for license verification"));
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 12 * 1024 * 1024 },
});
