// Task-Management-Service/services/task.js
const { Task, TASK_STATUS } = require("../models/task");

// ================== Helpers chung ==================

// Ghi log history status
const pushStatusHistory = (task, { status, note, changedBy }) => {
  task.statusHistory.push({
    status,
    note,
    changedBy,
  });
};

// Lấy userId/role (sau này nối UserService thì thay bằng req.user)
const getCurrentUserId = (req) => req.headers["x-user-id"] || null;
const getCurrentUserRole = (req) => req.headers["x-user-role"] || null;

// Ưu tiên header -> body.changedBy -> fallback
const getActorId = (req, fallback = "system") =>
  getCurrentUserId(req) || req.body.changedBy || fallback;

// Check permission cơ bản (Manager/Technician)
const ensureManagerOrTechnician = (req, res) => {
  const role = getCurrentUserRole(req);
  // ! CALL USER SERVICE TO VERIFY USER & ROLE (sau này)
  if (role && role !== "MANAGER" && role !== "TECHNICIAN") {
    res.status(403).json({ message: "Không có quyền thao tác Task" });
    return false;
  }
  return true;
};

// Helper: tìm task theo taskCode
const findTaskByCode = async (taskCode) => {
  return Task.findOne({ taskCode });
};

// Sinh taskCode dạng T0001, T0002, ...
const generateTaskCode = async () => {
  const lastTask = await Task.findOne()
    .sort({ createdAt: -1 })
    .select("taskCode")
    .lean();

  let nextNumber = 1;

  if (lastTask && lastTask.taskCode) {
    const match = lastTask.taskCode.match(/^T(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `T${String(nextNumber).padStart(4, "0")}`; // T0001, T0002, ...
};

// ================== CRUD cơ bản ==================

// POST /api/tasks
const CreateTask = async (req, res) => {
  try {
    if (!ensureManagerOrTechnician(req, res)) return;

    const {
      reportId,     // RP-U01-01
      managerId,    // ManagerID
      technicianId, // TechnicianID
      title,
      description,
      deadline,
    } = req.body;

    if (!reportId || !managerId || !title) {
      return res.status(400).json({
        message: "reportId, managerId, title là bắt buộc",
      });
    }

    const taskCode = await generateTaskCode();
    const creatorId = managerId || getActorId(req, "manager-unknown");

    const task = new Task({
      taskCode,
      reportId,
      managerId: creatorId,
      technicianId,
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

// GET /api/tasks
const GetTasks = async (req, res) => {
  try {
    const { status, technicianId, managerId, reportId } = req.query;

    const query = {};
    if (status) query.status = status;
    if (technicianId) query.technicianId = technicianId;
    if (managerId) query.managerId = managerId;
    if (reportId) query.reportId = reportId;

    const tasks = await Task.find(query).sort({ createdAt: -1 });

    return res.status(200).json(tasks);
  } catch (error) {
    console.error("GetTasks error:", error);
    return res
      .status(500)
      .json({ message: "Lấy danh sách task thất bại", error: error.message });
  }
};

// GET /api/tasks/:taskCode
const GetTaskByTaskCode = async (req, res) => {
  try {
    const { taskCode } = req.params;

    const task = await Task.findOne({ taskCode });

    if (!task) {
      return res.status(404).json({ message: "Không tìm thấy task" });
    }

    return res.status(200).json(task);
  } catch (error) {
    console.error("GetTaskByTaskCode error:", error);
    return res
      .status(500)
      .json({ message: "Lấy task thất bại", error: error.message });
  }
};


// ================== Dùng taskCode thay cho _id ==================

// GET /api/tasks/:taskCode
const GetTaskById = async (req, res) => {
  try {
    const { taskCode } = req.params;

    const task = await findTaskByCode(taskCode);

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

// PUT /api/tasks/:taskCode
const UpdateTask = async (req, res) => {
  try {
    if (!ensureManagerOrTechnician(req, res)) return;

    const { taskCode } = req.params;
    const { title, description, technicianId, deadline } = req.body;

    const task = await Task.findOneAndUpdate(
      { taskCode },
      { title, description, technicianId, deadline },
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

// PATCH /api/tasks/:taskCode/technician-complete
const TechnicianCompleteTask = async (req, res) => {
  try {
    if (!ensureManagerOrTechnician(req, res)) return;

    const { taskCode } = req.params;
    const { attachmentIds, note } = req.body; // swagger dùng attachmentIds

    const task = await findTaskByCode(taskCode);
    if (!task) {
      return res.status(404).json({ message: "Không tìm thấy task" });
    }

    const userId = getActorId(req, task.technicianId || "technician-unknown");

    // ! CALL MEDIA SERVICE TO VERIFY / GET ATTACHMENT INFO
    if (attachmentIds && attachmentIds.length) {
      task.attachments = attachmentIds;
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

// PATCH /api/tasks/:taskCode/manager-review
const ManagerReviewTask = async (req, res) => {
  try {
    if (!ensureManagerOrTechnician(req, res)) return;

    const { taskCode } = req.params;
    const { isApproved, reason } = req.body; // swagger dùng isApproved

    const task = await findTaskByCode(taskCode);
    if (!task) {
      return res.status(404).json({ message: "Không tìm thấy task" });
    }

    const userId = getActorId(req, task.managerId || "manager-unknown");

    if (isApproved) {
      task.status = TASK_STATUS.APPROVED;
      task.isFailedStandard = false;
      task.reason = undefined;

      pushStatusHistory(task, {
        status: TASK_STATUS.APPROVED,
        note: "Manager approved",
        changedBy: userId,
      });
    } else {
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

// PATCH /api/tasks/:taskCode/status
const UpdateTaskStatus = async (req, res) => {
  try {
    if (!ensureManagerOrTechnician(req, res)) return;

    const { taskCode } = req.params;
    const { status, reason, isFailedStandard, changedBy } = req.body;

    if (!Object.values(TASK_STATUS).includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ" });
    }

    const task = await findTaskByCode(taskCode);
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
  GetTaskById,
  GetTaskByTaskCode,  
  UpdateTask,
  TechnicianCompleteTask,
  ManagerReviewTask,
  UpdateTaskStatus,
};
