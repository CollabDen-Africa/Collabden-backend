const {
  createProjectService,
  getProjectListService,
  getProjectDetailsService,
  inviteCollaboratorService,
  respondToInviteService,
  getMyInvitesService,
  updateProjectService,
  deleteProjectService,
  removeCollaboratorService,
  getProjectMetadataService,
  getMarketplaceProjectsService,
  getMarketplaceProjectSummaryService,
  reportProjectService,
  uploadProjectCoverService,
} = require("../services/projects.service");
const {
  sendProjectMessage: sendProjectMessageService,
  listProjectMessages: listProjectMessagesService,
  markProjectMessagesRead: markProjectMessagesReadService,
  toggleProjectMessageReaction: toggleProjectMessageReactionService,
} = require("../services/projectMessaging.service");
const {
  uploadMessageAttachment: uploadMessageAttachmentService,
} = require("../services/projectMessageAttachments.service");
const {
  createTask: createTaskService,
  listTasks: listTasksService,
  getTaskDetails: getTaskDetailsService,
  updateTask: updateTaskService,
  deleteTask: deleteTaskService,
  addTaskComment: addTaskCommentService,
  listTaskComments: listTaskCommentsService,
  deleteTaskComment: deleteTaskCommentService,
} = require("../services/projectTasks.service");
const {
  uploadProjectFile: uploadProjectFileService,
  listProjectFiles: listProjectFilesService,
  listFileVersions: listFileVersionsService,
  restoreFileVersion: restoreFileVersionService,
  streamProjectFile: streamProjectFileService,
  downloadProjectFile: downloadProjectFileService,
  deleteProjectFileVersion: deleteProjectFileVersionService,
  deleteProjectFile: deleteProjectFileService,
  getProjectStorageUsage: getProjectStorageUsageService,
} = require("../services/projectFiles.service");
const {
  getProjectRoyaltySplits,
  updateProjectRoyaltySplits,
} = require("../services/royalty.service");
const { PROJECT_VISIBILITY } = require("../../../utils/constants");

const parseArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return val.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
};

const parseBoolean = (val) => {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val.toLowerCase() === "true";
  return false;
};

