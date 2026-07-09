const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const getMongoUri = () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing from .env");
  }

  if (
    uri.includes("<db_password>") ||
    uri.includes("YOUR_PASSWORD") ||
    uri.includes("YOUR_ACTUAL_PASSWORD")
  ) {
    throw new Error("Replace <db_password> with your real MongoDB Atlas password.");
  }

  return uri.trim();
};

const connectDB = async () => {
  try {
    const mongoUri = getMongoUri();

    console.log(
      "Connecting to:",
      mongoUri.replace(/\/\/(.*?):(.*?)@/, "//****:****@")
    );

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB Error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB Disconnected");
    });

    return conn;
  } catch (err) {
    console.error("❌ MongoDB Connection Failed");
    console.error(err);
    process.exit(1);
  }
};

module.exports = { connectDB };