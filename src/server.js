// // src/server.js
// const http = require("http");
// const app = require("./index"); // Import your main Express app
// const { Server } = require("socket.io");
// const prisma = require("./prisma"); // Import your Prisma client

// // Load environment variables if not already loaded by a higher-level script
// require("dotenv").config();

// const PORT = process.env.PORT || 3000;

// // Create HTTP server from Express app
// const server = http.createServer(app);

// // Initialize Socket.IO server
// const io = new Server(server, {
//   cors: {
//     origin: "*", // IMPORTANT: Adjust this to your specific frontend URL(s) in production for security!
//     methods: ["GET", "POST"],
//   },
// });

// // --- In-memory store for online users ---
// // Maps userId to their socket.id (or an array of socket.ids if multiple devices)
// const onlineUsers = new Map();

// // Make onlineUsers map accessible to Express routes via the app object
// app.set("onlineUsers", onlineUsers);

// io.on("connection", (socket) => {
//   console.log(`User connected to Socket.IO: ${socket.id}`);

//   // Event to register a user as online after they authenticate
//   socket.on("registerUser", (data) => {
//     const { userId } = data;
//     if (userId) {
//       // Store the userId -> socketId mapping. If a user connects from multiple places,
//       // you might want to store an array of socket.ids for that userId.
//       onlineUsers.set(userId, socket.id);
//       console.log(
//         `[Socket] User ${userId} registered as online (socket: ${socket.id}). Total online: ${onlineUsers.size}`
//       );
//       // Broadcast user online status to all connected clients
//       io.emit("userStatusChange", { userId: userId, isOnline: true });
//     }
//   });

//   // When a user joins a specific chat room
//   socket.on("joinChat", async (data) => {
//     const { userId, matchId } = data;

//     if (!userId || !matchId) {
//       socket.emit("chatError", "Missing userId or matchId to join chat.");
//       return;
//     }

//     try {
//       const match = await prisma.match.findUnique({
//         where: { id: matchId },
//         select: {
//           user1Id: true,
//           user2Id: true,
//           approvedByUser1: true,
//           approvedByUser2: true,
//         },
//       });

//       if (!match) {
//         console.warn(
//           `[Socket] Match ${matchId} not found when user ${userId} attempted to join.`
//         );
//         socket.emit("chatError", "Match not found.");
//         return;
//       }

//       const isUser1 = match.user1Id === userId;
//       const isUser2 = match.user2Id === userId;

//       if (!isUser1 && !isUser2) {
//         console.warn(
//           `[Socket] User ${userId} attempted to join unauthorized match ${matchId} (not part of match).`
//         );
//         socket.emit("chatError", "Unauthorized to join this chat.");
//         return;
//       }

//       // Logic: Allow joining if at least one of approvedByUser1 or approvedByUser2 is true.
//       if (!match.approvedByUser1 && !match.approvedByUser2) {
//         console.warn(
//           `[Socket] User ${userId} attempted to join match ${matchId} but neither user has approved.`
//         );
//         socket.emit(
//           "chatError",
//           "Chat is not available until at least one person has approved their side of the match."
//         );
//         return;
//       }

//       socket.join(matchId); // Join a room named after the matchId
//       console.log(`[Socket] User ${userId} joined chat room: ${matchId}`);
//       socket.emit(
//         "chatJoined",
//         `Successfully joined chat for match ${matchId}`
//       );
//     } catch (error) {
//       console.error(
//         `[Socket] Error joining chat for user ${userId} and match ${matchId}:`,
//         error
//       );
//       socket.emit("chatError", "Failed to join chat.");
//     }
//   });

//   // When a user sends a message
//   socket.on("sendMessage", async (data) => {
//     // IMPORTANT: In a production app, `senderId` should be extracted from a
//     // server-verified authentication token, not directly from the client.
//     const { matchId, senderId, receiverId, message } = data;

//     if (!matchId || !senderId || !receiverId || !message) {
//       socket.emit("chatError", "Invalid message data provided.");
//       return;
//     }

//     try {
//       // Verify match status (important for security for sending messages)
//       const match = await prisma.match.findUnique({
//         where: { id: matchId },
//         select: {
//           user1Id: true,
//           user2Id: true,
//           approvedByUser1: true,
//           approvedByUser2: true,
//         },
//       });

