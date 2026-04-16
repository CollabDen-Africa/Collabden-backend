const {
  createProjectService,
  getProjectListService,
  getProjectDetailsService,
  inviteCollaboratorService,
} = require("../services/projects.service");

const createProject = async (req, res) => {
  try {
    const { name, description, genre, startDate, visibility } = req.body;
    const userId = req.user.id;

    if (!name || !genre || !startDate) {
      return res.status(400).json({ error: "Missing required fields" });
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
    const projects = await getProjectListService(userId);
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProjectDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getProjectDetailsService(id);
    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const inviteCollaborator = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { collaboratorId } = req.body;

    if (!collaboratorId) {
      return res.status(400).json({ error: "Collaborator ID is required" });
    }

    const collaborator = await inviteCollaboratorService(projectId, collaboratorId);
    res.status(200).json({
      message: "Collaborator invited successfully",
      collaborator,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectDetails,
  inviteCollaborator,
};
