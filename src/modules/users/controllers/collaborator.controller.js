const collaboratorService = require("../services/collaborator.service");

const getCollaborators = async (req, res) => {
  try {
    const { name, skills, genres, role, openToCollaborate } = req.query;
    const collaborators = await collaboratorService.listCollaborators({
      name,
      skills,
      genres,
      role,
      openToCollaborate,
    });
    res.status(200).json(collaborators);
  } catch (error) {
    console.error("Error fetching collaborators:", error);
    res.status(500).json({ error: "Failed to fetch collaborators" });
  }
};

const getCollaboratorById = async (req, res) => {
  try {
    const { userId } = req.params;
    const details = await collaboratorService.getCollaboratorDetails(userId);
    
    if (!details) {
      return res.status(404).json({ error: "Collaborator not found" });
    }
    
    res.status(200).json(details);
  } catch (error) {
    console.error("Error fetching collaborator details:", error);
    res.status(500).json({ error: "Failed to fetch collaborator details" });
  }
};

const updateAvailability = async (req, res) => {
  try {
    const userId = req.user.id;
    const { openToCollaborate } = req.body;
    
    const profile = await collaboratorService.updateAvailabilityStatus(userId, openToCollaborate);
    
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    
    res.status(200).json({
      message: "Availability status updated successfully",
      profile,
    });
  } catch (error) {
    console.error("Error updating availability:", error);
    res.status(500).json({ error: "Failed to update availability status" });
  }
};

const listSkills = async (req, res) => {
  try {
    const skills = await collaboratorService.getUniqueSkills();
    res.status(200).json(skills);
  } catch (error) {
    console.error("Error fetching unique skills:", error);
    res.status(500).json({ error: "Failed to fetch unique skills" });
  }
};

const listGenres = async (req, res) => {
  try {
    const genres = await collaboratorService.getUniqueGenres();
    res.status(200).json(genres);
  } catch (error) {
    console.error("Error fetching unique genres:", error);
    res.status(500).json({ error: "Failed to fetch unique genres" });
  }
};

module.exports = {
  getCollaborators,
  getCollaboratorById,
  updateAvailability,
  listSkills,
  listGenres,
};
