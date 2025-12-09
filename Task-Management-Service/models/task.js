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
    deadline: Date,

    status: {
      type: String,
      enum: Object.values(TASK_STATUS),
      default: TASK_STATUS.PENDING,
    },

    disqualifiedCount: {
      type: Number,
      default: 0,
    },

  },
  { timestamps: true }
);

const Task = mongoose.model("Task", TaskSchema);

module.exports = { Task, TASK_STATUS };
