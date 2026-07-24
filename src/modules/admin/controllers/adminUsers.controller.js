const {
  createAdmin,
  getAdmins,
  getAdminById,
  updateAdmin,
  deactivateAdmin,
  getUsers,
  getUserById,
  getUserActivity,
  getUserReports,
  getUserAuditHistory,
  getUserNotes,
  addAdminNote,
  moderateUser,
} = require("../services/adminUsers.service");

const createAdminController = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ error: "Email, password, and role are required." });
    }

    const newAdmin = await createAdmin({ email, password, role });
    res.status(201).json(newAdmin);
  } catch (error) {
    if (error.message.includes("already exists")) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

const getAdminsController = async (req, res) => {
  try {
    const admins = await getAdmins();
    res.status(200).json(admins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAdminByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await getAdminById(id);
    res.status(200).json(admin);
  } catch (error) {
    if (error.message === "Admin user not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

const updateAdminController = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, accountStatus } = req.body;
    
    // Explicitly prevent password updates
    if (req.body.password) {
      return res.status(400).json({ error: "Password updates are not allowed via this endpoint." });
    }

    const updateData = {};
    if (role) updateData.role = role;
    if (accountStatus) updateData.accountStatus = accountStatus;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No valid fields provided for update." });
    }

    const updatedAdmin = await updateAdmin(id, updateData);
    res.status(200).json(updatedAdmin);
  } catch (error) {
    if (error.message === "Admin user not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

const deactivateAdminController = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingAdminId = req.user.id;
    
    const deactivatedAdmin = await deactivateAdmin(id, requestingAdminId);
    res.status(200).json({
      message: "Admin deactivated successfully.",
      admin: deactivatedAdmin
    });
  } catch (error) {
    if (error.message === "Admin user not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("own account")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

const getUsersController = async (req, res) => {
  try {
    const { page, limit, search, accountStatus, isVerified, tier } = req.query;
    const result = await getUsers({
      page,
      limit,
      search,
      accountStatus,
      isVerified,
      tier,
    });
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users." });
  }
};

const moderateUserController = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason, notes } = req.body;
    
    if (!action || !reason) {
      return res.status(400).json({ error: "Action and reason are required." });
    }

    const updatedUser = await moderateUser(
      id,
      req.user.id,
      action,
      reason,
      notes,
      req.ip || req.connection?.remoteAddress,
      req.headers['user-agent']
    );

    res.status(200).json({
      message: `User successfully moderated (${action})`,
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error moderating user:", error);
    res.status(500).json({ error: error.message || "Failed to moderate user." });
  }
};

const getUserByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getUserById(id);
    res.status(200).json(user);
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

const getUserActivityController = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit, search, type } = req.query;
    const result = await getUserActivity(id, { page, limit, search, type });
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching user activity:", error);
    res.status(500).json({ error: "Failed to fetch user activity." });
  }
};

const getUserReportsController = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit, search, type } = req.query;
    const result = await getUserReports(id, { page, limit, search, type });
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching user reports:", error);
    res.status(500).json({ error: "Failed to fetch user reports." });
  }
};

const getUserAuditHistoryController = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit } = req.query;
    const result = await getUserAuditHistory(id, { page, limit });
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching user audit history:", error);
    res.status(500).json({ error: "Failed to fetch user audit history." });
  }
};

const getUserNotesController = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit } = req.query;
    const result = await getUserNotes(id, { page, limit });
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching user notes:", error);
    res.status(500).json({ error: "Failed to fetch user notes." });
  }
};

const addAdminNoteController = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    const adminId = req.body.adminId;
    
    if (!adminId || !content) {
      return res.status(400).json({ error: "adminId and content are required." });
    }

    const note = await addAdminNote(adminId, id, content);
    res.status(201).json(note);
  } catch (error) {
    console.error("Error adding admin note:", error);
    res.status(500).json({ error: "Failed to add admin note." });
  }
};

module.exports = {
  createAdminController,
  getAdminsController,
  getAdminByIdController,
  updateAdminController,
  deactivateAdminController,
  getUsersController,
  getUserByIdController,
  getUserActivityController,
  getUserReportsController,
  getUserAuditHistoryController,
  getUserNotesController,
  addAdminNoteController,
  moderateUserController,
};
