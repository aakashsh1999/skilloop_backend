const prisma = require("../prisma"); // Adjust the path to your prisma client
const otpStore = require("../utils/otpStore"); // Adjust the path to your otpStore
const twilioService = require("../utils/twilioService");

const { OAuth2Client } = require("google-auth-library");
// const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); // Uncomment for real Google verification

exports.handleOtp = async (req, res) => {
  const { mobile_number, otp } = req.body;

  if (!mobile_number) {
    return res.status(400).json({ error: "Mobile number is required" });
  }

  try {
    if (!otp) {
      // --- Send OTP Flow ---
      const generatedOtp = otpStore.generateOtp(mobile_number);
      console.log(`[DEV/TEST] Sending OTP ${generatedOtp} to ${mobile_number}`);
      const sendResult = await twilioService.sendOtp(
        mobile_number,
        generatedOtp
      );

      if (!sendResult.success) {
        return res.status(500).json({ error: "Failed to send OTP via SMS" });
      }

      // TODO: Integrate with SMS provider to send OTP in production
      return res.status(200).json({
        message: "OTP sent",
        otp: generatedOtp, // Remove this from production response!
      });
    } else {
      // --- Verify OTP Flow ---
      const verificationResult = otpStore.verifyOtp(mobile_number, otp);

      if (!verificationResult.success) {
        return res.status(400).json({ error: verificationResult.message });
      }

      console.log(mobile_number, "ss");

      // OTP verified, check if user exists
      const user = await prisma.user.findUnique({
        where: { mobile_number },
      });

      if (user) {
        // Existing user — login success
        // TODO: Generate JWT token here
        return res.status(200).json({
          message: "Login successful",
          user,
          isNewUser: false,
        });
      } else {
        // New user — proceed to registration
        return res.status(200).json({
          message: "Mobile number verified. Please complete registration.",
          isNewUser: true,
          mobile_number,
        });
      }
    }
  } catch (error) {
    console.error("Error in handleOtp:", error);
    return res.status(500).json({
      error: "Failed to process OTP.",
      details: error.message,
    });
  }
};

exports.register = async (req, res) => {
  const { mobile_number, ...userData } = req.body;

  // Basic required fields validation
  if (
    !mobile_number ||
    !userData.user_type ||
    !userData.name ||
    !userData.gender ||
    !userData.age ||
    !userData.location ||
    !userData.profile_image ||
    !userData.skills ||
    !userData.skill_type ||
    !userData.short_bio
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const newUser = await prisma.user.create({
      data: {
        mobile_number,
        user_type: userData.user_type,
        name: userData.name,
        gender: userData.gender,
        age: parseInt(userData.age),
        location: userData.location,
        short_bio: userData.short_bio,
        latitude: userData.latitude ? parseFloat(userData.latitude) : null,
        longitude: userData.longitude ? parseFloat(userData.longitude) : null,
        profile_image: userData.profile_image,
        face: userData.face || null,
        anything_but_professional: userData.anything_but_professional || null,
        skills: userData.skills,
        skill_type: userData.skill_type,
        business_card: userData.business_card || null,
        certificates: userData.certificates || [],
        work_experience: userData.work_experience || [],
      },
    });

    return res
      .status(201)
      .json({ message: "User registered successfully", user: newUser });
  } catch (error) {
    if (
      error.code === "P2002" &&
      error.meta?.target?.includes("mobile_number")
    ) {
      return res
        .status(409)
        .json({ error: "A user with this mobile number already exists." });
    }
    console.error("Error during user registration:", error);
    return res
      .status(500)
      .json({ error: "Failed to register user.", details: error.message });
  }
};

exports.googleLogin = async (req, res) => {
  const { id_token } = req.body;

  if (!id_token) {
    return res.status(400).json({ error: "Google ID token is required" });
  }

  try {
    // Uncomment and configure for real Google ID token verification
    /*
    const ticket = await client.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;
    */

    // MOCK payload for testing
    let email, name, picture;
    if (id_token === "valid_google_id_token_existing") {
      email = "existing_google_user@example.com";
      name = "Existing Google User";
      picture = "http://example.com/existing_profile.jpg";
    } else if (id_token === "valid_google_id_token_new") {
      email = "new_google_user@example.com";
      name = "New Google User";
      picture = "http://example.com/new_profile.jpg";
    } else {
      return res.status(401).json({
        error: "Invalid or unrecognized Google ID token for testing.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      return res.json({
        message: "Google login successful",
        user,
        isNewUser: false,
      });
    } else {
      return res.json({
        message: "Google account verified. Please complete registration.",
        isNewUser: true,
        email,
        name,
        profile_image: picture,
      });
    }
  } catch (error) {
    console.error("Error during Google login verification:", error);
    return res.status(500).json({
      error: "Failed to process Google login.",
      details: error.message,
    });
  }
};
