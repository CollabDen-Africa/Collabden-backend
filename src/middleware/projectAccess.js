const prisma = require("../config/prismaClient");

const requireProjectAccess = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    if (!projectId) {
      return res.status(400).json({ error: "Project ID is required." });
    }

    // Check if the user is the project owner
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    if (project.ownerId === userId) {
      return next();
    }

    // Check if the user is a collaborator
    const collaborator = await prisma.projectCollaborator.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (!collaborator || !collaborator.isActive) {
      return res.status(403).json({ error: "Access denied." });
    }

    next();
  } catch (error) {
    console.error("Error in requireProjectAccess middleware:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

module.exports = {
  requireProjectAccess,
};
