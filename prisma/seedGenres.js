const prisma = require("../src/config/prismaClient");

const ALL_GENRES = [
  "Afrobeats",
  "Amapiano",
  "R&B",
  "Electronic",
  "Hip-Hop",
  "Jazz",
  "Folk",
  "Ambient",
  "Pop",
  "Classical",
  "Cinematic",
  "Rock",
  "Gospel",
  "Reggae",
  "Dancehall",
  "Highlife",
  "Country",
  "Blues",
  "Soul",
  "Trap"
];

async function main() {
  const profiles = await prisma.userProfile.findMany();
  console.log(`Found ${profiles.length} user profiles to seed with genres.`);
  
  for (const profile of profiles) {
    const existingGenres = profile.genres || [];
    const merged = Array.from(new Set([...existingGenres, ...ALL_GENRES]));
    await prisma.userProfile.update({
      where: { id: profile.id },
      data: { genres: merged },
    });
  }
  console.log("Successfully seeded database user profiles with full genres!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
