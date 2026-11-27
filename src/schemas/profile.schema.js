const { z } = require("zod");

const isWebProtocol = (value) => {
  try {
    return /^https?:$/i.test(new URL(value).protocol);
  } catch {
    return true; // malformed URLs are already reported by .url()
  }
};

// Only http(s) links may be stored: z.url() alone also accepts javascript:, data: and similar.
const webUrl = (message = "Must be a valid URL") =>
  z
    .string()
    .trim()
    .url(message)
    .refine(isWebProtocol, { message: "Only http and https links are allowed" });

const MAX_PROFILE_LINKS = 10;
const ENDORSEMENT_CONTENT_MAX = 600;
const TESTIMONIAL_CONTENT_MIN = 20;

const updateProfileSchema = z.object({
  legalName: z.string().optional(),
  displayName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  avatarUrl: webUrl().optional().nullable(),
  bio: z.string().max(500, "Bio must be 500 characters or less").optional().nullable(),
  role: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  yearsOfExperience: z.number().optional().nullable(),
  creativePhilosophy: z.string().optional().nullable(),
  experience: z.string().optional().nullable(),
  skills: z.array(z.string()).optional(),
  specializations: z.array(z.string()).optional(),
  primaryRoles: z.array(z.string()).optional(),
  genres: z.array(z.string()).optional(),
  portfolioLinks: z
    .array(webUrl("Each portfolio link must be a valid URL"))
    .max(MAX_PROFILE_LINKS, `You can add up to ${MAX_PROFILE_LINKS} portfolio links`)
    .optional(),
  socialLinks: z
    .array(webUrl("Each social link must be a valid URL"))
    .max(MAX_PROFILE_LINKS, `You can add up to ${MAX_PROFILE_LINKS} social links`)
    .optional(),
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
  avatarUrl: webUrl("Must be a valid URL for the profile picture"),
});


// Skill endorsement: verified by a shared project; the note is optional.
const addEndorsementSchema = z.object({
  skill: z.string().trim().min(1, "Skill is required").max(60, "Skill must be 60 characters or less"),
  projectId: z.string().min(1, "Project ID is required"),
  content: z
    .string()
    .trim()
    .max(ENDORSEMENT_CONTENT_MAX, `Endorsement must be ${ENDORSEMENT_CONTENT_MAX} characters or less`)
    .optional()
    .nullable(),
});


const updatePortfolioSchema = z.object({
  contributionRole: z.string().optional(),
  completedMusicLink: webUrl().optional(),
  isPinned: z.boolean().optional(),
});

// Project-specific endorsement
const testimonialContent = z
  .string()
  .trim()
  .min(TESTIMONIAL_CONTENT_MIN, `Testimonial must be at least ${TESTIMONIAL_CONTENT_MIN} characters`)
  .max(ENDORSEMENT_CONTENT_MAX, `Testimonial must be ${ENDORSEMENT_CONTENT_MAX} characters or less`);

const rating = z
  .number()
  .int("Rating must be a whole number")
  .min(1, "Rating must be between 1 and 5")
  .max(5, "Rating must be between 1 and 5");

const projectEndorsementSchema = z.object({
  recipientId: z.string().min(1, "Recipient ID is required"),
  content: testimonialContent,
  rating: rating.optional().nullable(),
});

// Endorser edits their own endorsement. Skill and project cannot change.
// Type-specific rules (testimonial length, rating only on testimonials) are enforced in the service.
const updateEndorsementSchema = z
  .object({
    content: z
      .string()
      .trim()
      .max(ENDORSEMENT_CONTENT_MAX, `Endorsement must be ${ENDORSEMENT_CONTENT_MAX} characters or less`)
      .optional()
      .nullable(),
    rating: rating.optional().nullable(),
  })
  .refine((data) => data.content !== undefined || data.rating !== undefined, {
    message: "Provide content or rating to update",
  });

// Recipient hides or shows an endorsement on their public profile.
const endorsementVisibilitySchema = z.object({
  hidden: z.boolean({ error: "hidden must be true or false" }),
});

// Stored on the account so the theme follows the user across devices.
const updatePreferencesSchema = z.object({
  theme: z
    .string({ error: "Theme is required" })
    .transform((val) => val.toUpperCase())
    .pipe(z.enum(["LIGHT", "DARK", "SYSTEM"], { error: "Theme must be LIGHT, DARK, or SYSTEM" })),
});

const addBackupEmailSchema = z.object({
  backupEmail: z.string().email("Must be a valid email address"),
});

const verifyBackupEmailSchema = z.object({
  token: z
    .string()
    .length(6, "Verification code must be 6 digits")
    .regex(/^\d{6}$/, "Verification code must be numeric"),
});

module.exports = {
  TESTIMONIAL_CONTENT_MIN,
  updateProfileSchema,
  updateEmailSchema,
  updatePhoneSchema,
  changePasswordSchema,
  updateAvatarSchema,
  addEndorsementSchema,
  updatePortfolioSchema,
  projectEndorsementSchema,
  updateEndorsementSchema,
  endorsementVisibilitySchema,
  addBackupEmailSchema,
  verifyBackupEmailSchema,
  updatePreferencesSchema,
};
