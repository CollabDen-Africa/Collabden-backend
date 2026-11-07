const test = require("node:test");
const assert = require("node:assert/strict");

const { publicProfileSelect } = require("../src/utils/publicProfile");

const PRIVATE_FIELDS = [
  "email", "password", "googleId", "ninHash", "legalName", "phoneNumber",
  "verificationToken", "verificationTokenExpiry", "resetToken", "resetTokenExpiry",
  "backupEmail", "backupEmailToken", "backupEmailTokenExpiry", "twoFactorSecret",
  "isTwoFactorEnabled", "tokenVersion", "accountStatus", "failedLoginAttempts",
  "lockoutUntil", "theme",
];

test("public profile select exposes none of the private columns", () => {
  for (const field of PRIVATE_FIELDS) {
    assert.equal(field in publicProfileSelect, false, `${field} must not be public`);
  }
});

test("public profile uses an explicit select, never a bare include", () => {
  assert.equal(publicProfileSelect.receivedEndorsements.select.endorser.select.email, undefined);
  assert.ok(publicProfileSelect.ownedProjects.select);
  assert.equal(publicProfileSelect.ownedProjects.select.budget, undefined);
  assert.equal(publicProfileSelect.ownedProjects.select.metadata, undefined);
});

test("only public, live, completed projects are listed", () => {
  assert.deepEqual(publicProfileSelect.ownedProjects.where, {
    status: "COMPLETED",
    visibility: "PUBLIC",
    isDeleted: false,
  });
});

test("portfolio select lists only public project fields and named users", () => {
  const { buildPortfolioProjectSelect, publicProjectWhere } = require("../src/utils/publicProfile");
  const select = buildPortfolioProjectSelect("u1");
  for (const field of ["budget", "metadata", "pricingType", "visibility", "ownerId"]) {
    assert.equal(field in select, false, `${field} must not be in the portfolio`);
  }
  assert.deepEqual(Object.keys(select.collaborators.select.user.select).sort(), ["displayName", "firstName", "id", "lastName"]);
  assert.deepEqual(select.endorsements.where, { recipientId: "u1", isApproved: true });
  assert.deepEqual(publicProjectWhere, { visibility: "PUBLIC", isDeleted: false });
});
