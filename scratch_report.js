require('dotenv').config();
const prisma = require('./src/config/prismaClient');

async function main() {
  const projectId = 'cmoq8rl8g00001ecb9b3h85p3';
  
  // Find any user to act as the reporter
  const user = await prisma.userProfile.findFirst();
  
  if (!user) {
    console.log("No users found in the database. Cannot create a report.");
    return;
  }
  
  console.log(`Using user ${user.id} as reporter.`);

  // Verify the project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    console.log(`Project with ID ${projectId} not found.`);
    return;
  }

  const report = await prisma.report.create({
    data: {
      projectId: projectId,
      reporterId: user.id,
      reason: "Inappropriate Content",
      description: "This project contains content that violates the community guidelines.",
      status: "OPEN"
    }
  });

  console.log("Report created successfully:", report);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
