// // src/routes/matchRoutes.js
// const express = require("express");
// const router = express.Router();
// const matchController = require("../controller/matchControllers.js");
// const prisma = require("../prisma");

// // Get all matches for the current user
// router.get("/", matchController.getMatches);

// // Approve a specific match
// router.patch("/:matchId/approve", matchController.approveMatch);
// router.get("/chats", matchController.getChatListForUser); // This is the new route

// router.post("/approve", async (req, res) => {
//   const { currentUserId, otherUserId } = req.body;

//   if (!currentUserId || !otherUserId) {
//     return res
//       .status(400)
//       .json({ message: "Both currentUserId and otherUserId are required." });
//   }

//   // IMPORTANT: In a real app, verify `currentUserId` against the authenticated user's ID from JWT.
//   // if (!req.user || req.user.id !== currentUserId) {
//   //     return res.status(403).json({ message: "Forbidden: You can only approve matches for yourself." });
//   // }

//   try {
//     // 1. Check if 'otherUserId' has already liked 'currentUserId' (pre-requisite for a match)
//     const existingLikeFromOtherUser = await prisma.like.findUnique({
//       where: {
//         fromUserId_toUserId: {
//           fromUserId: otherUserId,
//           toUserId: currentUserId,
//         },
//       },
//     });

//     if (!existingLikeFromOtherUser) {
//       return res
//         .status(400)
//         .json({
//           message: "The other user has not liked you yet. Cannot approve.",
//         });
//     }

//     // Determine user1Id and user2Id to maintain a consistent order in the Match table
//     // This ensures there's only one unique match record between any two users
//     const user1Id = currentUserId < otherUserId ? currentUserId : otherUserId;
//     const user2Id = currentUserId < otherUserId ? otherUserId : currentUserId;

//     let match = await prisma.match.findUnique({
//       where: {
//         user1Id_user2Id: {
//           user1Id,
//           user2Id,
//         },
//       },
//     });

//     let message = "";
//     let isMutualMatch = false;

//     if (match) {
//       // Match record already exists, update approval status for the current user
//       const updateData = {};
//       if (currentUserId === match.user1Id) {
//         updateData.approvedByUser1 = true;
//       } else {
//         updateData.approvedByUser2 = true;
//       }

//       // Check if it becomes a mutual match after this update
//       if (
//         (currentUserId === match.user1Id && match.approvedByUser2) ||
//         (currentUserId === match.user2Id && match.approvedByUser1)
//       ) {
//         updateData.matchedAt = new Date(); // Set matchedAt timestamp
//         isMutualMatch = true;
//         message = "It's a match!";
//       } else {
//         message = "Approval recorded. Waiting for the other person to approve.";
//       }

//       match = await prisma.match.update({
//         where: {
//           user1Id_user2Id: { user1Id, user2Id },
//         },
//         data: updateData,
//         include: { user1: true, user2: true }, // Include full user details
//       });
//     } else {
//       // Create a new match record
//       const newMatchData = {
//         user1Id,
//         user2Id,
//         approvedByUser1: currentUserId === user1Id, // Current user is user1
//         approvedByUser2: currentUserId === user2Id, // Current user is user2
//       };
//       message = "Approval recorded. Waiting for the other person to approve.";

//       match = await prisma.match.create({
//         data: newMatchData,
//         include: { user1: true, user2: true },
//       });
//     }

//     res.status(200).json({ message, match, matched: isMutualMatch });
//   } catch (error) {
//     console.error("Error in /api/matches/approve:", error);
//     res
//       .status(500)
//       .json({
//         message: "Failed to process match approval.",
//         error: error.message,
//       });
//   }
// });

// router.get("/:userId", async (req, res) => {
//   const { userId } = req.params;

//   // IMPORTANT: In a real app, verify `userId` against the authenticated user's ID from JWT.
//   // if (!req.user || req.user.id !== userId) {
//   //     return res.status(403).json({ message: "Forbidden: You can only view your own matches." });
//   // }

//   try {
//     const mutualMatches = await prisma.match.findMany({
//       where: {
//         OR: [{ user1Id: userId }, { user2Id: userId }],
//         approvedByUser1: true,
//         approvedByUser2: true, // Only retrieve mutual matches
//       },
//       include: {
//         user1: {
//           select: {
//             id: true,
//             name: true,
//             age: true,
//             gender: true,
//             profile_image: true,
//             avatar: true,
//             short_bio: true,
//             skill_type: true,
//             business_card: true, // Include business_card for social links/website
//           },
//         },
//         user2: {
//           select: {
//             id: true,
//             name: true,
//             age: true,
//             gender: true,
//             profile_image: true,
//             avatar: true,
//             short_bio: true,
//             skill_type: true,
//             business_card: true, // Include business_card for social links/website
//           },
//         },
//       },
//       orderBy: {
//         matchedAt: "desc", // Order by newest matches first
//       },
//       // Add pagination if desired: skip, take
//     });

