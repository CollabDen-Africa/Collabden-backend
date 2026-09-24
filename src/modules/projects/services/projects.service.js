const prisma = require("../../../config/prismaClient");
const supabase = require("../../../config/supabase");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");
const {
  PROJECT_VISIBILITY,
  PROJECT_STATUS,
  COLLABORATOR_ROLE,
} = require("../../../utils/constants");
const { TIER_LIMITS } = require("../../../config/constants");
const {
  getPlatformGeneralSettings,
  getPlatformMarketplaceSettings,
  getPlatformUserSettings,
} = require("../../../services/platformSettings.service");

const checkConnection = async (userId, targetId) => {
  const connection = await prisma.userConnection.findFirst({
    where: {
      OR: [
        { senderId: userId, receiverId: targetId, status: "ACCEPTED" },
        { senderId: targetId, receiverId: userId, status: "ACCEPTED" },
      ],
    },
  });
  return !!connection;
};

const PROJECT_FILES_BUCKET = "project-files";
const ALLOWED_PROJECT_FILE_TYPES = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/flac",
  "audio/x-flac",
  "audio/midi",
  "audio/x-midi",
  "application/pdf",
]);

const uploadProjectFileService = async (projectId, userId, file) => {
  if (!supabase) {
    const error = new Error("File storage is not configured.");
    error.status = 503;
    throw error;
  }

  if (!ALLOWED_PROJECT_FILE_TYPES.has(file.mimetype)) {
    const error = new Error("Unsupported file type. Upload WAV, MP3, FLAC, MIDI, or PDF files.");
    error.status = 400;
    throw error;
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      isDeleted: false,
      OR: [
        { ownerId: userId },
        { collaborators: { some: { userId, isActive: true } } },
      ],
    },
    select: { id: true },
  });

  if (!project) {
    const error = new Error("Project not found or you do not have permission to upload files.");
    error.status = 404;
    throw error;
  }

  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${projectId}/${userId}-${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });

  if (uploadError) {
    const error = new Error("File upload failed. Please try again.");
    error.status = 502;
    throw error;
  }

  const projectFile = await prisma.projectFile.create({
    data: {
      projectId,
      name: file.originalname,
      url: storagePath,
      size: file.size,
      type: file.mimetype,
    },
  });

  await prisma.activityLog.create({
    data: {
      projectId,
      action: "FILE_UPLOADED",
      details: `File \"${file.originalname}\" was uploaded.`,
    },
  });

  return projectFile;
};

const sendProjectMessageService = async (projectId, userId, content) => {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      isDeleted: false,
      OR: [
        { ownerId: userId },
        { collaborators: { some: { userId, isActive: true } } },
      ],
    },
    select: { id: true },
  });

  if (!project) {
    const error = new Error("Project not found or you do not have permission to send messages.");
    error.status = 404;
    throw error;
  }

  const message = await prisma.projectMessage.create({
    data: { projectId, senderId: userId, content },
  });
  const sender = await prisma.userProfile.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, legalName: true, avatarUrl: true },
  });

  return { ...message, sender };
};

const createProjectTaskService = async (projectId, userId, {
  title,
  description,
  dueDate,
  status = "TODO",
}) => {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      isDeleted: false,
      OR: [
        { ownerId: userId },
        { collaborators: { some: { userId, isActive: true } } },
      ],
    },
    select: { id: true },
  });

  if (!project) {
    const error = new Error("Project not found or you do not have permission to create tasks.");
    error.status = 404;
    throw error;
  }

  const task = await prisma.projectTask.create({
    data: {
      projectId,
      title,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      status,
    },
  });

  await prisma.activityLog.create({
    data: {
      projectId,
      action: "TASK_CREATED",
      details: `Task \"${title}\" was created.`,
    },
  });

  return task;
};

