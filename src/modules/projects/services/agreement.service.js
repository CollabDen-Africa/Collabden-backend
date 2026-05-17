const prisma = require('../../../config/prismaClient');
const supabase = require('../../../config/supabase');
const { uploadAgreement: uploadToSupabase } = require('../../../lib/uploadAgreement');
const { sendEmail } = require('../../../utils/sendEmail');

async function notifyCollaborators(projectId, agreementTitle) {
  const collaborators = await prisma.projectCollaborator.findMany({
    where: { projectId, isActive: true },
    include: { user: true },
  });
  
  const emails = collaborators.map(c => c.user.email);
  if (emails.length > 0) {
    for (const email of emails) {
      await sendEmail({
        to: email,
        subject: `Agreement Signed: ${agreementTitle}`,
        text: `The legal agreement "${agreementTitle}" for your project has been officially signed and locked. You can now view and download it from the project dashboard.`,
        html: `<p>The legal agreement <strong>"${agreementTitle}"</strong> for your project has been officially signed and locked.</p><p>You can now view and download it from the project dashboard.</p>`,
      }).catch(err => console.error("Failed to send email to", email, err));
    }
  }
}

const uploadAgreementService = async (file, projectId, userId) => {
  // Free tier check
  const user = await prisma.userProfile.findUnique({
    where: { id: userId },
  });

  const isPremium = user?.tier === 'PREMIUM';

  if (!isPremium) {
    const agreementCount = await prisma.legalAgreement.count({
      where: { projectId },
    });

    if (agreementCount >= 3) {
      const error = new Error('Free plan limit reached. Upgrade for unlimited uploads.');
      error.status = 403;
      throw error;
    }
  }

  // Upload file to Supabase
  const uploadResult = await uploadToSupabase(file, projectId, userId);
  const { fileUrl, filePath } = uploadResult;

  // Create Agreement record in Prisma
  const agreement = await prisma.legalAgreement.create({
    data: {
      projectId,
      title: file.originalname,
      fileUrl,
      filePath,
      status: 'DRAFT',
    },
  });

  await prisma.activityLog.create({
    data: {
      projectId,
      action: 'AGREEMENT_UPLOADED',
      details: `Agreement "${file.originalname}" was uploaded.`,
    }
  });

  return agreement;
};

const getAgreementsService = async (projectId) => {
  const agreements = await prisma.legalAgreement.findMany({
    where: { projectId },
    include: { signatures: true },
    orderBy: { createdAt: 'desc' },
  });

  // Generate fresh signed URLs
  const agreementsWithUrls = await Promise.all(
    agreements.map(async (agreement) => {
      if (agreement.filePath && supabase) {
        const { data, error } = await supabase.storage
          .from('agreements')
          .createSignedUrl(agreement.filePath, 3600);
          
        if (!error && data?.signedUrl) {
          agreement.fileUrl = data.signedUrl;
        }
      }
      return agreement;
    })
  );

  return agreementsWithUrls;
};

const updateAgreementStatusService = async (id, status, userId) => {
  const validTransitions = {
    DRAFT: ['PENDING_SIGNATURE'],
    PENDING_SIGNATURE: ['SIGNED'],
    SIGNED: [],
  };

  const agreement = await prisma.legalAgreement.findUnique({
    where: { id },
  });

  if (!agreement) {
    const error = new Error('Agreement not found.');
    error.status = 404;
    throw error;
  }

  const allowedNextStatuses = validTransitions[agreement.status] || [];

  if (!allowedNextStatuses.includes(status)) {
    const error = new Error(`Invalid status transition from ${agreement.status} to ${status}.`);
    error.status = 400;
    throw error;
  }

  let user = null;
  if (status === 'SIGNED') {
    user = await prisma.userProfile.findUnique({
      where: { id: userId },
    });

    if (!user?.identityVerified || !user?.legalName) {
      const error = new Error('Identity verification (via government ID/NIN) and completed profile (full legal name) are required to sign agreements.');
      error.status = 403;
      throw error;
    }
  }

  const updateData = { status };
  if (status === 'SIGNED' && user) {
    updateData.auditMetadata = {
      lockedAt: new Date().toISOString(),
      actionType: 'status_update_signed',
      signerName: user.legalName,
      signerId: userId,
      projectId: agreement.projectId
    };
  }

  const updatedAgreement = await prisma.legalAgreement.update({
    where: { id },
    data: updateData,
  });

  if (status === 'SIGNED' && user) {
    await prisma.agreementSignature.create({
      data: {
        agreementId: id,
        userId,
        legalName: user.legalName,
      }
    });
  }

  await prisma.activityLog.create({
    data: {
      projectId: updatedAgreement.projectId,
      action: 'AGREEMENT_STATUS_UPDATED',
      details: `Agreement "${updatedAgreement.title || 'Untitled'}" status changed to ${status}.`,
    }
  });

  if (status === 'SIGNED') {
    await notifyCollaborators(updatedAgreement.projectId, updatedAgreement.title || 'Untitled');
  }

  return updatedAgreement;
};

