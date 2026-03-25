/**
 * Remove sensitive fields from user object
 * Excludes: password, verificationToken
 */
const sanitizeUser = (user) => {
  if (!user) return null;

  const { password, verificationToken, ...sanitizedUser } = user;
  return sanitizedUser;
};

module.exports = { sanitizeUser };
