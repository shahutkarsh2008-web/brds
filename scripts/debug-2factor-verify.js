const key = 'e546b209-babd-11f1-af74-0200cd936042';
const session = process.argv[2];
const code = process.argv[3];

if (!session || !code) {
  console.log('Usage: node scripts/debug-2factor-verify.js <session_id> <otp_code>');
  process.exit(1);
}

console.log(`Verifying OTP ${code} for session ${session}...`);
const verifyUrl = `https://2factor.in/API/V1/${key}/SMS/VERIFY/${session}/${code}`;
console.log('Verify URL:', verifyUrl);

const res = await fetch(verifyUrl);
const data = await res.json();
console.log('Full Verify Response:', JSON.stringify(data, null, 2));
