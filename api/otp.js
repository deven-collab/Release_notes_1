const otpStore = {};

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(to, otp) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || 'noreply@voiro.com',
      to: [to],
      subject: 'Your Voiro Release Notes login code',
      html: `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;">
          <div style="margin-bottom:24px;display:flex;align-items:center;gap:10px;">
            <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg"><g fill="none"><path d="M23.739 11.391L4.192 3.042l.463-.379A11.675 11.675 0 0112.074 0c6.075 0 11.179 4.741 11.623 10.795l.042.596z" fill="#474647"/><path d="M3.317 19.84l-.165-.172A11.033 11.033 0 010 11.927a11.04 11.04 0 013.215-7.814l.165-.165 18.768 7.978L3.317 19.84z" fill="#3BB6BB"/><path d="M11.866 23.791a11.888 11.888 0 01-7.541-2.703l-.469-.39 19.882-8.464-.048.609c-.464 6.137-5.659 10.948-11.824 10.948" fill="#CE5450"/></g></svg>
            <span style="font-size:15px;font-weight:600;color:#1a1a2e;">Voiro Release Notes</span>
          </div>
          <h2 style="font-size:20px;font-weight:600;color:#1a1a2e;margin-bottom:8px;">Your login code</h2>
          <p style="font-size:14px;color:#52526e;margin-bottom:24px;line-height:1.6;">Use this code to sign in. It expires in 10 minutes.</p>
          <div style="background:#f5f5f7;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#4f46e5;">${otp}</span>
          </div>
          <p style="font-size:13px;color:#8e8ea0;line-height:1.6;">
            If you did not request this, ignore this email.<br>
            For access issues contact <a href="mailto:deven@voiro.com" style="color:#4f46e5;">deven@voiro.com</a>
          </p>
        </div>`
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err.slice(0, 200)}`);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
  const { action, email, otp } = req.body || {};

  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const normalizedEmail = email.trim().toLowerCase();

  if (action === 'send') {
    if (!ALLOWED_EMAILS.includes(normalizedEmail)) {
      return res.status(403).json({
        error: 'Your email is not authorised. Please contact deven@voiro.com to request access.'
      });
    }
    const code = generateOTP();
    otpStore[normalizedEmail] = { code, expires: Date.now() + 10 * 60 * 1000 };
    try {
      await sendOTPEmail(normalizedEmail, code);
      return res.status(200).json({ sent: true });
    } catch (err) {
      console.error('OTP send error:', err.message);
      return res.status(500).json({ error: `Failed to send login code: ${err.message}` });
    }
  }

  if (action === 'verify') {
    const record = otpStore[normalizedEmail];
    if (!record) return res.status(400).json({ error: 'No code found. Please request a new one.' });
    if (Date.now() > record.expires) {
      delete otpStore[normalizedEmail];
      return res.status(400).json({ error: 'Code has expired. Please request a new one.' });
    }
    if (record.code !== otp?.trim()) {
      return res.status(400).json({ error: 'Incorrect code. Please try again.' });
    }
    delete otpStore[normalizedEmail];
    return res.status(200).json({ verified: true });
  }

  return res.status(400).json({ error: 'Invalid action.' });
};
