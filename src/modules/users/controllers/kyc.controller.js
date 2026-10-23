const prisma = require("../../../config/prismaClient");


const identifyUser = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { nin, dateOfBirth } = req.body;

  if (!nin || !dateOfBirth) {
    return res.status(400).json({ error: "nin and dateOfBirth are required" });
  }

  const apiKey = process.env.NINJA_API_KEY;
  if (!apiKey) {
    console.error("NINJA_API_KEY is not configured");
    return res.status(500).json({ error: "Identity verification service is not configured" });
  }

  const user = await prisma.userProfile.findUnique({
    where: { id: userId },
    select: { identityVerified: true, firstName: true, lastName: true },
  });
  if (user?.identityVerified) {
    return res.status(409).json({ error: "Your identity has already been verified." });
  }

  if (!user?.firstName || !user?.lastName) {
    return res.status(400).json({ error: "Please update your profile with your first and last name before verifying your identity." });
  }

  // Rate limit: max 3 attempts per 24 hours
  const recentAttempts = await prisma.auditLog.count({
    where: {
      userId,
      action: { in: ["IDENTITY_VERIFICATION_COMPLETED", "IDENTITY_VERIFICATION_FAILED"] },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (recentAttempts >= 3) {
    return res.status(429).json({
      error: "Too many verification attempts. Please try again in 24 hours.",
    });
  }

  try {
    const ninjaResponse = await fetch( process.env.NINJA_KYC_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idType: "nin",
        mode: "lookup",
        idNumber: nin,
        reference: userId,
      }),
    });

    const ninjaData = await ninjaResponse.json();

    if (!ninjaResponse.ok) {
      console.error("Ninja KYC API error:", JSON.stringify(ninjaData));
      return res.status(502).json({
        error: "Identity verification service error",
        details: ninjaData?.message || "Unknown error",
      });
    }

    // Compare returned identity data against what the user submitted
    const returned = ninjaData.data || {};
    const normalize = (str) => (str || "").trim().toLowerCase();
    const firstNameMatch = normalize(returned.first_name) === normalize(user.firstName);
    const lastNameMatch = normalize(returned.last_name) === normalize(user.lastName);
    const returnedDob = returned.date_of_birth;
    const returnedAge = returned.age;

    let dobMatch;
    if (returnedDob) {
      dobMatch = normalize(returnedDob) === normalize(dateOfBirth);
    } else if (returnedAge) {
      const dob = new Date(dateOfBirth);
      const today = new Date();
      let calculatedAge = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) calculatedAge--;
      dobMatch = calculatedAge === returnedAge;
    } else {
      dobMatch = true;
    }

    const verified = firstNameMatch && lastNameMatch && dobMatch;

    await prisma.userProfile.update({
      where: { id: userId },
      data: { identityVerified: verified },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: verified ? "IDENTITY_VERIFICATION_COMPLETED" : "IDENTITY_VERIFICATION_FAILED",
        changes: {
          status: verified ? "verified" : "failed",
          nin: nin.slice(0, 4) + "***",
          ...(!verified && {
            reason: "Details mismatch",
            firstNameMatch,
            lastNameMatch,
            dobMatch,
          }),
        },
      },
    });

    return res.status(200).json({ verified });
  } catch (error) {
    console.error("Error calling Ninja KYC:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { identifyUser };
