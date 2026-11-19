/**
 * Script: backfillProjectFileUploaders.js
 * Usage: node src/scripts/backfillProjectFileUploaders.js [--dry-run]
 *
 * Restores ProjectFile.uploaderId to the original sharer (the uploader of v1).
 * Uploading a new version used to overwrite uploaderId with the version's uploader,
 * which stripped delete rights from the person who shared the file.
 *
 * Files whose v1 was deleted, or whose v1 uploader no longer exists, are skipped
 * and listed so they can be reviewed manually.
 * Safe to run multiple times — only files with a mismatched uploader are updated.
 */

require("dotenv").config();
const prisma = require("../config/prismaClient");

const DRY_RUN = process.argv.includes("--dry-run");

async function backfillProjectFileUploaders() {
  try {
    console.log(`🔍 Scanning project files${DRY_RUN ? " (dry run)" : ""}...`);

    const files = await prisma.projectFile.findMany({
      select: {
        id: true,
        name: true,
        projectId: true,
        uploaderId: true,
        versions: {
          where: { versionNumber: 1 },
          select: { uploaderId: true },
        },
      },
    });

    let updated = 0;
    const skipped = [];

    for (const file of files) {
      const originalUploaderId = file.versions[0]?.uploaderId;

      if (!originalUploaderId) {
        skipped.push(file);
        continue;
      }
      if (originalUploaderId === file.uploaderId) continue;

      console.log(`✏️  "${file.name}" (${file.id}): ${file.uploaderId ?? "null"} → ${originalUploaderId}`);
      if (!DRY_RUN) {
        await prisma.projectFile.update({
          where: { id: file.id },
          data: { uploaderId: originalUploaderId },
        });
      }
      updated += 1;
    }

    console.log(`\n✅ ${DRY_RUN ? "Would update" : "Updated"} ${updated} of ${files.length} files.`);

    if (skipped.length > 0) {
      console.log(`⚠️  Skipped ${skipped.length} files with no v1 uploader (review manually):`);
      for (const file of skipped) {
        console.log(`   - "${file.name}" (${file.id}) in project ${file.projectId}`);
      }
    }
  } catch (error) {
    console.error("❌ Backfill failed:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log("🔌 Database connection closed.");
  }
}

backfillProjectFileUploaders();
