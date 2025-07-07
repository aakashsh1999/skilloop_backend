const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.searchSkills = async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter "q"' });
  }

  try {
    const skills = await prisma.skill.findMany({
      where: {
        name: {
          contains: query,
          mode: "insensitive", // Case-insensitive search
        },
      },
      take: 10, // Limit for performance
    });

    res.json({ skills });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
