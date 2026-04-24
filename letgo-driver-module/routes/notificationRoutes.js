const express = require("express");
const router = express.Router();
const {
  createNotification,
  getUserNotifications,
  markNotificationRead,
  deleteNotification,
} = require("../controllers/notificationController");

router.post("/", createNotification);
router.get("/", getUserNotifications);
router.put("/:id/read", markNotificationRead);
router.delete("/:id", deleteNotification);

module.exports = router;