const updateProjectTaskStatusService = async (projectId, taskId, userId, status) => {
  const task = await prisma.projectTask.findFirst({
    where: {
      id: taskId,
      projectId,
      project: {
        isDeleted: false,
        OR: [
          { ownerId: userId },
          { collaborators: { some: { userId, isActive: true } } },
        ],
      },
    },
    select: { id: true, title: true, status: true },
  });

  if (!task) {
    const error = new Error("Task not found or you do not have permission to update it.");
    error.status = 404;
    throw error;
  }

  if (task.status === status) return task;

  const updatedTask = await prisma.projectTask.update({
    where: { id: taskId },
    data: { status },
  });

  await prisma.activityLog.create({
    data: {
      projectId,
      action: "TASK_STATUS_UPDATED",
      details: `Task \"${task.title}\" moved to ${status.replace("_", " ").toLowerCase()}.`,
    },
  });

  return updatedTask;
};

const createProjectService = async ({
  userId,
  name,
  description,
  genre,
  startDate,
  endDate,
  visibility,
  collaboratorIds = [],
  openToCollaborators = false,
  requiredRoles = [],
  requiredSkills = [],
  budget,
  pricingType,
}) => {
  // Fetch user profile for tier check
  const user = await prisma.userProfile.findUnique({
    where: { id: userId },
    include: {
      ownedProjects: {
        where: { status: "ACTIVE", isDeleted: false },
      },
    },
  });

  if (!user) throw new Error("User not found");

  const limits = TIER_LIMITS[user.tier];

  if (openToCollaborators) {
    const [generalSettings, marketplaceSettings] = await Promise.all([
      getPlatformGeneralSettings(),
      getPlatformMarketplaceSettings(),
    ]);

    if (!generalSettings.enableMarketplace) {
      throw new Error(
        "Marketplace is currently disabled. Projects cannot be opened for collaboration."
      );
    }

    // Max active listings limit
    const activeListingsCount = await prisma.project.count({
      where: {
        ownerId: userId,
        openToCollaborators: true,
        isDeleted: false,
        status: "ACTIVE",
      },
    });
    if (activeListingsCount >= marketplaceSettings.maxActiveListingsPerUser) {
      throw new Error(
        `Maximum active marketplace listings limit reached (${marketplaceSettings.maxActiveListingsPerUser}).`
      );
    }

    // Budget rules
    if (marketplaceSettings.requireProjectBudget) {
      if (!budget || Number(budget) <= 0) {
        throw new Error(
          "A project budget is required for marketplace listings."
        );
      }
    }
    if (marketplaceSettings.minimumProjectBudget > 0 && budget !== undefined) {
      if (Number(budget) < marketplaceSettings.minimumProjectBudget) {
        throw new Error(
          `Project budget must be at least ${marketplaceSettings.minimumProjectBudget}.`
        );
      }
    }

    // Deadline rule
    if (marketplaceSettings.requireProjectDeadline) {
      if (!endDate) {
        throw new Error(
          "A project deadline (end date) is required for marketplace listings."
        );
      }
      if (new Date(endDate) <= new Date(startDate)) {
        throw new Error("Project end date must be after the start date.");
      }
    }

    // Pricing model rules
    if (
      pricingType === "fixed" &&
      !marketplaceSettings.allowFixedPriceProjects
    ) {
      throw new Error(
        "Fixed-price projects are currently not allowed on the marketplace."
      );
    }
    if (pricingType === "hourly" && !marketplaceSettings.allowHourlyProjects) {
      throw new Error(
        "Hourly projects are currently not allowed on the marketplace."
      );
    }

    // Posting cooldown
    if (marketplaceSettings.projectPostingCooldownHours > 0) {
      const lastListing = await prisma.project.findFirst({
        where: { ownerId: userId, openToCollaborators: true, isDeleted: false },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (lastListing) {
        const hoursSinceLast =
          (Date.now() - new Date(lastListing.createdAt).getTime()) /
          (1000 * 60 * 60);
        const hoursRemaining =
          marketplaceSettings.projectPostingCooldownHours - hoursSinceLast;
        if (hoursRemaining > 0) {
          throw new Error(
            `You must wait ${Math.ceil(hoursRemaining)} more hour(s) before posting another marketplace listing.`
          );
        }
      }
    }
  }

  // Check collaborator invitations
  if (collaboratorIds.length > 0) {
    // 1. Check collaborator limit
    if (collaboratorIds.length > limits.MAX_COLLABORATORS) {
      throw new Error(
        `Collaborator limit reached for ${user.tier} tier. Max ${limits.MAX_COLLABORATORS} collaborators allowed.`
      );
    }

    // 2. Check connections
    // 2. Check connections and verification
    for (const collaboratorId of collaboratorIds) {
      const isConnected = await checkConnection(userId, collaboratorId);
      if (!isConnected) {
        throw new Error(
          `You can only invite collaborators you are connected with. Please send a connection request to user ${collaboratorId} first.`
        );
      }

      const colProfile = await prisma.userProfile.findUnique({
        where: { id: collaboratorId },
      });

      if (
        !colProfile ||
        !colProfile.identityVerified ||
        !colProfile.legalName
      ) {
        throw new Error(
          `Collaborator ${collaboratorId} must complete their identity verification (via government ID/NIN) and set their legal name before they can collaborate on projects.`
        );
      }
    }
  }

  const projectData = {
    name,
    description,
    genre,
    startDate: new Date(startDate),
    visibility,
    ownerId: userId,
    openToCollaborators,
    requiredRoles,
    requiredSkills,
    collaborators: {
      create: [
        {
          userId: userId,
          role: COLLABORATOR_ROLE.OWNER,
          isActive: true,
          inviteStatus: "ACCEPTED",
        },
        ...collaboratorIds.map((id) => ({
          userId: id,
          role: COLLABORATOR_ROLE.COLLABORATOR,
          isActive: false,
          inviteStatus: "PENDING",
        })),
      ],
    },
    activities: {
      create: {
        action: "PROJECT_CREATED",
        details: `Project "${name}" was created with ${collaboratorIds.length} initial collaborators.`,
      },
    },
    metadata: {
      creatorId: userId,
      initialCollaboratorCount: collaboratorIds.length,
      creationPlatform: "web-dashboard",
      listingApprovalStatus: openToCollaborators
        ? await (async () => {
            const ms = await getPlatformMarketplaceSettings();
            return ms.listingApprovalRequired ? "PENDING" : "APPROVED";
          })()
        : null,
    },
  };

  const project = await prisma.project.create({
    data: projectData,
    include: {
      owner: { select: { displayName: true, legalName: true } },
      collaborators: true,
      activities: true,
    },
  });

  // Publish event
  await publishEvent(EVENT_TYPES.PROJECT_CREATED, { project, userId });

  // Publish invitation events for all initial collaborators
  if (Array.isArray(collaboratorIds) && collaboratorIds.length > 0) {
    const inviterName = project.owner?.displayName || project.owner?.legalName || "A project owner";
    for (const collabId of collaboratorIds) {
      await publishEvent(EVENT_TYPES.COLLABORATOR_INVITED, {
        projectId: project.id,
        projectName: project.name,
        collaboratorId: collabId,
        inviterName,
      });
    }
  }

  return project;
};

const getProjectListService = async (userId, filters = {}) => {
  const {
    visibility,
    page = 1,
    limit = 10,
    status,
    search,
    genre,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;
  const skip =
    (Math.max(1, parseInt(page) || 1) - 1) *
    Math.min(100, Math.max(1, parseInt(limit) || 10));
  const take = Math.min(100, Math.max(1, parseInt(limit) || 10));

  const where = {
    isDeleted: false,
    AND: [],
  };

  if (visibility) {
    where.visibility = visibility;

    // If filtering for PRIVATE, must be owner or collaborator
    if (visibility === PROJECT_VISIBILITY.PRIVATE) {
      where.AND.push({
        OR: [
          { ownerId: userId },
          {
            collaborators: {
              some: {
                userId: userId,
                isActive: true,
              },
            },
          },
        ],
      });
    }
  } else {
    // Default: Show only projects belonging to user (owner or active collaborator)
    where.AND.push({
      OR: [
        { ownerId: userId },
        {
          collaborators: {
            some: {
              userId: userId,
              isActive: true,
            },
          },
        },
      ],
    });
  }

  if (status) {
    where.status = status;
  }

  if (genre) {
    where.genre = genre;
  }

  if (search) {
    where.AND.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  // Define allowed sorting fields to prevent injection or invalid fields
  const allowedSortFields = ["createdAt", "updatedAt", "name", "startDate"];
  const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  const validSortOrder = ["asc", "desc"].includes(sortOrder.toLowerCase())
    ? sortOrder.toLowerCase()
    : "desc";

  // Fetch total count for pagination metadata
  const total = await prisma.project.count({ where });

  const projects = await prisma.project.findMany({
    where,
    include: {
      owner: {
        select: {
          id: true,
          email: true,
          displayName: true,
          legalName: true,
          avatarUrl: true,
        },
      },
      collaborators: {
        where: { isActive: true },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              legalName: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
    orderBy: { [validSortBy]: validSortOrder },
    skip,
    take,
  });

  return {
    projects,
    meta: {
      total,
      page: parseInt(page),
      limit: take,
      totalPages: Math.ceil(total / take),
    },
  };
};

const getProjectDetailsService = async (projectId, userId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: true,
      collaborators: {
        include: {
          user: true,
        },
      },
      tasks: true,
      files: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      agreements: true,
      activities: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found");
  }

  // Visibility Check
  if (project.visibility === PROJECT_VISIBILITY.PRIVATE) {
    const isOwner = project.ownerId === userId;
    const isCollaborator = project.collaborators.some(
      (c) => c.userId === userId && c.isActive
    );

    if (!isOwner && !isCollaborator) {
      throw new Error("Project not found");
    }
  }

  // For non-owner requests, filter collaborators list to active only
  if (project.ownerId !== userId) {
    project.collaborators = project.collaborators.filter((c) => c.isActive);
  }

  if (supabase && project.files.length > 0) {
    project.files = await Promise.all(
      project.files.map(async (file) => {
        // Legacy records may already contain a direct URL.
        if (file.url.startsWith("http")) return file;

        const { data, error } = await supabase.storage
          .from(PROJECT_FILES_BUCKET)
          .createSignedUrl(file.url, 3600);
        return !error && data?.signedUrl ? { ...file, url: data.signedUrl } : file;
      }),
    );
  }

  const senderIds = [...new Set(project.messages.map((message) => message.senderId))];
  if (senderIds.length > 0) {
    const senders = await prisma.userProfile.findMany({
      where: { id: { in: senderIds } },
      select: { id: true, email: true, displayName: true, legalName: true, avatarUrl: true },
    });
    const sendersById = new Map(senders.map((sender) => [sender.id, sender]));
    project.messages = project.messages.map((message) => ({
      ...message,
      sender: sendersById.get(message.senderId) || null,
    }));
  }

  return project;
};

const inviteCollaboratorService = async (
  projectId,
  collaboratorId,
  inviterId
) => {
  // 1. Fetch project to check permissions and limits
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: true,
      collaborators: true,
    },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found.");
  }

  // 2. Permission Validation: Only owner can invite for now (as per requirements)
  if (project.ownerId !== inviterId) {
    throw new Error("Only the project owner can invite collaborators.");
  }

  // 3. User Validation
  if (project.ownerId === collaboratorId) {
    throw new Error("This user is already the owner of the project.");
  }

  const userToInvite = await prisma.userProfile.findUnique({
    where: { id: collaboratorId },
  });

  if (!userToInvite) {
    throw new Error("The user you are trying to invite does not exist.");
  }

  // 4. Connection Check
  const isConnected = await checkConnection(inviterId, collaboratorId);
  if (!isConnected) {
    throw new Error(
      "You can only invite collaborators you are connected with."
    );
  }

  // 5. Tier/Limit Check
  const limits = TIER_LIMITS[project.owner.tier];
  const activeCollaborators = project.collaborators.filter(
    (c) => c.isActive && c.role !== COLLABORATOR_ROLE.OWNER
  );

  if (
    limits.MAX_COLLABORATORS !== -1 &&
    activeCollaborators.length >= limits.MAX_COLLABORATORS
  ) {
    throw new Error(
      `Collaborator limit reached for ${project.owner.tier} tier. Max ${limits.MAX_COLLABORATORS} collaborators allowed.`
    );
  }

  // 6. Check if already a collaborator (including inactive ones)
  const existingCollaborator = await prisma.projectCollaborator.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: collaboratorId,
      },
    },
  });

  if (existingCollaborator) {
    if (existingCollaborator.inviteStatus === "PENDING" || existingCollaborator.isActive) {
      throw new Error(
        "This user already has a pending or active invitation for this project."
      );
    } else {
      // Re-invite a previously declined collaborator — reset to PENDING
      const collaborator = await prisma.projectCollaborator.update({
        where: { id: existingCollaborator.id },
        data: { isActive: false, inviteStatus: "PENDING", role: COLLABORATOR_ROLE.COLLABORATOR },
      });

      await publishEvent(EVENT_TYPES.COLLABORATOR_INVITED, {
        projectId,
        projectName: project.name,
        collaboratorId,
        inviterName: project.owner.displayName || project.owner.legalName || "A project owner",
      });

      return collaborator;
    }
  }

  // 7. Add new collaborator as PENDING invite
  const collaborator = await prisma.projectCollaborator.create({
    data: {
      projectId,
      userId: collaboratorId,
      role: COLLABORATOR_ROLE.COLLABORATOR,
      isActive: false,
      inviteStatus: "PENDING",
    },
  });

  // 8. Publish event
  await publishEvent(EVENT_TYPES.COLLABORATOR_INVITED, {
    projectId,
    projectName: project.name,
    collaboratorId,
    inviterName: project.owner.displayName || project.owner.legalName || "A project owner",
  });

  return collaborator;
};

