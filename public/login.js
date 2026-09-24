const loginForm = document.querySelector('#login-form');
const otpForm = document.querySelector('#otp-form');
const message = document.querySelector('#message');
async function post(path, data) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(20000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to sign in.');
  return result;
}
async function run(form, work) {
  const buttons = [...document.querySelectorAll('button')];
  buttons.forEach(button => { button.disabled = true; }); message.textContent = 'Please wait…';
  try { await work(); }
  catch (error) { message.textContent = error.name === 'TimeoutError' ? 'The request timed out. Please try again.' : error.message; }
  finally { buttons.forEach(button => { button.disabled = false; }); }
}
loginForm.addEventListener('submit', event => {
  event.preventDefault();
  run(loginForm, async () => {
    const result = await post('/api/login', { loginId: document.querySelector('#login-id').value, password: document.querySelector('#password').value });
    document.querySelector('#password').value = '';
    loginForm.hidden = true; otpForm.hidden = false;
    document.querySelector('#step').textContent = '02 / VERIFY YOUR IDENTITY';
    document.querySelector('#title').textContent = 'Check your phone.';
    document.querySelector('#description').textContent = `Enter the code sent to your registered mobile ending ${result.phoneHint.slice(-4)}.`;
    message.textContent = ''; document.querySelector('#code').focus();
  });
});
otpForm.addEventListener('submit', event => {
  event.preventDefault();
  run(otpForm, async () => {
    const result = await post('/api/verify-otp', { code: document.querySelector('#code').value });
    location.assign(result.redirect);
  });
});
document.querySelector('#restart').addEventListener('click', () => location.assign('/login'));
fetch('/api/me').then(response => response.json()).then(result => { if (result.user) location.replace(`/${result.user.role}`); }).catch(() => { message.textContent = 'Cannot reach the server. Check your connection.'; });
