const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error("MONGO_URI is not defined in .env");
    }

    const certPath = process.env.MONGO_X509_KEY_PATH;
    if (!certPath) {
      throw new Error("MONGO_X509_KEY_PATH is not defined in .env");
    }

    const absPath = path.resolve(certPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`X.509 cert file not found at: ${absPath}`);
    }

    const conn = await mongoose.connect(uri, {
      tls: true,
      tlsCertificateKeyFile: absPath,
    });

    console.log(
      "======= Task-Management-Service: MongoDB connected =======",
      conn.connection.host
    );
  } catch (error) {
    console.error("Task-Management-Service: MongoDB connection error:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
