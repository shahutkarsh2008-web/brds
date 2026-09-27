const base = 'https://brds-cbt.onrender.com';

try {
  console.log(`Testing login for utkarsh on ${base}...`);
  const res = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ loginId: 'utkarsh', password: 'Abc123@def' })
  });

  const data = await res.json();
  console.log('HTTP Status:', res.status);
  console.log('Response Body:', data);

  if (res.status === 200 && data.otpRequired) {
    console.log('\n🎉 LOGIN VERIFIED 100% SUCCESSFUL!');
    console.log(`OTP sent to phone ending ${data.phoneHint}`);
  } else {
    console.error('Login returned unexpected result:', data);
  }
} catch (err) {
  console.error('Login request error:', err.message);
}
