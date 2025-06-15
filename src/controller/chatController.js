// routes/chat.js
const express = require("express");
const router = express.Router();
const prisma = require("../prisma"); // Assuming your Prisma client is exported from ../prisma

// GET /api/chats/:matchId/messages - Get historical messages for a match
router.get("/:matchId/messages", async (req, res) => {
  const { matchId } = req.params;
  const userId = req.query.userId; // Assuming userId is passed as a query param for verification

  if (!userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    // 1. Verify if the requesting user is part of this match
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        user1Id: true,
        user2Id: true,
        approvedByUser1: true,
        approvedByUser2: true,
      },
    });

    if (!match) {
      return res.status(404).json({ message: "Match not found." });
    }

    if (match.user1Id !== userId && match.user2Id !== userId) {
      return res
        .status(403)
        .json({ message: "Unauthorized access to chat messages." });
    }

    // **MODIFIED LOGIC START**
    // Allow access if at least one of approvedByUser1 or approvedByUser2 is true.
    if (!match.approvedByUser1 && !match.approvedByUser2) {
      return res.status(403).json({
        message:
          "Chat not available until at least one person has approved their side of the match.",
      });
    }
    // **MODIFIED LOGIC END**

    // 2. Fetch messages for the matchId
    const messages = await prisma.chatMessage.findMany({
      where: { matchId: matchId },
      orderBy: { createdAt: "asc" }, // Order by oldest first
      include: {
        sender: {
          select: {
            id: true,
            name: true, // Fetch sender's name
            avatar: true, // Fetch sender's avatar
            profile_image: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            avatar: true,
            profile_image: true,
          },
        },
      },
    });

    // Format messages for client, enriching sender/receiver info
    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      matchId: msg.matchId,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      message: msg.message,
      createdAt: msg.createdAt.toISOString(),
      senderName: msg.sender?.name, // Add sender's name
      senderAvatar: msg.sender?.avatar || msg.sender?.profile_image, // Add sender's avatar
    }));

    res.status(200).json(formattedMessages);
  } catch (error) {
    console.error(`Error fetching chat messages for match ${matchId}:`, error);
    res.status(500).json({
      message: "Failed to fetch chat messages.",
      error: error.message,
    });
  }
});

module.exports = router;
