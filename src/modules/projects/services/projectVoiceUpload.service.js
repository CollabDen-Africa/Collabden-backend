const prisma = require("../../../config/prismaClient");
const supabase = require("../../../config/supabase");
const { assertOwnerCanAbsorb } = require("./storageQuota.service");
const {
  VOICE_NOTES_BUCKET,
  MAX_VOICE_DURATION_SECONDS,
  MAX_VOICE_BYTES,
  ALLOWED_VOICE_MIME_TYPES,
} = require("../../messaging/services/voiceUpload.service");

const PLAYBACK_URL_TTL_SECONDS = 60 * 60; // 1 hour

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
    throw httpError("Project not found or you do not have access to send voice notes.", 404);
  }
  return project;
};

const extensionForMime = (mimeType) => {
  const map = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
  };
  return map[mimeType] || "bin";
};

const uploadProjectVoiceNote = async (projectId, userId, file, { durationSeconds } = {}) => {
  assertStorageConfigured();
  if (!file || !file.buffer) throw httpError("No audio file was uploaded.", 400);
  if (!ALLOWED_VOICE_MIME_TYPES.has(file.mimetype)) {
    throw httpError("Unsupported audio format. Allowed: webm, ogg, m4a, aac, mp3, wav.", 400);
  }

  const duration = Number(durationSeconds);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw httpError("durationSeconds (positive number) is required.", 400);
  }
  if (duration > MAX_VOICE_DURATION_SECONDS) {
    throw httpError(
      `Voice notes cannot exceed ${MAX_VOICE_DURATION_SECONDS} seconds.`,
      400,
      "DURATION_TOO_LONG"
    );
  }

  const project = await assertProjectAccess(projectId, userId);

  await assertOwnerCanAbsorb({
    owner: project.owner,
    incomingBytes: file.size,
    perFileCapBytes: MAX_VOICE_BYTES,
    perFileCapLabel: "Voice note",
  });

  const ext = extensionForMime(file.mimetype);
  const nonce = Math.random().toString(36).slice(2, 8);
  const path = `${projectId}/${userId}-${Date.now()}-${nonce}.${ext}`;

  let { error: uploadError } = await supabase.storage
    .from(VOICE_NOTES_BUCKET)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });

  if (
    uploadError &&
    (uploadError.statusCode === "404" || uploadError.message?.toLowerCase().includes("not found"))
  ) {
    await supabase.storage.createBucket(VOICE_NOTES_BUCKET, { public: false });
    ({ error: uploadError } = await supabase.storage
      .from(VOICE_NOTES_BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false }));
  }

  if (uploadError) {
    console.error("[Project voice upload] Supabase upload error:", uploadError);
    throw httpError("Voice note upload failed. Please try again.", 502);
  }

  const { data: signed, error: urlError } = await supabase.storage
    .from(VOICE_NOTES_BUCKET)
    .createSignedUrl(path, PLAYBACK_URL_TTL_SECONDS);
  if (urlError) {
    throw httpError("Upload succeeded, but failed to generate playback URL.", 502);
  }

  return {
    path,
    signedUrl: signed.signedUrl,
    mimeType: file.mimetype,
    size: file.size,
    durationSeconds: Math.trunc(duration),
    expiresInSeconds: PLAYBACK_URL_TTL_SECONDS,
  };
};

module.exports = {
  uploadProjectVoiceNote,
};
