const prisma = require('../../../config/prismaClient');
const bcrypt = require("bcryptjs");

/**
 * Update general profile info (display name, bio, skills, social links, etc.)
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const ALLOWED_FIELDS = [
      "legalName", "displayName", "firstName", "lastName",
      "avatarUrl", "bio", "experience", "skills", "genres",
      "portfolioLinks", "socialLinks", "openToCollaborate",
    ];

    // Strip any fields not in the allowed list (extra security layer on top of Zod)
    const updateData = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => ALLOWED_FIELDS.includes(key))
    );

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No valid fields provided for update" });
    }

    const oldProfile = await prisma.userProfile.findUnique({ where: { id: userId } });

    if (!oldProfile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const newProfile = await prisma.userProfile.update({
      where: { id: userId },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "PROFILE_UPDATE",
        changes: { before: oldProfile, after: newProfile },
      },
    });

    res.status(200).json({ message: "Profile updated successfully", profile: newProfile });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

/**
 * Change email — requires the user to confirm their current password first.
 * Marks isVerified = false so they must re-verify the new address.
 */
const updateEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { newEmail, currentPassword } = req.body;

    const user = await prisma.userProfile.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Google OAuth users have no password — block direct email change
    if (!user.password) {
      return res.status(400).json({
        error: "Email cannot be changed directly for accounts linked via Google. Use Google account settings.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const emailTaken = await prisma.userProfile.findUnique({ where: { email: newEmail } });
    if (emailTaken) {
      return res.status(409).json({ error: "This email is already in use by another account" });
    }

    await prisma.userProfile.update({
      where: { id: userId },
      data: {
        email: newEmail,
        isVerified: false, // Force re-verification of the new address
      },
    });

    await prisma.auditLog.create({
      data: { userId, action: "EMAIL_CHANGE", changes: { oldEmail: user.email, newEmail } },
    });

    res.status(200).json({
      message: "Email updated successfully. Please verify your new email address.",
    });
  } catch (error) {
    console.error("Error updating email:", error);
    res.status(500).json({ error: "Failed to update email" });
  }
};

/**
 * Update or remove phone number.
 */
const updatePhone = async (req, res) => {
  try {
    const userId = req.user.id;
    const { phoneNumber } = req.body;

    await prisma.userProfile.update({
      where: { id: userId },
      data: { phoneNumber: phoneNumber ?? null },
    });

    res.status(200).json({
      message: phoneNumber ? "Phone number updated successfully" : "Phone number removed",
    });
  } catch (error) {
    console.error("Error updating phone:", error);
    res.status(500).json({ error: "Failed to update phone number" });
  }
};

/**
 * Change password — requires current password for verification.
 */
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.userProfile.findUnique({ where: { id: userId } });

    if (!user || !user.password) {
      return res.status(400).json({
        error: "Password cannot be set for accounts linked via Google. Use Google account settings.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Prevent reusing the same password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ error: "New password must be different from your current password" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.userProfile.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await prisma.auditLog.create({
      data: { userId, action: "PASSWORD_CHANGE", changes: {} },
    });

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
};

/**
 * Update profile picture URL.
 */
const updateAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const { avatarUrl } = req.body;

    await prisma.userProfile.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    res.status(200).json({ message: "Profile picture updated successfully", avatarUrl });
  } catch (error) {
    console.error("Error updating avatar:", error);
    res.status(500).json({ error: "Failed to update profile picture" });
  }
};



const getProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const profile = await prisma.userProfile.findUnique({
      where: { id: userId },
      include: {
        receivedEndorsements: {
          where: { isApproved: true },
          include: {
            endorser: {
              select: {
                id: true,
                displayName: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        ownedProjects: {
          where: { status: "COMPLETED" },
        },
      },
    });

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.status(200).json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

const addEndorsement = async (req, res) => {
  try {
    const endorserId = req.user.id;
    const { userId: recipientId } = req.params;
    const { content } = req.body;

    if (endorserId === recipientId) {
      return res.status(400).json({ error: "You cannot endorse yourself" });
    }

    const endorsement = await prisma.endorsement.create({
      data: {
        endorserId,
        recipientId,
        content,
      },
    });

    res.status(201).json({ message: "Endorsement added successfully", endorsement });
  } catch (error) {
    console.error("Error adding endorsement:", error);
    res.status(500).json({ error: "Failed to add endorsement" });
  }
};

const getPortfolio = async (req, res) => {
  try {
    const { userId } = req.params;

    const portfolio = await prisma.projectCollaborator.findMany({
      where: {
        userId: userId,
        project: {
          status: 'COMPLETED'
        }
      },
      include: {
        project: {
          include: {
            collaborators: {
              include: {
                user: {
                  select: { id: true, displayName: true, firstName: true, lastName: true }
                }
              }
            },
            endorsements: {
              where: { recipientId: userId, isApproved: true },
              include: {
                endorser: {
                  select: { id: true, displayName: true, firstName: true, lastName: true }
                }
              }
            }
          }
        }
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.status(200).json(portfolio);
  } catch (error) {
    console.error("Error fetching portfolio:", error);
    res.status(500).json({ error: "Failed to fetch portfolio" });
  }
};

const updatePortfolioEntry = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;
    const { contributionRole, completedMusicLink, isPinned } = req.body;

    const collaboratorEntry = await prisma.projectCollaborator.findUnique({
      where: {
        projectId_userId: { projectId, userId }
      },
      include: {
        project: true
      }
    });

    if (!collaboratorEntry) {
      return res.status(404).json({ error: "Portfolio entry not found" });
    }

    if (collaboratorEntry.project.status !== 'COMPLETED') {
      return res.status(400).json({ error: "Project must be completed to update portfolio entry" });
    }

    const updatedEntry = await prisma.projectCollaborator.update({
      where: {
        id: collaboratorEntry.id
      },
      data: {
        contributionRole: contributionRole !== undefined ? contributionRole : undefined,
        completedMusicLink: completedMusicLink !== undefined ? completedMusicLink : undefined,
        isPinned: isPinned !== undefined ? isPinned : undefined,
      }
    });

    res.status(200).json({ message: "Portfolio entry updated successfully", entry: updatedEntry });
  } catch (error) {
    console.error("Error updating portfolio entry:", error);
    res.status(500).json({ error: "Failed to update portfolio entry" });
  }
};

const addProjectEndorsement = async (req, res) => {
  try {
    const endorserId = req.user.id;
    const { projectId } = req.params;
    const { content, recipientId } = req.body;

    if (endorserId === recipientId) {
      return res.status(400).json({ error: "You cannot endorse yourself" });
    }
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.status !== "COMPLETED") {
      return res.status(400).json({
        error: "Endorsements can only be given after a project is completed",
      });
    }

    const endorserCollab = await prisma.projectCollaborator.findUnique({
      where: { projectId_userId: { projectId, userId: endorserId } }
    });

    const recipientCollab = await prisma.projectCollaborator.findUnique({
      where: { projectId_userId: { projectId, userId: recipientId } }
    });

    if (!endorserCollab || !recipientCollab) {
      return res.status(400).json({ error: "Both users must be collaborators on the project" });
    }

    if (!endorserCollab.isActive || !recipientCollab.isActive) {
      return res.status(400).json({ error: "Both collaborators must have been active on this project to exchange endorsements" });
    }

    const existing = await prisma.endorsement.findFirst({
      where: { endorserId, recipientId, projectId },
    });

    if (existing) {
      return res.status(409).json({
        error: "You have already endorsed this collaborator for this project",
      });
    }

    const endorsement = await prisma.endorsement.create({
      data: {
        endorserId,
        recipientId,
        projectId,
        content,
      },
    });

    res.status(201).json({ message: "Endorsement added successfully", endorsement });
  } catch (error) {
    console.error("Error adding project endorsement:", error);
    res.status(500).json({ error: "Failed to add project endorsement" });
  }
};

const getProfileCompleteness = async (req, res) => {
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

    res.status(200).json({
      isComplete: missingFields.length === 0,
      missingFields,
    });
  } catch (error) {
    console.error("Error fetching profile completeness:", error);
    res.status(500).json({ error: "Failed to fetch profile completeness" });
  }
};

const browseCollaborators = async (req, res) => {
  try {
    const { skills, genres, q } = req.query;

    const filters = {
      openToCollaborate: true,
    };

    if (skills) {
      filters.skills = { hasSome: skills.split(",").map(s => s.trim()) };
    }
    console
    if (genres) {
      filters.genres = { hasSome: genres.split(",").map(g => g.trim()) };
    }

    if (q) {
      filters.OR = [
        { displayName: { contains: q, mode: 'insensitive' } },
        { bio: { contains: q, mode: 'insensitive' } },
      ];
    }

    const collaborators = await prisma.userProfile.findMany({
      where: filters,
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        skills: true,
        genres: true,
        experience: true,
        bio: true,
      },
    });

    res.status(200).json(collaborators);
  } catch (error) {
    console.error("Error browsing collaborators:", error);
    res.status(500).json({ error: "Failed to browse collaborators" });
  }
};

module.exports = {
  updateProfile,
  updateEmail,
  updatePhone,
  changePassword,
  updateAvatar,
  getProfile,
  addEndorsement,
  getPortfolio,
  updatePortfolioEntry,
  addProjectEndorsement,
  getProfileCompleteness,
  browseCollaborators,
};

