const mongoose = require("mongoose");

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.warn(
      "[DB] MONGO_URI is not set — auth uses in-memory users only; they disappear after a server restart."
    );
    return;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");
  } catch (error) {
    console.error("DB Connection Error:", error.message);
    console.warn(
      "[DB] Running without MongoDB — accounts are in-memory only until the connection works."
    );
  }
};

module.exports = connectDB;
