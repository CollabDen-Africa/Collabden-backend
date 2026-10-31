const prisma = require('../../../config/prismaClient');
const supabase = require('../../../config/supabase');
const { uploadAgreement: uploadToSupabase } = require('../../../lib/uploadAgreement');
const { sendEmail } = require('../../../utils/sendEmail');
const { publishEvent } = require('../../../events/publisher');
const EVENT_TYPES = require('../../../events/eventTypes');

async function getAgreementAttachment(filePath, title) {
  if (!filePath || !supabase) return null;

  try {
    const { data, error } = await supabase.storage.from('agreements').download(filePath);
    if (error || !data) return null;

    const arrayBuffer = await data.arrayBuffer();
    const content = Buffer.from(arrayBuffer).toString('base64');
    const filename = title
      ? `${title.replace(/[^a-z0-9_\-. ]/gi, '_')}.pdf`
      : 'agreement.pdf';

    return { filename, content };
  } catch {
    return null;
  }
}

async function getRequiredSignerIds(projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      collaborators: {
        where: { isActive: true, inviteStatus: 'ACCEPTED' },
        select: { userId: true },
      },
    },
  });
  if (!project) return [];
  const ids = new Set([project.ownerId, ...project.collaborators.map(c => c.userId)]);
  return [...ids];
}

async function notifyCollaborators(projectId, agreementTitle, filePath) {
  const collaborators = await prisma.projectCollaborator.findMany({
    where: { projectId, isActive: true },
    include: { user: true },
  });

  const attachment = await getAgreementAttachment(filePath, agreementTitle);
  const attachments = attachment ? [attachment] : [];

  const emails = collaborators.map(c => c.user.email);
  for (const email of emails) {
    await sendEmail({
      to: email,
      subject: `Agreement Signed: ${agreementTitle}`,
      text: `The legal agreement "${agreementTitle}" for your project has been officially signed and locked. Please find a copy attached.`,
      html: `<p>The legal agreement <strong>"${agreementTitle}"</strong> for your project has been officially signed and locked.</p><p>A copy is attached to this email. You can also view and download it from the project dashboard.</p>`,
      attachments,
    }).catch(err => console.error("Failed to send email to", email, err));
  }
}

const uploadAgreementService = async (file, projectId, userId) => {
  const user = await prisma.userProfile.findUnique({ where: { id: userId } });
  const isPremium = user?.tier === 'PREMIUM';

  if (!isPremium) {
    const agreementCount = await prisma.legalAgreement.count({ where: { projectId } });
    if (agreementCount >= 3) {
      const error = new Error('Free plan limit reached. Upgrade for unlimited uploads.');
      error.status = 403;
      throw error;
    }
  }

  const uploadResult = await uploadToSupabase(file, projectId, userId);
  const { fileUrl, filePath } = uploadResult;

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

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });

  await publishEvent(EVENT_TYPES.AGREEMENT_UPLOADED, {
    projectId,
    projectName: project?.name,
    agreementId: agreement.id,
    agreementTitle: agreement.title,
    uploaderId: userId,
  });

  return agreement;
};

const getAgreementsService = async (projectId) => {
  const agreements = await prisma.legalAgreement.findMany({
    where: { projectId },
    include: { signatures: true },
    orderBy: { createdAt: 'desc' },
  });

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
    PENDING_SIGNATURE: [],
    SIGNED: [],
    EXPIRED: [],
  };

  const agreement = await prisma.legalAgreement.findUnique({
    where: { id },
    include: { project: { select: { ownerId: true, name: true } } },
  });

  if (!agreement) {
    const error = new Error('Agreement not found.');
    error.status = 404;
    throw error;
  }

  if (agreement.project.ownerId !== userId) {
    const error = new Error('Only the project owner can update agreement status.');
    error.status = 403;
    throw error;
  }

  const allowedNextStatuses = validTransitions[agreement.status] || [];
  if (!allowedNextStatuses.includes(status)) {
    const error = new Error(`Invalid status transition from ${agreement.status} to ${status}.`);
    error.status = 400;
    throw error;
  }

  const updatedAgreement = await prisma.legalAgreement.update({
    where: { id },
    data: { status },
  });

  await prisma.activityLog.create({
    data: {
      projectId: updatedAgreement.projectId,
      action: 'AGREEMENT_STATUS_UPDATED',
      details: `Agreement "${updatedAgreement.title || 'Untitled'}" status changed to ${status}.`,
    }
  });

  if (status === 'PENDING_SIGNATURE') {
    await publishEvent(EVENT_TYPES.AGREEMENT_PENDING_SIGNATURE, {
      projectId: agreement.projectId,
      projectName: agreement.project.name,
      agreementId: id,
      agreementTitle: agreement.title,
    });
  }

  return updatedAgreement;
};

