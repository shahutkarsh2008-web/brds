const signupForm = document.querySelector('#signup-form');
const otpForm = document.querySelector('#otp-form');
const btnSubmit = document.querySelector('#btn-submit');
const btnOtpSubmit = document.querySelector('#btn-otp-submit');
const alertBanner = document.querySelector('#alert-banner');
const otpAlertBanner = document.querySelector('#otp-alert-banner');
const togglePassBtn = document.querySelector('#toggle-password');
const restartSignupBtn = document.querySelector('#restart-signup');

const params = new URLSearchParams(window.location.search);
if (params.has('loginId')) {
  const loginInput = document.querySelector('#loginId');
  if (loginInput) loginInput.value = params.get('loginId');
}

if (togglePassBtn) {
  togglePassBtn.addEventListener('click', () => {
    const passInput = document.querySelector('#password');
    if (passInput) {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      togglePassBtn.textContent = isPass ? 'Hide' : 'Show';
    }
  });
}

function showAlert(banner, text, type = 'error') {
  if (banner) {
    banner.className = `alert-banner ${type}`;
    banner.textContent = text;
  }
}

function clearAlert() {
  if (alertBanner) {
    alertBanner.className = 'alert-banner';
    alertBanner.textContent = '';
  }
  if (otpAlertBanner) {
    otpAlertBanner.className = 'alert-banner';
    otpAlertBanner.textContent = '';
  }
  ['#name', '#loginId', '#phone', '#password', '#code'].forEach(selector => {
    const el = document.querySelector(selector);
    if (el) el.classList.remove('input-error');
  });
}

signupForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearAlert();

  const nameEl = document.querySelector('#name');
  const loginIdEl = document.querySelector('#loginId');
  const phoneEl = document.querySelector('#phone');
  const passwordEl = document.querySelector('#password');
  const targetExamEl = document.querySelector('#targetExam');

  let name = (nameEl?.value || '').trim();
  let rawLoginId = (loginIdEl?.value || '').trim().toLowerCase();
  let rawPhone = (phoneEl?.value || '').replace(/[\s+-]/g, '');
  let password = passwordEl?.value || '';
  let targetExam = targetExamEl?.value || 'UCEED 2026';

  if (!name) {
    nameEl?.classList.add('input-error');
    nameEl?.focus();
    showAlert(alertBanner, 'Please enter your Full Name.');
    return;
  }

  if (!rawLoginId || !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(rawLoginId)) {
    loginIdEl?.classList.add('input-error');
    loginIdEl?.focus();
    showAlert(alertBanner, 'Login ID must be 3–40 characters using letters, numbers, dots or underscores.');
    return;
  }

  if (rawPhone.length === 10 && /^[6-9]\d{9}$/.test(rawPhone)) {
    rawPhone = '91' + rawPhone;
  }

  if (!/^91[6-9]\d{9}$/.test(rawPhone)) {
    phoneEl?.classList.add('input-error');
    phoneEl?.focus();
    showAlert(alertBanner, 'Enter a valid 10-digit Indian mobile number.');
    return;
  }

  if (!password || password.length < 12) {
    passwordEl?.classList.add('input-error');
    passwordEl?.focus();
    showAlert(alertBanner, 'Password must be at least 12 characters long.');
    return;
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = 'Creating account…';
  }

  const payload = {
    name,
    loginId: rawLoginId,
    phone: rawPhone,
    targetExam,
    password,
    role: 'student'
  };

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed.');

    // Initiate sign in to trigger OTP issue
    const loginRes = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId: payload.loginId, password: payload.password })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error(loginData.error || 'Account created, but sign-in failed. Please sign in manually.');

    // Hide signup form, show OTP form
    signupForm.hidden = true;
    if (otpForm) otpForm.hidden = false;
    const stepEl = document.querySelector('.form-content .eyebrow');
    if (stepEl) stepEl.textContent = '02 / VERIFY IDENTITY';
    const titleEl = document.querySelector('.form-content h2');
    if (titleEl) titleEl.textContent = 'Check your phone.';
    const descEl = document.querySelector('.form-content p');
    if (descEl) descEl.textContent = `Account created! Enter the 6-digit verification code sent to your registered mobile ending ${loginData.phoneHint ? loginData.phoneHint.slice(-4) : 'phone'}.`;

    document.querySelector('#code')?.focus();
  } catch (err) {
    showAlert(alertBanner, err.message, 'error');
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = 'Create Account & Enter Workspace <span>→</span>';
    }
  }
});

otpForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearAlert();
  const codeEl = document.querySelector('#code');
  const code = (codeEl?.value || '').trim();

  if (!code || !/^\d{4,8}$/.test(code)) {
    codeEl?.classList.add('input-error');
    codeEl?.focus();
    showAlert(otpAlertBanner, 'Enter a valid verification code.');
    return;
  }

  if (btnOtpSubmit) {
    btnOtpSubmit.disabled = true;
    btnOtpSubmit.innerHTML = 'Verifying…';
  }

  try {
    const res = await fetch('/api/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    const target = (data.user && ['admin', 'teacher'].includes(data.user.role)) ? '/admin.html' : '/dashboard.html';
    window.location.assign(target);
  } catch (err) {
    showAlert(otpAlertBanner, err.message, 'error');
    if (btnOtpSubmit) {
      btnOtpSubmit.disabled = false;
      btnOtpSubmit.innerHTML = 'Verify & Enter Workspace <span>→</span>';
    }
  }
});

restartSignupBtn?.addEventListener('click', () => {
  if (otpForm) otpForm.hidden = true;
  if (signupForm) signupForm.hidden = false;
  if (btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = 'Create Account & Enter Workspace <span>→</span>';
  }
});