const uploadSignedAgreementService = async (id, file, userId) => {
  const agreement = await prisma.legalAgreement.findUnique({
    where: { id },
  });

  if (!agreement) {
    const error = new Error('Agreement not found.');
    error.status = 404;
    throw error;
  }

  if (agreement.status === 'SIGNED') {
    const error = new Error('Agreement is already signed and locked.');
    error.status = 400;
    throw error;
  }

  const user = await prisma.userProfile.findUnique({
    where: { id: userId },
  });

  if (!user?.identityVerified || !user?.legalName) {
    const error = new Error('Identity verification (via government ID/NIN) and completed profile (full legal name) are required to sign agreements.');
    error.status = 403;
    throw error;
  }

  const uploadResult = await uploadToSupabase(file, agreement.projectId, userId);
  const { fileUrl, filePath } = uploadResult;

  const updatedAgreement = await prisma.legalAgreement.update({
    where: { id },
    data: {
      fileUrl,
      filePath,
      status: 'SIGNED',
      auditMetadata: {
        lockedAt: new Date().toISOString(),
        actionType: 'upload_signed_document',
        signerName: user.legalName,
        signerId: userId,
        projectId: agreement.projectId
      }
    },
  });

  await prisma.agreementSignature.create({
    data: {
      agreementId: id,
      userId,
      legalName: user.legalName,
    }
  });

  await prisma.activityLog.create({
    data: {
      projectId: agreement.projectId,
      action: 'AGREEMENT_SIGNED',
      details: `Signed agreement document "${agreement.title || 'Untitled'}" was uploaded by ${user.legalName}.`,
    }
  });

  await notifyCollaborators(agreement.projectId, agreement.title || 'Untitled');

  return updatedAgreement;
};

const esignAgreementService = async (id, userId, intentToSign) => {
  if (!intentToSign) {
    const error = new Error('You must check the box to indicate your intent to sign.');
    error.status = 400;
    throw error;
  }

  const agreement = await prisma.legalAgreement.findUnique({
    where: { id },
    include: { signatures: true },
  });

  if (!agreement) {
    const error = new Error('Agreement not found.');
    error.status = 404;
    throw error;
  }

  if (agreement.status === 'SIGNED') {
    const error = new Error('Agreement is already fully signed and locked.');
    error.status = 400;
    throw error;
  }

  const user = await prisma.userProfile.findUnique({
    where: { id: userId },
  });

  if (!user) {
    const error = new Error('User not found.');
    error.status = 404;
    throw error;
  }

  if (!user.identityVerified || !user.legalName) {
    const error = new Error('Identity verification (via government ID/NIN) and completed profile (full legal name) are required to sign agreements.');
    error.status = 403;
    throw error;
  }

  // Check if user already signed
  const alreadySigned = agreement.signatures.some(sig => sig.userId === userId);
  if (alreadySigned) {
    const error = new Error('You have already signed this agreement.');
    error.status = 400;
    throw error;
  }

  // Add signature record
  await prisma.agreementSignature.create({
    data: {
      agreementId: id,
      userId,
      legalName: user.legalName,
    }
  });

  const updatedAgreement = await prisma.legalAgreement.update({
    where: { id },
    data: { 
      status: 'SIGNED',
      auditMetadata: {
        lockedAt: new Date().toISOString(),
        actionType: 'electronic_signature',
        signerName: user.legalName,
        signerId: userId,
        projectId: agreement.projectId
      }
    },
    include: { signatures: true },
  });

  await prisma.activityLog.create({
    data: {
      projectId: agreement.projectId,
      action: 'AGREEMENT_SIGNED',
      details: `Agreement "${agreement.title || 'Untitled'}" was electronically signed by ${user.legalName}.`,
    }
  });

  await notifyCollaborators(agreement.projectId, agreement.title || 'Untitled');

  return updatedAgreement;
};

const editAgreementService = async (id, file, updateData, userId) => {
  const agreement = await prisma.legalAgreement.findUnique({
    where: { id },
    include: { project: true }
  });

  if (!agreement) {
    const error = new Error('Agreement not found.');
    error.status = 404;
    throw error;
  }

  if (agreement.status === 'SIGNED') {
    const error = new Error('Cannot edit a signed agreement.');
    error.status = 400;
    throw error;
  }

  if (agreement.project.ownerId !== userId) {
    const error = new Error('Only the project owner or authorized users can edit agreements.');
    error.status = 403;
    throw error;
  }

  const dataToUpdate = {};
  if (updateData.title) dataToUpdate.title = updateData.title;
  if (updateData.content) dataToUpdate.content = updateData.content;
  if (updateData.status) {
      if (updateData.status === 'SIGNED') {
          const error = new Error('Cannot set status to SIGNED through edit endpoint.');
          error.status = 400;
          throw error;
      }
      dataToUpdate.status = updateData.status;
  }

  if (file) {
    const uploadResult = await uploadToSupabase(file, agreement.projectId, userId);
    dataToUpdate.fileUrl = uploadResult.fileUrl;
    dataToUpdate.filePath = uploadResult.filePath;
  }

  const updatedAgreement = await prisma.legalAgreement.update({
    where: { id },
    data: dataToUpdate,
  });

  await prisma.activityLog.create({
    data: {
      projectId: agreement.projectId,
      action: 'AGREEMENT_EDITED',
      details: `Agreement "${updatedAgreement.title || 'Untitled'}" was edited or replaced.`,
    }
  });

  return updatedAgreement;
};

module.exports = {
  uploadAgreementService,
  getAgreementsService,
  updateAgreementStatusService,
  uploadSignedAgreementService,
  esignAgreementService,
  editAgreementService,
};
