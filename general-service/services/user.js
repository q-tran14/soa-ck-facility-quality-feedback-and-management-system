const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");

const userController = {
  // ====================== REGISTER ======================
  Register: asyncHandler(async (req, res) => {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({ message: "Thiếu thông tin" });
    }

    if (!["Reporter", "Manager", "Technician"].includes(role)) {
      return res.status(400).json({ message: "Role không hợp lệ" });
    }

    const existed = await User.findByEmail(email);
    if (existed) {
      return res.status(409).json({ message: "Email đã tồn tại" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      Name: name,
      Email: email,
      Phone: phone,
      Role: role,
      HashPassword: hashedPassword,
    });

    res.json({
      message: "Đăng kí thành công",
      user: {
        UserID: newUser.UserID,
        Name: newUser.Name,
        Email: newUser.Email,
        Role: newUser.Role,
        Phone: newUser.Phone,
      },
    });
  }),

  // ====================== LOGIN ======================
  Login: asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ message: "Email không tồn tại" });

    const match = await bcrypt.compare(password, user.HashPassword);
    if (!match) return res.status(401).json({ message: "Sai mật khẩu" });

    const token = jwt.sign(
      {
        id: user.UserID,
        role: user.Role,
        email: user.Email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "4h" }
    );

    res.json({
      message: "Đăng nhập thành công",
      token,
      user: {
        UserID: user.UserID,
        Name: user.Name,
        Email: user.Email,
        Phone: user.Phone,
        Role: user.Role,
      },
    });
  }),

  // ====================== RESET PASSWORD ======================
  ResetPassword: asyncHandler(async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword)
      return res.status(400).json({ message: "Thiếu thông tin" });

    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ message: "Email không tồn tại" });

    const hashed = await bcrypt.hash(newPassword, 10);

    await User.updateOne({ Email: email }, { HashPassword: hashed });

    res.json({ message: "Cập nhật mật khẩu thành công" });
  }),
  // =============================== LẤY 1 USER THEO ID ===============================
  GetUser: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

    user.HashPassword = undefined;

    res.json(user);
  }),
  // =============================== LẤY 1 USER THEO EMAIL ===============================
  GetUserByEmail: asyncHandler(async (req, res) => {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ Email: email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Fetched user by email",
      data: user,
    });
  }),
  // =============================== LẤY DANH SÁCH USER ===============================
  GetAllUsers: asyncHandler(async (req, res) => {
    const users = await User.getAllUsers();
    res.json(users);
  }),

  // =============================== LẤY DANH SÁCH USER THEO ROLE ===============================
  GetUsersByRole: asyncHandler(async (req, res) => {
    const { role } = req.params;

    if (!["Reporter", "Manager", "Technician"].includes(role))
      return res.status(400).json({ message: "Role không hợp lệ" });

    const users = await User.findByRole(role);
    res.json(users);
  }),

  // =============================== UPDATE ROLE USER ===============================
  UpdateRole: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { newRole } = req.body;

    if (!["Reporter", "Manager", "Technician"].includes(newRole))
      return res.status(400).json({ message: "Role không hợp lệ" });

    await User.updateRole(id, newRole);

    res.json({ message: "Cập nhật role thành công" });
  }),
};

module.exports = userController;
