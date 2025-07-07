// app.get("/api/search-skills", async

// src/routes/taskRoutes.js
const express = require("express");
const router = express.Router();
const skillsController = require("../controller/searchControllers.js");

router.get("/skills", skillsController.searchSkills);

module.exports = router;
