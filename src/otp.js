export class OtpUnavailable extends Error {}
export function createOtpProvider(env = process.env, request = fetch) {
  // No fixed OTP or bypass mode. Only tests inject a replacement provider.
  const key = env.TWOFACTOR_API_KEY;
  async function call(parts) {
    if (!key) throw new OtpUnavailable('OTP provider is not configured');
    try {
      const response = await request(`https://2factor.in/API/V1/${encodeURIComponent(key)}/SMS/${parts.map(encodeURIComponent).join('/')}`, {
        signal: AbortSignal.timeout(10000), redirect: 'error', headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      if (response.status >= 500 || response.status === 429) throw new Error();
      return { ok: response.ok, data };
    } catch { throw new OtpUnavailable('OTP provider is temporarily unavailable'); }
  }
  return {
    async send(phone) {
      const parts = [phone, 'AUTOGEN'];
      if (env.TWOFACTOR_TEMPLATE) parts.push(env.TWOFACTOR_TEMPLATE);
      const { ok, data } = await call(parts);
      if (!ok || data.Status !== 'Success' || typeof data.Details !== 'string' || !data.Details) throw new OtpUnavailable('OTP delivery could not be started');
      return data.Details;
    },
    async verify(session, code) {
      const { ok, data } = await call(['VERIFY', session, code]);
      return ok && data.Status === 'Success' && typeof data.Details === 'string' && /matched|validated/i.test(data.Details);
    },
  };
}
