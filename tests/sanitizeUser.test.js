const test = require("node:test");
const assert = require("node:assert/strict");

const { sanitizeUser } = require("../src/utils/sanitizeUser");

test("sanitizeUser strips credentials, tokens, the 2FA secret and the NIN hash", () => {
  const user = sanitizeUser({
    id: "u1",
    email: "a@b.c",
    theme: "DARK",
    isTwoFactorEnabled: true,
    password: "hash",
    verificationToken: "v",
    resetToken: "r",
    backupEmailToken: "b",
    twoFactorSecret: "secret",
    ninHash: "nin",
  });
  assert.deepEqual(user, { id: "u1", email: "a@b.c", theme: "DARK", isTwoFactorEnabled: true });
});

test("sanitizeUser returns null for a missing user", () => {
  assert.equal(sanitizeUser(null), null);
});