/**
 * Respond to a collaboration invite (ACCEPT or DECLINE).
 * Only the invited user can respond to their own invite.
 */
const respondToInviteService = async (projectId, userId, action) => {
  if (action !== "ACCEPT" && action !== "DECLINE") {
    throw new Error("Invalid action. Must be ACCEPT or DECLINE.");
  }

  const invite = await prisma.projectCollaborator.findUnique({
    where: { projectId_userId: { projectId, userId } },
    include: { project: { include: { owner: true } } },
  });

  if (!invite) {
    throw new Error("Invitation not found.");
  }

  if (invite.inviteStatus !== "PENDING") {
    throw new Error(`This invitation has already been ${invite.inviteStatus.toLowerCase()}.`);
  }

  if (invite.role === COLLABORATOR_ROLE.OWNER) {
    throw new Error("Project owners cannot respond to their own project invite.");
  }

  const isAccepting = action === "ACCEPT";

  const updated = await prisma.projectCollaborator.update({
    where: { projectId_userId: { projectId, userId } },
    data: {
      inviteStatus: isAccepting ? "ACCEPTED" : "DECLINED",
      isActive: isAccepting,
    },
  });

  // Notify project owner
  const eventType = isAccepting
    ? EVENT_TYPES.COLLABORATOR_INVITE_ACCEPTED
    : EVENT_TYPES.COLLABORATOR_INVITE_DECLINED;

  await publishEvent(eventType, {
    projectId,
    projectName: invite.project.name,
    ownerId: invite.project.ownerId,
    collaboratorId: userId,
  });

  return updated;
};

