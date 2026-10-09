const {
  createProjectService,
  uploadProjectFileService,
  sendProjectMessageService,
  createProjectTaskService,
  updateProjectTaskStatusService,
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

    const projectFile = await uploadProjectFileService(
      req.params.id,
      req.user.id,
      req.file,
    );
    return res.status(201).json({ file: projectFile });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const sendProjectMessage = async (req, res) => {
  try {
    const content = req.body?.content?.trim();
    if (!content) return res.status(400).json({ error: "Message content is required." });

    const message = await sendProjectMessageService(req.params.id, req.user.id, content);
    return res.status(201).json({ message });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const createProjectTask = async (req, res) => {
  try {
    const title = req.body?.title?.trim();
    const { description, dueDate, status } = req.body || {};

    if (!title) return res.status(400).json({ error: "Task title is required." });
    if (title.length > 150) return res.status(400).json({ error: "Task title cannot exceed 150 characters." });
    if (description && description.length > 2000) return res.status(400).json({ error: "Task description cannot exceed 2000 characters." });
    if (dueDate && Number.isNaN(new Date(dueDate).getTime())) return res.status(400).json({ error: "Due date is invalid." });
    if (status && !["TODO", "IN_PROGRESS", "COMPLETED"].includes(status)) {
      return res.status(400).json({ error: "Task status is invalid." });
    }

    const task = await createProjectTaskService(req.params.id, req.user.id, {
      title,
      description: description?.trim(),
      dueDate,
      status,
    });
    return res.status(201).json({ task });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const updateProjectTaskStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["TODO", "IN_PROGRESS", "COMPLETED"].includes(status)) {
      return res.status(400).json({ error: "Task status is invalid." });
    }

    const task = await updateProjectTaskStatusService(req.params.id, req.params.taskId, req.user.id, status);
    return res.status(200).json({ task });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const getProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    const { visibility, page, limit, status, search, genre, sortBy, sortOrder } = req.query;
    const data = await getProjectListService(userId, { 
      visibility, page, limit, status, search, genre, sortBy, sortOrder 
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
    res.status(500).json({ error: error.message });
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
  sendProjectMessage,
  createProjectTask,
  updateProjectTaskStatus,
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
