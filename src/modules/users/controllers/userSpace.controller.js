const {
  getUserSpace,
  removeSavedFile,
} = require("../services/userSpace.service");

const getUserSpaceHandler = async (req, res) => {
  try {
    const result = await getUserSpace(req.user.id, req.query);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in getUserSpaceHandler:", error);
    return res
      .status(error.status || 500)
      .json({ error: error.message || "Internal server error." });
  }
};

const removeSavedFileHandler = async (req, res) => {
  try {
    const { projectFileId } = req.params;
    const result = await removeSavedFile(req.user.id, projectFileId);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in removeSavedFileHandler:", error);
    return res
      .status(error.status || 500)
      .json({ error: error.message || "Internal server error." });
  }
};

module.exports = {
  getUserSpaceHandler,
  removeSavedFileHandler,
};
