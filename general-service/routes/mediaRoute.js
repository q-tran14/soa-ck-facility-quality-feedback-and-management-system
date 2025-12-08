const express = require("express");
const router = express.Router();
const { mediaService, upload } = require("../services/media");

/**
 * @openapi
 * /api/media/upload:
 *   post:
 *     tags: [Media]
 *     summary: Upload file (ảnh, video, tài liệu...) lên Cloudinary
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               taskId:
 *                 type: string
 *                 description: ID của Task (chỉ truyền 1 trong 2)
 *               reportId:
 *                 type: string
 *                 description: ID của Report (chỉ truyền 1 trong 2)
 *     responses:
 *       200:
 *         description: Upload thành công
 */
router.post("/upload", upload.single("file"), mediaService.UploadFile);

/**
 * @openapi
 * /api/media/{mediaId}:
 *   get:
 *     tags: [Media]
 *     summary: Lấy thông tin media bằng mediaId
 *     parameters:
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trả về thông tin file
 */
router.get("/:mediaId", mediaService.GetFile);

/**
 * @openapi
 * /api/media/{mediaId}:
 *   delete:
 *     tags: [Media]
 *     summary: Xóa file media trên Cloudinary và trong MongoDB
 *     parameters:
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa file thành công
 */
router.delete("/:mediaId", mediaService.DeleteFile);

/**
 * @openapi
 * /api/media/task/{taskId}:
 *   get:
 *     tags: [Media]
 *     summary: Lấy tất cả media thuộc một Task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách media
 */
router.get("/task/:taskId", mediaService.GetMediaByTask);

/**
 * @openapi
 * /api/media/report/{reportId}:
 *   get:
 *     tags: [Media]
 *     summary: Lấy tất cả media thuộc một Report
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách media
 */
router.get("/report/:reportId", mediaService.GetMediaByReport);

module.exports = router;
