const test = require("node:test");
const assert = require("node:assert/strict");

const {
  endorsementError,
  matchProfileSkill,
  getEndorsementBlocker,
  getEndorsementUpdateBlocker,
  toPublicEndorsement,
  toSharedProjects,
} = require("../src/helpers/endorsementRules");
const {
  updateProfileSchema,
  addEndorsementSchema,
  projectEndorsementSchema,
  updateEndorsementSchema,
} = require("../src/schemas/profile.schema");
const { publicProfileSelect } = require("../src/utils/publicProfile");

const completed = { isDeleted: false, status: "COMPLETED" };
const active = { isDeleted: false, status: "ACTIVE" };

const blocker = (overrides = {}) =>
  getEndorsementBlocker({
    endorserId: "alice",
    recipientId: "bob",
    project: completed,
    activeMemberIds: ["alice", "bob"],
    requireCompleted: false,
    ...overrides,
  });

test("errors carry a status and a stable code", () => {
  const error = endorsementError("NOT_PROJECT_COLLABORATORS");
  assert.equal(error.status, 403);
  assert.equal(error.code, "NOT_PROJECT_COLLABORATORS");
  assert.equal(endorsementError("DUPLICATE_ENDORSEMENT", "custom").message, "custom");
});

test("skills match the recipient's profile spelling, ignoring case and spacing", () => {
  assert.equal(matchProfileSkill("  mixing ", ["Mixing", "Mastering"]), "Mixing");
  assert.equal(matchProfileSkill("Vocals", ["Mixing"]), null);
  assert.equal(matchProfileSkill("Mixing", undefined), null);
});

test("collaborators on the same project may endorse each other", () => {
  assert.equal(blocker(), null);
  assert.equal(blocker({ project: active }), null);
});

test("self-endorsement is refused first", () => {
  assert.equal(blocker({ recipientId: "alice", project: null }), "SELF_ENDORSEMENT");
});

test("missing or deleted projects are not found", () => {
  assert.equal(blocker({ project: null }), "PROJECT_NOT_FOUND");
  assert.equal(blocker({ project: { ...completed, isDeleted: true } }), "PROJECT_NOT_FOUND");
});

test("both users must be active on the project", () => {
  assert.equal(blocker({ activeMemberIds: ["alice"] }), "NOT_PROJECT_COLLABORATORS");
  assert.equal(blocker({ activeMemberIds: ["bob"] }), "NOT_PROJECT_COLLABORATORS");
});

test("testimonials require a completed project", () => {
  assert.equal(blocker({ project: active, requireCompleted: true }), "PROJECT_NOT_COMPLETED");
  assert.equal(blocker({ requireCompleted: true }), null);
});

test("edits respect the endorsement type", () => {
  assert.equal(getEndorsementUpdateBlocker("SKILL", { rating: 4 }, 20), "RATING_NOT_ALLOWED");
  assert.equal(getEndorsementUpdateBlocker("SKILL", { rating: null, content: "" }, 20), null);
  assert.equal(getEndorsementUpdateBlocker("TESTIMONIAL", { content: "too short" }, 20), "CONTENT_TOO_SHORT");
  assert.equal(getEndorsementUpdateBlocker("TESTIMONIAL", { content: null }, 20), "CONTENT_TOO_SHORT");
  assert.equal(getEndorsementUpdateBlocker("TESTIMONIAL", { rating: 5 }, 20), null);
});

test("private project names never reach a public endorsement", () => {
  const base = { id: "e1", content: "Great" };
  assert.deepEqual(
    toPublicEndorsement({ ...base, project: { id: "p1", name: "Album", visibility: "PUBLIC", isDeleted: false } }).project,
    { id: "p1", name: "Album" }
  );
  assert.equal(toPublicEndorsement({ ...base, project: { id: "p2", name: "Secret", visibility: "PRIVATE", isDeleted: false } }).project, null);
  assert.equal(toPublicEndorsement({ ...base, project: { id: "p3", name: "Gone", visibility: "PUBLIC", isDeleted: true } }).project, null);
  assert.equal(toPublicEndorsement({ ...base, project: null }).project, null);
});

test("shared projects flag when a testimonial can be left", () => {
  assert.deepEqual(
    toSharedProjects([
      { id: "p1", name: "A", status: "COMPLETED", completedAt: null, extra: true },
      { id: "p2", name: "B", status: "ACTIVE", completedAt: null },
    ]),
    [
      { id: "p1", name: "A", status: "COMPLETED", completedAt: null, canLeaveTestimonial: true },
      { id: "p2", name: "B", status: "ACTIVE", completedAt: null, canLeaveTestimonial: false },
    ]
  );
});

test("profile links must be http or https", () => {
  for (const link of ["javascript:alert(1)", "data:text/html,hi", "ftp://files.example.com"]) {
    assert.equal(updateProfileSchema.safeParse({ portfolioLinks: [link] }).success, false, link);
    assert.equal(updateProfileSchema.safeParse({ socialLinks: [link] }).success, false, link);
  }
  assert.equal(updateProfileSchema.safeParse({ portfolioLinks: ["https://soundcloud.com/me"] }).success, true);
  assert.equal(updateProfileSchema.safeParse({ avatarUrl: "javascript:alert(1)" }).success, false);
  assert.equal(
    updateProfileSchema.safeParse({ portfolioLinks: Array(11).fill("https://example.com") }).success,
    false
  );
});

test("skill endorsements need a skill and project; content is optional", () => {
  assert.equal(addEndorsementSchema.safeParse({ skill: "Mixing", projectId: "p1" }).success, true);
  assert.equal(addEndorsementSchema.safeParse({ content: "Great" }).success, false);
  assert.equal(addEndorsementSchema.safeParse({ skill: "Mixing", projectId: "p1", content: "x".repeat(601) }).success, false);
});

test("testimonials are 20–600 characters with an optional 1–5 rating", () => {
  const content = "Brilliant to work with on this record.";
  assert.equal(projectEndorsementSchema.safeParse({ recipientId: "bob", content, rating: 5 }).success, true);
  assert.equal(projectEndorsementSchema.safeParse({ recipientId: "bob", content }).success, true);
  assert.equal(projectEndorsementSchema.safeParse({ recipientId: "bob", content: "Too short" }).success, false);
  assert.equal(projectEndorsementSchema.safeParse({ recipientId: "bob", content: "x".repeat(601) }).success, false);
  assert.equal(projectEndorsementSchema.safeParse({ recipientId: "bob", content, rating: 6 }).success, false);
  assert.equal(projectEndorsementSchema.safeParse({ recipientId: "bob", content, rating: 4.5 }).success, false);
});

test("an edit must change content or rating", () => {
  assert.equal(updateEndorsementSchema.safeParse({}).success, false);
  assert.equal(updateEndorsementSchema.safeParse({ rating: null }).success, true);
});

test("public profile endorsements hide hidden ones and expose the new fields", () => {
  const { where, select } = publicProfileSelect.receivedEndorsements;
  assert.deepEqual(where, { isApproved: true, isHidden: false });
  for (const field of ["type", "skill", "rating", "project"]) assert.ok(select[field], field);
  assert.ok(select.endorser.select.avatarUrl);
  assert.equal(select.endorser.select.email, undefined);
});
