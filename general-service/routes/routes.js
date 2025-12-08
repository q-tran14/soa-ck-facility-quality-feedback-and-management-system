const express = require("express");
const otpController = require("../services/otp");
const notificationController = require("../services/notification");
const userService = require("../services/user");

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: OTP
 *     description: Gửi và xác thực mã OTP
 *   - name: Notification
 *     description: Gửi email thông báo
 *   - name: User
 *     description: Quản lý tài khoản User (Người báo cáo, Nhân viên tiếp nhận và điều phối xử lí, Nhân viên kỹ thuật tại hiện trường) và phân quyền cho từng người dùng
 *   - name: Media
 *     description: Quản lý upload, lấy và xóa file media (ảnh, video)
 */

/**
 * @openapi
 * /api/otp/send:
 *   post:
 *     tags: [OTP]
 *     summary: Gửi mã OTP qua email (theo action)
 *     description: "Gửi OTP cho một hành động cụ thể như đăng ký tài khoản hoặc đặt lại mật khẩu.\nCác hành động cần xác thực OTP: register, reset_password."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - action
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *               action:
 *                 type: string
 *                 description: "Mục đích OTP (vd: register, reset_password)"
 *                 example: "register"
 *     responses:
 *       200:
 *         description: "OTP đã được gửi đến email"
 */
router.post("/otp/send", otpController.SendOTP);

/**
 * @openapi
 * /api/otp/verify:
 *   post:
 *     tags: [OTP]
 *     summary: Xác thực mã OTP
 *     description: "Kiểm tra OTP theo email và action. OTP có hiệu lực 5 phút."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - action
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *               action:
 *                 type: string
 *                 description: "Mục đích OTP (vd: register, reset_password)"
 *                 example: "register"
 *               code:
 *                 type: string
 *                 description: "Mã OTP 6 chữ số"
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: "OTP hợp lệ"
 *       401:
 *         description: "OTP không đúng"
 *       410:
 *         description: "OTP đã hết hạn"
 *       404:
 *         description: "Không tìm thấy OTP cho email và action này"
 */
router.post("/otp/verify", otpController.VerifyOTP);

/**
 * @openapi
 * /api/email/send:
 *   post:
 *     tags: [Notification]
 *     summary: Gửi email thông báo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               to:
 *                 type: string
 *               subject:
 *                 type: string
 *               text:
 *                 type: string
 *               html:
 *                 type: string
 *     responses:
 *       200:
 *         description: Gửi email thành công
 */
router.post("/email/send", notificationController.SendEmail);


/**
 * @openapi
 * /api/users/register:
 *   post:
 *     tags: [User]
 *     summary: Đăng ký tài khoản người dùng
 *     description: "Đăng ký tài khoản với các vai trò: Reporter, Manager, Technician."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               phone: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               role: { type: string, enum: [Reporter, Manager, Technician] }
 *     responses:
 *       200:
 *         description: Đăng ký thành công
 */
router.post("/users/register", userService.Register);

/**
 * @openapi
 * /api/users/login:
 *   post:
 *     tags: [User]
 *     summary: Đăng nhập tài khoản khách hàng
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả về token
 */
router.post("/users/login", userService.Login);


/**
 * @openapi
 * /api/users/reset-password:
 *   post:
 *     tags: [User]
 *     summary: Đặt lại mật khẩu cho tài khoản khách hàng
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200:
 *         description: Cập nhật mật khẩu thành công
 */
router.post("/users/reset-password", userService.ResetPassword);

/**
 * @openapi
 * /api/users/email/{email}:
 *   get:
 *     tags: [User]
 *     summary: Lấy thông tin user theo email
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Thông tin user
 */
router.get("/users/email/:email", userService.GetUserByEmail);

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     tags: [User]
 *     summary: Lấy thông tin 1 user theo UserID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Trả về thông tin người dùng
 */
router.get("/users/:id", userService.GetUser);

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [User]
 *     summary: Lấy danh sách toàn bộ user
 *     responses:
 *       200:
 *         description: Danh sách người dùng
 */
router.get("/users", userService.GetAllUsers);

/**
 * @openapi
 * /api/users/role/{role}:
 *   get:
 *     tags: [User]
 *     summary: Lấy danh sách user theo role
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Reporter, Manager, Technician]
 *     responses:
 *       200:
 *         description: Danh sách người dùng theo role
 */
router.get("/users/role/:role", userService.GetUsersByRole);

/**
 * @openapi
 * /api/users/{id}/role:
 *   put:
 *     tags: [User]
 *     summary: Cập nhật role của người dùng
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newRole:
 *                 type: string
 *                 enum: [Reporter, Manager, Technician]
 *     responses:
 *       200:
 *         description: Cập nhật role thành công
 */
router.put("/users/:id/role", userService.UpdateRole);

module.exports = router;

// http://localhost:8000/api/users/