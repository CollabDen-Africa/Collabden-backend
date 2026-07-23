require('dotenv').config();
const prisma = require('./src/config/prismaClient');
const bcrypt = require('bcryptjs');
async function main() {
  console.log('Seeding database...');
  
  const defaultPassword = 'Password123!';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  // Seed Super Admin
  const adminEmail = 'admin@collabden.com';
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: adminEmail }
  });
  
  if (!existingAdmin) {
    await prisma.adminUser.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        isTwoFactorEnabled: true,
      }
    });
    console.log(`✅ Super Admin created: ${adminEmail} / ${defaultPassword}`);
  } else {
    // Update password just in case
    await prisma.adminUser.update({
      where: { email: adminEmail },
      data: { password: hashedPassword, failedLoginAttempts: 0, lockoutUntil: null }
    });
    console.log(`✅ Super Admin already exists: ${adminEmail}`);
  }

  // Seed Regular User
  const userEmail = 'user@collabden.com';
  const existingUser = await prisma.userProfile.findUnique({
    where: { email: userEmail }
  });

  if (!existingUser) {
    await prisma.userProfile.create({
      data: {
        firstName: 'Test',
        lastName: 'User',
        email: userEmail,
        password: hashedPassword,
        isVerified: true,
      }
    });
    console.log(`✅ Regular User created: ${userEmail} / ${defaultPassword}`);
  } else {
    // Update password just in case
    await prisma.userProfile.update({
      where: { email: userEmail },
      data: { password: hashedPassword, failedLoginAttempts: 0, lockoutUntil: null }
    });
    console.log(`✅ Regular User already exists: ${userEmail}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
