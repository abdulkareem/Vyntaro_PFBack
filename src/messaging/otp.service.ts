import { sendEmailOtp } from './email/email.service.js'
import { sendSmsOtp } from './sms/sms.service.js'
import { sendWhatsAppOTP } from './whatsapp/whatsapp.sender.js'

export async function sendOtp(phone: string, otp: string, email?: string | null): Promise<void> {
  await sendSmsOtp(phone, otp)

  if (email) {
    sendEmailOtp(email, otp).catch(() => {})
  }

  sendWhatsAppOTP(phone, otp).catch(() => {})
}