//     // Format the response to return the 'other' user's profile and match details
//     const formattedMatches = mutualMatches.map((match) => {
//       const otherUser = match.user1Id === userId ? match.user2 : match.user1;
//       const socialLinksFromBusinessCard =
//         otherUser.business_card?.socialProfiles?.map((profile) => ({
//           type: profile.platform.toLowerCase(),
//           url: profile.url,
//         })) || [];
//       const websiteFromBusinessCard =
//         otherUser.business_card?.portfolio || null;

//       return {
//         id: otherUser.id, // The ID of the matched user
//         name: otherUser.name,
//         age: otherUser.age,
//         gender: otherUser.gender,
//         profile_image: otherUser.profile_image || otherUser.avatar, // Prefer profile_image, fallback to avatar
//         title:
//           otherUser.business_card?.role ||
//           otherUser.short_bio ||
//           "No title provided",
//         website: websiteFromBusinessCard,
//         socialLinks: socialLinksFromBusinessCard,
//         matchId: match.id, // The ID of the match record itself
//         matchedAt: match.matchedAt,
//       };
//     });

//     res.status(200).json(formattedMatches);
//   } catch (error) {
//     console.error("Error in /api/matches/:userId:", error);
//     res
//       .status(500)
//       .json({ message: "Failed to fetch matches.", error: error.message });
//   }
// });

// module.exports = router;
// module.exports = router;

// const express = require("express");
// const router = express.Router();
// const prisma = require("../prisma");

// // Note: I've removed the specific matchController calls and integrated the logic directly
// // into the routes for clarity, as you provided the inline implementation.
// // If you intend to use a controller, wrap these async functions within controller methods.

// // Approve a match (POST /api/matches/approve) - This is the primary endpoint for forming mutual matches
// router.post("/approve", async (req, res) => {
//   const { currentUserId, otherUserId } = req.body;

//   if (!currentUserId || !otherUserId) {
//     return res
//       .status(400)
//       .json({ message: "Both currentUserId and otherUserId are required." });
//   }

//   // IMPORTANT: In a real app, verify 'currentUserId' against the authenticated user's ID from JWT.
//   // if (!req.user || req.user.id !== currentUserId) {
//   //     return res.status(403).json({ message: "Forbidden: You can only approve matches for yourself." });
//   // }

//   try {
//     // 1. Ensure the 'otherUserId' has already liked 'currentUserId' (pre-requisite for approval)
//     const existingLikeFromOtherUser = await prisma.like.findUnique({
//       where: {
//         fromUserId_toUserId: {
//           fromUserId: otherUserId,
//           toUserId: currentUserId,
//         },
//       },
//     });

//     if (!existingLikeFromOtherUser) {
//       // If the other user hasn't liked the current user, this isn't an "approval" action
//       // it's effectively a new 'like'. You might want to handle this by calling the /api/likes/ endpoint
//       // or return an error depending on your UX flow. For now, we return an error.
//       return res.status(400).json({
//         message: "The other user has not liked you yet. Cannot approve.",
//       });
//     }

//     // Determine user1Id and user2Id to maintain a consistent order in the Match table
//     const user1Id = currentUserId < otherUserId ? currentUserId : otherUserId;
//     // FIX: Corrected typo here. It was 'otherUserId' twice.
//     const user2Id = currentUserId < otherUserId ? otherUserId : currentUserId;

//     let match = await prisma.match.findUnique({
//       where: {
//         user1Id_user2Id: {
//           user1Id,
//           user2Id,
//         },
//       },
//     });

//     let message = "";
//     let isMutualMatch = false;
//     let updatedOrCreatedMatch; // To hold the result of the update/create operation

//     if (match) {
//       // Match record already exists, update approval status for the current user
//       const updateData = {};
//       if (currentUserId === match.user1Id) {
//         updateData.approvedByUser1 = true;
//       } else {
//         updateData.approvedByUser2 = true;
//       }

