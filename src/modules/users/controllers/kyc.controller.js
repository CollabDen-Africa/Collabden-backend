const crypto = require("crypto");
const prisma = require("../../../config/prismaClient");

const MAX_ATTEMPTS_PER_DAY = 3;
const ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MIN_AGE_YEARS = 16;
const MAX_AGE_YEARS = 120;

const hashNin = (nin) => {
  const pepper = process.env.KYC_NIN_PEPPER;
  if (!pepper) throw new Error("KYC_NIN_PEPPER is not configured");
  return crypto.createHmac("sha256", pepper).update(nin).digest("hex");
};

const sanitizeNin = (value) => (typeof value === "string" ? value.replace(/\D/g, "") : "");

const ageFromDob = (iso) => {
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
};

const fail = (res, status, code, message, extra = {}) =>
  res.status(status).json({ code, error: message, ...extra });

const identifyUser = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "UNAUTHORIZED", "Unauthorized");

  const nin = sanitizeNin(req.body?.nin);
  const dateOfBirth = (req.body?.dateOfBirth || "").trim();

  if (!nin || !dateOfBirth) {
    return fail(res, 400, "INVALID_INPUT", "nin and dateOfBirth are required");
  }
  if (nin.length !== 11) {
    return fail(res, 400, "INVALID_INPUT", "Enter a valid 11-digit NIN");
  }
  const age = ageFromDob(dateOfBirth);
  if (age === null) {
    return fail(res, 400, "INVALID_INPUT", "Enter a valid date of birth");
  }
  if (age < MIN_AGE_YEARS || age > MAX_AGE_YEARS) {
    return fail(res, 400, "INVALID_INPUT", `You must be at least ${MIN_AGE_YEARS} years old`);
  }

  if (!process.env.NINJA_API_KEY || !process.env.NINJA_KYC_URL) {
    console.error("Ninja KYC env not configured");
    return fail(res, 500, "SERVICE_UNAVAILABLE", "Identity verification service is not configured");
  }

  let ninHash;
  try {
    ninHash = hashNin(nin);
  } catch (err) {
    console.error("KYC pepper not configured:", err);
    return fail(res, 500, "SERVICE_UNAVAILABLE", "Identity verification service is not configured");
  }

  const user = await prisma.userProfile.findUnique({
    where: { id: userId },
    select: { identityVerified: true, firstName: true, lastName: true },
  });

  if (!user) return fail(res, 401, "UNAUTHORIZED", "Unauthorized");
  if (user.identityVerified) {
    return fail(res, 409, "ALREADY_VERIFIED", "Your identity has already been verified.");
  }
  if (!user.firstName || !user.lastName) {
    return fail(
      res,
      400,
      "PROFILE_INCOMPLETE",
      "Please update your profile with your first and last name before verifying your identity."
    );
  }

  // Pre-flight: block NIN already linked to another account BEFORE paying for a NIMC call.
  const ninOwner = await prisma.userProfile.findUnique({
    where: { ninHash },
    select: { id: true },
  });
  if (ninOwner && ninOwner.id !== userId) {
    await prisma.auditLog.create({
      data: {
        userId,
        action: "IDENTITY_VERIFICATION_BLOCKED_DUPLICATE_NIN",
        changes: { nin: `${nin.slice(0, 4)}***`, reason: "nin_already_linked" },
      },
    });
    return fail(
      res,
      409,
      "NIN_ALREADY_LINKED",
      "This NIN is already linked to another account. If this is yours, contact support."
    );
  }

  // Rate limit: max N attempts per 24h, counted from audit log.
  const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MS);
  const recentAttempts = await prisma.auditLog.count({
    where: {
      userId,
      action: { in: ["IDENTITY_VERIFICATION_COMPLETED", "IDENTITY_VERIFICATION_FAILED"] },
      createdAt: { gte: windowStart },
    },
  });
  const attemptsRemaining = Math.max(0, MAX_ATTEMPTS_PER_DAY - recentAttempts);
  if (recentAttempts >= MAX_ATTEMPTS_PER_DAY) {
    return fail(res, 429, "RATE_LIMITED", "Too many verification attempts. Please try again in 24 hours.", {
      attemptsRemaining: 0,
      retryAfter: ATTEMPT_WINDOW_MS / 1000,
    });
  }

  try {
    const ninjaResponse = await fetch(process.env.NINJA_KYC_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NINJA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idType: "nin",
        mode: "lookup",
        idNumber: nin,
        reference: userId,
      }),
    });

    const ninjaData = await ninjaResponse.json().catch(() => ({}));

    if (!ninjaResponse.ok) {
      console.error("Ninja KYC API error:", JSON.stringify(ninjaData));
      await prisma.auditLog.create({
        data: {
          userId,
          action: "IDENTITY_VERIFICATION_FAILED",
          changes: {
            nin: `${nin.slice(0, 4)}***`,
            reason: "upstream_error",
            upstreamStatus: ninjaResponse.status,
          },
        },
      });
      return fail(res, 502, "SERVICE_UNAVAILABLE", "Identity verification service error", {
        attemptsRemaining: Math.max(0, attemptsRemaining - 1),
      });
    }

    const returned = ninjaData.data || {};
    const normalize = (s) => (s || "").trim().toLowerCase();
    const firstNameMatch = normalize(returned.first_name) === normalize(user.firstName);
    const lastNameMatch = normalize(returned.last_name) === normalize(user.lastName);
    const returnedDob = returned.date_of_birth;
    const returnedAge = returned.age;

    let dobMatch;
    if (returnedDob) {
      dobMatch = normalize(returnedDob) === normalize(dateOfBirth);
    } else if (returnedAge) {
      dobMatch = ageFromDob(dateOfBirth) === returnedAge;
    } else {
      dobMatch = true;
    }

    const verified = firstNameMatch && lastNameMatch && dobMatch;
    const nextAttemptsRemaining = Math.max(0, attemptsRemaining - 1);

    if (verified) {
      try {
        await prisma.userProfile.update({
          where: { id: userId },
          data: {
            identityVerified: true,
            identityVerifiedAt: new Date(),
            ninHash,
          },
        });
      } catch (err) {
        // Unique-constraint race: another account claimed the NIN between pre-flight and update.
        if (err?.code === "P2002") {
          await prisma.auditLog.create({
            data: {
              userId,
              action: "IDENTITY_VERIFICATION_BLOCKED_DUPLICATE_NIN",
              changes: { nin: `${nin.slice(0, 4)}***`, reason: "unique_race" },
            },
          });
          return fail(
            res,
            409,
            "NIN_ALREADY_LINKED",
            "This NIN is already linked to another account. If this is yours, contact support.",
            { attemptsRemaining: nextAttemptsRemaining }
          );
        }
        throw err;
      }
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action: verified ? "IDENTITY_VERIFICATION_COMPLETED" : "IDENTITY_VERIFICATION_FAILED",
        changes: {
          status: verified ? "verified" : "failed",
          nin: `${nin.slice(0, 4)}***`,
          ...(!verified && {
            reason: "details_mismatch",
            firstNameMatch,
            lastNameMatch,
            dobMatch,
          }),
        },
      },
    });

    if (verified) {
      return res.status(200).json({ verified: true, attemptsRemaining: nextAttemptsRemaining });
    }
    return res.status(200).json({
      verified: false,
      code: "DETAILS_MISMATCH",
      attemptsRemaining: nextAttemptsRemaining,
    });
  } catch (error) {
    console.error("Error calling Ninja KYC:", error);
    return fail(res, 500, "SERVICE_UNAVAILABLE", "Internal server error");
  }
};

module.exports = { identifyUser };
