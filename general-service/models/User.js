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

userSchema.statics.findById = function (id) {
  return this.findOne({ UserID: id });
};

userSchema.statics.createUser = async function ({ name, email, phone, role, hashPassword }) {
  const user = new this({
    Name: name,
    Email: email,
    Phone: phone,
    Role: role,
    HashPassword: hashPassword,
  });

  await user.save();
  return user.UserID;
};

// Lấy danh sách user theo role
userSchema.statics.findByRole = function (role) {
  return this.find({ Role: role });
};

// Lấy tất cả user (ngoại trừ password)
userSchema.statics.getAllUsers = function () {
  return this.find({}, { HashPassword: 0 });
};

// Cập nhật password
userSchema.statics.updatePassword = function (email, hashPassword) {
  return this.updateOne({ Email: email }, { HashPassword: hashPassword });
};

// Cập nhật role
userSchema.statics.updateRole = function (id, newRole) {
  return this.updateOne({ UserID: id }, { Role: newRole });
};
module.exports = mongoose.model("User", userSchema);
