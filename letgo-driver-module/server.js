const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");
const { warmupLicenseOcrWorker } = require("./utils/licenseOcr");

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT"]
  }
});

app.set("io", io);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/trips", require("./routes/tripRoutes"));
app.use("/api/bookings", require("./routes/bookingRoutes"));
app.use("/api/drivers", require("./routes/driverRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/ride-requests", require("./routes/rideRequestRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/inquiries", require("./routes/inquiryRoutes"));
app.use("/api/feedback", require("./routes/feedbackRoutes"));

app.get("/", (req, res) => {
  res.send("Let Go Driver Module API Running");
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  const skipOcr = ["1", "true", "yes"].includes(
    String(process.env.SKIP_LICENSE_OCR ?? "").trim().toLowerCase()
  );
  if (!skipOcr) void warmupLicenseOcrWorker();
});
