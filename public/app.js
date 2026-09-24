const health = document.querySelector('#health');
const status = document.querySelector('#socket');
const send = document.querySelector('#send');
const reply = document.querySelector('#reply');
let socket, pending, timer, reconnect;
async function checkHealth() {
  health.textContent = 'Checking connection…'; health.className = '';
  try {
    const response = await fetch('/health', { signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error();
    const result = await response.json();
    health.textContent = `Online · ${result.database === 'postgres' ? 'PostgreSQL' : 'SQLite'} connected`;
    health.className = 'ok';
  } catch { health.textContent = 'Unavailable · try again'; health.className = 'error'; }
}
function connect() {
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
  socket.onopen = () => { status.textContent = 'Connected · ready to test'; status.className = 'ok'; send.disabled = false; };
  socket.onmessage = event => {
    if (!pending) return;
    clearTimeout(timer);
    reply.textContent = event.data === pending.text ? `Received: “${event.data}” · ${Math.round(performance.now() - pending.start)} ms round-trip` : 'Unexpected reply. Please try again.';
    pending = null; send.disabled = false;
  };
  socket.onclose = () => {
    clearTimeout(timer); pending = null;
    status.textContent = 'Disconnected · reconnecting…'; status.className = 'error'; send.disabled = true;
    reply.textContent = 'Connection interrupted. Send a new test after reconnection.';
    reconnect = setTimeout(connect, 2500);
  };
  socket.onerror = () => { status.textContent = 'Connection failed'; status.className = 'error'; };
}
document.querySelector('#echo-form').addEventListener('submit', event => {
  event.preventDefault();
  if (socket.readyState !== WebSocket.OPEN) return;
  pending = { text: document.querySelector('#message').value, start: performance.now() };
  socket.send(pending.text); send.disabled = true; reply.textContent = 'Waiting for reply…';
  timer = setTimeout(() => { reply.textContent = 'No reply within 7 seconds. Try again.'; pending = null; send.disabled = socket.readyState !== WebSocket.OPEN; }, 7000);
});
document.querySelector('#check').addEventListener('click', checkHealth);
window.addEventListener('pagehide', () => { clearTimeout(reconnect); socket.onclose = null; socket.close(); });
window.addEventListener('pageshow', event => { if (event.persisted) { checkHealth(); connect(); } });
checkHealth(); connect();
