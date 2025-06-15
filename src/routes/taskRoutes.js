// src/routes/taskRoutes.js
const express = require("express");
const router = express.Router();
const taskController = require("../controller/taskControllers.js");

// Create a new task (personal or assigned)
router.post("/", taskController.createTask);

// Get tasks for the current user (can filter by date)
router.get("/", taskController.getUserTasks);

// Update status of a task
router.patch("/:taskId/status", taskController.updateTaskStatus);

module.exports = router;
