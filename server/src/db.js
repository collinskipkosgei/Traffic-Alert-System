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

let cachedConnectionPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (cachedConnectionPromise) {
    return cachedConnectionPromise;
  }

  const mongoUri = getMongoUri();

  console.log(
    "Connecting to:",
    mongoUri.replace(/\/\/(.*?):(.*?)@/, "//****:****@")
  );

  cachedConnectionPromise = mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  }).then((conn) => {
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB Error:", err.message);
    });
    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB Disconnected");
      cachedConnectionPromise = null;
    });
    return conn;
  }).catch((err) => {
    cachedConnectionPromise = null;
    console.error("❌ MongoDB Connection Failed");
    throw err;
  });

  return cachedConnectionPromise;
};

module.exports = { connectDB };