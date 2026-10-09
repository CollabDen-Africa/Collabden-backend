const test = require("node:test");
const assert = require("node:assert/strict");

// Mock prisma and redis before requiring service
const prismaMock = {
  project: {
    findFirst: async ({ where }) => {
      if (where.id === "proj-1" && where.ownerId === "owner-1") {
        return { id: "proj-1", name: "Test Project", ownerId: "owner-1", isDeleted: false };
      }
      return null;
    },
  },
  projectApplication: {
    findMany: async ({ where }) => {
      if (where.projectId === "proj-1") {
        return [
          {
            id: "app-1",
            projectId: "proj-1",
            applicantId: "user-2",
            message: "I would love to produce the audio for this project!",
            status: "APPLIED",
            createdAt: new Date(),
            applicant: {
              id: "user-2",
              displayName: "Jane Doe",
              firstName: "Jane",
              lastName: "Doe",
              avatarUrl: "https://example.com/avatar.jpg",
              bio: "Passionate audio producer and sound designer",
              location: "Lagos, Nigeria",
              yearsOfExperience: 5,
              role: "PRODUCER",
              skills: ["Audio Engineering", "Mixing"],
              genres: ["Afrobeats", "R&B"],
              portfolioLinks: ["https://soundcloud.com/janedoe"],
              socialLinks: ["https://instagram.com/janedoe"],
              creativePhilosophy: "Quality first",
              experience: "Senior Producer",
            },
          },
        ];
      }
      return [];
    },
    findUnique: async ({ where }) => {
      if (where.id === "app-1") {
        return {
          id: "app-1",
          projectId: "proj-1",
          applicantId: "user-2",
          message: "I would love to produce the audio for this project!",
          status: "APPLIED",
          project: {
            id: "proj-1",
            name: "Test Project",
            ownerId: "owner-1",
          },
        };
      }
      return null;
    },
    update: async ({ where, data }) => {
      return {
        id: where.id,
        projectId: "proj-1",
        applicantId: "user-2",
        message: "I would love to produce the audio for this project!",
        status: data.status,
        applicant: {
          id: "user-2",
          displayName: "Jane Doe",
          firstName: "Jane",
          lastName: "Doe",
          avatarUrl: "https://example.com/avatar.jpg",
          bio: "Passionate audio producer and sound designer",
          location: "Lagos, Nigeria",
          skills: ["Audio Engineering"],
          genres: ["Afrobeats"],
          portfolioLinks: ["https://soundcloud.com/janedoe"],
        },
      };
    },
  },
  projectCollaborator: {
    findFirst: async () => null,
    create: async ({ data }) => {
      prismaMock.lastCreatedCollaborator = data;
      return { id: "collab-1", ...data };
    },
    update: async ({ where, data }) => {
      prismaMock.lastUpdatedCollaborator = { where, data };
      return { id: where.id, ...data };
    },
  },
};

// Override require cache for prismaClient and redis
const prismaPath = require.resolve("../src/config/prismaClient");
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaMock };

const redisPath = require.resolve("../src/config/redis");
require.cache[redisPath] = {
  id: redisPath,
  filename: redisPath,
  loaded: true,
  exports: { publisherClient: { publish: async () => {} } },
};

const {
  getProjectApplicationsService,
  reviewApplicationService,
  cancelApplicationService,
} = require("../src/modules/projects/services/applications.service");

test("getProjectApplicationsService returns applicant profile data, pitch, and portfolio link", async () => {
  const applications = await getProjectApplicationsService("proj-1", "owner-1");
  assert.equal(applications.length, 1);

  const app = applications[0];
  assert.equal(app.pitch, "I would love to produce the audio for this project!");
  assert.equal(app.portfolioLink, "https://soundcloud.com/janedoe");
  assert.equal(app.applicant.displayName, "Jane Doe");
  assert.equal(app.applicant.bio, "Passionate audio producer and sound designer");
  assert.equal(app.applicant.location, "Lagos, Nigeria");
  assert.deepEqual(app.applicant.portfolioLinks, ["https://soundcloud.com/janedoe"]);
});

test("reviewApplicationService ACCEPTED automatically adds applicant as collaborator", async () => {
  prismaMock.lastCreatedCollaborator = null;
  const result = await reviewApplicationService("app-1", "owner-1", "ACCEPTED", "proj-1");

  assert.equal(result.status, "ACCEPTED");
  assert.ok(prismaMock.lastCreatedCollaborator);
  assert.equal(prismaMock.lastCreatedCollaborator.projectId, "proj-1");
  assert.equal(prismaMock.lastCreatedCollaborator.userId, "user-2");
  assert.equal(prismaMock.lastCreatedCollaborator.role, "COLLABORATOR");
  assert.equal(prismaMock.lastCreatedCollaborator.isActive, true);
  assert.equal(prismaMock.lastCreatedCollaborator.inviteStatus, "ACCEPTED");
});

test("reviewApplicationService DECLINED/REJECTED updates status without adding collaborator", async () => {
  prismaMock.lastCreatedCollaborator = null;
  const result = await reviewApplicationService("app-1", "owner-1", "DECLINED", "proj-1");

  assert.equal(result.status, "REJECTED");
  assert.equal(prismaMock.lastCreatedCollaborator, null);
});

test("cancelApplicationService sets application status to CANCELLED", async () => {
  const result = await cancelApplicationService("app-1", "user-2", "proj-1");

  assert.equal(result.status, "CANCELLED");
});
