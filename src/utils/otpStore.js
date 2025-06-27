// src/utils/otpStore.js

const otpStore = new Map(); // Stores { mobile_number: { otp: '...', timestamp: '...' } }
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const generateOtp = (mobileNumber) => {
  // Generate a 6-digit random OTP
  // Math.floor(100000 + Math.random() * 900000).toString()
  const otp = "000000";
  otpStore.set(mobileNumber, { otp, timestamp: Date.now() });
  return otp;
};

const verifyOtp = (mobileNumber, userOtp) => {
  const stored = otpStore.get(mobileNumber);

  if (!stored) {
    return { success: false, message: "OTP not requested for this number." };
  }

  if (Date.now() - stored.timestamp > OTP_EXPIRY_MS) {
    otpStore.delete(mobileNumber); // OTP expired
    return {
      success: false,
      message: "OTP expired. Please request a new one.",
    };
  }

  if (stored.otp !== userOtp) {
    return { success: false, message: "Invalid OTP." };
  }

  // OTP is valid and not expired, remove it after successful verification
  otpStore.delete(mobileNumber);
  return { success: true, message: "OTP verified successfully." };
};

module.exports = {
  generateOtp,
  verifyOtp,
};
