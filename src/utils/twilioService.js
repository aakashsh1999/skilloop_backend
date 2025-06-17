// utils/twilioService.js
const twilio = require("twilio");

const USE_TWILIO = false;

let client;
if (USE_TWILIO) {
  client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

exports.sendOtp = async (to, otp) => {
  if (!USE_TWILIO) {
    console.log(`[DEV MODE] Skipping SMS. OTP for ${to}: ${otp}`);
    return { success: true, dev: true };
  }

  try {
    const message = await client.messages.create({
      body: `Your verification code is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to.startsWith("+") ? to : `+91${to}`,
    });
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error("Twilio send error:", error);
    return { success: false, error: error.message };
  }
};
