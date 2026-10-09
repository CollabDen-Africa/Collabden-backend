const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { createAuthMiddleware } = require("../src/middleware/auth.middleware");
const { createAdminMiddleware } = require("../src/middleware/admin.middleware");

const config = { secret: "test-secret", algorithm: "HS256", issuer: "test-issuer", audience: "test-audience", clockTolerance: 30 };
const sign = (payload, options = {}) => jwt.sign(payload, config.secret, {
  algorithm: config.algorithm, issuer: config.issuer, audience: config.audience,
  expiresIn: "1h", notBefore: 0, ...options,
});
const userRecord = { tokenVersion: 0, accountStatus: "ACTIVE", lastActiveAt: null };
const prisma = {
  userProfile: { findUnique: async () => userRecord, update: async () => {} },
  adminUser: { findUnique: async () => ({ id: "admin-1", tokenVersion: 0, accountStatus: "ACTIVE", lastActiveAt: null, role: "SUPER_ADMIN" }), update: async () => {} },
};
const request = async (middleware, token) => {
  const req = { headers: { authorization: `Bearer ${token}` } };
  let status;
  let body;
  const res = { status: (code) => { status = code; return res; }, json: (value) => { body = value; return res; } };
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });
  return { status: status || 200, body: body || (nextCalled ? { id: req.user.id } : undefined) };
};
const userToken = (extra = {}, options = {}) => sign({ id: "user-1", tokenVersion: 0, tokenType: "user", ...extra }, options);
const userTokenWithoutNbf = (extra = {}) => jwt.sign(
  { id: "user-1", tokenVersion: 0, tokenType: "user", ...extra },
  config.secret,
  { algorithm: config.algorithm, issuer: config.issuer, audience: config.audience, expiresIn: "1h" }
);

test("valid OAuth-style user token can access /api/v1/user/profile", async () => {
  const result = await request(createAuthMiddleware({ prismaClient: prisma, jwtConfig: config }), userToken());
  assert.equal(result.status, 200);
  assert.equal(result.body.id, "user-1");
});

test("expired user token is rejected", async () => {
  const result = await request(createAuthMiddleware({ prismaClient: prisma, jwtConfig: config }), userToken({}, { expiresIn: -31 }));
  assert.equal(result.status, 401);
});

test("future-issued token beyond the explicit tolerance is rejected", async () => {
  const middleware = createAuthMiddleware({ prismaClient: prisma, jwtConfig: config });
  const futureIat = Math.floor(Date.now() / 1000) + config.clockTolerance + 31;
  const result = await request(middleware, userTokenWithoutNbf({ iat: futureIat }));
  assert.equal(result.status, 401);
});

test("future-issued token within the explicit tolerance is accepted", async () => {
  const middleware = createAuthMiddleware({ prismaClient: prisma, jwtConfig: config });
  const futureIat = Math.floor(Date.now() / 1000) + config.clockTolerance - 1;
  const result = await request(middleware, userTokenWithoutNbf({ iat: futureIat }));
  assert.equal(result.status, 200);
});

test("normal user token cannot access admin /me", async () => {
  const result = await request(createAdminMiddleware({ prismaClient: prisma, jwtConfig: config })(), userToken());
  assert.equal(result.status, 403);
  assert.equal(result.body.message, "Forbidden: Admin token required");
});

test("admin token cannot be used as a normal user token", async () => {
  const middleware = createAuthMiddleware({ prismaClient: prisma, jwtConfig: config });
  const adminToken = sign({ id: "admin-1", tokenVersion: 0, tokenType: "admin", isAdminAuth: true });
  const result = await request(middleware, adminToken);
  assert.equal(result.status, 401);
});
