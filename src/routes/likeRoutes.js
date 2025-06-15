const express = require("express");
const router = express.Router();
const prisma = require("../prisma");

// Like a user (POST /api/likes/)
router.post("/", async (req, res) => {
  const { fromUserId, toUserId } = req.body;

  if (!fromUserId || !toUserId) {
    return res
      .status(400)
      .json({ message: "Both fromUserId and toUserId are required." });
  }

  // IMPORTANT: In a real app, verify 'fromUserId' against the authenticated user's ID from JWT.
  // if (!req.user || req.user.id !== fromUserId) {
  //     return res.status(403).json({ message: "Forbidden: You can only like users as yourself." });
  // }

  try {
    // 1. Record the like
    const like = await prisma.like.create({
      data: {
        fromUserId,
        toUserId,
      },
    });

    let message = "Like recorded successfully.";
    let isMutualMatch = false;

    // 2. Check for a reverse like (has the 'toUser' already liked the 'fromUser'?)
    const existingLikeFromToUser = await prisma.like.findUnique({
      where: {
        fromUserId_toUserId: {
          fromUserId: toUserId,
          toUserId: fromUserId,
        },
      },
    });

    // 3. If a reverse like exists, create or update a Match record
    if (existingLikeFromToUser) {
      // Determine user1Id and user2Id to maintain a consistent order in the Match table
      const user1Id = fromUserId < toUserId ? fromUserId : toUserId;
      const user2Id = fromUserId < toUserId ? toUserId : fromUserId;

      let match = await prisma.match.findUnique({
        where: {
          user1Id_user2Id: {
            user1Id,
            user2Id,
          },
        },
      });

      if (match) {
        // Match record already exists, update approval statuses
        const updateData = {};
        if (fromUserId === match.user1Id) {
          updateData.approvedByUser1 = true;
        } else {
          updateData.approvedByUser2 = true;
        }

        // If both approvedByUser1 and approvedByUser2 are true after this update, it's a mutual match
        if (
          (fromUserId === match.user1Id && match.approvedByUser2) ||
          (fromUserId === match.user2Id && match.approvedByUser1)
        ) {
          updateData.matchedAt = new Date(); // Set matchedAt timestamp
          isMutualMatch = true;
          message = "It's a match!";
        }

        match = await prisma.match.update({
          where: {
            user1Id_user2Id: { user1Id, user2Id },
          },
          data: updateData,
        });
      } else {
        // No match record yet, create a new one
        isMutualMatch = true; // Since both liked, it's immediately a match
        message = "It's a match!";

        match = await prisma.match.create({
          data: {
            user1Id,
            user2Id,
            approvedByUser1: fromUserId === user1Id,
            approvedByUser2: fromUserId === user2Id,
            matchedAt: new Date(), // Set matchedAt timestamp
          },
        });
      }
    }

    res.status(201).json({ message, liked: true, matched: isMutualMatch });
  } catch (error) {
    // Handle unique constraint violation (user already liked this person)
    if (
      error.code === "P2002" &&
      error.meta?.target?.includes("fromUserId_toUserId")
    ) {
      return res
        .status(409)
        .json({ message: "You have already liked this user." });
    }
    console.error("Error in /api/likes/:", error);
    res
      .status(500)
      .json({ message: "Failed to process like.", error: error.message });
  }
});

// Unlike a user (optional - DELETE /api/likes/)
router.delete("/", async (req, res) => {
  const { fromUserId, toUserId } = req.body;

  if (!fromUserId || !toUserId) {
    return res
      .status(400)
      .json({ message: "Both fromUserId and toUserId are required." });
  }

  try {
    await prisma.like.delete({
      where: {
        fromUserId_toUserId: {
          fromUserId,
          toUserId,
        },
      },
    });

    // Optionally, if an unlike breaks a match, you could update the Match record here.
    // For simplicity, we'll assume unliking doesn't automatically "unmatch" for now.

    res.status(200).json({ message: "Like removed successfully." });
  } catch (error) {
    if (error.code === "P2025") {
      // Prisma error for record not found
      return res.status(404).json({ message: "Like not found." });
    }
    console.error("Error in /api/likes/ (DELETE):", error);
    res
      .status(500)
      .json({ message: "Failed to remove like.", error: error.message });
  }
});

// Get received likes for a user (GET /api/likes/received/:userId)
router.get("/received/:userId", async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const receivedLikes = await prisma.like.findMany({
      where: {
        toUserId: userId,
        // Only show likes from users the current user hasn't yet "approved" into a match.
        // This is a more complex condition and might involve checking the 'Match' table.
        // For now, it will show all incoming likes.
        // If you want to filter out users who are already matched, you'd need to add a check here.
      },
      include: {
        fromUser: {
          select: {
            id: true,
            name: true,
            age: true,
            gender: true,
            location: true,
            profile_image: true,
            avatar: true, // Include avatar for chat UI consistency
            short_bio: true,
            skill_type: true,
            business_card: true, // Include business_card for social links/website
          },
        },
      },
      orderBy: {
        createdAt: "desc", // Order by newest likes first
      },
      skip,
      take: limit,
    });

    const totalLikesCount = await prisma.like.count({
      where: {
        toUserId: userId,
      },
    });

    const totalPages = Math.ceil(totalLikesCount / limit);

    const likers = receivedLikes.map((like) => ({
      id: like.fromUser.id,
      name: like.fromUser.name,
      age: like.fromUser.age,
      gender: like.fromUser.gender,
      location: like.fromUser.location,
      profile_image: like.fromUser.profile_image || like.fromUser.avatar, // Prefer profile_image, fallback to avatar
      avatar: like.fromUser.avatar,
      short_bio: like.fromUser.short_bio,
      skill_type: like.fromUser.skill_type,
      business_card: like.fromUser.business_card, // Pass the whole business_card JSON
    }));

    res.status(200).json({
      likers,
      page,
      limit,
      total: totalLikesCount,
      totalPages,
    });
  } catch (error) {
    console.error("Error fetching received likes for user:", userId, error);
    res.status(500).json({
      message: "Failed to fetch received likes.",
      error: error.message,
    });
  }
});

module.exports = router;
