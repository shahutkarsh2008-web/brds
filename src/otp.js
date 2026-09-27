export class OtpUnavailable extends Error {}
export function createOtpProvider(env = process.env, request = fetch) {
  // No fixed OTP or bypass mode. Only tests inject a replacement provider.
  const key = env.TWOFACTOR_API_KEY;
  async function call(parts) {
    if (!key) {
      console.error('[OTP CONFIG ERROR] TWOFACTOR_API_KEY is missing or empty');
      throw new OtpUnavailable('OTP provider is not configured');
    }
    try {
      const url = `https://2factor.in/API/V1/${encodeURIComponent(key)}/SMS/${parts.map(encodeURIComponent).join('/')}`;
      const response = await request(url, {
        signal: AbortSignal.timeout(10000), redirect: 'error', headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      if (response.status >= 500 || response.status === 429) {
        console.error('[OTP API HTTP ERROR]', { status: response.status, data });
        throw new Error();
      }
      return { ok: response.ok, data };
    } catch (err) {
      if (err instanceof OtpUnavailable) throw err;
      console.error('[OTP API REQUEST FAILED]', err.message || err);
      throw new OtpUnavailable('OTP provider is temporarily unavailable');
    }
  }
  return {
    async send(phone) {
      const parts = [phone, 'AUTOGEN'];
      if (env.TWOFACTOR_TEMPLATE) parts.push(env.TWOFACTOR_TEMPLATE);
      const { ok, data } = await call(parts);
      if (!ok || data?.Status !== 'Success' || typeof data?.Details !== 'string' || !data?.Details) {
        console.error('[OTP SEND REJECTED]', { ok, status: data?.Status, details: data?.Details });
        throw new OtpUnavailable('OTP delivery could not be started');
      }
      return data.Details;
    },
    async verify(session, code, phone) {
      const isPhone = typeof phone === 'string' && /^91[6-9]\d{9}$/.test(phone);
      const action = isPhone ? 'VERIFY3' : 'VERIFY';
      const target = isPhone ? phone : session;

      let res = await call([action, target, code]);
      const checkValid = r => r.ok && r.data?.Status === 'Success' && typeof r.data?.Details === 'string' && r.data.Details !== 'unexpected' && !/mismatch|expired|invalid/i.test(r.data.Details);
      let isValid = checkValid(res);

      if (!isValid && isPhone && session && session !== phone) {
        const fallbackRes = await call(['VERIFY', session, code]);
        if (checkValid(fallbackRes)) {
          isValid = true;
        }
      }

      if (!isValid) {
        console.warn('[OTP VERIFY REJECTED BY 2FACTOR]', { ok: res.ok, status: res.data?.Status, details: res.data?.Details });
      }
      return isValid;
    },
  };
}