//       // Check if it becomes a mutual match after this update
//       // This is the crucial part: if both sides have approved, it's a match.
//       if (
//         (currentUserId === match.user1Id && match.approvedByUser2) || // Current user is user1 and user2 already approved
//         (currentUserId === match.user2Id && match.approvedByUser1) // Current user is user2 and user1 already approved
//       ) {
//         updateData.matchedAt = new Date(); // Set matchedAt timestamp
//         isMutualMatch = true;
//         message = "It's a match!";
//       } else {
//         // One side has approved, waiting for the other
//         message = "Approval recorded. Waiting for the other person to approve.";
//       }

//       updatedOrCreatedMatch = await prisma.match.update({
//         where: {
//           user1Id_user2Id: { user1Id, user2Id },
//         },
//         data: updateData,
//         include: {
//           // Include user details in the response for the frontend
//           user1: {
//             select: {
//               id: true,
//               name: true,
//               age: true,
//               gender: true,
//               profile_image: true,
//               avatar: true,
//               short_bio: true,
//               skill_type: true,
//               business_card: true,
//             },
//           },
//           user2: {
//             select: {
//               id: true,
//               name: true,
//               age: true,
//               gender: true,
//               profile_image: true,
//               avatar: true,
//               short_bio: true,
//               skill_type: true,
//               business_card: true,
//             },
//           },
//         },
//       });
//     } else {
//       // This scenario should ideally not happen if the `existingLikeFromOtherUser` check passes
//       // AND your `likes` route also creates/updates the match.
//       // However, as a safeguard, if a like exists from `otherUser` but no match record, create one.
//       const newMatchData = {
//         user1Id,
//         user2Id,
//         approvedByUser1: currentUserId === user1Id,
//         approvedByUser2: currentUserId === user2Id,
//       };

//       // Since existingLikeFromOtherUser implies the other user has approved,
//       // and this action is the current user's approval, it should immediately be a match.
//       newMatchData.matchedAt = new Date();
//       isMutualMatch = true;
//       message = "It's a match!";

//       updatedOrCreatedMatch = await prisma.match.create({
//         data: newMatchData,
//         include: {
//           // Include user details in the response for the frontend
//           user1: {
//             select: {
//               id: true,
//               name: true,
//               age: true,
//               gender: true,
//               profile_image: true,
//               avatar: true,
//               short_bio: true,
//               skill_type: true,
//               business_card: true,
//             },
//           },
//           user2: {
//             select: {
//               id: true,
//               name: true,
//               age: true,
//               gender: true,
//               profile_image: true,
//               avatar: true,
//               short_bio: true,
//               skill_type: true,
//               business_card: true,
//             },
//           },
//         },
//       });
//     }

//     // If a mutual match is formed, delete the corresponding Like record
//     if (isMutualMatch) {
//       await prisma.like.delete({
//         where: {
//           fromUserId_toUserId: {
//             fromUserId: otherUserId, // The user who liked first
//             toUserId: currentUserId, // The user who is now approving
//           },
//         },
//       });

//       // Also delete the like from current user to other user if it exists (for robustness, though not strictly needed here)
//       // This handles cases where both might have liked each other independently before one "approved"
//       await prisma.like.deleteMany({
//         where: {
//           fromUserId: currentUserId,
//           toUserId: otherUserId,
//         },
//       });
//     }

//     // Format the match object to include the 'other' user's profile details for the client
//     const otherUserInMatch =
//       updatedOrCreatedMatch.user1Id === currentUserId
//         ? updatedOrCreatedMatch.user2
//         : updatedOrCreatedMatch.user1;
//     const socialLinksFromBusinessCard = Array.isArray(
//       otherUserInMatch.business_card?.socialProfiles
//     )
//       ? otherUserInMatch.business_card.socialProfiles.map((profile) => ({
//           type: profile.platform.toLowerCase(),
//           url: profile.url,
//         }))
//       : [];
//     const websiteFromBusinessCard =
//       otherUserInMatch.business_card?.portfolio || null;

//     const formattedMatchResponse = {
//       id: otherUserInMatch.id, // The ID of the matched user
//       name: otherUserInMatch.name,
//       age: otherUserInMatch.age,
//       gender: otherUserInMatch.gender,
//       profile_image: otherUserInMatch.profile_image || otherUserInMatch.avatar, // Prefer profile_image, fallback to avatar
//       avatar: otherUserInMatch.avatar, // Include avatar explicitly if needed
//       title:
//         otherUserInMatch.business_card?.role ||
//         otherUserInMatch.short_bio ||
//         "No title provided",
//       website: websiteFromBusinessCard,
//       socialLinks: socialLinksFromBusinessCard,
//       matchId: updatedOrCreatedMatch.id, // The ID of the match record itself
//       matchedAt: updatedOrCreatedMatch.matchedAt,
//     };