//       if (!match) {
//         socket.emit("chatError", "Cannot send message: Match not found.");
//         return;
//       }

//       // Check if the sender is actually one of the users in the match
//       const isSenderUser1 = match.user1Id === senderId;
//       const isSenderUser2 = match.user2Id === senderId;

//       if (!isSenderUser1 && !isSenderUser2) {
//         socket.emit(
//           "chatError",
//           "Cannot send message: Sender is not part of this match."
//         );
//         return;
//       }

//       // Check if the receiver is the other user in the match
//       const isReceiverCorrect =
//         (isSenderUser1 && match.user2Id === receiverId) ||
//         (isSenderUser2 && match.user1Id === receiverId);

//       if (!isReceiverCorrect) {
//         socket.emit(
//           "chatError",
//           "Cannot send message: Invalid receiver for this match."
//         );
//         return;
//       }

//       // Logic: Allow sending messages if at least one of approvedByUser1 or approvedByUser2 is true.
//       if (!match.approvedByUser1 && !match.approvedByUser2) {
//         console.warn(
//           `[Socket] User ${senderId} attempted to send message in match ${matchId} but neither user has approved.`
//         );
//         socket.emit(
//           "chatError",
//           "Cannot send message: Chat is not available until at least one person has approved their side of the match."
//         );
//         return;
//       }

//       // Save message to database
//       const newChatMessage = await prisma.chatMessage.create({
//         data: {
//           matchId: matchId,
//           senderId: senderId,
//           receiverId: receiverId,
//           message: message,
//         },
//       });

//       // Emit message to all clients in the match room
//       io.to(matchId).emit("receiveMessage", {
//         id: newChatMessage.id,
//         matchId: newChatMessage.matchId,
//         senderId: newChatMessage.senderId,
//         receiverId: newChatMessage.receiverId,
//         message: newChatMessage.message,
//         createdAt: newChatMessage.createdAt,
//       });
//       console.log(`[Socket] Message sent in match ${matchId} by ${senderId}.`);
//     } catch (error) {
//       console.error("[Socket] Error saving or sending message:", error);
//       socket.emit("chatError", "Failed to send message.");
//     }
//   });

//   socket.on("disconnect", () => {
//     // When a user disconnects, remove them from onlineUsers map
//     let disconnectedUserId = null;
//     for (let [userId, socketId] of onlineUsers.entries()) {
//       if (socketId === socket.id) {
//         disconnectedUserId = userId;
//         onlineUsers.delete(userId);
//         break;
//       }
//     }
//     if (disconnectedUserId) {
//       console.log(
//         `[Socket] User ${disconnectedUserId} disconnected (socket: ${socket.id}). Total online: ${onlineUsers.size}`
//       );
//       // Broadcast user offline status
//       io.emit("userStatusChange", {
//         userId: disconnectedUserId,
//         isOnline: false,
//       });
//     } else {
//       console.log(
//         `User disconnected from Socket.IO: ${socket.id}. User ID not found in map.`
//       );
//     }
//   });
// });

// // Start listening for HTTP requests
// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
//   console.log(`API documentation/endpoints: http://localhost:${PORT}/`); // Your root endpoint
// });

// // Graceful shutdown
// process.on("beforeExit", async () => {
//   await prisma.$disconnect();
//   console.log("Prisma client disconnected.");
// });

// src/server.js
const http = require("http");
const app = require("./index"); // Import your main Express app
const { Server } = require("socket.io");
const prisma = require("./prisma"); // Import your Prisma client

// --- NEW: Import Expo Server SDK ---
const { Expo } = require("expo-server-sdk");
const expo = new Expo(); // Initialize an Expo client

// Load environment variables if not already loaded by a higher-level script
require("dotenv").config();

const PORT = process.env.PORT || 3000;

// Create HTTP server from Express app
const server = http.createServer(app);

