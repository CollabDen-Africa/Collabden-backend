const prisma = require("../../../config/prismaClient");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");

/**
 * Retrieve collaborator profiles with optional filtering and searching.
 */
const listCollaborators = async (filters = {}) => {
  const { name, skills, genres, role, openToCollaborate } = filters;
  const where = {};

  // Default to showing only users who are open to collaborate, unless specified otherwise
  let openFilter = true;
  if (openToCollaborate !== undefined) {
    if (openToCollaborate === 'all') {
      openFilter = undefined;
    } else {
      openFilter = openToCollaborate === 'true' || openToCollaborate === true;
    }
  }

  if (openFilter !== undefined) {
    where.openToCollaborate = openFilter;
  }

  // Name filtering (checks display name, legal name, first name, last name)
  if (name) {
    where.OR = [
      { displayName: { contains: name, mode: "insensitive" } },
      { firstName: { contains: name, mode: "insensitive" } },
      { lastName: { contains: name, mode: "insensitive" } },
      { legalName: { contains: name, mode: "insensitive" } },
    ];
  }

  // Skills filtering (supports comma-separated list or array)
  if (skills) {
    const skillsList = typeof skills === "string" 
      ? skills.split(",").map(s => s.trim()) 
      : skills;
    where.skills = { hasSome: skillsList };
  }

  // Genres filtering (supports comma-separated list or array)
  if (genres) {
    const genresList = typeof genres === "string" 
      ? genres.split(",").map(g => g.trim()) 
      : genres;
    where.genres = { hasSome: genresList };
  }

  // Role filtering (searches experience text or checks skills list)
  if (role) {
    const roleSearch = { experience: { contains: role, mode: "insensitive" } };
    const skillSearch = { skills: { hasSome: [role] } };
    
    if (where.OR) {
      // If name filter OR is already set, we combine them
      where.AND = [
        { OR: where.OR },
        { OR: [roleSearch, skillSearch] }
      ];
      delete where.OR;
    } else {
      where.OR = [roleSearch, skillSearch];
    }
  }

  return await prisma.userProfile.findMany({
    where,
    select: {
      id: true,
      email: true,
      displayName: true,
      legalName: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      bio: true,
      experience: true,
      skills: true,
      genres: true,
      openToCollaborate: true,
      tier: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Retrieve detailed profile details of a collaborator including portfolio,
 * collaboration history, and endorsements.
 */
const getCollaboratorDetails = async (userId) => {
  const profile = await prisma.userProfile.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      legalName: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      bio: true,
      experience: true,
      skills: true,
      genres: true,
      portfolioLinks: true,
      socialLinks: true,
      openToCollaborate: true,
      tier: true,
      createdAt: true,
    },
  });

  if (!profile) return null;

  // 1. Portfolio: Completed projects where they were collaborators
  const portfolioEntries = await prisma.projectCollaborator.findMany({
    where: {
      userId,
      project: { status: "COMPLETED" },
    },
    include: {
      project: {
        include: {
          collaborators: {
            include: {
              user: {
                select: { id: true, displayName: true, firstName: true, lastName: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const portfolio = portfolioEntries.map(entry => ({
    projectId: entry.projectId,
    projectName: entry.project.name,
    role: entry.contributionRole || entry.role || "Collaborator",
    completedMusicLink: entry.completedMusicLink,
    isPinned: entry.isPinned,
    startDate: entry.project.startDate || entry.createdAt,
    endDate: entry.project.endDate || entry.project.updatedAt,
    collaborators: entry.project.collaborators.map(c => ({
      userId: c.user.id,
      name: c.user.displayName || `${c.user.firstName} ${c.user.lastName}`,
    })),
  }));

  // 2. Collaboration History: All projects (owned + collaborated)
  const ownedProjects = await prisma.project.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true, status: true, createdAt: true },
  });

  const collaboratorProjects = await prisma.projectCollaborator.findMany({
    where: { userId },
    include: {
      project: {
        select: { id: true, name: true, status: true, createdAt: true },
      },
    },
  });

  // Calculate project statistics
  const allProjects = [];
  const projectIds = new Set();

  ownedProjects.forEach(p => {
    projectIds.add(p.id);
    allProjects.push({
      id: p.id,
      name: p.name,
      status: p.status,
      role: "Owner",
      startDate: p.createdAt,
    });
  });

  collaboratorProjects.forEach(cp => {
    if (!projectIds.has(cp.project.id)) {
      projectIds.add(cp.project.id);
      allProjects.push({
        id: cp.project.id,
        name: cp.project.name,
        status: cp.project.status,
        role: cp.contributionRole || cp.role || "Collaborator",
        startDate: cp.project.createdAt,
      });
    }
  });

  const history = {
    totalProjectsCount: allProjects.length,
    completedProjectsCount: allProjects.filter(p => p.status === "COMPLETED").length,
    activeProjectsCount: allProjects.filter(p => p.status === "ACTIVE" || p.status === "IN_PROGRESS").length,
    projects: allProjects.sort((a, b) => new Date(b.startDate) - new Date(a.startDate)),
  };

  // 3. Endorsements: Received endorsements
  const endorsements = await prisma.endorsement.findMany({
    where: { recipientId: userId, isApproved: true },
    include: {
      endorser: {
        select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
      },
      project: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    ...profile,
    portfolio,
    history,
    endorsements: endorsements.map(e => ({
      id: e.id,
      content: e.content,
      createdAt: e.createdAt,
      endorser: {
        userId: e.endorser.id,
        name: e.endorser.displayName || `${e.endorser.firstName} ${e.endorser.lastName}`,
        avatarUrl: e.endorser.avatarUrl,
      },
      project: e.project ? { id: e.project.id, name: e.project.name } : null,
    })),
  };
};

/**
 * Update availability status for a collaborator.
 */
const updateAvailabilityStatus = async (userId, openToCollaborate) => {
  const oldProfile = await prisma.userProfile.findUnique({
    where: { id: userId },
    select: { openToCollaborate: true },
  });

  if (!oldProfile) return null;

  const updatedProfile = await prisma.userProfile.update({
    where: { id: userId },
    data: { openToCollaborate },
  });

  // Publish event for notifications
  await publishEvent(EVENT_TYPES.AVAILABILITY_STATUS_UPDATED, {
    userId,
    openToCollaborate,
  });

  return updatedProfile;
};

/**
 * Retrieve list of all unique skills currently present in user profiles.
 */
const getUniqueSkills = async () => {
  const profiles = await prisma.userProfile.findMany({
    select: { skills: true },
  });

  const skillsSet = new Set();
  profiles.forEach(p => {
    if (p.skills) {
      p.skills.forEach(s => skillsSet.add(s.trim()));
    }
  });

  return Array.from(skillsSet).sort();
};

/**
 * Retrieve list of all unique genres currently present in user profiles.
 */
const getUniqueGenres = async () => {
  const profiles = await prisma.userProfile.findMany({
    select: { genres: true },
  });

  const genresSet = new Set();
  profiles.forEach(p => {
    if (p.genres) {
      p.genres.forEach(g => genresSet.add(g.trim()));
    }
  });

  return Array.from(genresSet).sort();
};

module.exports = {
  listCollaborators,
  getCollaboratorDetails,
  updateAvailabilityStatus,
  getUniqueSkills,
  getUniqueGenres,
};
