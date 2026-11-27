/**
 * Prisma select for profiles viewed by other users (unauthenticated).
 * An allowlist, so new UserProfile columns stay private by default.
 * Never add credentials, tokens, contact details or account state here.
 */
const publicUserSelect = {
  id: true,
  displayName: true,
  displayNameMode: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  role: true,
};

// Fields of an endorsement safe to show publicly. `project` is reduced by
// toPublicEndorsement so private project names never reach a public profile.
const publicEndorsementSelect = {
  id: true,
  type: true,
  skill: true,
  rating: true,
  content: true,
  projectId: true,
  createdAt: true,
  endorser: { select: publicUserSelect },
};

const visibleEndorsementWhere = { isApproved: true, isHidden: false };

const publicProjectSelect = {
  id: true,
  name: true,
  description: true,
  genre: true,
  coverImageUrl: true,
  startDate: true,
  endDate: true,
  status: true,
  createdAt: true,
};

const publicProjectWhere = { visibility: "PUBLIC", isDeleted: false };

const publicProfileSelect = {
  id: true,
  displayName: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  bio: true,
  role: true,
  location: true,
  yearsOfExperience: true,
  creativePhilosophy: true,
  experience: true,
  skills: true,
  specializations: true,
  primaryRoles: true,
  genres: true,
  portfolioLinks: true,
  socialLinks: true,
  openToCollaborate: true,
  identityVerified: true,
  tier: true,
  displayNameMode: true,
  showLocation: true,
  createdAt: true,
  receivedEndorsements: {
    where: visibleEndorsementWhere,
    select: {
      ...publicEndorsementSelect,
      project: { select: { id: true, name: true, visibility: true, isDeleted: true } },
    },
    orderBy: { createdAt: "desc" },
  },
  ownedProjects: {
    where: { status: "COMPLETED", ...publicProjectWhere },
    select: publicProjectSelect,
  },
};

/**
 * Project select for a user's public portfolio: the project's public fields,
 * its collaborators by name, and the approved endorsements given to that user.
 */
const buildPortfolioProjectSelect = (userId) => ({
  ...publicProjectSelect,
  collaborators: {
    select: {
      id: true,
      userId: true,
      role: true,
      contributionRole: true,
      user: { select: publicUserSelect },
    },
  },
  endorsements: {
    where: { recipientId: userId, ...visibleEndorsementWhere },
    select: publicEndorsementSelect,
    orderBy: { createdAt: "desc" },
  },
});

module.exports = {
  publicProfileSelect,
  publicProjectWhere,
  buildPortfolioProjectSelect,
};

