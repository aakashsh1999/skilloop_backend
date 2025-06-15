// src/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const userController = require("../controller/userControllers.js");
const prisma = require("../prisma"); // Assuming your Prisma client is exported from ../prisma

router.get("/", userController.getUserDetails); // Example: /api/users?mobile_number=... or ?user_id=...
router.get("/nearby", userController.getNearbyUsers); // Example: /api/users/nearby?latitude=...&longitude=...&radius_km=...
// router.get("/:id", userController.getUserProfile);
router.get("/recommendations/:userId", userController.getRecommendedUsers);

router.post("/save-expo-token", async (req, res) => {
  const { userId, token } = req.body;

  if (!userId || !token) {
    return res
      .status(400)
      .json({ message: "User ID and Expo push token are required." });
  }

  try {
    // Update the user's record with the new Expo push token
    // If a user can have multiple devices, you might want a separate table
    // like `UserDeviceTokens` instead of a single `expoPushToken` field on `User`.
    await prisma.user.update({
      where: { id: userId },
      data: {
        expoPushToken: token,
      },
    });

    res.status(200).json({ message: "Expo push token saved successfully." });
  } catch (error) {
    console.error("Error saving Expo push token for user:", userId, error);
    res.status(500).json({
      message: "Failed to save Expo push token.",
      error: error.message,
    });
  }
});

module.exports = router;
