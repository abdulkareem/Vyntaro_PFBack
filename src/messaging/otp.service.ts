import { sendEmailOtp } from './email/email.service.js'
import { sendSmsOtp } from './sms/sms.service.js'
import { sendWhatsAppOTP } from './whatsapp/whatsapp.sender.js'

export type OtpDeliveryStatus = {
  sms: 'sent'
  email: 'sent' | 'skipped' | 'failed'
  whatsapp: 'sent' | 'skipped' | 'failed'
}

export async function sendOtp(phone: string, otp: string, email?: string | null): Promise<OtpDeliveryStatus> {
  await sendSmsOtp(phone, otp)

  let emailStatus: OtpDeliveryStatus['email'] = 'skipped'
  let whatsappStatus: OtpDeliveryStatus['whatsapp'] = 'skipped'

  if (email) {
    try {
      await sendEmailOtp(email, otp)
      emailStatus = 'sent'
    } catch (error) {
      console.error('Email OTP delivery failed', error)
      emailStatus = 'failed'
    }
  }

  try {
    await sendWhatsAppOTP(phone, otp)
    whatsappStatus = 'sent'
  } catch (error) {
    console.error('WhatsApp OTP delivery failed', error)
    whatsappStatus = 'failed'
  }

  return {
    sms: 'sent',
    email: emailStatus,
    whatsapp: whatsappStatus
  }
}
