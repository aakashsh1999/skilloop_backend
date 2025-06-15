// src/controllers/matchController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getMatches = async (req, res) => {
  const userId = req.user.id; // Authenticated user ID

  try {
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        user1: {
          select: { id: true, name: true, profile_image: true, avatar: true },
        },
        user2: {
          select: { id: true, name: true, profile_image: true, avatar: true },
        },
      },
      orderBy: {
        matchedAt: "desc", // Order recent matches first
      },
    });

    // Filter for active matches and format output
    const activeMatches = matches
      .filter((match) => match.approvedByUser1 && match.approvedByUser2)
      .map((match) => {
        const otherUser = match.user1Id === userId ? match.user2 : match.user1;
        return {
          matchId: match.id,
          otherUser: {
            id: otherUser.id,
            name: otherUser.name,
            profile_image: otherUser.profile_image,
            avatar: otherUser.avatar,
          },
          matchedAt: match.matchedAt,
        };
      });

    // Also return pending matches if you want to show them in the UI
    const pendingMatches = matches
      .filter((match) => !(match.approvedByUser1 && match.approvedByUser2))
      .map((match) => {
        const isUser1 = match.user1Id === userId;
        const otherUser = isUser1 ? match.user2 : match.user1;
        const myApproval = isUser1
          ? match.approvedByUser1
          : match.approvedByUser2;
        const theirApproval = isUser1
          ? match.user2Id === userId
            ? match.approvedByUser1
            : match.approvedByUser2
          : match.approvedByUser1; // Corrected logic for theirApproval

        return {
          matchId: match.id,
          otherUser: {
            id: otherUser.id,
            name: otherUser.name,
            profile_image: otherUser.profile_image,
            avatar: otherUser.avatar,
          },
          myApproval: myApproval,
          theirApproval: theirApproval,
          status: myApproval && theirApproval ? "matched" : "pending",
        };
      });

    res.json({ activeMatches, pendingMatches });
  } catch (error) {
    console.error("Error fetching matches:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.approveMatch = async (req, res) => {
  const userId = req.user.id; // Authenticated user
  const { matchId } = req.params;

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      return res.status(404).json({ message: "Match not found." });
    }

    if (match.user1Id !== userId && match.user2Id !== userId) {
      return res
        .status(403)
        .json({ message: "You are not part of this match." });
    }

    let updatedMatch;
    if (match.user1Id === userId) {
      updatedMatch = await prisma.match.update({
        where: { id: matchId },
        data: { approvedByUser1: true },
      });
    } else {
      // match.user2Id === userId
      updatedMatch = await prisma.match.update({
        where: { id: matchId },
        data: { approvedByUser2: true },
      });
    }

    // If both users have approved, set matchedAt timestamp
    if (
      updatedMatch.approvedByUser1 &&
      updatedMatch.approvedByUser2 &&
      !updatedMatch.matchedAt
    ) {
      updatedMatch = await prisma.match.update({
        where: { id: matchId },
        data: { matchedAt: new Date() },
      });
      return res.status(200).json({
        message: "Match approved and confirmed!",
        match: updatedMatch,
      });
    }

    res
      .status(200)
      .json({ message: "Match approval updated.", match: updatedMatch });
  } catch (error) {
    console.error("Error approving match:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// NEW API: Get list of active chats for the user
exports.getChatListForUser = async (req, res) => {
  const currentUserId = req.user.id;

  try {
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
        approvedByUser1: true, // Only show fully approved matches for chat list
        approvedByUser2: true,
      },
      include: {
        user1: {
          select: { id: true, name: true, profile_image: true, avatar: true },
        },
        user2: {
          select: { id: true, name: true, profile_image: true, avatar: true },
        },
      },
      orderBy: {
        // You might want to order by last message timestamp, but that's harder without schema changes.
        // For now, order by when the match was created/approved.
        matchedAt: "desc",
      },
    });

    // Use Promise.all to fetch last message for each match concurrently
    const chatList = await Promise.all(
      matches.map(async (match) => {
        const otherUser =
          match.user1Id === currentUserId ? match.user2 : match.user1;

        // Fetch the last message for this specific match
        // NOTE: This performs an N+1 query (1 for matches, N for each message).
        // For very large numbers of chats, consider:
        // 1. Denormalizing last_message_id/text/timestamp into the Match model.
        // 2. Using raw SQL for a more complex but single query.
        const lastMessage = await prisma.chatMessage.findFirst({
          where: {
            OR: [
              { senderId: match.user1Id, receiverId: match.user2Id },
              { senderId: match.user2Id, receiverId: match.user1Id },
            ],
          },
          orderBy: { createdAt: "desc" },
          select: { message: true, createdAt: true, senderId: true },
          take: 1,
        });

        return {
          matchId: match.id,
          otherUser: {
            id: otherUser.id,
            name: otherUser.name,
            profile_image: otherUser.profile_image,
            avatar: otherUser.avatar,
          },
          lastMessagePreview: lastMessage
            ? {
                message: lastMessage.message,
                createdAt: lastMessage.createdAt,
                isSentByMe: lastMessage.senderId === currentUserId, // Helps UI show "You: Message..."
              }
            : null,
          matchedAt: match.matchedAt,
        };
      })
    );

    res.json(chatList);
  } catch (error) {
    console.error("Error fetching chat list:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
