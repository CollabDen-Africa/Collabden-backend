const prisma = require("../../../config/prismaClient");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");
const { TESTIMONIAL_CONTENT_MIN } = require("../../../schemas/profile.schema");
const {
  endorsementError,
  matchProfileSkill,
  getEndorsementBlocker,
  getEndorsementUpdateBlocker,
  toSharedProjects,
} = require("../../../helpers/endorsementRules");

// Both parties must be active collaborators (the owner has a collaborator row too).
const assertCanEndorse = async ({ endorserId, recipientId, projectId, requireCompleted }) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      status: true,
      isDeleted: true,
      collaborators: {
        where: { isActive: true, userId: { in: [endorserId, recipientId] } },
        select: { userId: true },
      },
    },
  });

  const blocker = getEndorsementBlocker({
    endorserId,
    recipientId,
    project,
    activeMemberIds: project ? project.collaborators.map((c) => c.userId) : [],
    requireCompleted,
  });
  if (blocker) throw endorsementError(blocker);

  return project;
};

const isUniqueViolation = (error) => error?.code === "P2002";

const notifyRecipient = (endorsement, project) =>
  publishEvent(EVENT_TYPES.ENDORSEMENT_RECEIVED, {
    endorsementId: endorsement.id,
    type: endorsement.type,
    skill: endorsement.skill,
    endorserId: endorsement.endorserId,
    recipientId: endorsement.recipientId,
    projectId: project.id,
    projectName: project.name,
  });

/**
 * Endorse a collaborator for one of the skills on their profile,
 * verified by a project both users are active on.
 */
const createSkillEndorsement = async (endorserId, recipientId, { skill, projectId, content }) => {
  if (endorserId === recipientId) throw endorsementError("SELF_ENDORSEMENT");

  const recipient = await prisma.userProfile.findUnique({
    where: { id: recipientId },
    select: { id: true, skills: true },
  });
  if (!recipient) throw endorsementError("USER_NOT_FOUND");

  const project = await assertCanEndorse({ endorserId, recipientId, projectId, requireCompleted: false });

  const profileSkill = matchProfileSkill(skill, recipient.skills);
  if (!profileSkill) throw endorsementError("SKILL_NOT_ON_PROFILE");

  const duplicateMessage = `You have already endorsed this collaborator for ${profileSkill} on this project.`;
  const existing = await prisma.endorsement.findFirst({
    where: {
      type: "SKILL",
      endorserId,
      recipientId,
      projectId,
      skill: { equals: profileSkill, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (existing) throw endorsementError("DUPLICATE_ENDORSEMENT", duplicateMessage);

  let endorsement;
  try {
    endorsement = await prisma.endorsement.create({
      data: {
        type: "SKILL",
        endorserId,
        recipientId,
        projectId,
        skill: profileSkill,
        content: content || null,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw endorsementError("DUPLICATE_ENDORSEMENT", duplicateMessage);
    throw error;
  }

  await notifyRecipient(endorsement, project);
  return endorsement;
};

/**
 * Leave a testimonial (with optional 1–5 rating) for a collaborator on a completed project.
 */
const createTestimonial = async (endorserId, projectId, { recipientId, content, rating }) => {
  const project = await assertCanEndorse({ endorserId, recipientId, projectId, requireCompleted: true });

  const duplicateMessage = "You have already left a testimonial for this collaborator on this project.";
  const existing = await prisma.endorsement.findFirst({
    where: { type: "TESTIMONIAL", endorserId, recipientId, projectId },
    select: { id: true },
  });
  if (existing) throw endorsementError("DUPLICATE_ENDORSEMENT", duplicateMessage);

  let endorsement;
  try {
    endorsement = await prisma.endorsement.create({
      data: {
        type: "TESTIMONIAL",
        endorserId,
        recipientId,
        projectId,
        content,
        rating: rating ?? null,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw endorsementError("DUPLICATE_ENDORSEMENT", duplicateMessage);
    throw error;
  }

  await notifyRecipient(endorsement, project);
  return endorsement;
};

const findEndorsement = async (id) => {
  const endorsement = await prisma.endorsement.findUnique({ where: { id } });
  if (!endorsement) throw endorsementError("ENDORSEMENT_NOT_FOUND");
  return endorsement;
};

/**
 * The endorser edits the text or rating of their own endorsement.
 */
const updateEndorsement = async (id, userId, { content, rating }) => {
  const endorsement = await findEndorsement(id);
  if (endorsement.endorserId !== userId) throw endorsementError("NOT_ENDORSER");

  const blocker = getEndorsementUpdateBlocker(endorsement.type, { content, rating }, TESTIMONIAL_CONTENT_MIN);
  if (blocker === "CONTENT_TOO_SHORT") {
    throw endorsementError(blocker, `Testimonial must be at least ${TESTIMONIAL_CONTENT_MIN} characters.`);
  }
  if (blocker) throw endorsementError(blocker);

  return prisma.endorsement.update({
    where: { id },
    data: {
      ...(content !== undefined && { content: content || null }),
      ...(rating !== undefined && { rating }),
    },
  });
};

/**
 * The endorser withdraws their own endorsement.
 */
const deleteEndorsement = async (id, userId) => {
  const endorsement = await findEndorsement(id);
  if (endorsement.endorserId !== userId) throw endorsementError("NOT_ENDORSER");

  await prisma.endorsement.delete({ where: { id } });
};

/**
 * The recipient hides or shows an endorsement on their public profile.
 */
const setEndorsementVisibility = async (id, userId, hidden) => {
  const endorsement = await findEndorsement(id);
  if (endorsement.recipientId !== userId) throw endorsementError("NOT_RECIPIENT");

  return prisma.endorsement.update({
    where: { id },
    data: { isHidden: hidden },
    select: { id: true, isHidden: true },
  });
};

/**
 * Projects on which the caller and `userId` are both active collaborators.
 * Drives the Endorse / Testimonial buttons on a profile.
 */
const getSharedProjects = async (callerId, userId) => {
  if (callerId === userId) return [];

  const projects = await prisma.project.findMany({
    where: {
      isDeleted: false,
      AND: [
        { collaborators: { some: { userId: callerId, isActive: true } } },
        { collaborators: { some: { userId, isActive: true } } },
      ],
    },
    select: { id: true, name: true, status: true, completedAt: true },
    orderBy: { createdAt: "desc" },
  });

  return toSharedProjects(projects);
};

/**
 * Counts for the public profile stats row.
 */
const getProfileStats = async (userId) => {
  const [completedProjects, connections, endorsements] = await Promise.all([
    prisma.project.count({
      where: {
        status: "COMPLETED",
        visibility: "PUBLIC",
        isDeleted: false,
        collaborators: { some: { userId, isActive: true } },
      },
    }),
    prisma.userConnection.count({
      where: {
        status: "ACCEPTED",
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
    }),
    prisma.endorsement.count({
      where: { recipientId: userId, isApproved: true, isHidden: false },
    }),
  ]);

  return { completedProjects, connections, endorsements };
};

module.exports = {
  createSkillEndorsement,
  createTestimonial,
  updateEndorsement,
  deleteEndorsement,
  setEndorsementVisibility,
  getSharedProjects,
  getProfileStats,
};
