const prisma = require("./prisma");
async function main() {
  // Insert a dummy match
  const newMatch = await prisma.match.create({
    data: {
      user1Id: "userId1", // replace with real user IDs or dummy ones
      user2Id: "userId2",
      matchedAt: new Date(),
      approvedByUser1: false,
      approvedByUser2: false,
    },
  });
  console.log("Created match:", newMatch);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
