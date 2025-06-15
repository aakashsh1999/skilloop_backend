const express = require("express");
const router = express.Router();
const authController = require("../controller/authControllers.js");

// Combined OTP route for sending and verifying OTP (both login and register)
router.post("/otp", authController.handleOtp);

router.post("/register", authController.register);

router.post("/login/google", authController.googleLogin);

module.exports = router;
