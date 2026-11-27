/**
 * Pure rules for skill endorsements and project testimonials.
 * Kept free of Prisma so they can be unit tested in isolation.
 *
 * Every error carries a stable `code` so clients never need to match on message text.
 */

const ENDORSEMENT_ERRORS = {
  SELF_ENDORSEMENT: { status: 400, message: "You cannot endorse yourself." },
  USER_NOT_FOUND: { status: 404, message: "User not found." },
  PROJECT_NOT_FOUND: { status: 404, message: "Project not found." },
  NOT_PROJECT_COLLABORATORS: { status: 403, message: "You can only endorse someone you have worked with on this project." },
  PROJECT_NOT_COMPLETED: { status: 403, message: "Testimonials can only be given after the project is completed." },
  SKILL_NOT_ON_PROFILE: { status: 400, message: "This skill is not listed on the user's profile." },
  DUPLICATE_ENDORSEMENT: { status: 409, message: "You have already endorsed this collaborator for this." },
  ENDORSEMENT_NOT_FOUND: { status: 404, message: "Endorsement not found." },
  NOT_ENDORSER: { status: 403, message: "Only the person who wrote this endorsement can change it." },
  NOT_RECIPIENT: { status: 403, message: "Only the recipient can change the visibility of this endorsement." },
  RATING_NOT_ALLOWED: { status: 400, message: "Ratings can only be given on testimonials." },
  CONTENT_TOO_SHORT: { status: 400, message: "Testimonial must be at least 20 characters." },
};

const endorsementError = (code, message) => {
  const { status, message: defaultMessage } = ENDORSEMENT_ERRORS[code];
  const error = new Error(message || defaultMessage);
  error.status = status;
  error.code = code;
  return error;
};

/**
 * Match an endorsed skill against the recipient's profile skills, ignoring case and spacing.
 * Returns the profile's own spelling, or null when the skill is not on the profile.
 *
 * @param {string} skill
 * @param {string[]} recipientSkills
 * @returns {string|null}
 */
const matchProfileSkill = (skill, recipientSkills = []) => {
  const wanted = skill.trim().toLowerCase();
  return recipientSkills.find((s) => s.trim().toLowerCase() === wanted) || null;
};

/**
 * Returns the error code that stops `endorserId` from endorsing `recipientId` on a project, or null.
 *
 * @param {{
 *   endorserId: string,
 *   recipientId: string,
 *   project: { isDeleted: boolean, status: string } | null,
 *   activeMemberIds: string[],
 *   requireCompleted: boolean,
 * }} params
 * @returns {string|null}
 */
const getEndorsementBlocker = ({ endorserId, recipientId, project, activeMemberIds, requireCompleted }) => {
  if (endorserId === recipientId) return "SELF_ENDORSEMENT";
  if (!project || project.isDeleted) return "PROJECT_NOT_FOUND";

  const members = new Set(activeMemberIds);
  if (!members.has(endorserId) || !members.has(recipientId)) return "NOT_PROJECT_COLLABORATORS";

  if (requireCompleted && project.status !== "COMPLETED") return "PROJECT_NOT_COMPLETED";
  return null;
};

/**
 * Validate an endorser's edit against the endorsement's type.
 * Returns the error code, or null when the edit is allowed.
 *
 * @param {"SKILL"|"TESTIMONIAL"} type
 * @param {{ content?: string|null, rating?: number|null }} changes
 * @param {number} testimonialMinLength
 */
const getEndorsementUpdateBlocker = (type, { content, rating }, testimonialMinLength) => {
  if (type === "SKILL" && rating !== undefined && rating !== null) return "RATING_NOT_ALLOWED";
  if (type === "TESTIMONIAL" && content !== undefined && (content || "").length < testimonialMinLength) {
    return "CONTENT_TOO_SHORT";
  }
  return null;
};

/**
 * Shape an endorsement for public display. A private project's name must not
 * leak onto a public profile, so its project is reduced to null.
 */
const toPublicEndorsement = ({ project, ...endorsement }) => ({
  ...endorsement,
  project:
    project && project.visibility === "PUBLIC" && !project.isDeleted
      ? { id: project.id, name: project.name }
      : null,
});

/**
 * Projects two users share, as returned to the caller.
 *
 * @param {{ id: string, name: string, status: string, completedAt: Date|null }[]} projects
 */
const toSharedProjects = (projects) =>
  projects.map(({ id, name, status, completedAt }) => ({
    id,
    name,
    status,
    completedAt,
    canLeaveTestimonial: status === "COMPLETED",
  }));

module.exports = {
  ENDORSEMENT_ERRORS,
  endorsementError,
  matchProfileSkill,
  getEndorsementBlocker,
  getEndorsementUpdateBlocker,
  toPublicEndorsement,
  toSharedProjects,
};
