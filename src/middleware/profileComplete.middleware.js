const prisma = require('../../config/prismaClient');

const requireProfileComplete = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const profile = await prisma.userProfile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const requiredFields = [
      "legalName",
      "displayName",
      "avatarUrl",
      "email",
      "experience",
    ];

    const missingFields = [];

    for (const field of requiredFields) {
      if (!profile[field]) {
        missingFields.push(field);
      }
    }

    if (!profile.skills || profile.skills.length === 0) {
      missingFields.push("skills");
    }

    if (!profile.genres || profile.genres.length === 0) {
      missingFields.push("genres");
    }

    if (missingFields.length > 0) {
      return res.status(403).json({
        error: "Profile incomplete",
        message: "You must complete your profile to access this feature.",
        missingFields,
      });
    }

    req.userProfile = profile;
    next();
  } catch (error) {
    console.error("Error checking profile completeness:", error);
    res.status(500).json({ error: "Failed to verify profile status" });
  }
};

const requireIdentityVerified = async (req, res, next) => {
  try {
    const userId = req.user.id;

    let profile = req.userProfile;
    if (!profile) {
       profile = await prisma.userProfile.findUnique({
        where: { id: userId },
      });
    }

    if (!profile || !profile.identityVerified) {
      return res.status(403).json({
        error: "Identity verification required",
        message: "You must verify your identity to access this feature.",
      });
    }

    next();
  } catch (error) {
    console.error("Error checking identity verification:", error);
    res.status(500).json({ error: "Failed to verify identity status" });
  }
};

module.exports = {
  requireProfileComplete,
  requireIdentityVerified,
};
