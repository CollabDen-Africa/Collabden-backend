const supabase = require("../../../config/supabase");

const DIRECT_MESSAGE_ATTACHMENTS_BUCKET = "direct-message-attachments";
const MAX_DM_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB per attachment (no total quota — DMs have no owner).
const PLAYBACK_URL_TTL_SECONDS = 60 * 60; // 1 hour

const ALLOWED_DM_ATTACHMENT_MIME_TYPES = new Set([
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
  // Audio (small clips; voice notes have their own upload path)
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

const safeStorageKey = (userId, originalName) => {
  const safeName = (originalName || "attachment").replace(/[^a-zA-Z0-9._-]/g, "_");
  const nonce = Math.random().toString(36).slice(2, 8);
  return `${userId}/${Date.now()}-${nonce}-${safeName}`;
};

const uploadDirectMessageAttachment = async (userId, file) => {
  assertStorageConfigured();
  if (!file || !file.buffer) throw httpError("No file was uploaded.", 400);
  if (!ALLOWED_DM_ATTACHMENT_MIME_TYPES.has(file.mimetype)) {
    throw httpError(
      "Unsupported attachment type. Allowed: images, PDFs, Office docs, and audio clips.",
      400,
      "UNSUPPORTED_TYPE"
    );
  }
  if (file.size > MAX_DM_ATTACHMENT_BYTES) {
    throw httpError(
      `Attachment is larger than the ${Math.round(MAX_DM_ATTACHMENT_BYTES / 1024 / 1024)} MB limit.`,
      413,
      "FILE_TOO_LARGE"
    );
  }

  const path = safeStorageKey(userId, file.originalname);
  let { error: uploadError } = await supabase.storage
    .from(DIRECT_MESSAGE_ATTACHMENTS_BUCKET)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });

  if (uploadError && (uploadError.statusCode === "404" || uploadError.message?.toLowerCase().includes("not found"))) {
    await supabase.storage.createBucket(DIRECT_MESSAGE_ATTACHMENTS_BUCKET, { public: false });
    ({ error: uploadError } = await supabase.storage
      .from(DIRECT_MESSAGE_ATTACHMENTS_BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false }));
  }

  if (uploadError) {
    console.error("[DM attachment upload] Supabase upload error:", uploadError);
    throw httpError("Attachment upload failed. Please try again.", 502);
  }

  const { data: signed, error: urlError } = await supabase.storage
    .from(DIRECT_MESSAGE_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, PLAYBACK_URL_TTL_SECONDS);
  if (urlError) {
    console.error("[DM attachment upload] Supabase signed URL error:", urlError);
    throw httpError("Upload succeeded, but failed to generate preview URL.", 502);
  }

  return {
    url: path,
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
    .from(DIRECT_MESSAGE_ATTACHMENTS_BUCKET)
    .createSignedUrl(storedUrl, PLAYBACK_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return storedUrl;
  return data.signedUrl;
};

const resolveDirectMessageAttachmentUrls = async (messages) => {
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

const MAX_ATTACHMENTS_PER_DM = 10;

const sanitizeAttachmentsPayload = (attachments) => {
  if (attachments === undefined || attachments === null) return [];
  if (!Array.isArray(attachments)) {
    throw httpError("attachments must be an array.", 400);
  }
  if (attachments.length > MAX_ATTACHMENTS_PER_DM) {
    throw httpError(`A message cannot have more than ${MAX_ATTACHMENTS_PER_DM} attachments.`, 400);
  }
  return attachments.map((a) => {
    if (!a || typeof a.url !== "string" || !a.url.trim()) {
      throw httpError("Each attachment must include a url.", 400);
    }
    return {
      url: a.url.trim(),
      name: typeof a.name === "string" ? a.name.trim() : null,
      mimeType: typeof a.mimeType === "string" ? a.mimeType.trim() : null,
      size: Number.isFinite(a.size) ? Math.trunc(a.size) : null,
    };
  });
};

module.exports = {
  uploadDirectMessageAttachment,
  resolveAttachmentUrl,
  resolveDirectMessageAttachmentUrls,
  sanitizeAttachmentsPayload,
  DIRECT_MESSAGE_ATTACHMENTS_BUCKET,
  MAX_DM_ATTACHMENT_BYTES,
  ALLOWED_DM_ATTACHMENT_MIME_TYPES,
};
