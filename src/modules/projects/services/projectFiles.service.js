const prisma = require("../../../config/prismaClient");
const supabase = require("../../../config/supabase");
const {
  TIER_LIMITS,
  MAX_FILE_UPLOAD_MB,
} = require("../../../config/constants");
const {
  buildStoragePayload,
  assertOwnerCanAbsorb,
  getTierLimits: getTierLimitsShared,
} = require("./storageQuota.service");

const PROJECT_FILES_BUCKET = "project-files";
const ALLOWED_PROJECT_FILE_TYPES = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mpeg",
  "audio/mp3",
  "audio/flac",
  "audio/x-flac",
  "audio/midi",
  "audio/x-midi",
  "application/pdf",
]);
const MAX_FILE_UPLOAD_BYTES = MAX_FILE_UPLOAD_MB * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 10 * 60;

const httpError = (message, status, code, extra) => {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  if (extra) Object.assign(err, extra);
  return err;
};

const assertStorageConfigured = () => {
  if (!supabase) throw httpError("File storage is not configured.", 503);
};

const assertProjectAccess = async (projectId, userId) => {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      isDeleted: false,
      OR: [
        { ownerId: userId },
        { collaborators: { some: { userId, isActive: true } } },
      ],
    },
    select: {
      id: true,
      name: true,
      ownerId: true,
      owner: { select: { id: true, tier: true } },
    },
  });
  if (!project) {
    throw httpError("Project not found or you do not have access to its files.", 404);
  }
  return project;
};

const getTierLimits = getTierLimitsShared;

const assertUploadAllowed = (project, incomingBytes) =>
  assertOwnerCanAbsorb({
    owner: project.owner,
    incomingBytes,
    perFileCapBytes: MAX_FILE_UPLOAD_BYTES,
    perFileCapLabel: "File",
  });

