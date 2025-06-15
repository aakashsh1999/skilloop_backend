// src/controllers/userController.js
const prisma = require("../prisma");

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance; // Distance in km
}

exports.getUserDetails = async (req, res) => {
  const { mobile_number, user_id } = req.query;
  if (!mobile_number || !user_id) {
    return res
      .status(400)
      .json({ error: "mobile_number or user_id is required" });
  }

  try {
    let user;
    if (mobile_number) {
      user = await prisma.user.findUnique({
        where: { mobile_number: mobile_number },
      });
    } else if (user_id) {
      user = await prisma.user.findUnique({
        where: { id: user_id },
      });
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch user details.", details: error.message });
  }
};

exports.getNearbyUsers = async (req, res) => {
  const { latitude, longitude, radius_km, user_id } = req.query;

  if (!latitude || !longitude || !radius_km) {
    return res
      .status(400)
      .json({ error: "latitude, longitude, and radius_km are required" });
  }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const radius = parseFloat(radius_km);

  if (isNaN(lat) || isNaN(lon) || isNaN(radius)) {
    return res.status(400).json({
      error: "Invalid numeric values for latitude, longitude, or radius_km",
    });
  }

  // Use raw SQL query with Prisma for Haversine formula
  // Note: This assumes latitude and longitude columns exist in your 'users' table
  try {
    // Construct the filter for excluding the requesting user
    const excludeUserFilter = user_id ? `AND id != '${user_id}'` : "";

    const users = await prisma.$queryRawUnsafe(`
      SELECT
          id, user_type, name, gender, age, location, profile_image,
          face, skills, anything_but_professional, skill_type, short_bio,
          business_card, certificates, work_experience, mobile_number,
          (6371 * acos(
              cos(radians(${lat})) *
              cos(radians(latitude)) *
              cos(radians(longitude) - radians(${lon})) +
              sin(radians(${lat})) *
              sin(radians(latitude))
          )) AS distance
      FROM "users"
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      ${excludeUserFilter}
      HAVING (6371 * acos(
          cos(radians(${lat})) *
          cos(radians(latitude)) *
          cos(radians(longitude) - radians(${lon})) +
          sin(radians(${lat})) *
          sin(radians(latitude))
      )) <= ${radius}
      ORDER BY distance ASC
      LIMIT 100;
    `);

    res.json({ users });
  } catch (error) {
    console.error("Error fetching nearby users:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch nearby users.", details: error.message });
  }
};

exports.getDiscoverableUsers = async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page || "1");
  const limit = parseInt(req.query.limit || "10");
  const skip = (page - 1) * limit;

  try {
    const likedUserIds = await prisma.like.findMany({
      where: { fromUserId: userId },
      select: { toUserId: true },
    });

    const alreadyLikedIds = likedUserIds.map((like) => like.toUserId);

    const users = await prisma.user.findMany({
      where: {
        id: { not: userId, notIn: alreadyLikedIds },
      },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
};
exports.getRecommendedUsers = async (req, res) => {
  console.log(req.params, "ss");

  const currentUserId = req.params.userId;
  const radiusKm = parseInt(req.query.radius || "50"); // Default 50km
  const page = parseInt(req.query.page || "1");
  const limit = parseInt(req.query.limit || "10");
  const offset = (page - 1) * limit;

  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { latitude: true, longitude: true },
    });

    if (
      !currentUser ||
      currentUser.latitude === null ||
      currentUser.longitude === null
    ) {
      return res.status(400).json({
        message: "Current user's location is not set for recommendations.",
      });
    }

    const allOtherUsers = await prisma.user.findMany({
      where: {
        id: { not: currentUserId },
      },
      select: {
        id: true,
        name: true,
        gender: true,
        age: true,
        location: true,
        latitude: true,
        longitude: true,
        profile_image: true,
        short_bio: true,
        skill_type: true,
      },
    });

    const likedUserIds = (
      await prisma.like.findMany({
        where: { fromUserId: currentUserId },
        select: { toUserId: true },
      })
    ).map((l) => l.toUserId);

    const matchedUsers = await prisma.match.findMany({
      where: {
        OR: [
          {
            user1Id: currentUserId,
            approvedByUser1: true,
            approvedByUser2: true,
          },
          {
            user2Id: currentUserId,
            approvedByUser1: true,
            approvedByUser2: true,
          },
        ],
      },
      select: { user1Id: true, user2Id: true },
    });

    const matchedUserIds = matchedUsers
      .flatMap((m) => [m.user1Id, m.user2Id])
      .filter((id) => id !== currentUserId);

    const recommendedUsers = allOtherUsers.filter((user) => {
      if (likedUserIds.includes(user.id) || matchedUserIds.includes(user.id)) {
        return false;
      }

      if (user.latitude === null || user.longitude === null) {
        return false;
      }

      const distance = haversineDistance(
        currentUser.latitude,
        currentUser.longitude,
        user.latitude,
        user.longitude
      );

      return distance <= radiusKm;
    });

    const total = recommendedUsers.length;
    const paginatedUsers = recommendedUsers.slice(offset, offset + limit);
    res.json({
      users: paginatedUsers,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    console.error("Error fetching recommended users:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Utility function for Haversine distance in km
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;

  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
