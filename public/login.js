const loginForm = document.querySelector('#login-form');
const otpForm = document.querySelector('#otp-form');
const message = document.querySelector('#message');

fetch('/api/development').then(r => r.json()).then(info => {
  if (info.enabled) {
    const note = document.createElement('p');
    note.className = 'field-note';
    note.textContent = 'LOCAL DEMO · IDs: student1–student5, teacher, admin. Password: BRDS-local-demo-2026! · Simulated OTP: 123456. No SMS is sent.';
    document.querySelector('.form-content').prepend(note);
  }
}).catch(() => {});

async function post(path, data) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(20000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to sign in.');
  return result;
}

async function run(form, work) {
  const buttons = [...document.querySelectorAll('button')];
  buttons.forEach(button => { button.disabled = true; });
  message.textContent = 'Please wait…';
  try {
    await work();
  } catch (error) {
    message.textContent = error.name === 'TimeoutError' ? 'The request timed out. Please try again.' : error.message;
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

loginForm.addEventListener('submit', event => {
  event.preventDefault();
  run(loginForm, async () => {
    const result = await post('/api/login', {
      loginId: document.querySelector('#login-id').value,
      password: document.querySelector('#password').value
    });
    document.querySelector('#password').value = '';
    loginForm.hidden = true;
    otpForm.hidden = false;
    document.querySelector('#step').textContent = '02 / VERIFY YOUR IDENTITY';
    document.querySelector('#title').textContent = 'Check your phone.';
    document.querySelector('#description').textContent = `Enter the code sent to your registered mobile ending ${result.phoneHint.slice(-4)}.`;
    message.textContent = '';
    document.querySelector('#code').focus();
  });
});

otpForm.addEventListener('submit', event => {
  event.preventDefault();
  run(otpForm, async () => {
    const result = await post('/api/verify-otp', { code: document.querySelector('#code').value });
    const target = (result.user && result.user.role === 'admin') ? '/admin' : (result.redirect || '/');
    location.assign(target);
  });
});

document.querySelector('#restart').addEventListener('click', () => location.assign('/login'));

fetch('/api/me').then(response => response.json()).then(result => {
  if (result && result.user) {
    const target = result.user.role === 'admin' ? '/admin' : `/${result.user.role}`;
    location.replace(target);
  }
}).catch(() => {});
