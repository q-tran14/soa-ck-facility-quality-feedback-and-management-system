const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const userSchema = new mongoose.Schema(
  {
    UserID: { type: String, default: uuidv4 },

    Name: { type: String, required: true },

    Email: { type: String, required: true, unique: true },

    HashPassword: { type: String, required: true },

    Phone: { type: String, required: true },

    Role: {
      type: String,
      enum: ["Citizen", "Manager", "Technician"],
      required: true,
    }
  },
  { versionKey: false, timestamps: true }
);

userSchema.statics.findByEmail = function (email) {
  return this.findOne({ Email: email });
};

module.exports = mongoose.model("User", userSchema);
