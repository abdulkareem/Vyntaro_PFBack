export async function sendWhatsAppOTP(phone: string, otp: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!token || !phoneNumberId) {
    if (process.env.APP_ENV !== 'production') {
      console.warn('📲 WhatsApp config missing — skipping WhatsApp OTP')
    }
    return
  }

  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: `Your Aureliv OTP is ${otp}` }
    })
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`status=${response.status} body=${body}`)
  }

  if (process.env.APP_ENV !== 'production') {
    console.log(`📲 WhatsApp OTP sent to ${phone}`)
  }
}
