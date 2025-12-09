// Task-Management-Service/services/task.js
const { Task, TASK_STATUS } = require("../models/task");
const { updateReportStatus } = require("../clients/ircClient");


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
// Tạo task mới từ Report, mặc định status = PENDING
const CreateTask = async (req, res) => {
  try {
    if (!ensureManagerOrTechnician(req, res)) return;

    const {
      reportId, // RP-U01-01
      managerId,
      technicianId,
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
      // disqualifiedCount dùng default trong schema
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
// Lọc theo status, technician, manager, report
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

// ================== Dùng taskCode thay cho _id ==================

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
// Cập nhật thông tin cơ bản (title, desc, technician, deadline)
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

// PATCH /api/tasks/:taskCode/technician-complete
// Technician báo đã làm xong, chuyển từ PROCESSING -> WAITING_APPROVAL
const TechnicianCompleteTask = async (req, res) => {
  try {
    if (!ensureManagerOrTechnician(req, res)) return;

    const { taskCode } = req.params;
    const { attachmentIds, note } = req.body;

    const task = await findTaskByCode(taskCode);
    if (!task) {
      return res.status(404).json({ message: "Không tìm thấy task" });
    }

    // Chỉ cho complete khi đang PROCESSING
    if (task.status !== TASK_STATUS.PROCESSING) {
      return res.status(400).json({
        message: `Chỉ được hoàn thành task khi đang ở trạng thái PROCESSING (hiện tại: ${task.status})`,
      });
    }

    const userId = getActorId(req, task.technicianId || "technician-unknown");

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
//  - WAITING_MATERIAL_LIST:
//      + isApproved = true  -> PROCESSING
//      + isApproved = false -> REJECTED
//  - WAITING_APPROVAL:
//      + isApproved = true  -> APPROVED (+ báo Report COMPLETED)
//      + isApproved = false -> PROCESSING (làm lại)
// Không đụng tới disqualifiedCount – chỉ tăng bên flow khiếu nại citizen
const ManagerReviewTask = async (req, res) => {
  try {
    if (!ensureManagerOrTechnician(req, res)) return;

    const { taskCode } = req.params;
    const { isApproved, reason, note } = req.body || {};

    if (typeof isApproved !== "boolean") {
      return res
        .status(400)
        .json({ message: "isApproved (boolean) là bắt buộc" });
    }

    const task = await findTaskByCode(taskCode);
    if (!task) {
      return res.status(404).json({ message: "Không tìm thấy task" });
    }

    const userId = getActorId(req, task.managerId || "manager-unknown");

    if (task.status === TASK_STATUS.WAITING_MATERIAL_LIST) {
      // ====== Duyệt / không duyệt danh sách vật tư ======
      if (isApproved) {
        task.status = TASK_STATUS.PROCESSING;
        task.reason = undefined;

        pushStatusHistory(task, {
          status: TASK_STATUS.PROCESSING,
          note:
            note ||
            "Manager approved material list → chuyển sang PROCESSING",
          changedBy: userId,
        });
      } else {
        task.status = TASK_STATUS.REJECTED;
        task.reason = reason || note || "Manager rejected material list";

        pushStatusHistory(task, {
          status: TASK_STATUS.REJECTED,
          note: task.reason,
          changedBy: userId,
        });
      }
    } else if (task.status === TASK_STATUS.WAITING_APPROVAL) {
      // ====== Duyệt / không duyệt kết quả thi công ======
      if (isApproved) {
        task.status = TASK_STATUS.APPROVED;
        task.reason = undefined;

        pushStatusHistory(task, {
          status: TASK_STATUS.APPROVED,
          note: note || "Manager approved final result",
          changedBy: userId,
        });
      } else {
        task.status = TASK_STATUS.PROCESSING;
        task.reason =
          reason ||
          note ||
          "Manager không duyệt kết quả, yêu cầu technician xử lý lại";

        pushStatusHistory(task, {
          status: TASK_STATUS.PROCESSING,
          note: task.reason,
          changedBy: userId,
        });
      }
    } else {
      // Không đúng phase để duyệt
      return res.status(400).json({
        message: `Không thể duyệt task ở trạng thái ${task.status}. Chỉ hỗ trợ WAITING_MATERIAL_LIST hoặc WAITING_APPROVAL.`,
      });
    }

    await task.save();

    // 🔗 Nếu vừa APPROVED thì báo cho IRC-Service: report => COMPLETED
    if (task.status === TASK_STATUS.APPROVED && task.reportId) {
      updateReportStatus(
        task.reportId,
        "COMPLETED",
        `Task ${task.taskCode} đã được APPROVED`,
        "MANAGER" // header X-Role cho IRC service
      ).catch((err) =>
        console.error("[ManagerReviewTask] updateReportStatus error:", err)
      );
    }

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
// Hỗ trợ orchestrator / service khác tự điều khiển flow (PROCESSING, COMPLETED,...)
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
