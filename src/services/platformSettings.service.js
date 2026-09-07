const prisma = require("../config/prismaClient");

// Lightweight in-process cache so every login/signup doesn't hit the DB.
const CACHE_TTL_MS = 30 * 1000;

let _userSettingsCache = null;
let _userSettingsCachedAt = 0;

const getPlatformUserSettings = async () => {
  const now = Date.now();
  if (_userSettingsCache && now - _userSettingsCachedAt < CACHE_TTL_MS) {
    return _userSettingsCache;
  }

  let settings = await prisma.platformUserSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    settings = await prisma.platformUserSettings.create({
      data: { id: "singleton" },
    });
  }

  _userSettingsCache = settings;
  _userSettingsCachedAt = now;
  return settings;
};

const invalidatePlatformUserSettingsCache = () => {
  _userSettingsCache = null;
  _userSettingsCachedAt = 0;
};

// ── PlatformGeneralSettings cache ────────────────────────────────────────────
let _generalSettingsCache = null;
let _generalSettingsCachedAt = 0;

const getPlatformGeneralSettings = async () => {
  const now = Date.now();
  if (_generalSettingsCache && now - _generalSettingsCachedAt < CACHE_TTL_MS) {
    return _generalSettingsCache;
  }

  let settings = await prisma.platformGeneralSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    settings = await prisma.platformGeneralSettings.create({
      data: { id: "singleton" },
    });
  }

  _generalSettingsCache = settings;
  _generalSettingsCachedAt = now;
  return settings;
};

const invalidatePlatformGeneralSettingsCache = () => {
  _generalSettingsCache = null;
  _generalSettingsCachedAt = 0;
};

// ── PlatformMarketplaceSettings cache ─────────────────────────────────────────
let _marketplaceSettingsCache = null;
let _marketplaceSettingsCachedAt = 0;

const getPlatformMarketplaceSettings = async () => {
  const now = Date.now();
  if (_marketplaceSettingsCache && now - _marketplaceSettingsCachedAt < CACHE_TTL_MS) {
    return _marketplaceSettingsCache;
  }

  let settings = await prisma.platformMarketplaceSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    settings = await prisma.platformMarketplaceSettings.create({
      data: { id: "singleton" },
    });
  }

  _marketplaceSettingsCache = settings;
  _marketplaceSettingsCachedAt = now;
  return settings;
};

const invalidatePlatformMarketplaceSettingsCache = () => {
  _marketplaceSettingsCache = null;
  _marketplaceSettingsCachedAt = 0;
};

// ── PlatformPaymentSettings cache ───────────────────────────────────────────
let _paymentSettingsCache = null;
let _paymentSettingsCachedAt = 0;

const getPlatformPaymentSettings = async () => {
  const now = Date.now();
  if (_paymentSettingsCache && now - _paymentSettingsCachedAt < CACHE_TTL_MS) {
    return _paymentSettingsCache;
  }

  let settings = await prisma.platformPaymentSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    settings = await prisma.platformPaymentSettings.create({
      data: { id: "singleton" },
    });
  }

  _paymentSettingsCache = settings;
  _paymentSettingsCachedAt = now;
  return settings;
};

const invalidatePlatformPaymentSettingsCache = () => {
  _paymentSettingsCache = null;
  _paymentSettingsCachedAt = 0;
};

module.exports = {
  getPlatformUserSettings,
  invalidatePlatformUserSettingsCache,
  getPlatformGeneralSettings,
  invalidatePlatformGeneralSettingsCache,
  getPlatformMarketplaceSettings,
  invalidatePlatformMarketplaceSettingsCache,
  getPlatformPaymentSettings,
  invalidatePlatformPaymentSettingsCache,
};
