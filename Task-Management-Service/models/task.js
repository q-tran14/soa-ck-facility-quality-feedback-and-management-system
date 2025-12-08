// Task-Management-Service/models/task.js
const mongoose = require("mongoose");

const TASK_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  WAITING_APPROVAL: "WAITING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  FAILED_STANDARD: "FAILED_STANDARD",
};

const StatusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(TASK_STATUS),
      required: true,
    },
    note: String,
    changedBy: {
      type: String, 
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const TaskSchema = new mongoose.Schema(
  {
    // ID bên các service khác => string
    reportId: { type: String },
    createdBy: { type: String, required: true }, // manager-1
    assignedTo: { type: String }, // tech-1

    title: { type: String, required: true },
    description: String,
    deadline: Date,

    status: {
      type: String,
      enum: Object.values(TASK_STATUS),
      default: TASK_STATUS.PENDING,
    },

    isFailedStandard: { type: Boolean, default: false },
    reason: String,

    // list mediaId từ Media Service
    attachments: [{ type: String }],

    statusHistory: [StatusHistorySchema],
  },
  { timestamps: true }
);

const Task = mongoose.model("Task", TaskSchema);

module.exports = { Task, TASK_STATUS };