/**
 * Get all pending collaboration invites for the authenticated user.
 */
const getMyInvitesService = async (userId) => {
  const invites = await prisma.projectCollaborator.findMany({
    where: {
      userId,
      inviteStatus: "PENDING",
      isActive: false,
      project: { isDeleted: false },
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          description: true,
          genre: true,
          startDate: true,
          visibility: true,
          owner: {
            select: {
              id: true,
              displayName: true,
              legalName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return invites;
};

const updateProjectService = async (projectId, userId, updateData) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, isDeleted: true, metadata: true },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found.");
  }

  if (project.ownerId !== userId) {
    throw new Error("Only the project owner can update project settings.");
  }

  // If being opened to collaborators for the first time (or re-opened), enforce rules
  if (updateData.openToCollaborators === true) {
    const [generalSettings, marketplaceSettings] = await Promise.all([
      getPlatformGeneralSettings(),
      getPlatformMarketplaceSettings(),
    ]);

    if (!generalSettings.enableMarketplace) {
      throw new Error(
        "Marketplace is currently disabled. Projects cannot be opened for collaboration."
      );
    }

    const activeListingsCount = await prisma.project.count({
      where: {
        ownerId: userId,
        openToCollaborators: true,
        isDeleted: false,
        status: "ACTIVE",
        NOT: { id: projectId },
      },
    });
    if (activeListingsCount >= marketplaceSettings.maxActiveListingsPerUser) {
      throw new Error(
        `Maximum active marketplace listings limit reached (${marketplaceSettings.maxActiveListingsPerUser}).`
      );
    }

    // Budget rules
    const budget = updateData.budget;
    if (marketplaceSettings.requireProjectBudget) {
      if (!budget || Number(budget) <= 0) {
        throw new Error(
          "A project budget is required for marketplace listings."
        );
      }
    }
    if (marketplaceSettings.minimumProjectBudget > 0 && budget !== undefined) {
      if (Number(budget) < marketplaceSettings.minimumProjectBudget) {
        throw new Error(
          `Project budget must be at least ${marketplaceSettings.minimumProjectBudget}.`
        );
      }
    }

    // Deadline rule
    const endDate = updateData.endDate;
    const startDate = updateData.startDate || project.startDate;
    if (marketplaceSettings.requireProjectDeadline) {
      if (!endDate) {
        throw new Error(
          "A project deadline (end date) is required for marketplace listings."
        );
      }
      if (new Date(endDate) <= new Date(startDate)) {
        throw new Error("Project end date must be after the start date.");
      }
    }

    // Pricing model rules
    const pricingType = updateData.pricingType;
    if (
      pricingType === "fixed" &&
      !marketplaceSettings.allowFixedPriceProjects
    ) {
      throw new Error(
        "Fixed-price projects are currently not allowed on the marketplace."
      );
    }
    if (pricingType === "hourly" && !marketplaceSettings.allowHourlyProjects) {
      throw new Error(
        "Hourly projects are currently not allowed on the marketplace."
      );
    }

    // Update listing approval status on the metadata
    const existingMeta =
      project.metadata && typeof project.metadata === "object"
        ? project.metadata
        : {};
    updateData.metadata = {
      ...existingMeta,
      ...(updateData.metadata || {}),
      listingApprovalStatus: marketplaceSettings.listingApprovalRequired
        ? "PENDING"
        : "APPROVED",
    };
  }

  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...updateData,
      startDate: updateData.startDate
        ? new Date(updateData.startDate)
        : undefined,
    },
  });

  await publishEvent(EVENT_TYPES.PROJECT_UPDATED, {
    projectId,
    userId,
    updateData,
  });

  return updatedProject;
};

