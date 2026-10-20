const supabase = require("../../../config/supabase");

const VOICE_NOTES_BUCKET = "voice-notes";
const MAX_VOICE_DURATION_SECONDS = 180;
const MAX_VOICE_BYTES = 10 * 1024 * 1024;
const PLAYBACK_URL_TTL_SECONDS = 60 * 60; // 1 hour

const ALLOWED_VOICE_MIME_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
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

const uploadVoiceNote = async (userId, file, { durationSeconds } = {}) => {
  assertStorageConfigured();
  if (!file || !file.buffer) throw httpError("No audio file was uploaded.", 400);
  if (!ALLOWED_VOICE_MIME_TYPES.has(file.mimetype)) {
    throw httpError("Unsupported audio format. Allowed: webm, ogg, m4a, aac, mp3, wav.", 400);
  }
  if (file.size > MAX_VOICE_BYTES) {
    throw httpError(
      `Voice note is larger than the ${Math.round(MAX_VOICE_BYTES / 1024 / 1024)} MB limit.`,
      413,
      "FILE_TOO_LARGE"
    );
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

  const ext = extensionForMime(file.mimetype);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  let { error: uploadError } = await supabase.storage
    .from(VOICE_NOTES_BUCKET)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });

  if (uploadError && (uploadError.statusCode === "404" || uploadError.message?.toLowerCase().includes("not found"))) {
    await supabase.storage.createBucket(VOICE_NOTES_BUCKET, { public: false });
    ({ error: uploadError } = await supabase.storage
      .from(VOICE_NOTES_BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false }));
  }

  if (uploadError) {
    console.error("[Voice upload] Supabase upload error:", uploadError);
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

const isStorageKey = (value) =>
  typeof value === "string" && value.length > 0 && !/^https?:\/\//i.test(value);

/**
 * Swap a stored Supabase path for a short-lived signed playback URL.
 * Returns the value unchanged if it's already a full URL or not a voice-note path.
 */
const resolveVoicePlaybackUrl = async (voiceUrl) => {
  if (!isStorageKey(voiceUrl)) return voiceUrl;
  if (!supabase) return voiceUrl;
  const { data, error } = await supabase.storage
    .from(VOICE_NOTES_BUCKET)
    .createSignedUrl(voiceUrl, PLAYBACK_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return voiceUrl;
  return data.signedUrl;
};

const resolveMessageVoiceUrls = async (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) return messages;
  await Promise.all(
    messages.map(async (m) => {
      if (m && typeof m === "object" && isStorageKey(m.voiceUrl)) {
        m.voiceUrl = await resolveVoicePlaybackUrl(m.voiceUrl);
      }
      if (m && m.parent && isStorageKey(m.parent.voiceUrl)) {
        m.parent.voiceUrl = await resolveVoicePlaybackUrl(m.parent.voiceUrl);
      }
    })
  );
  return messages;
};

module.exports = {
  uploadVoiceNote,
  resolveVoicePlaybackUrl,
  resolveMessageVoiceUrls,
  VOICE_NOTES_BUCKET,
  MAX_VOICE_DURATION_SECONDS,
  MAX_VOICE_BYTES,
  ALLOWED_VOICE_MIME_TYPES,
};