//     res
//       .status(200)
//       .json({ message, match: formattedMatchResponse, matched: isMutualMatch });
//   } catch (error) {
//     console.error("Error in /api/matches/approve:", error);
//     res.status(500).json({
//       message: "Failed to process match approval.",
//       error: error.message,
//     });
//   }
// });

// // Get mutual matches for a user (GET /api/matches/:userId)
// router.get("/:userId", async (req, res) => {
//   const { userId } = req.params;

//   // IMPORTANT: In a real app, verify `userId` against the authenticated user's ID from JWT.
//   // if (!req.user || req.user.id !== userId) {
//   //     return res.status(403).json({ message: "Forbidden: You can only view your own matches." });
//   // }

//   try {
//     const mutualMatches = await prisma.match.findMany({
//       where: {
//         OR: [{ user1Id: userId }, { user2Id: userId }],
//         approvedByUser1: true,
//         approvedByUser2: true, // Only retrieve mutual matches
//       },
//       include: {
//         user1: {
//           select: {
//             id: true,
//             name: true,
//             age: true,
//             gender: true,
//             profile_image: true,
//             avatar: true,
//             short_bio: true,
//             skill_type: true,
//             business_card: true, // Include business_card for social links/website
//           },
//         },
//         user2: {
//           select: {
//             id: true,
//             name: true,
//             age: true,
//             gender: true,
//             profile_image: true,
//             avatar: true,
//             short_bio: true,
//             skill_type: true,
//             business_card: true, // Include business_card for social links/website
//           },
//         },
//       },
//       orderBy: {
//         matchedAt: "desc", // Order by newest matches first
//       },
//     });

//     // Format the response to return the 'other' user's profile and match details
//     const formattedMatches = mutualMatches.map((match) => {
//       const otherUser = match.user1Id === userId ? match.user2 : match.user1;
//       const socialLinksFromBusinessCard = Array.isArray(
//         otherUser.business_card?.socialProfiles
//       )
//         ? otherUser.business_card.socialProfiles.map((profile) => ({
//             type: profile.platform.toLowerCase(),
//             url: profile.url,
//           }))
//         : [];
//       const websiteFromBusinessCard =
//         otherUser.business_card?.portfolio || null;

//       return {
//         id: otherUser.id, // The ID of the matched user
//         name: otherUser.name,
//         age: otherUser.age,
//         gender: otherUser.gender,
//         profile_image: otherUser.profile_image || otherUser.avatar, // Prefer profile_image, fallback to avatar
//         avatar: otherUser.avatar, // Include avatar explicitly if needed
//         title:
//           otherUser.business_card?.role ||
//           otherUser.short_bio ||
//           "No title provided",
//         website: websiteFromBusinessCard,
//         socialLinks: socialLinksFromBusinessCard,
//         matchId: match.id, // The ID of the match record itself
//         matchedAt: match.matchedAt,
//       };
//     });

//     res.status(200).json(formattedMatches);
//   } catch (error) {
//     console.error("Error in /api/matches/:userId:", error);
//     res
//       .status(500)
//       .json({ message: "Failed to fetch matches.", error: error.message });
//   }
// });

// // This route (GET /api/matches/chats) was commented out in your original post
// // If you need a separate endpoint for a chat list, you can define it here.
// // For now, getUserMatches already provides the matched users which can be used for chat.
// // router.get("/chats", matchController.getChatListForUser);

// module.exports = router;

// Ensure this file is imported and used by your main Express app, e.g., in app.js or index.js
// const matchesRoutes = require('./routes/matches');
// app.use('/api/matches', matchesRoutes);

const express = require("express");
const router = express.Router();
const prisma = require("../prisma"); // Assuming your Prisma client is exported from ../prisma

