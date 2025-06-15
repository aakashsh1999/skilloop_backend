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
      console.warn(
        `[API] Match ${matchId} not found when user ${userId} attempted to fetch messages.`
      );
      return res.status(404).json({ message: "Match not found." });
    }

    if (match.user1Id !== userId && match.user2Id !== userId) {
      console.warn(
        `[API] Unauthorized: User ${userId} is not part of match ${matchId} to fetch messages.`
      );
      return res
        .status(403)
        .json({ message: "Unauthorized access to chat messages." });
    }

    // Logic: Allow access if at least one of approvedByUser1 or approvedByUser2 is true.
    if (!match.approvedByUser1 && !match.approvedByUser2) {
      console.warn(
        `[API] Denied: Neither user has approved for match ${matchId}. User: ${userId}`
      );
      return res.status(403).json({
        message:
          "Chat not available until at least one person has approved their side of the match.",
      });
    }

    // 2. Fetch messages for the matchId
    const messages = await prisma.chatMessage.findMany({
      where: { matchId: matchId },
      orderBy: { createdAt: "asc" }, // Order by oldest first
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true,
            profile_image: true,
          },
        },
        receiver: {
          // Although receiver info isn't used in your current formattedMessages, it's good to include
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
      senderName: msg.sender?.name,
      senderAvatar: msg.sender?.avatar || msg.sender?.profile_image,
    }));

    res.status(200).json(formattedMessages);
  } catch (error) {
    console.error(
      `[API] Error fetching chat messages for match ${matchId}:`,
      error
    );
    res.status(500).json({
      message: "Failed to fetch chat messages.",
      error: error.message,
    });
  }
});

// /chat.js

router.get("/active/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    const onlineUsers = req.app.get("onlineUsers");

    const activeMatches = await prisma.match.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
        // Now 'chatMessages' is a valid relation name in your Match model
        chatMessages: {
          // <--- Changed from 'messages' to 'chatMessages'
          some: {}, // Check if there's at least one chatMessage linked to this match
        },
      },
      include: {
        user1: {
          select: {
            id: true,
            name: true,
            avatar: true,
            profile_image: true,
          },
        },
        user2: {
          select: {
            id: true,
            name: true,
            avatar: true,
            profile_image: true,
          },
        },
        chatMessages: {
          // <--- Changed from 'messages' to 'chatMessages'
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            message: true,
            createdAt: true,
            senderId: true,
          },
        },
      },
      // Sorting remains in application logic as Prisma doesn't directly support
      // ordering parent records by an aggregated child field's max value.
    });

    // Post-processing: Sort the activeMatches by the latest chat message's timestamp
    const sortedActiveMatches = activeMatches.sort((a, b) => {
      // Use 'chatMessages' here
      const aTimestamp =
        a.chatMessages.length > 0
          ? new Date(a.chatMessages[0].createdAt).getTime()
          : 0;
      const bTimestamp =
        b.chatMessages.length > 0
          ? new Date(b.chatMessages[0].createdAt).getTime()
          : 0;
      return bTimestamp - aTimestamp; // Descending order (newest first)
    });

    const activeChats = sortedActiveMatches.map((match) => {
      const otherUser = match.user1Id === userId ? match.user2 : match.user1;
      // Use 'chatMessages' here
      const lastMessage =
        match.chatMessages.length > 0 ? match.chatMessages[0] : null;

      const isOnline = onlineUsers.has(otherUser.id);

      return {
        matchId: match.id,
        otherUserId: otherUser.id,
        otherUserName: otherUser.name,
        otherUserAvatar: otherUser.avatar || otherUser.profile_image,
        isOtherUserOnline: isOnline,
        lastMessage: lastMessage ? lastMessage.message : null,
        lastMessageTimestamp: lastMessage
          ? lastMessage.createdAt.toISOString()
          : null,
        lastMessageSenderId: lastMessage ? lastMessage.senderId : null,
        approvedByUser1: match.approvedByUser1,
        approvedByUser2: match.approvedByUser2,
      };
    });

    res.status(200).json(activeChats);
  } catch (error) {
    console.error(
      `[API] Error fetching active chats for user ${userId}:`,
      error
    );
    res.status(500).json({
      message: "Failed to fetch active chats.",
      error: error.message,
    });
  }
});

module.exports = router;
