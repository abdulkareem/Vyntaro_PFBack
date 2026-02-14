function getResendApiKey(): string | null {
  const apiKey = process.env.RESEND_API_KEY
  return apiKey ?? null
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'Aureliv <no-reply@aureliv.in>'

export async function sendEmailOtp(to: string, otp: string): Promise<void> {
  const apiKey = getResendApiKey()

  if (!apiKey) {
    if (process.env.APP_ENV !== 'production') {
      console.warn('📧 RESEND_API_KEY not set — skipping email OTP')
    }
    return
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: 'Your Aureliv OTP',
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5">
            <h2>Aureliv Verification Code</h2>
            <p>Your one-time password is:</p>
            <h1 style="letter-spacing: 6px">${otp}</h1>
            <p>This OTP is valid for a short time.</p>
            <p style="font-size: 12px; color: #666">
              If you did not request this, please ignore this email.
            </p>
          </div>
        `
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`status=${response.status} body=${errorText}`)
    }

    if (process.env.APP_ENV !== 'production') {
      const result = await response.json()
      console.log('📧 Email OTP sent:', result.id)
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error('📧 Email OTP failed', err.message)
      return
    }

    console.error('📧 Email OTP failed (unknown error)')
  }
}
