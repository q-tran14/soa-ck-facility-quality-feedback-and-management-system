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
 *       taskCode sẽ được service tự sinh (TK-RP-U01-01-001, ...)
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
 *               description:
 *                 type: string
 *               deadline:
 *                 type: string
 *                 format: date-time
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
 *         description: Trạng thái task
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
 *         description: 
 *           type: string
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
 *     summary: Cập nhật thông tin task
 *     parameters:
 *       - in: path
 *         name: taskCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Mã task (TK-...)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               technicianId:
 *                 type: string
 *                 description: ID technician mới
 *               deadline:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy task
 */
router.put("/tasks/:taskCode", taskService.UpdateTask);

/**
 * @openapi
 * /api/tasks/{taskCode}/technician-complete:
 *   patch:
 *     tags: [Task]
 *     summary: Technician báo đã xử lí xong task
 *     description: >
 *       Technician upload file (ảnh/video) minh chứng, system chuyển trạng thái
 *       task sang WAITING_APPROVAL.
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
 *     responses:
 *       200:
 *         description: Đã cập nhật task sang WAITING_APPROVAL
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
 *       Manager xem minh chứng, quyết định approve hay reject. Nếu reject thì
 *       gắn cờ FAILED_STANDARD và cho technician làm lại.
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
 *                 description: Lý do nếu không duyệt
 *               changedBy:
 *                 type: string
 *                 description: "ID manager (nếu không gửi thì lấy từ header x-user-id)"
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái theo quyết định của Manager
 *       404:
 *         description: Không tìm thấy task
 */
router.patch(
  "/tasks/:taskCode/manager-review",
  taskService.ManagerReviewTask
);

/**
 * @openapi
 * /api/tasks/{taskCode}/status:
 *   patch:
 *     tags: [Task]
 *     summary: Cập nhật trạng thái task (generic)
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
 *                 description: "Trạng thái mới của task (PENDING, PROCESSING, WAITING_APPROVAL, APPROVED, REJECTED, FAILED_STANDARD, ...)"
 *               reason:
 *                 type: string
 *                 description: "Lý do (nếu từ chối / không đạt tiêu chuẩn)"
 *               isFailedStandard:
 *                 type: boolean
 *                 description: "Đánh dấu Không đạt tiêu chuẩn"
 *               changedBy:
 *                 type: string
 *                 description: "ID người thay đổi trạng thái"
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái thành công
 *       400:
 *         description: Trạng thái không hợp lệ
 *       404:
 *         description: Không tìm thấy task
 */
router.patch("/tasks/:taskCode/status", taskService.UpdateTaskStatus);

module.exports = router;
