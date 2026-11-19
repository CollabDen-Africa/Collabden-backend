/**
 * Remove sensitive fields from user object
 * Excludes: password, tokens, the 2FA secret and the NIN hash
 */
const sanitizeUser = (user) => {
  if (!user) return null;

  const {
    password,
    verificationToken,
    resetToken,
    backupEmailToken,
    twoFactorSecret,
    ninHash,
    ...sanitizedUser
  } = user;
  return sanitizedUser;
};

module.exports = { sanitizeUser };