const deleteProjectService = async (projectId, userId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, name: true, isDeleted: true },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found.");
  }

  if (project.ownerId !== userId) {
    throw new Error("Only the project owner can delete this project.");
  }

  // Soft delete
  await prisma.project.update({
    where: { id: projectId },
    data: { isDeleted: true },
  });

  await publishEvent(EVENT_TYPES.PROJECT_DELETED, {
    projectId,
    projectName: project.name,
    userId,
  });

  return { message: `Project "${project.name}" has been deleted.` };
};

const removeCollaboratorService = async (
  projectId,
  targetUserId,
  requesterId
) => {
  // 1. Fetch project to check ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, isDeleted: true },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found.");
  }

  // 2. Find the active collaborator record
  const collaboratorRecord = await prisma.projectCollaborator.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: targetUserId,
      },
    },
  });

  if (!collaboratorRecord) {
    throw new Error("User is not a collaborator on this project.");
  }

  // 3. Permission Check: Only owner can remove others, or a collaborator can remove themselves
  if (project.ownerId !== requesterId && targetUserId !== requesterId) {
    throw new Error("You do not have permission to remove this collaborator.");
  }

  // 4. Safety Check: Cannot remove the owner
  if (project.ownerId === targetUserId) {
    throw new Error("The project owner cannot be removed from the project.");
  }

  // 5. Remove the collaborator (soft delete)
  await prisma.projectCollaborator.update({
    where: { id: collaboratorRecord.id },
    data: { isActive: false },
  });

  // 6. Publish event
  await publishEvent(EVENT_TYPES.COLLABORATOR_REMOVED, {
    projectId,
    projectName: project.name,
    removedUserId: targetUserId,
  });

  return { message: "Collaborator removed successfully." };
};

