const { Queue, Worker } = require("bullmq");
const connection = require("./redisConnection");
const prisma = require("../config/prismaClient");
const supabase = require("../config/supabase");
const { sendEmail } = require("../utils/sendEmail");
const { DATA_EXPORT_STATUS } = require("../config/constants");

const QUEUE_NAME = "exportQueue";

// Create the Queue
const exportQueue = new Queue(QUEUE_NAME, { connection });

// Create the Worker
const exportWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { userId, requestId } = job.data;
    console.log(`Processing data export job for user ${userId}, request ${requestId}`);

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

    // 2. Convert to JSON
    const jsonData = JSON.stringify(userProfile, null, 2);
    
    // 3. Upload to Supabase Storage (bucket: 'exports')
    const fileName = `export-${userId}-${Date.now()}.json`;
    const { data, error } = await supabase
      .storage
      .from('exports')
      .upload(fileName, jsonData, {
        contentType: 'application/json',
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

    // 6. Notify user
    // Send email
    await sendEmail({
      to: userProfile.email,
      subject: "Your Data Export is Ready",
      html: `<p>Hi ${userProfile.firstName},</p><p>Your requested data export is now ready. You can download it using the link below (valid for 7 days):</p><p><a href="${fileUrl}">Download Data Export</a></p>`,
    }).catch(e => console.error("Failed to send export email:", e));

    // Create in-app notification
    await prisma.notification.create({
      data: {
        userId,
        title: "Data Export Ready",
        message: "Your requested data export is complete and ready for download.",
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
  console.log(`Export job ${job.id} completed successfully`);
});

exportWorker.on("failed", async (job, err) => {
  console.error(`Export job ${job.id} failed:`, err);
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
