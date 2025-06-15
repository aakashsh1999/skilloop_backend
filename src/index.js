// src/app.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes.js");
const userRoutes = require("./routes/userRoutes.js");
const likeRoutes = require("./routes/likeRoutes.js");
const taskRoutes = require("./routes/taskRoutes.js");
const chatRoutes = require("./routes/chatRoutes.js");
const matchRoutes = require("./routes/matchRoutes.js");

const app = express();

app.use(cors());

// --- IMPORTANT: CONFIGURE BODY PARSER LIMITS HERE ---
// This allows JSON bodies up to 50MB. Adjust '50mb' as needed (e.g., '10mb', '100mb').
// This is crucial for handling large base64 image strings or extensive profile data.
app.use(express.json({ limit: "50mb" }));

// This handles URL-encoded bodies, also with a 50MB limit.
// 'extended: true' allows for parsing of rich objects and arrays.
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
// --------------------------------------------------

// Health check route
app.get("/", (req, res) => {
  res.send("Tinder-like backend is running!");
});

// API Routes
app.use("/api/auth", authRoutes); // Example: /api/users?mobile_number=... or ?user_id=...
app.use("/api/users", userRoutes);
app.use("/api/likes", likeRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/chats", chatRoutes); // For historical messages
app.use("/api/tasks", taskRoutes);

module.exports = app;
