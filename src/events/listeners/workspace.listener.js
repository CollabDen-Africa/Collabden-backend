const EVENT_TYPES = require("../eventTypes");
const prisma = require("../../config/prismaClient");

/**
 * Register workspace-related event listeners on the Redis subscriber.
 * @param {import("ioredis").Redis} subscriberClient
 */
const registerWorkspaceListeners = (subscriberClient) => {
  // Subscribe to channels relevant to workspace management
  subscriberClient.subscribe(EVENT_TYPES.PROJECT_CREATED, (err) => {
    if (err) {
      console.error("[Workspace Listener] Failed to subscribe:", err.message);
    }
  });

  subscriberClient.on("message", async (channel, message) => {
    try {
      const payload = JSON.parse(message);

      if (channel === EVENT_TYPES.PROJECT_CREATED) {
        await handleWorkspaceAutoGeneration(payload);
      }
    } catch (error) {
      console.error(`[Workspace Listener Error] ${channel}:`, error.message);
    }
  });
};

/**
 * Handle PROJECT_CREATED event:
 * - Generate a welcome message in the project workspace
 * - Create initial default tasks
 * - Create a default NDA template (Legal Agreement)
 * - Log the workspace generation activity
 */
const handleWorkspaceAutoGeneration = async ({ project, userId }) => {
  console.log(`[Workspace Listener] Auto-generating workspace content for project: ${project.id}`);

  try {
    // 1. Create a Welcome Message
    await prisma.projectMessage.create({
      data: {
        projectId: project.id,
        senderId: userId,
        content: `👋 Welcome to the "${project.name}" workspace! 

This is your collaborative hub. You can:
- Track milestones in the **Tasks** tab.
- Share assets and documents in **Files**.
- Discuss progress right here in **Messages**.
- Manage contracts in **Legal**.

Good luck with your project!`,
      },
    });

    // 2. Create Default Tasks
    const defaultTasks = [
      {
        title: "Complete project profile",
        description: "Add a detailed description and upload a project cover image if applicable.",
        status: "TODO",
      },
      {
        title: "Invite core team members",
        description: "Add your collaborators to the project so they can access the workspace.",
        status: "TODO",
      },
      {
        title: "Define first milestone",
        description: "Create a task for your first major project objective.",
        status: "TODO",
      },
    ];

    await prisma.projectTask.createMany({
      data: defaultTasks.map((task) => ({
        ...task,
        projectId: project.id,
      })),
    });

    // 3. Create a Default Legal Agreement Template (NDA)
    await prisma.legalAgreement.create({
      data: {
        projectId: project.id,
        title: "Standard Mutual NDA Template",
        content: `MUTUAL NON-DISCLOSURE AGREEMENT\n\nThis Agreement is made between the Project Owner and all Collaborators of "${project.name}"...\n\n[This is a generated template. Please review and sign to activate.]`,
        status: "PENDING",
      },
    });

    // 4. Log the workspace generation activity
    await prisma.activityLog.create({
      data: {
        projectId: project.id,
        action: "WORKSPACE_AUTO_GENERATED",
        details: "Initial tasks, welcome message, and agreement templates have been created.",
      },
    });

    console.log(`[Workspace Listener] Workspace generation completed for project: ${project.id}`);
  } catch (error) {
    console.error(`[Workspace Listener Error] Failed to generate workspace:`, error);
  }
};

module.exports = { registerWorkspaceListeners };