const uploadSignedAgreementService = async (id, file, userId) => {
  const agreement = await prisma.legalAgreement.findUnique({
    where: { id },
    include: {
      project: { select: { ownerId: true, name: true } },
      permissions: true,
      signatures: true,
    },
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

  const user = await prisma.userProfile.findUnique({ where: { id: userId } });

  if (!user?.identityVerified || !user?.legalName) {
    const error = new Error('Identity verification (via government ID/NIN) and completed profile (full legal name) are required to sign agreements.');
    error.status = 403;
    throw error;
  }

  const permission = agreement.permissions.find(p => p.userId === userId);
  if (permission && !permission.canSign) {
    const error = new Error('You do not have permission to sign this agreement.');
    error.status = 403;
    throw error;
  }

  if (agreement.signatures.some(sig => sig.userId === userId)) {
    const error = new Error('You have already signed this agreement.');
    error.status = 400;
    throw error;
  }

  const uploadResult = await uploadToSupabase(file, agreement.projectId, userId);
  const { fileUrl, filePath } = uploadResult;

  await prisma.agreementSignature.create({
    data: { agreementId: id, userId, legalName: user.legalName }
  });

  const requiredSignerIds = await getRequiredSignerIds(agreement.projectId);
  const signedUserIds = new Set([...agreement.signatures.map(s => s.userId), userId]);
  const allSigned = requiredSignerIds.length > 0 && requiredSignerIds.every(uid => signedUserIds.has(uid));

  const updatedAgreement = await prisma.legalAgreement.update({
    where: { id },
    data: {
      fileUrl,
      filePath,
      status: allSigned ? 'SIGNED' : 'PENDING_SIGNATURE',
      ...(allSigned && {
        auditMetadata: {
          lockedAt: new Date().toISOString(),
          actionType: 'upload_signed_document',
          signerName: user.legalName,
          signerId: userId,
          projectId: agreement.projectId,
        },
      }),
    },
  });

  await prisma.activityLog.create({
    data: {
      projectId: agreement.projectId,
      action: allSigned ? 'AGREEMENT_SIGNED' : 'AGREEMENT_SIGNATURE_ADDED',
      details: allSigned
        ? `Agreement "${agreement.title || 'Untitled'}" is fully signed and locked. Final signer: ${user.legalName}.`
        : `Signed agreement document "${agreement.title || 'Untitled'}" was uploaded by ${user.legalName}. Awaiting remaining signatures.`,
    }
  });

  if (allSigned) {
    await notifyCollaborators(agreement.projectId, agreement.title || 'Untitled', filePath);
    await publishEvent(EVENT_TYPES.AGREEMENT_SIGNED, {
      projectId: agreement.projectId,
      projectName: agreement.project.name,
      agreementId: id,
      agreementTitle: agreement.title,
      signerName: user.legalName,
    });
  }

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
    include: {
      signatures: true,
      permissions: true,
      project: { select: { ownerId: true, name: true } },
    },
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

  const user = await prisma.userProfile.findUnique({ where: { id: userId } });
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

  const permission = agreement.permissions.find(p => p.userId === userId);
  if (permission && !permission.canSign) {
    const error = new Error('You do not have permission to sign this agreement.');
    error.status = 403;
    throw error;
  }

  const alreadySigned = agreement.signatures.some(sig => sig.userId === userId);
  if (alreadySigned) {
    const error = new Error('You have already signed this agreement.');
    error.status = 400;
    throw error;
  }

  await prisma.agreementSignature.create({
    data: { agreementId: id, userId, legalName: user.legalName }
  });

  const requiredSignerIds = await getRequiredSignerIds(agreement.projectId);
  const signedUserIds = new Set([...agreement.signatures.map(s => s.userId), userId]);
  const allSigned = requiredSignerIds.length > 0 && requiredSignerIds.every(uid => signedUserIds.has(uid));

  const updatedAgreement = await prisma.legalAgreement.update({
    where: { id },
    data: {
      status: allSigned ? 'SIGNED' : 'PENDING_SIGNATURE',
      ...(allSigned && {
        auditMetadata: {
          lockedAt: new Date().toISOString(),
          actionType: 'electronic_signature',
          signerName: user.legalName,
          signerId: userId,
          projectId: agreement.projectId,
        },
      }),
    },
    include: { signatures: true },
  });

  await prisma.activityLog.create({
    data: {
      projectId: agreement.projectId,
      action: allSigned ? 'AGREEMENT_SIGNED' : 'AGREEMENT_SIGNATURE_ADDED',
      details: allSigned
        ? `Agreement "${agreement.title || 'Untitled'}" is fully signed and locked. Final signer: ${user.legalName}.`
        : `Agreement "${agreement.title || 'Untitled'}" was electronically signed by ${user.legalName}. Awaiting remaining signatures.`,
    }
  });

  if (allSigned) {
    await notifyCollaborators(agreement.projectId, agreement.title || 'Untitled', agreement.filePath);
    await publishEvent(EVENT_TYPES.AGREEMENT_SIGNED, {
      projectId: agreement.projectId,
      projectName: agreement.project.name,
      agreementId: id,
      agreementTitle: agreement.title,
      signerName: user.legalName,
    });
  }

  return updatedAgreement;
};

const editAgreementService = async (id, file, updateData, userId) => {
  const agreement = await prisma.legalAgreement.findUnique({
    where: { id },
    include: {
      project: { select: { ownerId: true } },
      permissions: true,
      signatures: { select: { id: true } },
    }
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

  const hasExistingSignatures = agreement.signatures.length > 0;

  const isOwner = agreement.project.ownerId === userId;
  const permission = agreement.permissions.find(p => p.userId === userId);
  const hasEditAccess = permission ? permission.canEdit : isOwner;

  if (!hasEditAccess) {
    const error = new Error('Only the project owner or authorized users can edit agreements.');
    error.status = 403;
    throw error;
  }

  const dataToUpdate = {};
  if (updateData.title) dataToUpdate.title = updateData.title;
  if (updateData.content) {
    if (hasExistingSignatures) {
      const error = new Error('Cannot modify agreement content after it has been signed by any collaborator. Create a new agreement instead.');
      error.status = 400;
      throw error;
    }
    dataToUpdate.content = updateData.content;
  }
  if (updateData.expiresAt) dataToUpdate.expiresAt = new Date(updateData.expiresAt);
  if (updateData.status) {
    if (updateData.status === 'SIGNED') {
      const error = new Error('Cannot set status to SIGNED through edit endpoint.');
      error.status = 400;
      throw error;
    }
    dataToUpdate.status = updateData.status;
  }

  if (file) {
    if (hasExistingSignatures) {
      const error = new Error('Cannot replace the agreement document after it has been signed by any collaborator. Create a new agreement instead.');
      error.status = 400;
      throw error;
    }
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

// FR100, FR104, FR106, FR107
const getUserAgreementsService = async (userId, query = {}) => {
  const {
    page = 1,
    limit = 10,
    status,
    projectName,
    dateFrom,
    dateTo,
    collaboratorName,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = query;

  const parsedPage = Math.max(1, parseInt(page) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 10));
  const skip = (parsedPage - 1) * parsedLimit;

  const whereClause = {
    project: {
      OR: [
        { ownerId: userId },
        { collaborators: { some: { userId } } },
      ],
    },
  };

  if (status) {
    whereClause.status = status;
  }

  if (projectName) {
    whereClause.project = {
      ...whereClause.project,
      name: { contains: projectName, mode: 'insensitive' },
    };
  }

  if (dateFrom || dateTo) {
    whereClause.createdAt = {};
    if (dateFrom) whereClause.createdAt.gte = new Date(dateFrom);
    if (dateTo) whereClause.createdAt.lte = new Date(dateTo);
  }

  const orderByMap = {
    createdAt: { createdAt: sortOrder },
    updatedAt: { updatedAt: sortOrder },
    oldest: { createdAt: 'asc' },
    newest: { createdAt: 'desc' },
  };
  const orderBy = orderByMap[sortBy] || { createdAt: 'desc' };

  const totalCount = await prisma.legalAgreement.count({ where: whereClause });

  const agreements = await prisma.legalAgreement.findMany({
    where: whereClause,
    include: {
      project: {
        select: {
          id: true,
          name: true,
          collaborators: {
            where: { isActive: true },
            select: {
              user: {
                select: { id: true, displayName: true, legalName: true, firstName: true, lastName: true, avatarUrl: true },
              },
            },
          },
        },
      },
      signatures: true,
    },
    orderBy,
    skip,
    take: parsedLimit,
  });

  let sortedAgreements = agreements;
  if (sortBy === 'pendingSignature') {
    sortedAgreements = [
      ...agreements.filter(a => a.status === 'PENDING_SIGNATURE'),
      ...agreements.filter(a => a.status !== 'PENDING_SIGNATURE'),
    ];
  }

  let filtered = sortedAgreements;
  if (collaboratorName) {
    const term = collaboratorName.toLowerCase();
    filtered = sortedAgreements.filter(a =>
      a.project.collaborators.some(c => {
        const name = (c.user.displayName || c.user.legalName ||
          `${c.user.firstName || ''} ${c.user.lastName || ''}`).toLowerCase();
        return name.includes(term);
      })
    );
  }

  const result = await Promise.all(
    filtered.map(async (agreement) => {
      if (agreement.filePath && supabase) {
        const { data, error } = await supabase.storage
          .from('agreements')
          .createSignedUrl(agreement.filePath, 3600);
        if (!error && data?.signedUrl) {
          agreement.fileUrl = data.signedUrl;
        }
      }

      const alreadySigned = agreement.signatures.some(s => s.userId === userId);
      agreement.awaitingMySignature = agreement.status === 'PENDING_SIGNATURE' && !alreadySigned;

      return agreement;
    })
  );

  return {
    agreements: result,
    pagination: {
      total: totalCount,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(totalCount / parsedLimit),
    },
  };
};

const downloadAgreementService = async (agreementId, userId) => {
  const agreement = await prisma.legalAgreement.findUnique({
    where: { id: agreementId },
    include: {
      project: { include: { collaborators: true } },
      permissions: true,
    },
  });

  if (!agreement) {
    const error = new Error('Agreement not found.');
    error.status = 404;
    throw error;
  }

  const isOwner = agreement.project.ownerId === userId;
  const isCollaborator = agreement.project.collaborators.some(c => c.userId === userId);

  if (!isOwner && !isCollaborator) {
    const error = new Error('You do not have access to this agreement.');
    error.status = 403;
    throw error;
  }

  // FR96: check explicit view permission if a record exists
  const permission = agreement.permissions.find(p => p.userId === userId);
  if (permission && !permission.canView) {
    const error = new Error('You do not have permission to view this agreement.');
    error.status = 403;
    throw error;
  }

  if (!agreement.filePath) {
    const error = new Error('No file attached to this agreement.');
    error.status = 404;
    throw error;
  }

  const { data, error: supabaseError } = await supabase.storage
    .from('agreements')
    .download(agreement.filePath);

  if (supabaseError || !data) {
    const error = new Error('Failed to retrieve agreement file.');
    error.status = 502;
    throw error;
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = agreement.title
    ? `${agreement.title.replace(/[^a-z0-9_\-. ]/gi, '_')}.pdf`
    : 'agreement.pdf';

  return { buffer, filename, contentType: 'application/pdf' };
};

// FR96: get permissions for an agreement (owner only)
const getAgreementPermissionsService = async (agreementId, requesterId) => {
  const agreement = await prisma.legalAgreement.findUnique({
    where: { id: agreementId },
    include: {
      project: { select: { ownerId: true } },
      permissions: {
        include: {
          user: {
            select: { id: true, displayName: true, legalName: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
      },
    },
  });

  if (!agreement) {
    const error = new Error('Agreement not found.');
    error.status = 404;
    throw error;
  }

  if (agreement.project.ownerId !== requesterId) {
    const error = new Error('Only the project owner can manage agreement permissions.');
    error.status = 403;
    throw error;
  }

  return agreement.permissions;
};

// FR96: upsert a permission record for a collaborator (owner only)
const updateAgreementPermissionService = async (agreementId, requesterId, targetUserId, { canView, canSign, canEdit }) => {
  const agreement = await prisma.legalAgreement.findUnique({
    where: { id: agreementId },
    include: { project: { select: { ownerId: true } } },
  });

  if (!agreement) {
    const error = new Error('Agreement not found.');
    error.status = 404;
    throw error;
  }

  if (agreement.project.ownerId !== requesterId) {
    const error = new Error('Only the project owner can manage agreement permissions.');
    error.status = 403;
    throw error;
  }

  // targetUserId must be a collaborator on this project
  const collaborator = await prisma.projectCollaborator.findUnique({
    where: { projectId_userId: { projectId: agreement.projectId, userId: targetUserId } },
  });

  if (!collaborator || !collaborator.isActive) {
    const error = new Error('Target user is not an active collaborator on this project.');
    error.status = 400;
    throw error;
  }

  const data = {};
  if (canView !== undefined) data.canView = Boolean(canView);
  if (canSign !== undefined) data.canSign = Boolean(canSign);
  if (canEdit !== undefined) data.canEdit = Boolean(canEdit);

  const permission = await prisma.agreementPermission.upsert({
    where: { agreementId_userId: { agreementId, userId: targetUserId } },
    update: data,
    create: { agreementId, userId: targetUserId, ...data },
  });

  await prisma.activityLog.create({
    data: {
      projectId: agreement.projectId,
      action: 'AGREEMENT_PERMISSION_UPDATED',
      details: `Permissions for agreement "${agreement.title || 'Untitled'}" updated for user ${targetUserId}.`,
    }
  });

  return permission;
};

const getUserAgreementActivityService = async (userId, query = {}) => {
  const {
    page = 1,
    limit = 20,
  } = query;

  const parsedPage = Math.max(1, parseInt(page) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  // Fetch projects the user owns or collaborates on
  const userProjects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { collaborators: { some: { userId } } },
      ],
    },
    select: { id: true },
  });

  const projectIds = userProjects.map(p => p.id);

  const agreementActions = ['AGREEMENT_UPLOADED', 'AGREEMENT_EDITED', 'AGREEMENT_SIGNED', 'AGREEMENT_STATUS_UPDATED', 'AGREEMENT_PERMISSION_UPDATED'];

  const whereClause = {
    projectId: { in: projectIds },
    action: { in: agreementActions },
  };

  const totalCount = await prisma.activityLog.count({ where: whereClause });

  const logs = await prisma.activityLog.findMany({
    where: whereClause,
    include: { project: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    skip,
    take: parsedLimit,
  });

  return {
    activity: logs,
    pagination: {
      total: totalCount,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(totalCount / parsedLimit),
    },
  };
};

module.exports = {
  uploadAgreementService,
  getAgreementsService,
  updateAgreementStatusService,
  uploadSignedAgreementService,
  esignAgreementService,
  editAgreementService,
  getUserAgreementsService,
  downloadAgreementService,
  getAgreementPermissionsService,
  updateAgreementPermissionService,
  getUserAgreementActivityService,
};
