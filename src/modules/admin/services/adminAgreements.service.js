const prisma = require("../../../config/prismaClient");
const supabase = require("../../../config/supabase");

/**
 * Retrieve all legal agreements with search, filtering, sorting, and pagination.
 * FR: FRA36, FRA37, FRA38 | NFR: NFRA24
 */
const getAgreements = async (filters = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    projectStatus,
    dateCreatedFrom,
    dateCreatedTo,
    dateSignedFrom,
    dateSignedTo,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;
  const direction = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";

  const where = {};

  // Search by agreement ID, project name, project owner name, or collaborator name
  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { project: { name: { contains: search, mode: "insensitive" } } },
      { project: { owner: { displayName: { contains: search, mode: "insensitive" } } } },
      { project: { owner: { email: { contains: search, mode: "insensitive" } } } },
      {
        project: {
          collaborators: {
            some: {
              user: {
                displayName: { contains: search, mode: "insensitive" },
              },
            },
          },
        },
      },
    ];
  }

  // Filter by agreement status
  if (status && status !== "All") {
    where.status = status;
  }

  // Filter by project status
  if (projectStatus && projectStatus !== "All") {
    where.project = {
      ...where.project,
      status: projectStatus,
    };
  }

  // Filter by date created range
  if (dateCreatedFrom || dateCreatedTo) {
    where.createdAt = {};
    if (dateCreatedFrom) where.createdAt.gte = new Date(dateCreatedFrom);
    if (dateCreatedTo) where.createdAt.lte = new Date(dateCreatedTo);
  }

  // Filter by date signed range (via signature records)
  if (dateSignedFrom || dateSignedTo) {
    where.signatures = {
      some: {
        signedAt: {
          ...(dateSignedFrom ? { gte: new Date(dateSignedFrom) } : {}),
          ...(dateSignedTo ? { lte: new Date(dateSignedTo) } : {}),
        },
      },
    };
  }

  const allowedSorts = ["createdAt", "title", "status", "updatedAt"];
  const sortField = allowedSorts.includes(sortBy) ? sortBy : "createdAt";

  const [total, agreements] = await Promise.all([
    prisma.legalAgreement.count({ where }),
    prisma.legalAgreement.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { [sortField]: direction },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            visibility: true,
            owner: {
              select: {
                id: true,
                displayName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        signatures: {
          select: {
            id: true,
            userId: true,
            legalName: true,
            signedAt: true,
          },
          orderBy: { signedAt: "asc" },
        },
        _count: {
          select: {
            signatures: true,
            reports: true,
          },
        },
      },
    }),
  ]);

  // Summary counts
  const [totalAgreements, draftCount, pendingCount, signedCount] = await Promise.all([
    prisma.legalAgreement.count(),
    prisma.legalAgreement.count({ where: { status: "DRAFT" } }),
    prisma.legalAgreement.count({ where: { status: "PENDING_SIGNATURE" } }),
    prisma.legalAgreement.count({ where: { status: "SIGNED" } }),
  ]);

  return {
    summary: {
      totalAgreements,
      draftCount,
      pendingSignatureCount: pendingCount,
      signedCount,
    },
    agreements,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

/**
 * Retrieve agreement details with signatories, identity verification info, and signed document access.
 * FR: FRA39, FRA40, FRA42 | NFR: NFRA25, NFRA26, NFRA28
 */
const getAgreementDetails = async (id) => {
  const agreement = await prisma.legalAgreement.findUnique({
    where: { id },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          description: true,
          genre: true,
          status: true,
          visibility: true,
          startDate: true,
          endDate: true,
          owner: {
            select: {
              id: true,
              displayName: true,
              legalName: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
              isVerified: true,
              identityVerified: true,
              tier: true,
            },
          },
          collaborators: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  legalName: true,
                  email: true,
                  avatarUrl: true,
                  isVerified: true,
                  identityVerified: true,
                },
              },
            },
          },
        },
      },
      signatures: {
        orderBy: { signedAt: "asc" },
        select: {
          id: true,
          userId: true,
          legalName: true,
          signedAt: true,
        },
      },
      escrows: {
        select: {
          id: true,
          totalAmount: true,
          fundedAmount: true,
          releasedAmount: true,
          status: true,
        },
      },
      reports: {
        orderBy: { createdAt: "desc" },
        include: {
          reporter: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      },
      adminNotes: {
        orderBy: { createdAt: "desc" },
        include: {
          admin: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!agreement) {
    throw new Error("Agreement not found");
  }

  // Enrich signatures with signer identity verification status
  const enrichedSignatures = await Promise.all(
    agreement.signatures.map(async (sig) => {
      const user = await prisma.userProfile.findUnique({
        where: { id: sig.userId },
        select: {
          displayName: true,
          email: true,
          avatarUrl: true,
          isVerified: true,
          identityVerified: true,
        },
      });
      return {
        ...sig,
        signer: user,
      };
    })
  );

  // Generate a fresh signed URL for authorized document access
  let secureFileUrl = agreement.fileUrl;
  if (agreement.filePath && supabase) {
    const { data, error } = await supabase.storage
      .from("agreements")
      .createSignedUrl(agreement.filePath, 3600); // 1 hour expiry
    if (!error && data?.signedUrl) {
      secureFileUrl = data.signedUrl;
    }
  }

  return {
    ...agreement,
    signatures: enrichedSignatures,
    secureFileUrl,
    isLocked: agreement.status === "SIGNED",
  };
};

/**
 * Retrieve agreement activity history (uploads, edits, signatures, status changes).
 * FR: FRA41 | NFR: NFRA29
 */
const getAgreementActivity = async (agreementId) => {
  const agreement = await prisma.legalAgreement.findUnique({
    where: { id: agreementId },
    select: { id: true, projectId: true, title: true },
  });

  if (!agreement) {
    throw new Error("Agreement not found");
  }

  // Fetch activity logs for the project filtered to agreement-related actions
  const activities = await prisma.activityLog.findMany({
    where: {
      projectId: agreement.projectId,
      action: {
        in: [
          "AGREEMENT_UPLOADED",
          "AGREEMENT_EDITED",
          "AGREEMENT_STATUS_UPDATED",
          "AGREEMENT_SIGNED",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Also include signature events directly from AgreementSignature
  const signatureEvents = await prisma.agreementSignature.findMany({
    where: { agreementId },
    orderBy: { signedAt: "desc" },
    select: {
      id: true,
      userId: true,
      legalName: true,
      signedAt: true,
    },
  });

  return {
    agreementId,
    agreementTitle: agreement.title,
    activities,
    signatureEvents,
  };
};

/**
 * Retrieve reports submitted against legal agreements.
 * FR: FRA43
 */
const getAgreementReports = async (filters = {}) => {
  const { page = 1, limit = 10, status, search } = filters;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  const where = {
    agreementId: { not: null },
  };

  if (status && status !== "All") {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { reason: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { reporter: { displayName: { contains: search, mode: "insensitive" } } },
      { reporter: { email: { contains: search, mode: "insensitive" } } },
      { agreement: { title: { contains: search, mode: "insensitive" } } },
      { agreement: { project: { name: { contains: search, mode: "insensitive" } } } },
    ];
  }

  const [total, reports] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: "desc" },
      include: {
        reporter: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
        agreement: {
          select: {
            id: true,
            title: true,
            status: true,
            project: {
              select: {
                id: true,
                name: true,
                owner: {
                  select: {
                    id: true,
                    displayName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    reports,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

/**
 * Retrieve a single agreement report by ID with full context.
 * FR: FRA43
 */
const getAgreementReportById = async (reportId) => {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      reporter: {
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
        },
      },
      agreement: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
              status: true,
              owner: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                },
              },
            },
          },
          signatures: {
            select: {
              id: true,
              userId: true,
              legalName: true,
              signedAt: true,
            },
          },
        },
      },
    },
  });

  if (!report) {
    throw new Error("Report not found");
  }

  return report;
};

/**
 * Update the status of an agreement report after investigation.
 * FR: FRA43 | NFR: NFRA27
 */
const updateAgreementReportStatus = async (adminId, reportId, status) => {
  const existingReport = await prisma.report.findUnique({ where: { id: reportId } });
  if (!existingReport) {
    throw new Error("Report not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedReport = await tx.report.update({
      where: { id: reportId },
      data: { status },
      include: {
        reporter: { select: { id: true, displayName: true, email: true } },
        agreement: { select: { id: true, title: true } },
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: "AGREEMENT_REPORT_STATUS_UPDATED",
        targetUserId: existingReport.reporterId || null,
        details: {
          reportId,
          agreementId: existingReport.agreementId,
          previousStatus: existingReport.status,
          newStatus: status,
        },
      },
    });

    return updatedReport;
  });

  return result;
};

/**
 * Add an internal administrative note to a legal agreement.
 * FR: FRA43 | NFR: NFRA27
 */
const addAgreementNote = async (adminId, payload) => {
  const { content, targetAgreementId } = payload;

  const agreement = await prisma.legalAgreement.findUnique({
    where: { id: targetAgreementId },
  });
  if (!agreement) {
    throw new Error("Agreement not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    const note = await tx.adminNote.create({
      data: {
        adminId,
        targetAgreementId,
        content,
      },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: "AGREEMENT_ADMIN_NOTE_ADDED",
        details: {
          noteId: note.id,
          agreementId: targetAgreementId,
          agreementTitle: agreement.title,
        },
      },
    });

    return note;
  });

  return result;
};

/**
 * View agreement audit history (read-only, chronological, immutable).
 * FR: FRA44, FRA45 | NFR: NFRA27, NFRA29
 */
const getAgreementAuditHistory = async (query = {}) => {
  const { page = 1, limit = 10, search } = query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  const where = {
    action: { startsWith: "AGREEMENT_" },
  };

  if (search) {
    where.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { admin: { email: { contains: search, mode: "insensitive" } } },
      { targetUser: { displayName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [total, auditLogs] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: "desc" },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        targetUser: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return {
    auditLogs,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

module.exports = {
  getAgreements,
  getAgreementDetails,
  getAgreementActivity,
  getAgreementReports,
  getAgreementReportById,
  updateAgreementReportStatus,
  addAgreementNote,
  getAgreementAuditHistory,
};