// Initialize Socket.IO server
const io = new Server(server, {
  cors: {
    // IMPORTANT: Adjust this to your specific frontend URL(s) in production for security!
    // For development, "*" is often used, but for production, specify your client domain(s).
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// --- In-memory store for online users ---
// Maps userId to their socket.id (or an array of socket.ids if multiple devices)
const onlineUsers = new Map();

// Make onlineUsers map accessible to Express routes via the app object (optional, but can be useful)
app.set("onlineUsers", onlineUsers);
app.set("io", io); // Also make io accessible if Express routes need to emit events

io.on("connection", (socket) => {
  console.log(`User connected to Socket.IO: ${socket.id}`);

  // Event to register a user as online after they authenticate
  socket.on("registerUser", (data) => {
    const { userId } = data;
    if (userId) {
      // Store the userId -> socketId mapping.
      // If a user can have multiple active sessions/devices, you might want to
      // store an array of socket.ids for that userId. For simplicity, we'll
      // assume one socket per user in this example, overwriting previous ones.
      onlineUsers.set(userId, socket.id);
      console.log(
        `[Socket] User ${userId} registered as online (socket: ${socket.id}). Total online: ${onlineUsers.size}`
      );
      // Broadcast user online status to all connected clients
      io.emit("userStatusChange", { userId: userId, isOnline: true });
    }
  });

  // When a user joins a specific chat room
  socket.on("joinChat", async (data) => {
    const { userId, matchId } = data;

    if (!userId || !matchId) {
      socket.emit("chatError", "Missing userId or matchId to join chat.");
      return;
    }

    try {
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
          `[Socket] Match ${matchId} not found when user ${userId} attempted to join.`
        );
        socket.emit("chatError", "Match not found.");
        return;
      }

      const isUser1 = match.user1Id === userId;
      const isUser2 = match.user2Id === userId;

      if (!isUser1 && !isUser2) {
        console.warn(
          `[Socket] User ${userId} attempted to join unauthorized match ${matchId} (not part of match).`
        );
        socket.emit("chatError", "Unauthorized to join this chat.");
        return;
      }

      // Logic: Allow joining only if *both* users have approved the match.
      // This is a common pattern for chat activation after a mutual like/match.
      console.log(match.approvedByUser1, match.approvedByUser2);
      if (!match.approvedByUser1 && !match.approvedByUser2) {
        console.warn(
          `[Socket] User ${userId} attempted to join match ${matchId} but both users have not approved.`
        );
        socket.emit(
          "chatError",
          "Chat is not available until both users have approved the match."
        );
        return;
      }

      socket.join(matchId); // Join a room named after the matchId
      console.log(`[Socket] User ${userId} joined chat room: ${matchId}`);
      socket.emit(
        "chatJoined",
        `Successfully joined chat for match ${matchId}`
      );
    } catch (error) {
      console.error(
        `[Socket] Error joining chat for user ${userId} and match ${matchId}:`,
        error
      );
      socket.emit("chatError", "Failed to join chat.");
    }
  });

  // When a user sends a message
  socket.on("sendMessage", async (data) => {
    // IMPORTANT: In a production app, `senderId` should be extracted from a
    // server-verified authentication token, not directly from the client.
    const { matchId, senderId, receiverId, message } = data;

    if (!matchId || !senderId || !receiverId || !message) {
      socket.emit("chatError", "Invalid message data provided.");
      return;
    }

    try {
      // Verify match status (important for security for sending messages)
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
        socket.emit("chatError", "Cannot send message: Match not found.");
        return;
      }

      // Check if the sender is actually one of the users in the match
      const isSenderUser1 = match.user1Id === senderId;
      const isSenderUser2 = match.user2Id === senderId;

      if (!isSenderUser1 && !isSenderUser2) {
        socket.emit(
          "chatError",
          "Cannot send message: Sender is not part of this match."
        );
        return;
      }

      // Check if the receiver is the other user in the match
      const isReceiverCorrect =
        (isSenderUser1 && match.user2Id === receiverId) ||
        (isSenderUser2 && match.user1Id === receiverId);

      if (!isReceiverCorrect) {
        socket.emit(
          "chatError",
          "Cannot send message: Invalid receiver for this match."
        );
        return;
      }

      // Logic: Allow sending messages only if *both* users have approved the match.
      // This ensures consistency with the 'joinChat' logic.
      if (!match.approvedByUser1 && !match.approvedByUser2) {
        console.warn(
          `[Socket] User ${senderId} attempted to send message in match ${matchId} but both users have not approved.`
        );
        socket.emit(
          "chatError",
          "Cannot send message: Chat is not available until both users have approved the match."
        );
        return;
      }

      // Save message to database
      const newChatMessage = await prisma.chatMessage.create({
        data: {
          matchId: matchId,
          senderId: senderId,
          receiverId: receiverId,
          message: message,
        },
      });

      // Emit message to all clients in the match room for real-time updates
      io.to(matchId).emit("receiveMessage", {
        id: newChatMessage.id,
        matchId: newChatMessage.matchId,
        senderId: newChatMessage.senderId,
        receiverId: newChatMessage.receiverId,
        message: newChatMessage.message,
        createdAt: newChatMessage.createdAt,
      });
      console.log(`[Socket] Message sent in match ${matchId} by ${senderId}.`);

      // --- NEW: Send Push Notification to the receiver if they are offline or not in the current chat view ---
      // Check if the receiver is currently online (socket connected)
      const receiverSocketId = onlineUsers.get(receiverId);
      // Check if the receiver's socket is in the specific chat room (meaning they are actively viewing this chat)
      const isReceiverInChatRoom =
        receiverSocketId &&
        io.sockets.adapter.rooms.get(matchId)?.has(receiverSocketId);

      // Only send a push notification if the receiver is NOT in the current chat room.
      // If they are in the room, the socket.io 'receiveMessage' handles the real-time update.
      if (!isReceiverInChatRoom) {
        const receiverUser = await prisma.user.findUnique({
          where: { id: receiverId },
          select: { expoPushToken: true, name: true }, // Select their Expo token and name
        });

        const senderUser = await prisma.user.findUnique({
          where: { id: senderId },
          select: { name: true }, // Select sender's name for notification title
        });

        if (
          receiverUser &&
          receiverUser.expoPushToken &&
          Expo.isExpoPushToken(receiverUser.expoPushToken)
        ) {
          const messages = [];
          messages.push({
            to: receiverUser.expoPushToken,
            sound: "default", // Plays the default notification sound
            title: `New message from ${senderUser?.name || "Someone"}`, // Notification title
            body: message, // The actual message content
            data: {
              matchId: matchId,
              // Pass `senderId` as `otherUserId` for the receiver's app to navigate correctly.
              otherUserId: senderId,
              otherUserName: senderUser?.name || "Chat Partner", // Useful for frontend deep linking
              // You can add `otherUserAvatar` here if you store it and fetch it.
            },
            // _displayInForeground: true, // Uncomment for testing: always show notification even if app is foregrounded
          });

          // Expo's utility to chunk notifications for efficient sending of multiple notifications
          const chunks = expo.chunkPushNotifications(messages);
          const tickets = [];

          for (let chunk of chunks) {
            try {
              const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
              console.log("Push notification tickets sent:", ticketChunk);
              tickets.push(...ticketChunk);
              // In a production app, you might save these tickets to your database
              // to check their status later (e.g., if a token became invalid).
            } catch (error) {
              console.error("Error sending push notification chunk:", error);
              // Log the error and consider invalidating tokens that cause persistent errors.
            }
          }
        } else {
          console.log(
            `[Push Notification] No valid Expo Push Token found for receiver ${receiverId} or receiver is not subscribed.`
          );
        }
      } else {
        console.log(
          `[Push Notification] Receiver ${receiverId} is in chat room ${matchId}. Skipping push notification.`
        );
      }
    } catch (error) {
      console.error(
        "[Socket] Error saving, sending message, or sending notification:",
        error
      );
      socket.emit("chatError", "Failed to send message.");
    }
  });

  socket.on("disconnect", () => {
    // When a user disconnects, remove them from the onlineUsers map
    let disconnectedUserId = null;
    for (let [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        disconnectedUserId = userId;
        onlineUsers.delete(userId);
        break;
      }
    }
    if (disconnectedUserId) {
      console.log(
        `[Socket] User ${disconnectedUserId} disconnected (socket: ${socket.id}). Total online: ${onlineUsers.size}`
      );
      // Broadcast user offline status to all connected clients
      io.emit("userStatusChange", {
        userId: disconnectedUserId,
        isOnline: false,
      });
    } else {
      console.log(
        `User disconnected from Socket.IO: ${socket.id}. User ID not found in map.`
      );
    }
  });
});

// Start listening for HTTP requests
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API documentation/endpoints: http://localhost:${PORT}/`);
});

// Graceful shutdown
process.on("beforeExit", async () => {
  await prisma.$disconnect();
  console.log("Prisma client disconnected.");
});
