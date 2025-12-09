// Task-Management-Service/models/task.js
const mongoose = require("mongoose");

// Enum trạng thái Task – đúng theo flow mới
const TASK_STATUS = {
  PENDING: "PENDING",
  WAITING_MATERIAL_LIST: "WAITING_MATERIAL_LIST",
  PROCESSING: "PROCESSING",
  WAITING_APPROVAL: "WAITING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  WAITING_RESULT_APPROVAL: "WAITING_RESULT_APPROVAL", // Sửa xong, chờ nghiệm thu (MỚI)
  COMPLETED: "COMPLETED",               // Đã xong hoàn toàn (MỚI)
};

const StatusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: Object.values(TASK_STATUS), required: true },
    note: String,
    changedBy: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const TaskSchema = new mongoose.Schema(
  {
    // Mã task để hiển thị
    taskCode: {
      type: String,
      required: true,
      unique: true, // mỗi taskCode chỉ xuất hiện 1 lần
    },

    // gắn với report
    reportId: { type: String, required: true },
    managerId: { type: String, required: true },
    technicianId: { type: String },

    title: { type: String, required: true },
    description: String,
    deadline: Date,

    status: {
      type: String,
      enum: Object.values(TASK_STATUS),
      default: TASK_STATUS.PENDING,
    },

    // Dùng cho phần khiếu nại của citizen, KHÔNG đụng tới trong ManagerReview
    disqualifiedCount: {
      type: Number,
      default: 0,
    },

    // Nếu sau này cần flag “không đạt chuẩn” thì vẫn dùng được
    isFailedStandard: { type: Boolean, default: false },
    reason: String,
    attachments: [{ type: String }],

    statusHistory: [StatusHistorySchema],
  },
  { timestamps: true }
);

const Task = mongoose.model("Task", TaskSchema);

module.exports = { Task, TASK_STATUS };
