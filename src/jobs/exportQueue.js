const { Queue, Worker } = require("bullmq");
const PDFDocument = require("pdfkit");
const connection = require("./redisConnection");
const prisma = require("../config/prismaClient");
const supabase = require("../config/supabase");
const { sendEmail } = require("../utils/sendEmail");
const { getCollabDenEmailTemplate } = require("../utils/emailTemplates");
const { DATA_EXPORT_STATUS } = require("../config/constants");

const QUEUE_NAME = "exportQueue";

/**
 * Generate a clean, branded PDF document containing all exportable user data.
 * @param {Object} userProfile
 * @returns {Promise<Buffer>}
 */
const generateUserExportPDF = (userProfile) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on("error", (err) => reject(err));

      // Brand Top Accent Bar
      doc.rect(40, 40, 515, 6).fill("#74c83d");
      doc.moveDown(1);

      // Header Banner
      doc.fillColor("#1f2937").fontSize(22).font("Helvetica-Bold").text("CollabDen", { inline: true });
      doc.fillColor("#6b7280").fontSize(14).font("Helvetica").text(" User Account Data Export");
      doc.fillColor("#9ca3af").fontSize(9).font("Helvetica").text("Generated: " + new Date().toUTCString() + " | Account ID: " + userProfile.id);
      doc.moveDown(0.8);

      // Horizontal Divider
      doc.strokeColor("#e5e7eb").lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(1);

      // --- SECTION 1: Personal Profile ---
      doc.fillColor("#1f2937").fontSize(13).font("Helvetica-Bold").text("1. Personal Profile");
      doc.moveDown(0.5);

      const fullName = [userProfile.firstName, userProfile.lastName].filter(Boolean).join(" ") || userProfile.legalName || "N/A";
      const storageUsed = ((userProfile.storageUsedBytes || 0) / (1024 * 1024)).toFixed(2) + " MB";
      const storageLimit = ((userProfile.storageLimitBytes || 524288000) / (1024 * 1024)).toFixed(0) + " MB";

      const profileFields = [
        ["Full Name", fullName],
        ["Email Address", userProfile.email || "N/A"],
        ["Username", userProfile.username ? "@" + userProfile.username : "N/A"],
        ["Phone Number", userProfile.phoneNumber || userProfile.phone || "N/A"],
        ["Role", userProfile.role || "USER"],
        ["Bio", userProfile.bio || "N/A"],
        ["Location", userProfile.location || "N/A"],
        ["Storage Usage", storageUsed + " / " + storageLimit],
        ["Member Since", userProfile.createdAt ? new Date(userProfile.createdAt).toLocaleString() : "N/A"],
      ];

      profileFields.forEach(([label, value]) => {
        doc.fontSize(9.5).fillColor("#6b7280").font("Helvetica-Bold").text(label + ": ", { continued: true });
        doc.fillColor("#1f2937").font("Helvetica").text(String(value));
      });

      doc.moveDown(1.2);

      // --- SECTION 2: Owned Projects ---
      const projects = userProfile.ownedProjects || [];
      doc.fillColor("#1f2937").fontSize(13).font("Helvetica-Bold").text("2. Projects Owned (" + projects.length + ")");
      doc.moveDown(0.5);

      if (projects.length === 0) {
        doc.fontSize(9.5).fillColor("#9ca3af").font("Helvetica-Oblique").text("No projects created yet.");
      } else {
        projects.forEach((proj, idx) => {
          doc.fontSize(10).fillColor("#74c83d").font("Helvetica-Bold").text((idx + 1) + ". " + (proj.title || proj.name || "Untitled Project"));
          if (proj.description) {
            const shortDesc = proj.description.length > 140 ? proj.description.substring(0, 140) + "..." : proj.description;
            doc.fontSize(9).fillColor("#4b5563").font("Helvetica").text("   " + shortDesc);
          }
          doc.fontSize(8.5).fillColor("#6b7280").font("Helvetica").text("   Status: " + (proj.status || "Active") + " | Category: " + (proj.category || "General") + " | Created: " + (proj.createdAt ? new Date(proj.createdAt).toLocaleDateString() : 'N/A'));
          doc.moveDown(0.4);
        });
      }

      doc.moveDown(1.2);

      // --- SECTION 3: Financial & Transactions ---
      const walletBalance = userProfile.wallet?.balance !== undefined ? "NGN " + Number(userProfile.wallet.balance).toLocaleString() : "NGN 0.00";
      const transactions = userProfile.transactions || [];

      doc.fillColor("#1f2937").fontSize(13).font("Helvetica-Bold").text("3. Financial Summary & Wallet");
      doc.moveDown(0.4);
      doc.fontSize(9.5).fillColor("#6b7280").font("Helvetica-Bold").text("Current Wallet Balance: ", { continued: true });
      doc.fillColor("#1f2937").font("Helvetica").text(walletBalance);
      doc.moveDown(0.4);

      doc.fontSize(10).fillColor("#1f2937").font("Helvetica-Bold").text("Transaction History (" + transactions.length + ")");
      doc.moveDown(0.4);

      if (transactions.length === 0) {
        doc.fontSize(9.5).fillColor("#9ca3af").font("Helvetica-Oblique").text("No financial transactions recorded.");
      } else {
        transactions.slice(0, 25).forEach((tx) => {
          const dateStr = tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : 'N/A';
          const amt = tx.amount !== undefined ? "NGN " + Number(tx.amount).toLocaleString() : 'NGN 0';
          doc.fontSize(8.5).fillColor("#4b5563").font("Helvetica")
            .text("• [" + dateStr + "] " + (tx.type || 'Transaction') + " - " + amt + " (Status: " + (tx.status || 'COMPLETED') + ", Ref: " + (tx.reference || tx.id || 'N/A') + ")");
        });
        if (transactions.length > 25) {
          doc.fontSize(8).fillColor("#9ca3af").text("... and " + (transactions.length - 25) + " more earlier transactions.");
        }
      }

      doc.moveDown(1.2);

      // --- SECTION 4: Security & Login History ---
      const loginActivities = userProfile.loginActivities || [];
      doc.fillColor("#1f2937").fontSize(13).font("Helvetica-Bold").text("4. Security & Login History (" + loginActivities.length + ")");
      doc.moveDown(0.4);

      if (loginActivities.length === 0) {
        doc.fontSize(9.5).fillColor("#9ca3af").font("Helvetica-Oblique").text("No login activity records.");
      } else {
        loginActivities.slice(0, 15).forEach((act) => {
          const dateStr = act.createdAt ? new Date(act.createdAt).toLocaleString() : 'N/A';
          doc.fontSize(8.5).fillColor("#4b5563").font("Helvetica")
            .text("• [" + dateStr + "] IP: " + (act.ipAddress || 'Unknown') + " | Device: " + (act.device || act.userAgent || 'Unknown'));
        });
      }

      // Footer
      doc.moveDown(2);
      doc.strokeColor("#e5e7eb").lineWidth(0.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(8).fillColor("#9ca3af").text("CollabDen Confidential — User Account Data Export | Validated & Exported", { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

// Create the Queue
const exportQueue = new Queue(QUEUE_NAME, { connection });

// Create the Worker
const exportWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { userId, requestId } = job.data;
    console.log("Processing data export job for user " + userId + ", request " + requestId);

    // 1. Fetch all user data
    const userProfile = await prisma.userProfile.findUnique({
      where: { id: userId },
      include: {
        ownedProjects: true,
        collaborations: true,
        loginActivities: true,
        supportTickets: true,
        dataExportRequests: true,
        sentRequests: true,
        receivedRequests: true,
        wallet: true,
        transactions: true,
        bankAccounts: true,
        paymentRecords: true,
        givenEndorsements: true,
        receivedEndorsements: true,
        auditLogs: true,
      }
    });

    if (!userProfile) {
      throw new Error("User not found");
    }

    // 2. Convert to PDF Buffer
    const pdfBuffer = await generateUserExportPDF(userProfile);
    
    // 3. Upload to Supabase Storage (bucket: 'exports') as PDF
    const fileName = "export-" + userId + "-" + Date.now() + ".pdf";
    const { data, error } = await supabase
      .storage
      .from('exports')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      throw error;
    }

    // 4. Generate presigned URL (valid for 7 days = 604800 seconds)
    const { data: urlData, error: urlError } = await supabase
      .storage
      .from('exports')
      .createSignedUrl(fileName, 604800);

    if (urlError) {
      throw urlError;
    }

    const fileUrl = urlData.signedUrl;

    // 5. Update request to COMPLETED
    await prisma.dataExportRequest.update({
      where: { id: requestId },
      data: {
        status: DATA_EXPORT_STATUS.COMPLETED,
        fileUrl,
      },
    });

    // 6. Notify user using the shared branded CollabDen email template
    const firstName = userProfile.firstName || userProfile.legalName || "there";
    const emailContent = `
      <h2 style="color: #1f2937;">Your Data Export is Ready 📦</h2>
      <p>Hi ${firstName},</p>
      <p>As requested, your account data export has been processed and compiled into a secure PDF document.</p>
      <div class="info-box" style="background-color: #f8fafc; border-left: 4px solid #74c83d; padding: 14px; border-radius: 8px; margin: 16px 0;">
        📄 <strong>Included:</strong> Profile details, projects owned, wallet transactions, and security login activities.
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${fileUrl}" class="reset-button" style="background-color: #74c83d; color: #ffffff; padding: 14px 32px; font-weight: 700; text-decoration: none; border-radius: 999px; display: inline-block;">Download PDF Export</a>
      </div>
      <div class="expiry-note" style="background-color: #f8fafc; border-left: 4px solid #74c83d; padding: 12px 15px; border-radius: 4px; font-size: 14px; margin: 20px 0;">
        ⏱ For security reasons, this download link will expire in <strong>7 days</strong>.
      </div>
      <p style="color: #6b7280; font-size: 13px;">If the button above does not work, copy and paste this link into your browser:</p>
      <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${fileUrl}</p>
      <div class="divider" style="height: 1px; background: #d9e0e8; margin: 24px 0;"></div>
      <p>Best regards,<br><strong>The CollabDen Team</strong></p>
    `;

    const htmlEmail = getCollabDenEmailTemplate({
      headerTitle: "Data Export Ready 📄",
      headerSubtitle: "Your requested account data PDF export",
      content: emailContent,
      preheader: "Your CollabDen account data export PDF is ready for download.",
    });

    const textEmail = "Hi " + firstName + ",\n\nYour requested account data export PDF is now ready. You can download it using the link below (valid for 7 days):\n\n" + fileUrl + "\n\nBest regards,\nThe CollabDen Team";

    await sendEmail({
      to: userProfile.email,
      subject: "Your Data Export is Ready",
      html: htmlEmail,
      text: textEmail,
    }).catch(e => console.error("Failed to send export email:", e));

    // Create in-app notification
    await prisma.notification.create({
      data: {
        userId,
        title: "Data Export Ready",
        message: "Your requested data export PDF is complete and ready for download.",
        type: "SYSTEM",
        link: fileUrl,
      }
    }).catch(e => console.error("Failed to create export notification:", e));

    return { fileUrl };
  },
  {
    connection,
    concurrency: 5,
  }
);

// Worker Events
exportWorker.on("completed", (job, returnvalue) => {
  console.log("Export job " + job.id + " completed successfully");
});

exportWorker.on("failed", async (job, err) => {
  console.error("Export job " + job.id + " failed:", err);
  if (job && job.data && job.data.requestId) {
    try {
      await prisma.dataExportRequest.update({
        where: { id: job.data.requestId },
        data: {
          status: DATA_EXPORT_STATUS.FAILED,
        },
      });
    } catch (dbError) {
      console.error("Failed to update status to FAILED:", dbError);
    }
  }
});

module.exports = { exportQueue, exportWorker };
