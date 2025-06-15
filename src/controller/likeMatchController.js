// src/controllers/likeController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.likeUser = async (req, res) => {
  const { toUserId, fromUserId } = req.body;

  if (!toUserId) {
    return res.status(400).json({ message: "Target user ID is required." });
  }
  if (fromUserId === toUserId) {
    return res.status(400).json({ message: "Cannot like yourself." });
  }

  try {
    // Check if user already liked the target
    const existingLike = await prisma.like.findUnique({
      where: {
        fromUserId_toUserId: {
          fromUserId: fromUserId,
          toUserId: toUserId,
        },
      },
    });

    if (existingLike) {
      return res.status(200).json({
        message: "You have already liked this user.",
        like: existingLike,
      });
    }

    // Create the like record
    const newLike = await prisma.like.create({
      data: { fromUserId, toUserId },
    });

    let matchStatus = "like_sent"; // Default status

    // Check for reciprocal like (potential match)
    const reciprocalLike = await prisma.like.findUnique({
      where: {
        fromUserId_toUserId: {
          fromUserId: toUserId,
          toUserId: fromUserId,
        },
      },
    });

    if (reciprocalLike) {
      // A mutual like exists, create or find the match record
      // Ensure consistent user order for unique constraint
      const user1Id = fromUserId < toUserId ? fromUserId : toUserId;
      const user2Id = fromUserId < toUserId ? toUserId : fromUserId;

      let match = await prisma.match.findUnique({
        where: {
          user1Id_user2Id: {
            user1Id: user1Id,
            user2Id: user2Id,
          },
        },
      });

      if (!match) {
        // Create a new match if it doesn't exist.
        // Initially, both approvals are false. They need to approve the match explicitly.
        match = await prisma.match.create({
          data: {
            user1Id: user1Id,
            user2Id: user2Id,
            // approvedByUser1 and approvedByUser2 default to false
          },
        });
        matchStatus = "potential_match_created";
      } else {
        matchStatus = "potential_match_exists";
      }
      res.status(201).json({
        message: "Like sent. Potential match created/exists.",
        like: newLike,
        match,
      });
    } else {
      res.status(201).json({ message: "Like sent.", like: newLike });
    }
  } catch (error) {
    console.error("Error liking user:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// You might also want a 'dislike' or 'unlike' functionality.
// For 'dislike', you might just not create a 'Like' record or delete one.
// For now, if a user doesn't 'like', it's implicitly a 'dislike' in terms of matching.
// If you want to explicitly remove a like:
exports.unlikeUser = async (req, res) => {
  const fromUserId = req.user.id;
  const { toUserId } = req.body;

  if (!toUserId) {
    return res.status(400).json({ message: "Target user ID is required." });
  }

  try {
    const deletedLike = await prisma.like.delete({
      where: {
        fromUserId_toUserId: {
          fromUserId: fromUserId,
          toUserId: toUserId,
        },
      },
    });
    // Consider also deleting the match if it's no longer desired,
    // or marking it as 'inactive' instead of deleting
    res.json({ message: "Like removed successfully.", like: deletedLike });
  } catch (error) {
    if (error.code === "P2025") {
      // Prisma error code for record not found
      return res.status(404).json({ message: "Like not found." });
    }
    console.error("Error unliking user:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
