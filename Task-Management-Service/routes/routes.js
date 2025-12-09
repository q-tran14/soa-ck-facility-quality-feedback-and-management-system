// Task-Management-Service/routes/routes.js
const express = require("express");
const taskService = require("../services/task");

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Task
 *     description: Quản lý Task xử lí Report (giao việc, cập nhật trạng thái)
 */

/**
 * @openapi
 * /api/tasks:
 *   post:
 *     tags: [Task]
 *     summary: Tạo task mới
 *     description: >
 *       Tạo một task mới dựa trên báo cáo (report).
 *       reportId nhận từ Report Service (vd: RP-U01-01).
 *       taskCode sẽ được service tự sinh (T0001, T0002, ...).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - reportId
 *               - managerId
 *             properties:
 *               reportId:
 *                 type: string
 *                 description: ID của report (RP-UserId-xx)
 *               managerId:
 *                 type: string
 *                 description: ID Manager tạo task
 *               technicianId:
 *                 type: string
 *                 description: ID Technician được giao xử lí
 *               title:
 *                 type: string
 *               deadline:
 *                 type: string
 *                 format: date-time
 *             example:
 *               reportId: "RP-U01-01"
 *               managerId: "manager-001"
 *               technicianId: "tech-001"
 *               title: "Sửa bóng đèn hành lang"
 *               deadline: "2025-12-10T17:00:00Z"
 *     responses:
 *       201:
 *         description: Tạo task thành công
 */
router.post("/tasks", taskService.CreateTask);

/**
 * @openapi
 * /api/tasks:
 *   get:
 *     tags: [Task]
 *     summary: Lấy danh sách task
 *     description: Lọc theo trạng thái, technician, manager, report.
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Trạng thái task (PENDING, PROCESSING, ...)
 *       - in: query
 *         name: technicianId
 *         schema:
 *           type: string
 *         description: ID technician được giao
 *       - in: query
 *         name: managerId
 *         schema:
 *           type: string
 *         description: ID manager tạo task
 *       - in: query
 *         name: reportId
 *         schema:
 *           type: string
 *         description: ID report
 *     responses:
 *       200:
 *         description: Danh sách task
 */
router.get("/tasks", taskService.GetTasks);

/**
 * @openapi
 * /api/tasks/{taskCode}:
 *   get:
 *     tags: [Task]
 *     summary: Lấy chi tiết 1 task
 *     parameters:
 *       - in: path
 *         name: taskCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Mã task (T0001, T0002, ...)
 *     responses:
 *       200:
 *         description: Chi tiết task
 *       404:
 *         description: Không tìm thấy task
 */
router.get("/tasks/:taskCode", taskService.GetTaskById);

/**
 * @openapi
 * /api/tasks/{taskCode}:
 *   put:
 *     tags: [Task]
 *     summary: Cập nhật thông tin task (tiêu đề/mô tả/kỹ thuật viên/deadline)
 *     parameters:
 *       - in: path
 *         name: taskCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Mã task (T0001, ...)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               technicianId:
 *                 type: string
 *                 description: ID technician mới
 *               deadline:
 *                 type: string
 *                 format: date-time
 *             example:
 *               title: "Cập nhật mô tả nhiệm vụ"
 *               technicianId: "tech-002"
 *               deadline: "2025-12-11T10:00:00Z"
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy task
 */
router.put("/tasks/:taskCode", taskService.UpdateTask);

/**
 * @openapi
 * /api/tasks/{taskCode}/status:
 *   patch:
 *     tags: [Task]
 *     summary: Cập nhật trạng thái task (generic)
 *     description: >
 *       API generic để đổi status trong các trường hợp đặc biệt.
 *       Flow chính vẫn nên dùng các endpoint chuyên biệt
 *       như /technician-complete và /manager-review.
 *     parameters:
 *       - in: path
 *         name: taskCode
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 description: >
 *                   Trạng thái mới của task.
 *                   Hỗ trợ: PENDING, WAITING_MATERIAL_LIST,
 *                   PROCESSING, WAITING_APPROVAL, APPROVED, REJECTED.
 *               reason:
 *                 type: string
 *                 description: "Lý do (nếu từ chối / ghi chú trạng thái)"
 *               changedBy:
 *                 type: string
 *                 description: "ID người thay đổi trạng thái"
 *             example:
 *               status: "WAITING_MATERIAL_LIST"
 *               reason: "Technician gửi danh sách vật tư"
 *               changedBy: "tech-001"
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái thành công
 *       400:
 *         description: Trạng thái không hợp lệ
 *       404:
 *         description: Không tìm thấy task
 */
router.patch("/tasks/:taskCode/status", taskService.UpdateTaskStatus);

/**
 * @openapi
 * /api/tasks/{taskCode}/technician-complete:
 *   patch:
 *     tags: [Task]
 *     summary: Technician báo đã xử lí xong task
 *     description: >
 *       Technician upload file (ảnh/video) minh chứng,
 *       system chuyển trạng thái task từ PROCESSING sang WAITING_APPROVAL.
 *     parameters:
 *       - in: path
 *         name: taskCode
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note:
 *                 type: string
 *                 description: Ghi chú của technician
 *               attachmentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Danh sách ID file/media đã upload (từ Media Service)
 *               changedBy:
 *                 type: string
 *                 description: "ID technician (nếu không gửi thì lấy từ header x-user-id)"
 *             example:
 *               note: "Đã thay bóng mới, kiểm tra hoạt động bình thường"
 *               attachmentIds:
 *                 - "media-123"
 *                 - "media-124"
 *               changedBy: "tech-001"
 *     responses:
 *       200:
 *         description: Đã cập nhật task sang WAITING_APPROVAL
 *       400:
 *         description: Sai trạng thái hiện tại (không phải PROCESSING)
 *       404:
 *         description: Không tìm thấy task
 */
router.patch(
  "/tasks/:taskCode/technician-complete",
  taskService.TechnicianCompleteTask
);

/**
 * @openapi
 * /api/tasks/{taskCode}/manager-review:
 *   patch:
 *     tags: [Task]
 *     summary: Manager duyệt / không duyệt task
 *     description: >
 *       Áp dụng cho 2 phase:
 *
 *       * Nếu task đang ở **WAITING_MATERIAL_LIST**:
 *         - isApproved = true  -> chuyển sang **PROCESSING** (OK, bắt đầu thi công)
 *         - isApproved = false -> chuyển sang **REJECTED** (không chấp nhận danh sách vật tư)
 *
 *       * Nếu task đang ở **WAITING_APPROVAL**:
 *         - isApproved = true  -> chuyển sang **APPROVED** (kết thúc task)
 *         - isApproved = false -> quay lại **PROCESSING** (Technician làm lại)
 *     parameters:
 *       - in: path
 *         name: taskCode
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isApproved
 *             properties:
 *               isApproved:
 *                 type: boolean
 *                 description: true = duyệt, false = không duyệt
 *               reason:
 *                 type: string
 *                 description: Lý do nếu không duyệt / ghi chú thêm
 *               changedBy:
 *                 type: string
 *                 description: "ID manager (nếu không gửi thì lấy từ header x-user-id)"
 *             example:
 *               isApproved: true
 *               reason: "Vật tư hợp lý, cho phép triển khai"
 *               changedBy: "manager-001"
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái theo quyết định của Manager
 *       400:
 *         description: Task không ở WAITING_MATERIAL_LIST hoặc WAITING_APPROVAL
 *       404:
 *         description: Không tìm thấy task
 */
router.patch(
  "/tasks/:taskCode/manager-review",
  taskService.ManagerReviewTask
);

module.exports = router;
