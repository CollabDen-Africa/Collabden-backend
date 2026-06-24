const { z } = require("zod");

const updateProfileSchema = z.object({
  legalName: z.string().optional(),
  displayName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  avatarUrl: z.string().url("Must be a valid URL").optional(),
  bio: z.string().max(500, "Bio must be 500 characters or less").optional(),
  experience: z.string().optional(),
  skills: z.array(z.string()).optional(),
  genres: z.array(z.string()).optional(),
  portfolioLinks: z.array(z.string().url("Each portfolio link must be a valid URL")).optional(),
  socialLinks: z.array(z.string().url("Each social link must be a valid URL")).optional(),
  openToCollaborate: z.boolean().optional(),
});


const updateEmailSchema = z.object({
  newEmail: z.string().email("Must be a valid email address"),
  currentPassword: z.string().min(1, "Current password is required to change email"),
});


const updatePhoneSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, "Must be a valid international phone number (e.g. +2348012345678)")
    .optional()
    .nullable(),
});


const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Must contain at least one special character"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const updateAvatarSchema = z.object({
  avatarUrl: z.string().url("Must be a valid URL for the profile picture"),
});


const addEndorsementSchema = z.object({
  content: z.string().min(1, "Endorsement content is required"),
});


const updatePortfolioSchema = z.object({
  contributionRole: z.string().optional(),
  completedMusicLink: z.string().url("Must be a valid URL").optional(),
  isPinned: z.boolean().optional(),
});

// Project-specific endorsement
const projectEndorsementSchema = z.object({
  recipientId: z.string().min(1, "Recipient ID is required"),
  content: z.string().min(10, "Endorsement must be at least 10 characters"),
});

module.exports = {
  updateProfileSchema,
  updateEmailSchema,
  updatePhoneSchema,
  changePasswordSchema,
  updateAvatarSchema,
  addEndorsementSchema,
  updatePortfolioSchema,
  projectEndorsementSchema,
};
