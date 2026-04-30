const {
  createProjectService,
  getProjectListService,
  getProjectDetailsService,
  inviteCollaboratorService,
  updateProjectService,
  deleteProjectService,
  removeCollaboratorService,
} = require("../services/projects.service");
const { PROJECT_VISIBILITY } = require("../../../utils/constants");

const createProject = async (req, res) => {
  try {
    const { name, description, genre, startDate, visibility } = req.body;
    const userId = req.user.id;

    if (!name || !genre || !startDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (visibility && !Object.values(PROJECT_VISIBILITY).includes(visibility)) {
      return res.status(400).json({ error: `Invalid visibility value. Must be one of: ${Object.values(PROJECT_VISIBILITY).join(", ")}` });
    }

    const project = await createProjectService({
      userId,
      name,
      description,
      genre,
      startDate,
      visibility,
    });

    res.status(201).json({
      message: "Project created successfully",
      project,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    const { visibility, page, limit } = req.query;
    const data = await getProjectListService(userId, { visibility, page, limit });
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
    res.status(500).json({ error: error.message });
  }
};

const updateProject = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const userId = req.user.id;
    const { name, description, genre, startDate, visibility } = req.body;

    if (visibility && !Object.values(PROJECT_VISIBILITY).includes(visibility)) {
      return res.status(400).json({ error: `Invalid visibility value. Must be one of: ${Object.values(PROJECT_VISIBILITY).join(", ")}` });
    }

    const project = await updateProjectService(projectId, userId, {
      name,
      description,
      genre,
      startDate,
      visibility,
    });

    res.status(200).json({
      message: "Project updated successfully",
      project,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

module.exports = {
  createProject,
  getProjects,
  getProjectDetails,
  inviteCollaborator,
  updateProject,
  deleteProject,
  removeCollaborator,
};
