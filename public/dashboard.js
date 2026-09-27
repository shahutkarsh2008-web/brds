const message = document.querySelector('#message');
let socket, reconnect, stopped = false;
async function request(path, data) {
  const response = await fetch(path, data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {});
  const result = await response.json();
  if (response.status === 401) location.replace('/login');
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}
function connect() {
  if (stopped) return;
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/session-ws`);
  socket.onopen = () => { document.querySelector('#connection').textContent = '● Live connection active'; };
  socket.onmessage = event => { try { window.dispatchEvent(new CustomEvent('brds-live', { detail: JSON.parse(event.data) })); } catch {} };
  socket.onclose = async event => {
    document.querySelector('#connection').textContent = 'Reconnecting…';
    if (stopped) return;
    if (event.code === 4001) return location.replace('/login');
    try { const { user } = await request('/api/me'); if (!user) return location.replace('/login'); } catch {}
    reconnect = setTimeout(connect, 3000);
  };
  socket.onerror = () => { document.querySelector('#connection').textContent = 'Connection interrupted'; };
}
async function loadUsers() {
  const { users } = await request('/api/admin/users');
  document.querySelector('#users').replaceChildren(...users.map(user => {
    const row = document.createElement('tr');
    for (const value of [user.loginId, user.name, user.role, user.active ? 'Active' : 'Inactive']) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    }
    return row;
  }));
}
document.querySelector('#logout').addEventListener('click', async () => {
  try { await request('/api/logout', {}); stopped = true; clearTimeout(reconnect); socket?.close(); location.replace('/login'); }
  catch (error) { message.textContent = error.message; }
});
document.querySelector('#create-user').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true;
  try {
    const { user } = await request('/api/admin/users', Object.fromEntries(new FormData(event.target)));
    event.target.reset(); message.textContent = `Account ${user.loginId} created.`; await loadUsers();
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; }
});
async function start() {
  const role = location.pathname.slice(1);
  if (role === 'admin') { location.replace('/admin'); return; }
  const { user } = await request(`/api/${role}`);
  const copy = {
    student: ['STUDENT WORKSPACE', 'Ready for your next step.', 'Your exam space is ready.', 'Assigned tests and attempt history will appear here when the exam engine is added.'],
    teacher: ['TEACHER WORKSPACE', 'A clear view of your classroom.', 'Your invigilation space is ready.', 'Live student monitoring and exam controls will be added in the next build phases.'],
    admin: ['ADMIN WORKSPACE', 'Give your students a connected start.', 'You manage access.', 'Create student, teacher, and administrator accounts below. Each account requires mobile OTP verification to sign in.'],
  }[role];

  document.querySelector('#role-label').textContent = copy[0];
  document.querySelector('#greeting').textContent = `Hello, ${user.name}.`;
  document.querySelector('#intro').textContent = copy[1];
  document.querySelector('#role-pill').textContent = user.role.toUpperCase();
  document.querySelector('#empty-title').textContent = copy[2];
  document.querySelector('#empty-description').textContent = copy[3];
  if (role === 'admin') { document.querySelector('#admin-panel').hidden = false; await loadUsers(); }
  window.brdsUser = user; window.dispatchEvent(new CustomEvent('brds-user', { detail: user }));
  connect();
}
window.addEventListener('pagehide', () => { stopped = true; clearTimeout(reconnect); socket?.close(); });
window.addEventListener('pageshow', event => { if (event.persisted) { stopped = false; start().catch(error => { message.textContent = error.message; }); } });
start().catch(error => { message.textContent = error.message; });
