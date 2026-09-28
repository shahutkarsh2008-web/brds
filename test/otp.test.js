import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOtpProvider,OtpUnavailable} from '../src/otp.js';
test('SMS sends the exact random code verified by its persisted challenge, without VERIFY calls',async()=>{
  const sent=[];
  const provider=createOtpProvider({TWOFACTOR_API_KEY:'test-key',TWOFACTOR_TEMPLATE:'BRDS OTP'},async(url,options)=>{
    const parts=new URL(url).pathname.split('/').map(decodeURIComponent);
    sent.push({parts,options});return new Response(JSON.stringify({Status:'Success',Details:'provider-session'}));
  });
  const challenge=await provider.send('919999999999'),code=sent[0].parts.at(-2);
  assert.match(code,/^\d{6}$/);assert.equal(sent[0].options.method,'POST');
  assert.equal(sent[0].parts.at(-1),'BRDS OTP');
  assert.equal(await provider.verify(challenge,code),true);
  const wrong=String((Number(code)+1)%1000000).padStart(6,'0');
  assert.equal(await provider.verify(challenge,wrong),false);
  assert.equal(sent.length,1);
  const restarted=createOtpProvider({TWOFACTOR_API_KEY:'test-key'},()=>{throw new Error('Verification must not call provider');});
  assert.equal(await restarted.verify(challenge,code),true);
  const tampered=JSON.parse(challenge.slice('brds-otp-v1:'.length));tampered.verifier='0'.repeat(64);
  assert.equal(await restarted.verify('brds-otp-v1:'+JSON.stringify(tampered),code),false);
});
test('OTP provider fails closed on malformed challenges and unexpected delivery replies',async()=>{
  const provider=createOtpProvider({TWOFACTOR_API_KEY:'test'},async()=>new Response(JSON.stringify({Status:'Error',Details:'Invalid API Key'}),{status:400}));
  await assert.rejects(provider.send('919999999999'),OtpUnavailable);
  await assert.rejects(provider.verify('old-provider-session','123456'),OtpUnavailable);
  await assert.rejects(provider.verify('brds-otp-v1:{}','123456'),OtpUnavailable);
});
