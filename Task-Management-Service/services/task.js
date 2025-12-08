// Task-Management-Service/services/task.js
const { Task, TASK_STATUS } = require("../models/task");

// Helper: push vào statusHistory
const pushStatusHistory = (task, { status, note, changedBy }) => {
  task.statusHistory.push({
    status,
    note,
    changedBy,
  });
};

// TODO: sau này m nối với User Service thì lấy userId & role từ token
const getCurrentUserId = (req) => {
  // ví dụ sau này: return req.user.id;
  return req.headers["x-user-id"] || null;
};

const getCurrentUserRole = (req) => {
  // ví dụ sau này: return req.user.role;
  return req.headers["x-user-role"] || null;
};

const getActorId = (req, fallback = "system") => {
  // ưu tiên: header -> body.changedBy -> fallback
  return getCurrentUserId(req) || req.body.changedBy || fallback;
};


const ensureManagerOrTechnician = (req, res) => {
  const role = getCurrentUserRole(req);
  // ! CALL USER SERVICE TO VERIFY USER & ROLE
  if (role && role !== "MANAGER" && role !== "TECHNICIAN") {
    res.status(403).json({ message: "Không có quyền thao tác Task" });
    return false;
  }
  return true;
};

// ========== CRUD cơ bản ==========

const CreateTask = async (req, res) => {
  try {
    if (!ensureManagerOrTechnician(req, res)) return;

    const {
      reportId,
      assignedTo,
      title,
      description,
      deadline,
      createdBy, // nếu chưa có auth thì FE gửi lên tạm
    } = req.body;

    const creatorId = createdBy || getActorId(req, "manager-unknown");

    const task = new Task({
      reportId,
      createdBy: creatorId,
      assignedTo,
      title,
      description,
      deadline,
      status: TASK_STATUS.PENDING,
    });

    pushStatusHistory(task, {
      status: TASK_STATUS.PENDING,
      note: "Task created",
      changedBy: creatorId,
    });

    await task.save();
    return res.status(201).json(task);
  } catch (error) {
    console.error("CreateTask error:", error);
    return res
      .status(500)
      .json({ message: "Tạo task thất bại", error: error.message });
  }
};


const GetTasks = async (req, res) => {
  try {
    const { status, assignedTo, createdBy } = req.query;

    const query = {};
    if (status) query.status = status;
    if (assignedTo) query.assignedTo = assignedTo;
    if (createdBy) query.createdBy = createdBy;

    const tasks = await Task.find(query).sort({ createdAt: -1 });

    return res.status(200).json(tasks);
  } catch (error) {
    console.error("GetTasks error:", error);
    return res
      .status(500)
      .json({ message: "Lấy danh sách task thất bại", error: error.message });
  }
};

// dùng riêng cho yêu cầu “lấy danh sách task theo TechnicianID”
const GetTasksByTechnician = async (req, res) => {
  try {
    const { technicianId } = req.params;
    const { status } = req.query;

    const query = { assignedTo: technicianId };
    if (status) query.status = status;

    const tasks = await Task.find(query).sort({ createdAt: -1 });
    return res.status(200).json(tasks);
  } catch (error) {
    console.error("GetTasksByTechnician error:", error);
    return res
      .status(500)
      .json({ message: "Lấy danh sách task theo technician thất bại", error: error.message });
  }
};

const GetTaskById = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({ message: "Không tìm thấy task" });
    }

    return res.status(200).json(task);
  } catch (error) {
    console.error("GetTaskById error:", error);
    return res
      .status(500)
      .json({ message: "Lấy task thất bại", error: error.message });
  }
};

const UpdateTask = async (req, res) => {
  try {
    if (!ensureManagerOrTechnician(req, res)) return;

    const { id } = req.params;
    const { title, description, assignedTo, deadline } = req.body;

    const task = await Task.findByIdAndUpdate(
      id,
      { title, description, assignedTo, deadline },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ message: "Không tìm thấy task" });
    }

    return res.status(200).json(task);
  } catch (error) {
    console.error("UpdateTask error:", error);
    return res
      .status(500)
      .json({ message: "Cập nhật task thất bại", error: error.message });
  }
};

