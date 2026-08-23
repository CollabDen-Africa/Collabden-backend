/**
 * Script: createAdminUser.js
 * Usage: node src/scripts/createAdminUser.js
 *
 * Creates a SUPER_ADMIN user in the database.
 * Safe to run multiple times — skips creation if email already exists.
 */

require("dotenv").config();
const bcrypt = require("bcryptjs");
const prisma = require("../config/prismaClient");

const ADMIN_EMAIL = "nzeella6@gmail.com";
const ADMIN_PASSWORD = "Password123";
const ADMIN_ROLE = "SUPER_ADMIN";

async function createAdminUser() {
  try {
    console.log("🔍 Checking if admin user already exists...");

    const existing = await prisma.adminUser.findUnique({
      where: { email: ADMIN_EMAIL },
    });

    if (existing) {
      console.log(`⚠️  Admin user with email "${ADMIN_EMAIL}" already exists. Skipping creation.`);
      console.log(`   Role: ${existing.role} | Status: ${existing.accountStatus}`);
      return;
    }

    console.log("🔐 Hashing password...");
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    console.log("👤 Creating admin user...");
    const admin = await prisma.adminUser.create({
      data: {
        email: ADMIN_EMAIL.toLowerCase(),
        password: hashedPassword,
        role: ADMIN_ROLE,
        accountStatus: "ACTIVE",
        isTwoFactorEnabled: false, // Disabled for initial setup convenience
      },
    });

    console.log("✅ Admin user created successfully!");
    console.log(`   ID:    ${admin.id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role:  ${admin.role}`);
    console.log(`   2FA:   ${admin.isTwoFactorEnabled ? "Enabled" : "Disabled"}`);
    console.log("\n⚠️  Remember to enable 2FA for this account in production!");
  } catch (error) {
    console.error("❌ Failed to create admin user:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log("🔌 Database connection closed.");
  }
}

createAdminUser();
