async function sendSmsReminder({ booking }) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  const to = booking.userId?.phone;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER || !to) {
    return { skipped: true };
  }

  const body = new URLSearchParams({
    To: to,
    From: TWILIO_FROM_NUMBER,
    Body: `Eventverse: “${booking.eventId.title}” sẽ bắt đầu lúc ${booking.bookingTime.toLocaleString('vi-VN', { timeZone: booking.eventId.timezone || 'Asia/Ho_Chi_Minh' })}.`
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  if (!response.ok) throw new Error(`Twilio trả về HTTP ${response.status}`);
  return { skipped: false };
}

module.exports = { sendSmsReminder };
