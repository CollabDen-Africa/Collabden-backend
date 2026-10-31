const prisma = require("../../../config/prismaClient");
const supabase = require("../../../config/supabase");

const AGREEMENTS_BUCKET = "agreements";
const PROJECT_FILES_BUCKET = "project-files";
const DIRECT_MESSAGE_ATTACHMENTS_BUCKET = "direct-message-attachments";
const SIGNED_URL_TTL_SECONDS = 3600;

const isStorageKey = (value) =>
  typeof value === "string" && value.length > 0 && !/^https?:\/\//i.test(value);

const signUrl = async (bucket, path) => {
  if (!path || !supabase) return null;
  if (!isStorageKey(path)) return path;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
};

const fetchAgreements = async (userId) => {
  const rows = await prisma.legalAgreement.findMany({
    where: {
      project: {
        OR: [
          { ownerId: userId },
          { collaborators: { some: { userId } } },
        ],
      },
    },
    include: {
      project: { select: { id: true, name: true } },
      signatures: { select: { userId: true } },
    },
  });

  return Promise.all(
    rows.map(async (a) => {
      const alreadySigned = a.signatures.some((s) => s.userId === userId);
      const url = a.filePath ? await signUrl(AGREEMENTS_BUCKET, a.filePath) : a.fileUrl;
      return {
        id: a.id,
        type: "agreement",
        title: a.title || "Agreement",
        mimeType: "application/pdf",
        size: null,
        url,
        project: a.project,
        createdAt: a.createdAt,
        meta: {
          status: a.status,
          awaitingMySignature: a.status === "PENDING_SIGNATURE" && !alreadySigned,
        },
      };
    })
  );
};

const fetchSavedFiles = async (userId) => {
  const rows = await prisma.userSavedFile.findMany({
    where: { userId },
    include: {
      projectFile: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
              ownerId: true,
              collaborators: { where: { userId, isActive: true }, select: { userId: true } },
            },
          },
        },
      },
    },
  });

  const accessible = rows.filter(
    (r) =>
      r.projectFile?.project &&
      (r.projectFile.project.ownerId === userId || r.projectFile.project.collaborators.length > 0)
  );

  return Promise.all(
    accessible.map(async (r) => {
      const pf = r.projectFile;
      const url = await signUrl(PROJECT_FILES_BUCKET, pf.url);
      return {
        id: r.id,
        type: "saved-file",
        title: pf.name,
        mimeType: pf.type,
        size: pf.size,
        url,
        project: { id: pf.project.id, name: pf.project.name },
        createdAt: r.savedAt,
        meta: {
          projectFileId: pf.id,
          savedAt: r.savedAt,
        },
      };
    })
  );
};

const fetchDmAttachments = async (userId) => {
  const rows = await prisma.directMessageAttachment.findMany({
    where: {
      message: {
        chat: {
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
      },
    },
    include: {
      message: { select: { id: true, chatId: true, senderId: true } },
    },
  });

  return Promise.all(
    rows.map(async (a) => {
      const url = isStorageKey(a.url) ? await signUrl(DIRECT_MESSAGE_ATTACHMENTS_BUCKET, a.url) : a.url;
      return {
        id: a.id,
        type: "dm-attachment",
        title: a.name || "Attachment",
        mimeType: a.mimeType,
        size: a.size,
        url,
        project: null,
        createdAt: a.createdAt,
        meta: {
          messageId: a.message.id,
          chatId: a.message.chatId,
          senderId: a.message.senderId,
        },
      };
    })
  );
};

const getUserSpace = async (userId, query = {}) => {
  const {
    page = 1,
    limit = 20,
    type,
    projectName,
    dateFrom,
    dateTo,
    search,
    sortOrder = "desc",
  } = query;

  const parsedPage = Math.max(1, parseInt(page) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));

  const fetchers = [];
  if (!type || type === "agreement") fetchers.push(fetchAgreements(userId));
  if (!type || type === "saved-file") fetchers.push(fetchSavedFiles(userId));
  if (!type || type === "dm-attachment") fetchers.push(fetchDmAttachments(userId));

  const results = (await Promise.all(fetchers)).flat();

  let filtered = results;
  if (projectName) {
    const term = projectName.toLowerCase();
    filtered = filtered.filter((r) => r.project?.name?.toLowerCase().includes(term));
  }
  if (search) {
    const term = search.toLowerCase();
    filtered = filtered.filter((r) => (r.title || "").toLowerCase().includes(term));
  }
  if (dateFrom) {
    const from = new Date(dateFrom);
    filtered = filtered.filter((r) => new Date(r.createdAt) >= from);
  }
  if (dateTo) {
    const to = new Date(dateTo);
    filtered = filtered.filter((r) => new Date(r.createdAt) <= to);
  }

  filtered.sort((a, b) => {
    const diff = new Date(b.createdAt) - new Date(a.createdAt);
    return sortOrder === "asc" ? -diff : diff;
  });

  const total = filtered.length;
  const skip = (parsedPage - 1) * parsedLimit;
  const items = filtered.slice(skip, skip + parsedLimit);

  return {
    items,
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit),
    },
  };
};

const removeSavedFile = async (userId, projectFileId) => {
  await prisma.userSavedFile.deleteMany({ where: { userId, projectFileId } });
  return { success: true };
};

module.exports = {
  getUserSpace,
  removeSavedFile,
};
