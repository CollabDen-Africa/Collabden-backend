const supabase = require("../config/supabase");

const { ALLOWED_MIMETYPES } = require("../config/constants");

const uploadAgreement = async (file, projectId, userId) => {
  if (!supabase) {
    throw new Error("Supabase client not initialized. Check environment variables.");
  }

  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    throw new Error("Unsupported file type. Please upload a PDF or DOC/DOCX file.");
  }

  const timestamp = Date.now();
  const ext = file.originalname.split(".").pop();
  const filePath = `${projectId}/${userId}-${timestamp}.${ext}`;

  const { data, error } = await supabase.storage
    .from("agreements")
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    throw new Error("File upload failed. Please try again.");
  }

  // Get signed URL (1 hour expiry = 3600 seconds)
  const { data: urlData, error: urlError } = await supabase.storage
    .from("agreements")
    .createSignedUrl(filePath, 3600);

  if (urlError) {
    console.error("Supabase signed URL error:", urlError);
    throw new Error("File upload successful, but failed to generate signed URL.");
  }

  return {
    fileUrl: urlData.signedUrl,
    filePath: filePath,
  };
};

module.exports = {
  uploadAgreement,
};
