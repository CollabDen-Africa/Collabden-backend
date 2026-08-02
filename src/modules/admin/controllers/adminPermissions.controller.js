const {
  getRolePermissions,
  getAllRolePermissions,
  getAvailablePermissionsAndModules,
  updateRolePermissions,
  addPermissionsToRole,
  removePermissionsFromRole,
  addModulesToRole,
  removeModulesFromRole,
  deleteRoleConfig,
  getPermissionChangeHistory
} = require("../services/adminPermissions.service");

/**
 * Helper to build the standard audit context from a request.
 */
const buildAuditContext = (req) => ({
  performedBy: req.user.id,
  ipAddress: req.ip || req.connection?.remoteAddress,
  userAgent: req.headers['user-agent']
});

// ──────────────────────────────────────────────
// Retrieve
// ──────────────────────────────────────────────

const getRolePermissionsController = async (req, res) => {
  try {
    const { role } = req.params;
    const permissions = await getRolePermissions(role);
    res.status(200).json(permissions);
  } catch (error) {
    if (error.message.includes("Invalid admin role")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

const getAllRolePermissionsController = async (req, res) => {
  try {
    const permissions = await getAllRolePermissions();
    res.status(200).json(permissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAvailablePermissionsController = async (req, res) => {
  try {
    const data = getAvailablePermissionsAndModules();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────
// Assign / Update Permissions
// ──────────────────────────────────────────────

const updateRolePermissionsController = async (req, res) => {
  try {
    const { role } = req.params;
    const { permissions, modules } = req.body;

    if (!permissions || !modules) {
      return res.status(400).json({ error: "Both 'permissions' and 'modules' arrays are required." });
    }

    const updatedConfig = await updateRolePermissions(role, permissions, modules, buildAuditContext(req));
    res.status(200).json({
      message: "Role permissions updated successfully.",
      config: updatedConfig
    });
  } catch (error) {
    if (error.message.includes("Invalid") || error.message.includes("must be arrays")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

const addPermissionsController = async (req, res) => {
  try {
    const { role } = req.params;
    const { permissions } = req.body;

    if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({ error: "'permissions' must be a non-empty array of permission strings." });
    }

    const result = await addPermissionsToRole(role, permissions, buildAuditContext(req));
    res.status(200).json({
      message: result.message || `Added ${result.added.length} permission(s) to ${role}.`,
      added: result.added,
      config: result.config
    });
  } catch (error) {
    if (error.message.includes("Invalid")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

const removePermissionsController = async (req, res) => {
  try {
    const { role } = req.params;
    const { permissions } = req.body;

    if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({ error: "'permissions' must be a non-empty array of permission strings." });
    }

    const result = await removePermissionsFromRole(role, permissions, buildAuditContext(req));
    res.status(200).json({
      message: result.message || `Removed ${result.removed.length} permission(s) from ${role}.`,
      removed: result.removed,
      config: result.config
    });
  } catch (error) {
    if (error.message.includes("Invalid")) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────
// Module Access Management
// ──────────────────────────────────────────────

const addModulesController = async (req, res) => {
  try {
    const { role } = req.params;
    const { modules } = req.body;

    if (!modules || !Array.isArray(modules) || modules.length === 0) {
      return res.status(400).json({ error: "'modules' must be a non-empty array of module strings." });
    }

    const result = await addModulesToRole(role, modules, buildAuditContext(req));
    res.status(200).json({
      message: result.message || `Added ${result.added.length} module(s) to ${role}.`,
      added: result.added,
      config: result.config
    });
  } catch (error) {
    if (error.message.includes("Invalid")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

const removeModulesController = async (req, res) => {
  try {
    const { role } = req.params;
    const { modules } = req.body;

    if (!modules || !Array.isArray(modules) || modules.length === 0) {
      return res.status(400).json({ error: "'modules' must be a non-empty array of module strings." });
    }

    const result = await removeModulesFromRole(role, modules, buildAuditContext(req));
    res.status(200).json({
      message: result.message || `Removed ${result.removed.length} module(s) from ${role}.`,
      removed: result.removed,
      config: result.config
    });
  } catch (error) {
    if (error.message.includes("Invalid")) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────
// Delete & History
// ──────────────────────────────────────────────

const deleteRoleConfigController = async (req, res) => {
  try {
    const { role } = req.params;
    const result = await deleteRoleConfig(role, buildAuditContext(req));
    res.status(200).json(result);
  } catch (error) {
    if (error.message.includes("Invalid admin role")) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes("Cannot delete role config")) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

const getPermissionChangeHistoryController = async (req, res) => {
  try {
    const { page, limit, role } = req.query;
    const result = await getPermissionChangeHistory({ page, limit, role });
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching permission change history:", error);
    res.status(500).json({ error: "Failed to fetch permission change history." });
  }
};

module.exports = {
  getRolePermissionsController,
  getAllRolePermissionsController,
  getAvailablePermissionsController,
  updateRolePermissionsController,
  addPermissionsController,
  removePermissionsController,
  addModulesController,
  removeModulesController,
  deleteRoleConfigController,
  getPermissionChangeHistoryController
};