const createProject = async (req, res) => {
  try {
    const { name, description, genre, startDate, endDate, visibility, coverImageUrl, budget, pricingType } = req.body;
    const userId = req.user.id;

    if (!name || !genre || !startDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (visibility && !Object.values(PROJECT_VISIBILITY).includes(visibility)) {
      return res.status(400).json({ error: `Invalid visibility value. Must be one of: ${Object.values(PROJECT_VISIBILITY).join(", ")}` });
    }

    const openToCollaborators = req.body.openToCollaborators !== undefined ? parseBoolean(req.body.openToCollaborators) : false;
    const collaboratorIds = parseArray(req.body.collaboratorIds);
    const requiredRoles = parseArray(req.body.requiredRoles);
    const requiredSkills = parseArray(req.body.requiredSkills);
    const coverImageFile = req.file;

    const project = await createProjectService({
      userId,
      name,
      description,
      genre,
      startDate,
      endDate,
      visibility,
      collaboratorIds,
      openToCollaborators,
      requiredRoles,
      requiredSkills,
      budget,
      pricingType,
      coverImageUrl,
      coverImageFile,
    });

    res.status(201).json({
      message: "Project created successfully",
      project,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const uploadProjectFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const { fileId, durationSeconds } = req.body || {};
    const projectFile = await uploadProjectFileService(
      req.params.id,
      req.user.id,
      req.file,
      { fileId, durationSeconds },
    );
    return res.status(201).json({ file: projectFile });
  } catch (error) {
    const body = { error: error.message, code: error.code };
    for (const k of ["usedBytes", "filesBytes", "chatBytes", "limitBytes", "upgradeTo"]) {
      if (error[k] !== undefined) body[k] = error[k];
    }
    return res.status(error.status || 500).json(body);
  }
};

const listProjectFiles = async (req, res) => {
  try {
    const files = await listProjectFilesService(req.params.id, req.user.id);
    return res.status(200).json({ files });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const getFileVersions = async (req, res) => {
  try {
    const data = await listFileVersionsService(req.params.id, req.params.fileId, req.user.id);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const restoreFileVersion = async (req, res) => {
  try {
    const file = await restoreFileVersionService(
      req.params.id,
      req.params.fileId,
      req.params.versionId,
      req.user.id,
    );
    return res.status(200).json({ file });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const streamProjectFile = async (req, res) => {
  try {
    const data = await streamProjectFileService(req.params.id, req.params.fileId, req.user.id, {
      versionId: req.query.versionId,
    });
    return res.status(200).json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const downloadProjectFile = async (req, res) => {
  try {
    const data = await downloadProjectFileService(req.params.id, req.params.fileId, req.user.id, {
      versionId: req.query.versionId,
    });
    return res.status(200).json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const deleteFileVersion = async (req, res) => {
  try {
    const data = await deleteProjectFileVersionService(
      req.params.id,
      req.params.fileId,
      req.params.versionId,
      req.user.id,
    );
    return res.status(200).json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const deleteProjectFile = async (req, res) => {
  try {
    const data = await deleteProjectFileService(req.params.id, req.params.fileId, req.user.id);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const getProjectStorageUsage = async (req, res) => {
  try {
    const data = await getProjectStorageUsageService(req.params.id, req.user.id);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const sendProjectMessage = async (req, res) => {
  try {
    const { content, parentId, voiceUrl, voiceDuration, attachments } = req.body || {};
    const message = await sendProjectMessageService(req.params.id, req.user.id, {
      content,
      parentId,
      voiceUrl,
      voiceDuration,
      attachments,
    });
    return res.status(201).json({ message });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const getProjectMessages = async (req, res) => {
  try {
    const { limit, beforeId } = req.query;
    const messages = await listProjectMessagesService(req.params.id, req.user.id, { limit, beforeId });
    return res.status(200).json({ messages });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const markProjectMessagesRead = async (req, res) => {
  try {
    const result = await markProjectMessagesReadService(req.params.id, req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const uploadProjectMessageAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Include a file in the 'file' field." });
    }
    const result = await uploadMessageAttachmentService(req.params.id, req.user.id, req.file);
    return res.status(201).json(result);
  } catch (error) {
    const body = { error: error.message, code: error.code };
    for (const k of ["usedBytes", "filesBytes", "chatBytes", "limitBytes", "upgradeTo"]) {
      if (error[k] !== undefined) body[k] = error[k];
    }
    return res.status(error.status || 500).json(body);
  }
};

const reactToProjectMessage = async (req, res) => {
  try {
    const { emoji } = req.body || {};
    const result = await toggleProjectMessageReactionService(req.user.id, req.params.messageId, emoji);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const createProjectTask = async (req, res) => {
  try {
    const { title, description, dueDate, status, priority, assigneeIds } = req.body || {};
    const task = await createTaskService(req.params.id, req.user.id, {
      title,
      description,
      dueDate,
      status,
      priority,
      assigneeIds,
    });
    return res.status(201).json({ task });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const listProjectTasks = async (req, res) => {
  try {
    const { status, priority, assigneeId, groupBy } = req.query;
    const data = await listTasksService(req.params.id, req.user.id, {
      status,
      priority,
      assigneeId,
      groupBy,
    });
    return res.status(200).json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const getProjectTaskDetails = async (req, res) => {
  try {
    const task = await getTaskDetailsService(req.params.id, req.params.taskId, req.user.id);
    return res.status(200).json({ task });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const updateProjectTask = async (req, res) => {
  try {
    const task = await updateTaskService(req.params.id, req.params.taskId, req.user.id, req.body || {});
    return res.status(200).json({ task });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const deleteProjectTask = async (req, res) => {
  try {
    const data = await deleteTaskService(req.params.id, req.params.taskId, req.user.id);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const addProjectTaskComment = async (req, res) => {
  try {
    const { content, parentId } = req.body || {};
    const comment = await addTaskCommentService(req.params.id, req.params.taskId, req.user.id, {
      content,
      parentId,
    });
    return res.status(201).json({ comment });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const listProjectTaskComments = async (req, res) => {
  try {
    const comments = await listTaskCommentsService(req.params.id, req.params.taskId, req.user.id);
    return res.status(200).json({ comments });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const deleteProjectTaskComment = async (req, res) => {
  try {
    const data = await deleteTaskCommentService(
      req.params.id,
      req.params.taskId,
      req.params.commentId,
      req.user.id,
    );
    return res.status(200).json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const getProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    const { visibility, page, limit, status, search, genre, sortBy, sortOrder, hasMessages } = req.query;
    const data = await getProjectListService(userId, { 
      visibility, page, limit, status, search, genre, sortBy, sortOrder, hasMessages 
    });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProjectDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const project = await getProjectDetailsService(id, userId);
    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const inviteCollaborator = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { collaboratorId } = req.body;
    const inviterId = req.user.id;

    if (!collaboratorId) {
      return res.status(400).json({ error: "Collaborator ID is required" });
    }

    const collaborator = await inviteCollaboratorService(projectId, collaboratorId, inviterId);
    res.status(200).json({
      message: "Collaborator invited successfully",
      collaborator,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, description, genre, startDate, endDate, visibility, coverImageUrl, budget, pricingType } = req.body;

    const openToCollaborators = req.body.openToCollaborators !== undefined ? parseBoolean(req.body.openToCollaborators) : undefined;
    const collaboratorIds = req.body.collaboratorIds !== undefined ? parseArray(req.body.collaboratorIds) : undefined;
    const requiredRoles = req.body.requiredRoles !== undefined ? parseArray(req.body.requiredRoles) : undefined;
    const requiredSkills = req.body.requiredSkills !== undefined ? parseArray(req.body.requiredSkills) : undefined;
    const coverImageFile = req.file;

    const project = await updateProjectService(id, userId, {
      name,
      description,
      genre,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
      visibility,
      openToCollaborators,
      requiredRoles,
      requiredSkills,
      budget,
      pricingType,
      coverImageUrl,
      coverImageFile,
    });

    res.status(200).json({
      message: "Project updated successfully",
      project,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const uploadProjectCover = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded. Include a file in the 'coverImage' field." });
    }

    const result = await uploadProjectCoverService(req.params.id, req.user.id, req.file);
    res.status(200).json({
      message: "Project cover image uploaded successfully",
      coverImageUrl: result.coverImageUrl,
      project: result.project,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

const deleteProject = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const userId = req.user.id;

    const result = await deleteProjectService(projectId, userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

const removeCollaborator = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { collaboratorId } = req.params;
    const requesterId = req.user.id;

    const result = await removeCollaboratorService(projectId, collaboratorId, requesterId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProjectMetadata = async (req, res) => {
  try {
    const { id } = req.params;
    const metadata = await getProjectMetadataService(id);
    res.status(200).json(metadata);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const getMarketplace = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit, genre, role, requirements, search, startDate, endDate, sortBy, sortOrder } = req.query;
    const data = await getMarketplaceProjectsService(userId, {
      page,
      limit,
      genre,
      role,
      requirements,
      search,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMarketplaceSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getMarketplaceProjectSummaryService(id);
    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const reportProject = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const reporterId = req.user.id;
    const reportData = req.body;

    const report = await reportProjectService(projectId, reporterId, reportData);
    res.status(201).json({
      message: "Project reported successfully",
      report,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const respondToInvite = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { action } = req.body;
    const userId = req.user.id;

    if (!action || !["ACCEPT", "DECLINE"].includes(action)) {
      return res.status(400).json({ error: "Action must be ACCEPT or DECLINE" });
    }

    const updated = await respondToInviteService(projectId, userId, action);
    res.status(200).json({
      message: `Invitation ${action.toLowerCase()}d successfully`,
      collaborator: updated,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMyInvites = async (req, res) => {
  try {
    const userId = req.user.id;
    const invites = await getMyInvitesService(userId);
    res.status(200).json(invites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getRoyaltySplits = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const userId = req.user.id;
    const result = await getProjectRoyaltySplits(projectId, userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

const updateRoyaltySplits = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const ownerId = req.user.id;
    const { splits } = req.body;
    const result = await updateProjectRoyaltySplits(projectId, ownerId, splits);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

module.exports = {
  createProject,
  uploadProjectFile,
  listProjectFiles,
  getFileVersions,
  restoreFileVersion,
  streamProjectFile,
  downloadProjectFile,
  deleteFileVersion,
  deleteProjectFile,
  getProjectStorageUsage,
  sendProjectMessage,
  getProjectMessages,
  markProjectMessagesRead,
  reactToProjectMessage,
  uploadProjectMessageAttachment,
  createProjectTask,
  listProjectTasks,
  getProjectTaskDetails,
  updateProjectTask,
  deleteProjectTask,
  addProjectTaskComment,
  listProjectTaskComments,
  deleteProjectTaskComment,
  getProjects,
  getProjectDetails,
  inviteCollaborator,
  respondToInvite,
  getMyInvites,
  updateProject,
  deleteProject,
  removeCollaborator,
  getProjectMetadata,
  getMarketplace,
  getMarketplaceSummary,
  reportProject,
  uploadProjectCover,
  getRoyaltySplits,
  updateRoyaltySplits,
};
