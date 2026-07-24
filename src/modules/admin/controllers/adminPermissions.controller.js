const {
  getRolePermissions,
  getAllRolePermissions,
  updateRolePermissions
} = require("../services/adminPermissions.service");

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

const updateRolePermissionsController = async (req, res) => {
  try {
    const { role } = req.params;
    const { permissions, modules } = req.body;

    if (!permissions || !modules) {
      return res.status(400).json({ error: "Both 'permissions' and 'modules' arrays are required." });
    }

    const updatedConfig = await updateRolePermissions(role, permissions, modules);
    res.status(200).json({
      message: "Role permissions updated successfully.",
      config: updatedConfig
    });
  } catch (error) {
    if (error.message.includes("Invalid admin role") || error.message.includes("must be arrays")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getRolePermissionsController,
  getAllRolePermissionsController,
  updateRolePermissionsController
};
