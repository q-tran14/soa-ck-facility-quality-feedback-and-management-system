const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;

async function connectDB() {
  try {
    const keyPath = process.env.MONGO_X509_KEY_PATH;

    let options = {};

    if (keyPath) {
      // Hỗ trợ cả path tuyệt đối (Render) lẫn path tương đối (local)
      const certPath = path.isAbsolute(keyPath)
        ? keyPath
        : path.resolve(__dirname, "..", keyPath);

      if (!fs.existsSync(certPath)) {
        throw new Error(`X.509 cert file not found at: ${certPath}`);
      }

      options = {
        ssl: true,
        tlsCertificateKeyFile: certPath,
        authMechanism: "MONGODB-X509",
      };
    }

    await mongoose.connect(MONGO_URI, options);
    console.log(
      "======= Task-Management-Service: MongoDB connected =======",
      mongoose.connection.host
    );
  } catch (err) {
    console.error(
      "Task-Management-Service: MongoDB connection error:",
      err
    );
  }
}

module.exports = connectDB;
