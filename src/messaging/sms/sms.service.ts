export async function sendSmsOtp(phone: string, otp: string): Promise<void> {
  if (process.env.APP_ENV !== 'production') {
    console.log(`📩 SMS OTP to ${phone}: ${otp}`)
  }
}