// POST /api/matches/approve - Primary endpoint for forming mutual matches
router.post("/approve", async (req, res) => {
  const { currentUserId, otherUserId } = req.body;

  if (!currentUserId || !otherUserId) {
    return res
      .status(400)
      .json({ message: "Both currentUserId and otherUserId are required." });
  }

  // IMPORTANT: In a real app, verify 'currentUserId' against the authenticated user's ID from JWT.
  // if (!req.user || req.user.id !== currentUserId) {
  //     return res.status(403).json({ message: "Forbidden: You can only approve matches for yourself." });
  // }

  try {
    // 1. Ensure the 'otherUserId' has already liked 'currentUserId' (pre-requisite for approval)
    const existingLikeFromOtherUser = await prisma.like.findUnique({
      where: {
        fromUserId_toUserId: {
          // Assuming a compound unique index on (fromUserId, toUserId)
          fromUserId: otherUserId,
          toUserId: currentUserId,
        },
      },
    });

    if (!existingLikeFromOtherUser) {
      // If the other user hasn't liked the current user, this isn't an "approval" action.
      // It's effectively a new 'like' from currentUserId to otherUserId.
      // Depending on your UX, you might silently convert this to a like or return an error.
      // For this "approve" endpoint, we'll enforce the pre-existing like.
      return res.status(400).json({
        message: "The other user has not liked you yet. Cannot approve.",
      });
    }

    // Determine user1Id and user2Id to maintain a consistent order in the Match table
    // This is crucial for unique constraints and predictable data retrieval.
    const user1Id = currentUserId < otherUserId ? currentUserId : otherUserId;
    const user2Id = currentUserId < otherUserId ? otherUserId : currentUserId;

    let match = await prisma.match.findUnique({
      where: {
        user1Id_user2Id: {
          // Assuming a compound unique index on (user1Id, user2Id)
          user1Id,
          user2Id,
        },
      },
    });

    let message = "";
    let isMutualMatch = false;
    let updatedOrCreatedMatch; // To hold the result of the update/create operation with includes

    if (match) {
      // Match record already exists, update approval status for the current user
      const updateData = {};
      if (currentUserId === match.user1Id) {
        updateData.approvedByUser1 = true;
      } else {
        updateData.approvedByUser2 = true;
      }

      // Check if it becomes a mutual match after this update
      if (
        (currentUserId === match.user1Id && match.approvedByUser2) || // Current user is user1 and user2 already approved
        (currentUserId === match.user2Id && match.approvedByUser1) // Current user is user2 and user1 already approved
      ) {
        updateData.matchedAt = new Date(); // Set matchedAt timestamp
        isMutualMatch = true;
        message = "It's a match!";
      } else {
        // One side has approved, waiting for the other
        message = "Approval recorded. Waiting for the other person to approve.";
      }

      updatedOrCreatedMatch = await prisma.match.update({
        where: {
          user1Id_user2Id: { user1Id, user2Id },
        },
        data: updateData,
        // Include user details in the response for the frontend to immediately update UI
        include: {
          user1: {
            select: {
              id: true,
              name: true,
              age: true,
              gender: true,
              profile_image: true,
              avatar: true,
              short_bio: true,
              skill_type: true,
              business_card: true,
            },
          },
          user2: {
            select: {
              id: true,
              name: true,
              age: true,
              gender: true,
              profile_image: true,
              avatar: true,
              short_bio: true,
              skill_type: true,
              business_card: true,
            },
          },
        },
      });
    } else {
      // This case should primarily occur if a like exists but no match record was initiated,
      // or if the `likes` endpoint doesn't create a pending match record.
      const newMatchData = {
        user1Id,
        user2Id,
        approvedByUser1: currentUserId === user1Id,
        approvedByUser2: currentUserId === user2Id,
      };

      // Since existingLikeFromOtherUser implies the other user has approved,
      // and this action is the current user's approval, it should immediately be a mutual match.
      newMatchData.matchedAt = new Date();
      isMutualMatch = true;
      message = "It's a match!";

      updatedOrCreatedMatch = await prisma.match.create({
        data: newMatchData,
        include: {
          user1: {
            select: {
              id: true,
              name: true,
              age: true,
              gender: true,
              profile_image: true,
              avatar: true,
              short_bio: true,
              skill_type: true,
              business_card: true,
            },
          },
          user2: {
            select: {
              id: true,
              name: true,
              age: true,
              gender: true,
              profile_image: true,
              avatar: true,
              short_bio: true,
              skill_type: true,
              business_card: true,
            },
          },
        },
      });
    }

    // If a mutual match is formed, delete the corresponding Like record(s).
    // This cleans up the 'likes received' list for both users.
    if (isMutualMatch) {
      // Delete the like from otherUser to currentUserId (the one being approved)
      await prisma.like.delete({
        where: {
          fromUserId_toUserId: {
            fromUserId: otherUserId,
            toUserId: currentUserId,
          },
        },
      });

      // Also, delete any like from currentUserId to otherUserId if it existed (for robustness)
      await prisma.like.deleteMany({
        where: {
          fromUserId: currentUserId,
          toUserId: otherUserId,
        },
      });
    }

    // Format the match object to include the 'other' user's profile details for the client
    const otherUserInMatch =
      updatedOrCreatedMatch.user1Id === currentUserId
        ? updatedOrCreatedMatch.user2
        : updatedOrCreatedMatch.user1;

    // Extract social links and website from business_card for a clean client-side object
    const socialLinksFromBusinessCard = Array.isArray(
      otherUserInMatch.business_card?.socialProfiles
    )
      ? otherUserInMatch.business_card.socialProfiles.map((profile) => ({
          type: profile.platform.toLowerCase(),
          url: profile.url,
        }))
      : [];
    const websiteFromBusinessCard =
      otherUserInMatch.business_card?.portfolio || null;

    const formattedMatchResponse = {
      id: otherUserInMatch.id, // The ID of the matched user
      name: otherUserInMatch.name,
      age: otherUserInMatch.age,
      gender: otherUserInMatch.gender,
      profile_image: otherUserInMatch.profile_image || otherUserInMatch.avatar, // Prefer profile_image, fallback to avatar
      avatar: otherUserInMatch.avatar, // Include avatar explicitly if needed
      title:
        otherUserInMatch.business_card?.role ||
        otherUserInMatch.short_bio ||
        "No title provided",
      website: websiteFromBusinessCard,
      socialLinks: socialLinksFromBusinessCard,
      matchId: updatedOrCreatedMatch.id, // The ID of the match record itself
      matchedAt: updatedOrCreatedMatch.matchedAt,
    };

    res
      .status(200)
      .json({ message, match: formattedMatchResponse, matched: isMutualMatch });
  } catch (error) {
    console.error("Error in /api/matches/approve:", error);
    res.status(500).json({
      message: "Failed to process match approval.",
      error: error.message,
    });
  }
});

