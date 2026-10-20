const prisma = require("../../../config/prismaClient");
const supabase = require("../../../config/supabase");
const { assertOwnerCanAbsorb } = require("./storageQuota.service");

const MESSAGE_ATTACHMENTS_BUCKET = "message-attachments";
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const PLAYBACK_URL_TTL_SECONDS = 60 * 60; // 1 hour

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  // Audio (overlap with voice/project files is OK)
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/flac",
  "audio/x-flac",
  "audio/midi",
  "audio/x-midi",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  // Archives (small sample packs)
  "application/zip",
  "application/x-zip-compressed",
]);

const httpError = (message, status, code) => {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
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
      ownerId: true,
      owner: { select: { id: true, tier: true } },
    },
  });
  if (!project) {
    throw httpError("Project not found or you do not have access to attach files.", 404);
  }
  return project;
};

const safeStorageKey = (projectId, userId, originalName) => {
  const safeName = (originalName || "attachment").replace(/[^a-zA-Z0-9._-]/g, "_");
  const nonce = Math.random().toString(36).slice(2, 8);
  return `${projectId}/${userId}-${Date.now()}-${nonce}-${safeName}`;
};

const uploadMessageAttachment = async (projectId, userId, file) => {
  assertStorageConfigured();
  if (!file || !file.buffer) throw httpError("No file was uploaded.", 400);
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.mimetype)) {
    throw httpError(
      "Unsupported attachment type. Allowed: images, PDFs, Office docs, audio, and zip archives.",
      400,
      "UNSUPPORTED_TYPE"
    );
  }

  const project = await assertProjectAccess(projectId, userId);

  await assertOwnerCanAbsorb({
    owner: project.owner,
    incomingBytes: file.size,
    perFileCapBytes: MAX_ATTACHMENT_BYTES,
    perFileCapLabel: "Attachment",
  });

  const path = safeStorageKey(projectId, userId, file.originalname);
  const { error: uploadError } = await supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
  if (uploadError) {
    throw httpError("Attachment upload failed. Please try again.", 502);
  }

  const { data: signed, error: urlError } = await supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, PLAYBACK_URL_TTL_SECONDS);
  if (urlError) {
    throw httpError("Upload succeeded, but failed to generate preview URL.", 502);
  }

  return {
    path,
    signedUrl: signed.signedUrl,
    name: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    expiresInSeconds: PLAYBACK_URL_TTL_SECONDS,
  };
};

const isStorageKey = (value) =>
  typeof value === "string" && value.length > 0 && !/^https?:\/\//i.test(value);

const resolveAttachmentUrl = async (storedUrl) => {
  if (!isStorageKey(storedUrl)) return storedUrl;
  if (!supabase) return storedUrl;
  const { data, error } = await supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .createSignedUrl(storedUrl, PLAYBACK_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return storedUrl;
  return data.signedUrl;
};

const resolveMessageAttachmentUrls = async (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) return messages;
  await Promise.all(
    messages.map(async (m) => {
      if (!m || !Array.isArray(m.attachments) || m.attachments.length === 0) return;
      await Promise.all(
        m.attachments.map(async (a) => {
          if (a && isStorageKey(a.url)) {
            a.url = await resolveAttachmentUrl(a.url);
          }
        })
      );
    })
  );
  return messages;
};

module.exports = {
  uploadMessageAttachment,
  resolveAttachmentUrl,
  resolveMessageAttachmentUrls,
  MESSAGE_ATTACHMENTS_BUCKET,
  MAX_ATTACHMENT_BYTES,
  ALLOWED_ATTACHMENT_MIME_TYPES,
};
