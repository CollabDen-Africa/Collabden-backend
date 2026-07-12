const crypto = require("crypto");
const prisma = require("../../../config/prismaClient");

const handleWebhook = async (req, res) => {
  const signatureHeader = req.headers["persona-signature"];
  const secret = process.env.PERSONA_WEBHOOK_SECRET;

  if (!secret) {
    console.error("PERSONA_WEBHOOK_SECRET is not configured");
    return res.status(500).json({ error: "Webhook secret missing" });
  }

  const payloadBuffer = req.rawBody;
    if (!Buffer.isBuffer(payloadBuffer)) {
      console.error("Webhook body is not a raw buffer.");
      return res.status(400).json({ error: "Bad request formatting" });
    }

    if (!signatureHeader) {
      console.error("Missing persona-signature header");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const parts = Object.fromEntries(
      signatureHeader.split(",").map((p) => p.trim().split("="))
    );
    const { t: timestamp, v1: providedSignature } = parts;

    if (!timestamp || !providedSignature) {
      console.error("Malformed persona-signature header");
      return res.status(401).json({ error: "Invalid signature" });
    }
  const signedPayload = `${timestamp}.${payloadBuffer.toString("utf8")}`;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "hex"),
    Buffer.from(providedSignature, "hex")
  );

  if (!isValid) {
    console.error("Invalid Persona webhook signature");
    return res.status(401).json({ error: "Invalid signature" });
  }


  try {
    const event = req.body;

    
    if (event.data && event.data.attributes && event.data.attributes.name) {
      const eventName = event.data.attributes.name;
      const inquiryAttributes = event.data.attributes.payload?.data?.attributes;
      
      const referenceId = inquiryAttributes?.['reference-id'] || inquiryAttributes?.referenceId;

      if (!referenceId) {
        console.warn(`Received Persona event ${eventName} without referenceId`);
        return res.status(200).send("Webhook received, but no reference-id found");
      }

      if (eventName === "inquiry.completed") {
        const userProfile = await prisma.userProfile.findUnique({
          where: { id: referenceId }
        });

        if (!userProfile) {
          console.warn(`User ${referenceId} not found during inquiry.completed`);
          return res.status(200).send("Webhook received, but user not found");
        }

        // Extract name from Persona webhook 
        let idFirstName = '';
        let idLastName = '';
        
        // 1. Try inquiry fields directly
        const fields = inquiryAttributes?.fields || {};
        if (fields['name-first']?.value) idFirstName = fields['name-first'].value;
        else if (fields['name_first']?.value) idFirstName = fields['name_first'].value;

        if (fields['name-last']?.value) idLastName = fields['name-last'].value;
        else if (fields['name_last']?.value) idLastName = fields['name_last'].value;

        // 2. Try included array (verifications/documents)
        if (!idFirstName && !idLastName && event.data.attributes.payload?.included) {
          const included = event.data.attributes.payload.included;
          for (const item of included) {
            if (item.type?.startsWith('verification') || item.type?.startsWith('document')) {
              const attrs = item.attributes || {};
              if (attrs['name-first']) idFirstName = attrs['name-first'];
              if (attrs['name-last']) idLastName = attrs['name-last'];
              if (idFirstName || idLastName) break;
            }
          }
        }

        // Extract name from Database profile 
        let dbFirstName = userProfile.firstName || '';
        let dbLastName = userProfile.lastName || '';
        
        // Fallback to legalName or displayName if firstName/lastName are empty
        if (!dbFirstName && !dbLastName) {
           const fallbackName = userProfile.legalName || userProfile.displayName || '';
           const parts = fallbackName.trim().split(' ');
           if (parts.length >= 2) {
              dbFirstName = parts[0];
              dbLastName = parts.slice(1).join(' ');
           } else if (parts.length === 1) {
              dbFirstName = parts[0];
           }
        }

        // Clean up and lowercase for comparison
        idFirstName = idFirstName.trim().toLowerCase();
        idLastName = idLastName.trim().toLowerCase();
        dbFirstName = dbFirstName.trim().toLowerCase();
        dbLastName = dbLastName.trim().toLowerCase();

        console.log("Persona Webhook Payload Event (partial):", JSON.stringify({ 
           inquiryFields: fields, 
           includedCount: event.data.attributes.payload?.included?.length 
        }, null, 2));
        
        
        // Check if names match
        const isNameMatch = idFirstName && idLastName && idFirstName === dbFirstName && idLastName === dbLastName;

        if (isNameMatch) {
          await prisma.userProfile.update({
            where: { id: referenceId },
            data: { identityVerified: true },
          });
          
          await prisma.auditLog.create({
            data: {
              userId: referenceId,
              action: "IDENTITY_VERIFICATION_COMPLETED",
              changes: { status: "verified", reason: "Name matched" },
            },
          });
          
          console.log(`User ${referenceId} identity verified via Persona. Name matched.`);
        } else {
          await prisma.userProfile.update({
            where: { id: referenceId },
            data: { identityVerified: false },
          });
          
          await prisma.auditLog.create({
            data: {
              userId: referenceId,
              action: "IDENTITY_VERIFICATION_FAILED",
              changes: { 
                status: "failed", 
                reason: "Name mismatch", 
                idName: `${idFirstName} ${idLastName}`, 
                dbName: `${dbFirstName} ${dbLastName}` 
              },
            },
          });
          
          console.log(`User ${referenceId} identity verification failed. Name mismatch: ID(${idFirstName} ${idLastName}) vs DB(${dbFirstName} ${dbLastName})`);
        }
      } else if (eventName === "inquiry.failed") {
        await prisma.userProfile.update({
          where: { id: referenceId },
          data: { identityVerified: false },
        });
        
        await prisma.auditLog.create({
          data: {
            userId: referenceId,
            action: "IDENTITY_VERIFICATION_FAILED",
            changes: { status: "failed" },
          },
        });
        
        console.log(`User ${referenceId} identity verification failed via Persona.`);
      } else {
        console.log(`Received other Persona event: ${eventName}`);
      }
    }

    res.status(200).send("Webhook processed");
  } catch (error) {
    console.error("Error processing Persona webhook:", error);
    if (error.code === 'P2025') {
       console.warn("User referenceId not found in database.");
       return res.status(200).send("Webhook processed (User not found)");
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  handleWebhook,
};