// GET /api/matches/:userId - Get all mutual matches for a user
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;

  // IMPORTANT: In a real app, verify `userId` against the authenticated user's ID from JWT.
  // if (!req.user || req.user.id !== userId) {
  //     return res.status(403).json({ message: "Forbidden: You can only view your own matches." });
  // }

  try {
    const mutualMatches = await prisma.match.findMany({
      where: {
        OR: [
          {
            user1Id: userId,
          },
          {
            user2Id: userId,
          },
        ],
      },
      include: {
        user1: {
          select: {
            id: true,
            name: true,
            age: true,
            gender: true,
            profile_image: true,
            avatar: true,
            short_bio: true,
            skill_type: true,
            business_card: true,
          },
        },
        user2: {
          select: {
            id: true,
            name: true,
            age: true,
            gender: true,
            profile_image: true,
            avatar: true,
            short_bio: true,
            skill_type: true,
            business_card: true,
          },
        },
      },
      orderBy: {
        matchedAt: "desc", // Order by newest matches first
      },
    });
    console.log(mutualMatches, "working");

    // Format the response to return the 'other' user's profile and match details
    const formattedMatches = mutualMatches.map((match) => {
      const otherUser = match.user1Id === userId ? match.user2 : match.user1;
      const socialLinksFromBusinessCard = Array.isArray(
        otherUser.business_card?.socialProfiles
      )
        ? otherUser.business_card.socialProfiles.map((profile) => ({
            type: profile.platform.toLowerCase(),
            url: profile.url,
          }))
        : [];
      const websiteFromBusinessCard =
        otherUser.business_card?.portfolio || null;

      return {
        id: otherUser.id, // The ID of the matched user
        name: otherUser.name,
        age: otherUser.age,
        gender: otherUser.gender,
        profile_image: otherUser.profile_image || otherUser.avatar, // Prefer profile_image, fallback to avatar
        avatar: otherUser.avatar, // Include avatar explicitly if needed
        title:
          otherUser.business_card?.role ||
          otherUser.short_bio ||
          "No title provided",
        website: websiteFromBusinessCard,
        socialLinks: socialLinksFromBusinessCard,
        matchId: match.id, // The ID of the match record itself
        matchedAt: match.matchedAt,
      };
    });

    res.status(200).json(formattedMatches);
  } catch (error) {
    console.error("Error in /api/matches/:userId:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch matches.", error: error.message });
  }
});

module.exports = router;
