/**
 * Prisma select for profiles viewed by other users (unauthenticated).
 * An allowlist, so new UserProfile columns stay private by default.
 * Never add credentials, tokens, contact details or account state here.
 */
const publicUserSelect = {
  id: true,
  displayName: true,
  firstName: true,
  lastName: true,
};

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
  createdAt: true,
  receivedEndorsements: {
    where: { isApproved: true },
    select: {
      id: true,
      content: true,
      projectId: true,
      createdAt: true,
      endorser: { select: publicUserSelect },
    },
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
    where: { recipientId: userId, isApproved: true },
    select: {
      id: true,
      content: true,
      createdAt: true,
      endorser: { select: publicUserSelect },
    },
  },
});

module.exports = {
  publicProfileSelect,
  publicProjectWhere,
  buildPortfolioProjectSelect,
};

