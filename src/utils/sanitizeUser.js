/**
 * Remove sensitive fields from user object
 * Excludes: password, verificationToken
 */
const sanitizeUser = (user) => {
  if (!user) return null;

  const { password, verificationToken, resetToken, backupEmailToken, ...sanitizedUser } = user;
  return sanitizedUser;
};

module.exports = { sanitizeUser };