const safeStorageKey = (projectId, uploaderId, originalName) => {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${projectId}/${uploaderId}-${Date.now()}-${safeName}`;
};

const uploadBufferToSupabase = async (storagePath, buffer, mimetype) => {
  const { error } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .upload(storagePath, buffer, { contentType: mimetype, upsert: false });
  if (error) {
    throw httpError("File upload failed. Please try again.", 502);
  }
};

const removeStoredObject = async (storagePath) => {
  if (!storagePath) return;
  try {
    await supabase.storage.from(PROJECT_FILES_BUCKET).remove([storagePath]);
  } catch (err) {
    // Non-fatal: log and continue so DB stays consistent.
    console.warn(`[projectFiles] Failed to remove storage object ${storagePath}:`, err.message);
  }
};

const trimOldVersions = async (fileId, retention) => {
  if (!Number.isFinite(retention) || retention <= 0) return [];
  const versions = await prisma.projectFileVersion.findMany({
    where: { fileId },
    orderBy: { versionNumber: "desc" },
    select: { id: true, url: true, versionNumber: true },
  });
  if (versions.length <= retention) return [];

  const victims = versions.slice(retention);
  // Never purge the current version (should be at index 0 after ordering desc).
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    select: { currentVersionId: true },
  });
  const purgeable = victims.filter((v) => v.id !== file.currentVersionId);

  if (purgeable.length === 0) return [];

  await prisma.projectFileVersion.deleteMany({
    where: { id: { in: purgeable.map((v) => v.id) } },
  });
  await Promise.all(purgeable.map((v) => removeStoredObject(v.url)));
  return purgeable;
};

const FILE_INCLUDE = {
  uploader: {
    select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
  },
  currentVersion: {
    include: {
      uploader: {
        select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
      },
    },
  },
};

const uploadProjectFile = async (projectId, userId, file, { fileId, durationSeconds } = {}) => {
  assertStorageConfigured();
  if (!file || !file.buffer) throw httpError("No file was uploaded.", 400);
  if (!ALLOWED_PROJECT_FILE_TYPES.has(file.mimetype)) {
    throw httpError("Unsupported file type. Upload WAV, MP3, FLAC, MIDI, or PDF files.", 400);
  }

  const project = await assertProjectAccess(projectId, userId);
  await assertUploadAllowed(project, file.size);

  const limits = getTierLimits(project.owner.tier);
  const storagePath = safeStorageKey(projectId, userId, file.originalname);
  await uploadBufferToSupabase(storagePath, file.buffer, file.mimetype);

  const parsedDuration = Number.isFinite(Number(durationSeconds))
    ? Math.max(0, Math.trunc(Number(durationSeconds)))
    : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      let targetFile = null;
      if (fileId) {
        targetFile = await tx.projectFile.findFirst({
          where: { id: fileId, projectId },
          select: { id: true },
        });
        if (!targetFile) {
          throw httpError("Target file not found in this project.", 404);
        }
      }

      if (!targetFile) {
        targetFile = await tx.projectFile.create({
          data: {
            projectId,
            name: file.originalname,
            url: storagePath,
            size: file.size,
            type: file.mimetype,
            durationSeconds: parsedDuration,
            uploaderId: userId,
          },
          select: { id: true },
        });
      }

      const lastVersion = await tx.projectFileVersion.findFirst({
        where: { fileId: targetFile.id },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1;

      const version = await tx.projectFileVersion.create({
        data: {
          fileId: targetFile.id,
          uploaderId: userId,
          versionNumber: nextVersionNumber,
          name: file.originalname,
          url: storagePath,
          size: file.size,
          type: file.mimetype,
          durationSeconds: parsedDuration,
        },
      });

      await tx.projectFile.update({
        where: { id: targetFile.id },
        data: {
          currentVersionId: version.id,
          name: file.originalname,
          url: storagePath,
          size: file.size,
          type: file.mimetype,
          durationSeconds: parsedDuration,
          uploaderId: userId,
        },
      });

      await tx.activityLog.create({
        data: {
          projectId,
          action: fileId ? "FILE_VERSION_UPLOADED" : "FILE_UPLOADED",
          details: fileId
            ? `New version (v${nextVersionNumber}) of "${file.originalname}" was uploaded.`
            : `File "${file.originalname}" was uploaded.`,
        },
      });

      return { targetFileId: targetFile.id };
    });

    await trimOldVersions(result.targetFileId, limits.VERSION_RETENTION);

    const projectFile = await prisma.projectFile.findUnique({
      where: { id: result.targetFileId },
      include: FILE_INCLUDE,
    });
    return projectFile;
  } catch (err) {
    // Best-effort rollback of the uploaded object if DB insert failed.
    await removeStoredObject(storagePath);
    throw err;
  }
};

const listProjectFiles = async (projectId, userId) => {
  await assertProjectAccess(projectId, userId);
  const files = await prisma.projectFile.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    include: {
      ...FILE_INCLUDE,
      _count: { select: { versions: true } },
    },
  });
  return files;
};

const assertFileAccess = async (projectId, fileId, userId) => {
  const project = await assertProjectAccess(projectId, userId);
  const file = await prisma.projectFile.findFirst({
    where: { id: fileId, projectId },
  });
  if (!file) throw httpError("File not found in this project.", 404);
  return { project, file };
};

const listFileVersions = async (projectId, fileId, userId) => {
  const { file } = await assertFileAccess(projectId, fileId, userId);
  const versions = await prisma.projectFileVersion.findMany({
    where: { fileId },
    orderBy: { versionNumber: "desc" },
    include: {
      uploader: {
        select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
      },
    },
  });
  return { fileId: file.id, currentVersionId: file.currentVersionId, versions };
};

const restoreFileVersion = async (projectId, fileId, versionId, userId) => {
  const { file } = await assertFileAccess(projectId, fileId, userId);
  const version = await prisma.projectFileVersion.findFirst({
    where: { id: versionId, fileId },
  });
  if (!version) throw httpError("Version not found for this file.", 404);
  if (version.id === file.currentVersionId) {
    return prisma.projectFile.findUnique({ where: { id: fileId }, include: FILE_INCLUDE });
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectFile.update({
      where: { id: fileId },
      data: {
        currentVersionId: version.id,
        name: version.name,
        url: version.url,
        size: version.size,
        type: version.type,
        durationSeconds: version.durationSeconds,
      },
    });
    await tx.activityLog.create({
      data: {
        projectId,
        action: "FILE_VERSION_RESTORED",
        details: `Restored version v${version.versionNumber} of "${version.name}".`,
      },
    });
  });

  return prisma.projectFile.findUnique({ where: { id: fileId }, include: FILE_INCLUDE });
};

const createSignedUrl = async (storagePath) => {
  if (!storagePath) throw httpError("File has no stored object.", 404);
  const { data, error } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error) {
    throw httpError("Failed to create download link.", 502);
  }
  return { url: data.signedUrl, expiresInSeconds: SIGNED_URL_TTL_SECONDS };
};

const streamProjectFile = async (projectId, fileId, userId, { versionId } = {}) => {
  const { file } = await assertFileAccess(projectId, fileId, userId);
  let storagePath = file.url;
  if (versionId) {
    const version = await prisma.projectFileVersion.findFirst({
      where: { id: versionId, fileId },
    });
    if (!version) throw httpError("Version not found for this file.", 404);
    storagePath = version.url;
  }
  const signed = await createSignedUrl(storagePath);
  return { ...signed, projectId, fileId, versionId: versionId || file.currentVersionId };
};

const downloadProjectFile = streamProjectFile; // same semantics; alias for route clarity.

const deleteProjectFileVersion = async (projectId, fileId, versionId, userId) => {
  assertStorageConfigured();
  const { file } = await assertFileAccess(projectId, fileId, userId);
  const version = await prisma.projectFileVersion.findFirst({
    where: { id: versionId, fileId },
  });
  if (!version) throw httpError("Version not found for this file.", 404);
  if (version.id === file.currentVersionId) {
    throw httpError("Cannot delete the current version. Restore a different version first or delete the entire file.", 400);
  }
  await prisma.projectFileVersion.delete({ where: { id: version.id } });
  await removeStoredObject(version.url);
  await prisma.activityLog.create({
    data: {
      projectId,
      action: "FILE_VERSION_DELETED",
      details: `Deleted version v${version.versionNumber} of "${version.name}".`,
    },
  });
  return { success: true };
};

const deleteProjectFile = async (projectId, fileId, userId) => {
  assertStorageConfigured();
  const { project, file } = await assertFileAccess(projectId, fileId, userId);
  // Only uploader or project owner can delete the whole file.
  if (file.uploaderId !== userId && project.ownerId !== userId) {
    throw httpError("You do not have permission to delete this file.", 403);
  }
  const versions = await prisma.projectFileVersion.findMany({
    where: { fileId },
    select: { url: true },
  });
  await prisma.projectFile.delete({ where: { id: fileId } });
  await Promise.all(versions.map((v) => removeStoredObject(v.url)));
  await prisma.activityLog.create({
    data: {
      projectId,
      action: "FILE_DELETED",
      details: `File "${file.name}" and its versions were deleted.`,
    },
  });
  return { success: true };
};

const saveProjectFileToSpace = async (projectId, fileId, userId) => {
  const { file } = await assertFileAccess(projectId, fileId, userId);
  const saved = await prisma.userSavedFile.upsert({
    where: { userId_projectFileId: { userId, projectFileId: file.id } },
    update: {},
    create: { userId, projectFileId: file.id },
  });
  return saved;
};

const removeSavedFile = async (userId, projectFileId) => {
  await prisma.userSavedFile.deleteMany({
    where: { userId, projectFileId },
  });
  return { success: true };
};

const getProjectStorageUsage = async (projectId, userId) => {
  const project = await assertProjectAccess(projectId, userId);
  const payload = await buildStoragePayload(project.owner);
  return { projectId, ownerId: project.ownerId, ...payload };
};

module.exports = {
  uploadProjectFile,
  listProjectFiles,
  listFileVersions,
  restoreFileVersion,
  streamProjectFile,
  downloadProjectFile,
  deleteProjectFileVersion,
  deleteProjectFile,
  saveProjectFileToSpace,
  removeSavedFile,
  getProjectStorageUsage,
  PROJECT_FILES_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  // exports for other modules that want to reason about limits.
  MAX_FILE_UPLOAD_BYTES,
  MAX_FILE_UPLOAD_MB,
  ALLOWED_PROJECT_FILE_TYPES,
};