const getProjectMetadataService = async (projectId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      _count: {
        select: {
          tasks: true,
          files: true,
          messages: true,
          agreements: true,
        },
      },
      collaborators: {
        where: { isActive: true },
      },
    },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found");
  }

  return {
    projectId: project.id,
    name: project.name,
    ownerId: project.ownerId,
    status: project.status,
    visibility: project.visibility,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    creationMetadata: project.metadata,
    currentStats: {
      ...project._count,
      collaborators: project.collaborators.length,
    },
  };
};

const getMarketplaceProjectsService = async (userId, filters = {}) => {
  const {
    page = 1,
    genre,
    role,
    requirements,
    skills,
    search,
    location,
    startDate,
    endDate,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  // ── Enforce platform-level marketplace settings ────────────────────────────
  const [generalSettings, marketplaceSettings] = await Promise.all([
    getPlatformGeneralSettings(),
    getPlatformMarketplaceSettings(),
  ]);

  if (!generalSettings.enableMarketplace) {
    throw new Error("Marketplace is currently disabled by administrator.");
  }

  if (search && !marketplaceSettings.searchEnabled) {
    throw new Error("Search is currently disabled on the marketplace.");
  }

  const skillsQuery = requirements || skills;
  if (skillsQuery && !marketplaceSettings.enableSkillBasedSearch) {
    throw new Error(
      "Skill-based search is currently disabled by administrator."
    );
  }

  if (location && !marketplaceSettings.enableLocationBasedSearch) {
    throw new Error(
      "Location-based search is currently disabled by administrator."
    );
  }
  // ───────────────────────────────────────────────────────────────────────────

  const limit =
    filters.limit !== undefined
      ? filters.limit
      : marketplaceSettings.searchResultsPerPage || 20;

  const skip =
    (Math.max(1, parseInt(page) || 1) - 1) *
    Math.min(100, Math.max(1, parseInt(limit) || 20));
  const take = Math.min(100, Math.max(1, parseInt(limit) || 20));

  const where = {
    isDeleted: false,
    visibility: "PUBLIC",
    openToCollaborators: true,
    AND: [],
  };

  // Exclude pending/rejected listings when listing approval is required
  if (marketplaceSettings.listingApprovalRequired) {
    where.AND.push({
      NOT: {
        OR: [
          { metadata: { path: ["listingApprovalStatus"], equals: "PENDING" } },
          { metadata: { path: ["listingApprovalStatus"], equals: "REJECTED" } },
        ],
      },
    });
  }

  if (genre) {
    where.genre = { contains: genre, mode: "insensitive" };
  }

  if (role) {
    where.requiredRoles = { has: role };
  }

  if (skillsQuery) {
    where.requiredSkills = { has: skillsQuery };
  }

  if (search) {
    where.AND.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (startDate) {
    where.startDate = { gte: new Date(startDate) };
  }

  if (endDate) {
    where.endDate = { lte: new Date(endDate) };
  }

  const allowedSortFields = ["createdAt", "updatedAt", "name", "startDate"];
  const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  const validSortOrder = ["asc", "desc"].includes(sortOrder.toLowerCase())
    ? sortOrder.toLowerCase()
    : "desc";

  const total = await prisma.project.count({ where });

  const projects = await prisma.project.findMany({
    where,
    include: {
      owner: {
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
          tier: true,
        },
      },
      _count: {
        select: {
          collaborators: true,
          applications: true,
        },
      },
    },
    orderBy: { [validSortBy]: validSortOrder },
    skip,
    take,
  });

  return {
    projects,
    meta: {
      total,
      page: parseInt(page),
      limit: take,
      totalPages: Math.ceil(total / take),
    },
  };
};

const getMarketplaceProjectSummaryService = async (projectId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: {
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
          tier: true,
        },
      },
      _count: {
        select: {
          collaborators: true,
        },
      },
    },
  });

  if (!project || project.isDeleted || project.visibility !== "PUBLIC" || !project.openToCollaborators) {
    throw new Error("Project summary not found, is private, or not open to collaborators.");
  }

  return project;
};

const reportProjectService = async (projectId, reporterId, reportData) => {
  const { reason, description } = reportData;

  if (!reason) {
    throw new Error("A reason must be provided to report a project.");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found.");
  }

  const report = await prisma.report.create({
    data: {
      projectId,
      reporterId,
      reason,
      description,
      status: "OPEN",
    },
  });

  return report;
};

module.exports = {
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
};
