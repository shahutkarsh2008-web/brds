// One backend instance owns live presence. Database records survive restarts.
export function createLiveHub(engine, auth, {now=Date.now}={}) {
  const clients=new Set(),seen=new Map();
  let timer,closed=false,running=Promise.resolve();
  const presence=id=>({connected:[...clients].some(ws=>ws.user.id===id&&ws.readyState===1),lastSeen:seen.get(id)||null});
  const snapshot=()=>engine.roster(presence);
  async function broadcast(){
    const current=[...clients].filter(ws=>ws.readyState===1);
    if(!current.length)return;
    const teachers=[];
    for(const ws of current){
      const user=await auth.session(ws.request);
      if(!user){ws.close(4001,'Session expired');continue;}
      if(['teacher','admin'].includes(user.role))teachers.push(ws);
      else ws.send(JSON.stringify({type:'attempt_changed',serverNow:now()}));
    }
    if(teachers.length){
      const payload=JSON.stringify(await snapshot());
      for(const ws of teachers)if(ws.readyState===1)ws.send(payload);
    }
  }
  function changed(){
    if(closed||timer)return;
    timer=setTimeout(()=>{timer=null;running=running.then(broadcast).catch(()=>console.error('Live update failed'));},20);
  }
  function add(ws,user){
    ws.user=user;clients.add(ws);seen.set(user.id,now());changed();
    ws.on('close',()=>{clients.delete(ws);seen.set(user.id,now());changed();});
    ws.on('pong',()=>seen.set(user.id,now()));
  }
  async function close(){closed=true;clearTimeout(timer);await running;}
  return {add,changed,snapshot,close};
}
