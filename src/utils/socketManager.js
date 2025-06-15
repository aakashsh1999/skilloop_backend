// // src/utils/socketManager.js
// const { Server } = require("socket.io");

// // Map to store userId to socket
// const userSockets = new Map();

// let ioInstance = null; // To hold the Socket.IO server instance

// const initSocketIO = (httpServer) => {
//   if (ioInstance) {
//     return ioInstance; // Already initialized
//   }

//   ioInstance = new Server(httpServer, {
//     cors: {
//       origin: "*", // Adjust this to your frontend URL in production
//       methods: ["GET", "POST"],
//     },
//   });

//   ioInstance.on("connection", (socket) => {
//     // For simplicity, userId is passed as a query param.
//     // In a real app, this should be part of an authenticated handshake (e.g., JWT in headers).
//     const { userId } = socket.handshake.query;

//     if (!userId) {
//       console.log("Socket disconnected: No userId provided.");
//       socket.disconnect(true);
//       return;
//     }

//     userSockets.set(userId, socket);
//     console.log(`User ${userId} connected. Socket ID: ${socket.id}`);

//     socket.on("chat_message", ({ to, text }) => {
//       if (!to || !text) {
//         socket.emit("error", { error: "Missing 'to' or 'text' in message" });
//         return;
//       }

//       const targetSocket = userSockets.get(to);
//       if (targetSocket) {
//         console.log(`Sending message from ${userId} to ${to}: "${text}"`);
//         targetSocket.emit("chat_message", { from: userId, text });
//       } else {
//         console.log(
//           `User ${to} not connected. Message from ${userId}: "${text}"`
//         );
//         // Optionally, store message in DB for offline delivery
//         socket.emit("error", {
//           error: "Recipient user not connected or invalid.",
//         });
//       }
//     });

//     socket.on("disconnect", () => {
//       userSockets.delete(userId);
//       console.log(`User ${userId} disconnected. Socket ID: ${socket.id}`);
//     });
//   });

//   return ioInstance;
// };

// // You can export ioInstance if you need to access it outside for broadcasting, etc.
// const getIO = () => {
//   if (!ioInstance) {
//     throw new Error("Socket.IO not initialized! Call initSocketIO first.");
//   }
//   return ioInstance;
// };

// // You might export userSockets map directly if you want to manage it externally,
// // but it's generally better to provide helper functions if direct access isn't strictly needed.
// const getSocketForUser = (userId) => userSockets.get(userId);

// module.exports = {
//   initSocketIO,
//   getIO,
//   getSocketForUser,
// };