// ========== Flow Technician hoàn thành & upload file ==========

const TechnicianCompleteTask = async (req, res) => {
  try {
    if (!ensureManagerOrTechnician(req, res)) return;

    const { id } = req.params;
    const { attachments, note } = req.body;

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: "Không tìm thấy task" });
    }

    const userId = getActorId(req, task.assignedTo || "technician-unknown");

    // ! CALL MEDIA SERVICE TO VERIFY / GET ATTACHMENT INFO
    if (attachments && attachments.length) {
      task.attachments = attachments;
    }

    task.status = TASK_STATUS.WAITING_APPROVAL;
    task.isFailedStandard = false;
    task.reason = undefined;

    pushStatusHistory(task, {
      status: TASK_STATUS.WAITING_APPROVAL,
      note: note || "Technician completed & waiting for approval",
      changedBy: userId,
    });

    await task.save();
    return res.status(200).json(task);
  } catch (error) {
    console.error("TechnicianCompleteTask error:", error);
    return res.status(500).json({
      message: "Cập nhật task khi technician hoàn thành thất bại",
      error: error.message,
    });
  }
};


// ========== Flow Manager duyệt ==========
const ManagerReviewTask = async (req, res) => {
  try {
    if (!ensureManagerOrTechnician(req, res)) return;

    const { id } = req.params;
    const { approved, reason } = req.body;

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: "Không tìm thấy task" });
    }

    const userId = getActorId(req, task.createdBy || "manager-unknown");

    if (approved) {
      // ✅ dùng APPROVED, đúng với enum
      task.status = TASK_STATUS.APPROVED;
      task.isFailedStandard = false;
      task.reason = undefined;

      pushStatusHistory(task, {
        status: TASK_STATUS.APPROVED,
        note: "Manager approved",
        changedBy: userId,
      });
    } else {
      // không đạt chuẩn → quay lại PROCESSING & gắn cờ failedStandard
      task.status = TASK_STATUS.PROCESSING;
      task.isFailedStandard = true;
      task.reason = reason;

      pushStatusHistory(task, {
        status: TASK_STATUS.FAILED_STANDARD,
        note: reason || "Manager rejected (failed standard)",
        changedBy: userId,
      });
    }

    await task.save();
    return res.status(200).json(task);
  } catch (error) {
    console.error("ManagerReviewTask error:", error);
    return res.status(500).json({
      message: "Manager duyệt task thất bại",
      error: error.message,
    });
  }
};

// ========== API đổi status tự do (nếu vẫn muốn giữ) ==========
const UpdateTaskStatus = async (req, res) => {
  try {
    if (!ensureManagerOrTechnician(req, res)) return;

    const { id } = req.params;
    const { status, reason, isFailedStandard, changedBy } = req.body;

    if (!Object.values(TASK_STATUS).includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ" });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: "Không tìm thấy task" });
    }

    task.status = status;
    if (typeof isFailedStandard === "boolean") {
      task.isFailedStandard = isFailedStandard;
    }
    if (reason) {
      task.reason = reason;
    }

    pushStatusHistory(task, {
      status,
      note: reason,
      changedBy: changedBy || getActorId(req),
    });

    await task.save();
    return res.status(200).json(task);
  } catch (error) {
    console.error("UpdateTaskStatus error:", error);
    return res.status(500).json({
      message: "Cập nhật trạng thái thất bại",
      error: error.message,
    });
  }
};


module.exports = {
  CreateTask,
  GetTasks,
  GetTasksByTechnician,
  GetTaskById,
  UpdateTask,
  TechnicianCompleteTask,
  ManagerReviewTask,
  UpdateTaskStatus,
};
