const key = 'e546b209-babd-11f1-af74-0200cd936042';
const phone = '919981084008';

console.log('1. Sending OTP via 2Factor API...');
const sendUrl = `https://2factor.in/API/V1/${key}/SMS/${phone}/AUTOGEN`;
console.log('Send URL:', sendUrl);

const sendRes = await fetch(sendUrl);
const sendData = await sendRes.json();
console.log('Send Response Data:', sendData);

if (sendData.Status === 'Success' && sendData.Details) {
  const sessionId = sendData.Details;
  console.log(`\nOTP Sent! Session ID: ${sessionId}`);
  console.log('Please check your phone right now for the OTP code.');
  console.log('Run: node scripts/debug-2factor-verify.js <session_id> <received_otp>');
}
