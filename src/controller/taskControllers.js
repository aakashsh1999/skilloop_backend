// src/controllers/taskController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.createTask = async (req, res) => {
  const currentUserId = req.user.id; // Authenticated user
  const { title, description, date, assignedToUserId } = req.body; // date should be in 'YYYY-MM-DD' format

  if (!title || !date) {
    return res
      .status(400)
      .json({ message: "Title and date are required for a task." });
  }

  try {
    let taskData = {
      title,
      description,
      date: new Date(date), // Convert YYYY-MM-DD string to Date object
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (assignedToUserId && assignedToUserId !== currentUserId) {
      // This is an assigned task.
      // 1. Check if both users are matched.
      const match = await prisma.match.findFirst({
        where: {
          OR: [
            { user1Id: currentUserId, user2Id: assignedToUserId },
            { user1Id: assignedToUserId, user2Id: currentUserId },
          ],
          approvedByUser1: true,
          approvedByUser2: true,
        },
      });

      if (!match) {
        return res
          .status(403)
          .json({
            message:
              "Cannot assign task: Users are not matched or match is not mutually approved.",
          });
      }

      taskData.userId = assignedToUserId; // Task is for the assigned user
      taskData.assignedById = currentUserId; // Current user is assigning it
      taskData.taskType = "assigned";
    } else {
      // This is a personal task.
      taskData.userId = currentUserId; // Task is for the current user
      taskData.taskType = "personal";
    }

    const newTask = await prisma.task.create({
      data: taskData,
    });

    res
      .status(201)
      .json({ message: "Task created successfully.", task: newTask });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.getUserTasks = async (req, res) => {
  const userId = req.user.id; // Authenticated user
  const { date } = req.query; // Optional: filter by date 'YYYY-MM-DD'

  try {
    const whereClause = {
      userId: userId, // Tasks assigned TO or owned BY this user
    };

    if (date) {
      // For @db.Date type, we need to query based on day
      const queryDate = new Date(date);
      queryDate.setUTCHours(0, 0, 0, 0); // Start of the day in UTC

      const nextDay = new Date(queryDate);
      nextDay.setDate(queryDate.getDate() + 1); // Start of the next day in UTC

      whereClause.date = {
        gte: queryDate,
        lt: nextDay,
      };
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      orderBy: { date: "asc" },
      include: {
        user: { select: { id: true, name: true, profile_image: true } }, // The user who owns the task
        assignedBy: { select: { id: true, name: true, profile_image: true } }, // The user who assigned it (if applicable)
      },
    });

    res.json(tasks);
  } catch (error) {
    console.error("Error fetching user tasks:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.updateTaskStatus = async (req, res) => {
  const userId = req.user.id; // Authenticated user
  const { taskId } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: "Status is required." });
  }

  const validStatuses = ["pending", "in-progress", "completed", "cancelled"];
  if (!validStatuses.includes(status)) {
    return res
      .status(400)
      .json({
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    // Only the user who owns the task can update its status
    if (task.userId !== userId) {
      return res
        .status(403)
        .json({ message: "You are not authorized to update this task." });
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status: status, updatedAt: new Date() },
    });

    res.json({
      message: "Task status updated successfully.",
      task: updatedTask,
    });
  } catch (error) {
    console.error("Error updating task status:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
