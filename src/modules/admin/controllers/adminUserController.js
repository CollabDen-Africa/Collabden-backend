const adminUserService = require("../services/adminUser.service");

/**
 * Get all users with filters.
 */
const listUsers = async (req, res) => {
  try {
    const {
      search,
      accountStatus,
      verificationStatus,
      subscriptionPlan,
      openToCollaborate,
      dateJoinedStart,
      dateJoinedEnd,
      page,
      limit,
    } = req.query;

    const filters = {
      search,
      accountStatus,
      verificationStatus,
      subscriptionPlan,
      openToCollaborate,
      dateJoinedStart,
      dateJoinedEnd,
    };

    const pagination = { page, limit };

    const result = await adminUserService.listUsers(filters, pagination);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error listing users:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get detailed profile of a user.
 */
const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await adminUserService.getUserById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error getting user details:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Create an admin note on a user profile.
 */
const createNote = async (req, res) => {
  try {
    const { userId } = req.params;
    const { content } = req.body;
    const adminId = req.user.id;

    const note = await adminUserService.createNote(userId, adminId, content);
    return res.status(201).json({ message: "Note added successfully", note });
  } catch (error) {
    console.error("Error creating admin note:", error);
    if (error.message === "User not found") {
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get all admin notes for a user.
 */
const getNotes = async (req, res) => {
  try {
    const { userId } = req.params;
    const notes = await adminUserService.getNotes(userId);
    return res.status(200).json(notes);
  } catch (error) {
    console.error("Error getting admin notes:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get administrative audit history of a user.
 */
const getAuditHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const history = await adminUserService.getAuditHistory(userId);
    return res.status(200).json(history);
  } catch (error) {
    console.error("Error getting audit history:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Moderate a user profile (suspend, restrict, reactivate, ban).
 */
const moderateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { action, reason } = req.body;
    const adminId = req.user.id;
    const ipAddress = req.ip || req.headers["x-forwarded-for"];
    const userAgent = req.headers["user-agent"];

    const updatedUser = await adminUserService.moderateUser(
      userId,
      adminId,
      action,
      reason,
      ipAddress,
      userAgent
    );

    return res.status(200).json({
      message: `User successfully ${action.toLowerCase()}ed`,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error moderating user:", error);
    if (error.message === "User not found") {
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get user activity feed.
 */
const getUserActivityFeed = async (req, res) => {
  try {
    const { userId } = req.params;
    const feed = await adminUserService.getUserActivityFeed(userId);
    return res.status(200).json(feed);
  } catch (error) {
    console.error("Error getting activity feed:", error);
    if (error.message === "User not found") {
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  listUsers,
  getUserDetails,
  createNote,
  getNotes,
  getAuditHistory,
  moderateUser,
  getUserActivityFeed,
};
