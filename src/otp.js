import {randomInt,randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
export class OtpUnavailable extends Error {}
const PREFIX='brds-otp-v1:';
export function createOtpProvider(env=process.env,request=fetch){
  const key=env.TWOFACTOR_API_KEY?.trim();
  function configured(){if(!key)throw new OtpUnavailable('OTP provider is not configured');}
  const fingerprint=(salt,code)=>createHmac('sha256',key).update('brds-login-otp:'+salt+':'+code).digest('hex');
  async function call(parts){
    configured();
    try{
      const response=await request('https://2factor.in/API/V1/'+encodeURIComponent(key)+'/SMS/'+parts.map(encodeURIComponent).join('/'),{
        method:'POST',signal:AbortSignal.timeout(10000),redirect:'error',cache:'no-store',headers:{Accept:'application/json'}
      });
      const data=await response.json();
      if(response.status>=500||response.status===429)throw new OtpUnavailable('OTP provider is temporarily unavailable');
      return {ok:response.ok,data};
    }catch{
      // Provider URLs contain credentials and OTPs: never log transport errors or raw responses.
      throw new OtpUnavailable('OTP provider is temporarily unavailable');
    }
  }
  return {
    async send(phone){
      configured();
      const code=String(randomInt(0,1000000)).padStart(6,'0');
      const salt=randomBytes(32).toString('hex');
      const parts=[phone,code];
      if(env.TWOFACTOR_TEMPLATE?.trim())parts.push(env.TWOFACTOR_TEMPLATE.trim());
      const {ok,data}=await call(parts);
      if(!ok||data?.Status!=='Success'||typeof data.Details!=='string'||!data.Details.trim())throw new OtpUnavailable('OTP delivery could not be started');
      // Store only a keyed verifier. Provider session lookup is not needed to verify the sent code.
      // auth.js owns challenge expiry, attempt limits, browser binding and atomic one-time consumption.
      return PREFIX+JSON.stringify({salt,verifier:fingerprint(salt,code)});
    },
    async verify(session,code){
      configured();
      if(typeof session!=='string'||!session.startsWith(PREFIX)){
        // Challenges created before this deployment require a fresh login/SMS.
        throw new OtpUnavailable('OTP challenge uses an older verification format. Request a new code.');
      }
      let saved;try{saved=JSON.parse(session.slice(PREFIX.length));}catch{throw new OtpUnavailable('Invalid OTP challenge format');}
      if(!/^[a-f0-9]{64}$/.test(saved?.salt||'')||!/^[a-f0-9]{64}$/.test(saved?.verifier||''))throw new OtpUnavailable('Invalid OTP challenge format');
      if(typeof code!=='string'||!/^\d{6}$/.test(code))return false;
      return timingSafeEqual(Buffer.from(saved.verifier,'hex'),Buffer.from(fingerprint(saved.salt,code),'hex'));
    }
  };
}
