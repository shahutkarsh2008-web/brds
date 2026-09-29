const $=selector=>document.querySelector(selector);
const id=new URLSearchParams(location.search).get('id');
let state,answers={},index=0,queue=[],flags=[],storageKey,storageOk=true,conflict=false,saving=false,refreshing=false,clockBase=0,clockAt=0,socket,retry,closed=false,expiredFetch=false,invalidNumeric=false;
const answered=value=>value!==null&&value!==undefined&&value!==''&&(!Array.isArray(value)||value.length>0);
const text=(selector,value)=>{$(selector).textContent=value;};
async function request(path,body,keepalive=false){
  const response=await fetch(path,{...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive}),signal:AbortSignal.timeout(12000)});
  const value=await response.json();
  if(response.status===401){location.replace('/login');throw new Error('Please sign in again.');}
  if(!response.ok){const error=new Error(value.error||'Unable to save.');error.status=response.status;error.code=value.code;throw error;}
  return value;
}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify({updates:queue,flags}));storageOk=true;}catch{storageOk=false;}}
function merged(){answers=structuredClone(state.answers);for(const update of queue)answers[update.questionId]={value:update.value,review:update.review,visited:true};}
function serverTime(){return state?.pausedAt??(clockBase+(performance.now()-clockAt));}
function takeState(next){if(state&&next.version<state.version)return;state=next;clockBase=next.serverNow;clockAt=performance.now();merged();}
function saveStatus(){
  if(invalidNumeric){text('#save-status','Numeric entry incomplete — enter a valid number to save it.');$('#save-status').classList.add('pending');return;}
  const pending=queue.length+flags.length;
  $('#save-status').classList.toggle('pending',pending>0||conflict||!navigator.onLine);
  text('#save-status',conflict?'Editing paused — review the message below.':pending?pending+' pending change(s) · '+(navigator.onLine?'Saving / retrying…':'Offline; will retry when connected.')+(!storageOk?' Local backup unavailable; keep this tab open.':''):state?.status==='submitted'?'Submission recorded.':socket?.readyState===1?'All changes saved · Live connection active':'All changes saved · Live connection reconnecting');
}
const controlNotice=document.createElement('p');controlNotice.id='control-notice';controlNotice.setAttribute('role','status');$('#save-status').after(controlNotice);
function acceptView(next){const before=state?.pausedAt;takeState(next);controlNotice.textContent=state.status==='active'&&state.pausedAt!==null?'Your teacher has frozen this attempt. Your timer is paused. Wait for permission to resume.':'';saveStatus();if(state.status==='submitted')renderResult();else if(before!==state.pausedAt){if(state.pausedAt!==null)$('#submit-dialog').close();if(queue.length){conflict=true;$('#reload-saved').hidden=false;text('#error','Teacher controls changed this attempt. Pending edits remain on this device; reload the saved version before continuing.');}renderQuestion(false);}}
function enqueue(value,review){
  if(conflict||state.pausedAt!==null||state.status!=='active')return;
  const q=state.exam.questions[index];
  queue.push({mutationId:crypto.randomUUID(),questionId:q.id,value,review,expectedVersion:state.version+queue.length});
  persist();merged();renderPalette();saveStatus();flush();
}
async function flush(){
  if(saving||conflict||closed||state?.pausedAt!==null||state?.status!=='active')return;
  saving=true;
  try{
    while(queue.length&&state.status==='active'&&state.pausedAt===null){
      const update=queue[0];
      const next=await request('/api/attempts/'+id+'/answers',update);
      queue.shift();persist();acceptView(next);
    }
    while(flags.length){await request('/api/attempts/'+id+'/flags',flags[0],true);flags.shift();persist();}
    saveStatus();
  }catch(error){
    if(error.status&&error.status!==503&&error.status!==500){
      conflict=true;$('#reload-saved').hidden=false;
      text('#error',error.message+' Pending edits remain on this device. Discard them only when you are ready to use the saved server version.');
      await refresh(false);
    }else{text('#error','Connection interrupted. Pending edits remain on this device; keep this page open or return to this attempt to retry.');}
    saveStatus();
  }finally{saving=false;if(!conflict&&(queue.length||flags.length)&&!closed){clearTimeout(retry);retry=setTimeout(flush,2500);}}
}
let refreshAgain=false;
async function refresh(render=true){
  if(refreshing){refreshAgain=true;return;}refreshing=true;
  try{const next=await request('/api/attempts/'+id);acceptView(next);if(render&&state.status==='active'&&!queue.length&&!invalidNumeric)renderQuestion(false);}
  catch(error){text('#error',error.message);}
  finally{refreshing=false;if(refreshAgain&&!closed){refreshAgain=false;await refresh();}}
}
function activeSection(){
  if(!state.exam.sections[0].durationSeconds)return null;
  let deadline=state.clockStartedAt??state.startedAt;
  for(const section of state.exam.sections){deadline+=section.durationSeconds*1000;if(serverTime()<deadline)return{id:section.id,deadline};}
  return null;
}
function available(q){const current=activeSection();return !state.exam.sections[0].durationSeconds||current?.id===q.sectionId;}
function guardNumeric(){const input=$('#numeric-answer');if(input&&!input.checkValidity()){input.reportValidity();return false;}return !invalidNumeric;}
function go(next){
  if(!guardNumeric()||conflict||state.pausedAt!==null||state.status!=='active')return;
  if(next<0||next>=state.exam.questions.length||!available(state.exam.questions[next]))return;
  index=next;renderQuestion(true);
}
function node(tag,content,className){const n=document.createElement(tag);if(content!==undefined)n.textContent=content;if(className)n.className=className;return n;}
function renderSections(){
  $('#sections').replaceChildren(...state.exam.sections.map(section=>{
    const button=node('button',section.title,state.exam.questions[index].sectionId===section.id?'selected':'');
    button.disabled=conflict||(!available({sectionId:section.id}));
    button.addEventListener('click',()=>go(state.exam.questions.findIndex(q=>q.sectionId===section.id)));return button;
  }));
}
function renderPalette(){
  let count=0;
  $('#palette').replaceChildren(...state.exam.questions.map((q,i)=>{
    const a=answers[q.id];const has=answered(a?.value);if(has)count++;
    const status=a?.review?'review':has?'answered':a?.visited?'unanswered':'unvisited';
    const button=node('button',String(i+1),'palette-button '+status+(a?.review&&has?' answered-review':'')+(i===index?' current':''));
    button.setAttribute('aria-label','Question '+(i+1)+', '+status+(a?.review&&has?', answered':''));
    if(i===index)button.setAttribute('aria-current','true');
    button.disabled=conflict||!available(q);button.addEventListener('click',()=>go(i));return button;
  }));
  text('#progress',count+' of '+state.exam.questions.length+' answered');
}
function renderQuestion(visit){
  if(state.status!=='active')return renderResult();
  const current=activeSection();
  if(state.exam.sections[0].durationSeconds&&current&&!available(state.exam.questions[index]))index=state.exam.questions.findIndex(q=>q.sectionId===current.id);
  const q=state.exam.questions[index];
  $('#exam-content').hidden=false;
  text('#exam-title',state.exam.title);text('#question-number','QUESTION '+(index+1)+' OF '+state.exam.questions.length);
  text('#question-type',q.type==='MSQ'?'MULTIPLE SELECT':q.type==='NAT'?'NUMERIC ANSWER':'SINGLE CHOICE');
  text('#prompt',q.prompt);text('#marks','Correct +'+q.marks.correct+' · Incorrect '+q.marks.incorrect+' · Unanswered '+q.marks.unanswered+(q.type==='MSQ'?(q.partialCredit?' · Partial credit for correct subsets; see instructions':' · Exact match required'):''));
  const image=$('#question-image');image.hidden=!q.image;if(q.image){image.src=q.image;image.alt=q.imageAlt;}else image.removeAttribute('src');
  const a=answers[q.id]||{value:null,review:false};const inputs=$('#answer-input');inputs.replaceChildren();invalidNumeric=false;
  if(q.type==='NAT'){
    const label=node('label','Enter your numeric answer','nat-label');label.htmlFor='numeric-answer';
    const input=node('input');input.id='numeric-answer';input.className='nat-input';input.type='text';input.inputMode='decimal';input.maxLength=40;input.autocomplete='off';input.value=a.value??'';
    input.addEventListener('input',()=>{
      const value=input.value.trim();const valid=value===''||(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)&&Number.isFinite(Number(value)));
      invalidNumeric=!valid;input.setCustomValidity(valid?'':'Enter a decimal number, or clear the answer.');
      if(valid)enqueue(value===''?null:value,!!answers[q.id]?.review);
      else{text('#save-status','Numeric entry incomplete — enter a valid number to save it.');}
    });inputs.append(label,input);
  }else for(const option of q.options){
    const label=node('label',undefined,'option'),input=node('input');input.type=q.type==='MSQ'?'checkbox':'radio';input.name=q.id;input.value=option.id;input.checked=q.type==='MSQ'?(a.value||[]).includes(option.id):a.value===option.id;
    input.addEventListener('change',()=>{
      const value=q.type==='MSQ'?[...inputs.querySelectorAll('input:checked')].map(input=>input.value):option.id;
      enqueue(value,!!answers[q.id]?.review);
    });label.append(input,node('span',option.text));inputs.append(label);
  }
  inputs.querySelectorAll('input').forEach(input=>{input.disabled=conflict||state.pausedAt!==null;});
  text('#review',a.review?'Remove review mark':'Mark for review');
  $('#clear').disabled=conflict||state.pausedAt!==null;$('#review').disabled=conflict||state.pausedAt!==null;$('#submit').disabled=conflict||state.pausedAt!==null;
  $('#previous').disabled=conflict||index===0||!available(state.exam.questions[index-1]);
  $('#next').disabled=conflict||index===state.exam.questions.length-1||!available(state.exam.questions[index+1]);
  renderSections();renderPalette();
  if(visit&&!a.visited)enqueue(a.value??null,!!a.review);
}
function renderResult(){
  $('#exam-content').hidden=true;$('#submit-dialog').close();$('#result').hidden=false;
  $('#fullscreen').hidden=true;text('#exam-title',state.exam.title);text('#timer','00:00');$('#section-clock').hidden=true;
  text('#score',String(state.result.score));text('#max-score','/ '+state.result.maxMarks+' marks');
  text('#submission-reason',state.result.reason==='teacher_locked'?'Your teacher locked and submitted this attempt. It cannot be resumed.':state.result.reason==='teacher_submitted'?'Your teacher submitted this attempt.':state.result.reason==='time_expired'?'Time expired. Your last server-saved answers were submitted automatically.':'Your submission has been recorded.');
  $('#result-sections').replaceChildren(...state.result.sections.map(section=>{const tr=node('tr');for(const v of [section.title,section.correct,section.partial||0,section.incorrect,section.unanswered,section.score+' / '+section.maxMarks])tr.append(node('td',String(v)));return tr;}));
  $('#question-review').replaceChildren(...(state.result.questions||[]).map((item,i)=>{
    const q=state.exam.questions.find(q=>q.id===item.id);
    if(!q)return node('p','Question unavailable');
    const card=node('details');card.className='question-review '+item.outcome;
    const labels={correct:'Correct',incorrect:'Incorrect',partial:'Partially correct',unanswered:'Unanswered'};
    card.append(node('summary','Q'+(i+1)+' · '+labels[item.outcome]+' · '+item.marks+' / '+item.maxMarks+' marks'));
    const prompt=node('p',q.prompt);prompt.className='review-prompt';card.append(prompt);
    if(q.image){const image=node('img');image.src=q.image;image.alt=q.imageAlt;image.loading='lazy';card.append(image);}
    const format=value=>{
      if(!answered(value))return 'Not answered';
      if(q.type==='NAT')return typeof value==='object'?(value.min===value.max?String(value.min):value.min+' to '+value.max+' (inclusive)'):String(value);
      return (Array.isArray(value)?value:[value]).map(id=>{const option=q.options.find(o=>o.id===id);return id.toUpperCase()+(option?' — '+option.text:'');}).join('; ');
    };
    card.append(node('p','Your answer: '+format(item.selectedAnswer)));
    card.append(node('p','Correct answer: '+[item.correctAnswer,...(item.answerAlternatives||[])].map(format).join(' OR ')));
    return card;
  }));
  if(queue.length){text('#error','This exam is submitted. '+queue.length+' pending edit(s) on this device were not included.');}
  else if(storageKey){try{localStorage.removeItem(storageKey);}catch{}}
  saveStatus();
}
function format(ms){const seconds=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
let lastSection;
function tick(){
  if(!state||state.status!=='active')return;
  text('#timer',format(state.deadline-serverTime()));$('#timer').classList.toggle('expired',state.deadline-serverTime()<60000);
  const section=activeSection();$('#section-clock').hidden=!section;if(section)text('#section-timer',format(section.deadline-serverTime()));
  if(section?.id!==lastSection){lastSection=section?.id;if(section){invalidNumeric=false;renderQuestion(true);}}
  if(serverTime()>=state.deadline&&!expiredFetch){
    expiredFetch=true;$('#answer-input').querySelectorAll('input').forEach(input=>input.disabled=true);
    text('#save-status','Time is up. Confirming your automatic submission…');
    refresh().finally(()=>{if(state.status==='active')setTimeout(()=>{expiredFetch=false;},2000);});
  }
}
function connect(){
  if(closed)return;
  socket=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/session-ws');
  socket.onopen=()=>{saveStatus();flush();if(!queue.length)refresh();};
  socket.onmessage=event=>{try{const message=JSON.parse(event.data);if(message.type==='attempt_changed')refresh();}catch{}};
  socket.onclose=event=>{saveStatus();if(closed)return;if(event.code===4001){location.replace('/login');return;}setTimeout(connect,2500);};
  socket.onerror=()=>saveStatus();
}
const flagTimes={};
function recordFlag(type){
  if(!state||state.status!=='active'||serverTime()>=state.deadline)return;
  const time=performance.now();if(flagTimes[type]&&time-flagTimes[type]<1500)return;flagTimes[type]=time;
  flags.push({eventId:crypto.randomUUID(),type});persist();flush();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)recordFlag('tab_hidden');else{flush();refresh();}});
window.addEventListener('blur',()=>recordFlag('window_blur'));
let wasFullscreen=false;
document.addEventListener('fullscreenchange',()=>{if(wasFullscreen&&!document.fullscreenElement)recordFlag('fullscreen_exit');wasFullscreen=!!document.fullscreenElement;text('#fullscreen',wasFullscreen?'Exit fullscreen':'Enter fullscreen');});
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else text('#error','Fullscreen is not available in this browser. You can continue your exam.');}catch{text('#error','Fullscreen could not be enabled. You can continue your exam.');}});
$('#previous').addEventListener('click',()=>go(index-1));$('#next').addEventListener('click',()=>go(index+1));
$('#clear').addEventListener('click',()=>{invalidNumeric=false;enqueue(null,!!answers[state.exam.questions[index].id]?.review);renderQuestion(false);});
$('#review').addEventListener('click',()=>{if(!guardNumeric())return;const a=answers[state.exam.questions[index].id]||{};enqueue(a.value??null,!a.review);renderQuestion(false);});
$('#submit').addEventListener('click',async()=>{
  if(!guardNumeric()||conflict||state.pausedAt!==null||state.status!=='active')return;
  await flush();if(queue.length||saving){text('#error','Wait until every answer is saved before submitting.');return;}
  const count=state.exam.questions.filter(q=>answered(answers[q.id]?.value)).length;
  text('#submit-summary',count+' answered · '+(state.exam.questions.length-count)+' unanswered.');$('#submit-dialog').showModal();
});
$('#cancel-submit').addEventListener('click',()=>$('#submit-dialog').close());
$('#confirm-submit').addEventListener('click',async()=>{
  $('#confirm-submit').disabled=true;
  try{const next=await request('/api/attempts/'+id+'/submit',{expectedVersion:state.version});acceptView(next);}
  catch(error){text('#error',error.message);$('#submit-dialog').close();await refresh();}
  finally{$('#confirm-submit').disabled=false;}
});
$('#reload-saved').addEventListener('click',async()=>{
  queue=[];flags=[];persist();conflict=false;invalidNumeric=false;$('#reload-saved').hidden=true;text('#error','');await refresh();if(state.status==='active')renderQuestion(true);
});
window.addEventListener('online',()=>{text('#error','');flush();if(!queue.length)refresh();});
window.addEventListener('offline',saveStatus);
window.addEventListener('storage',event=>{if(storageKey&&event.key===storageKey&&state?.status==='active'){conflict=true;$('#reload-saved').hidden=false;text('#error','This attempt is open in another tab. Keep one tab open, then reload its saved version.');saveStatus();renderQuestion(false);}});
window.addEventListener('pagehide',()=>{closed=true;clearTimeout(retry);socket?.close();});
window.addEventListener('pageshow',event=>{if(event.persisted){closed=false;connect();refresh();}});
async function start(){
  if(!id)throw new Error('Choose an exam from your student workspace.');
  takeState(await request('/api/attempts/'+encodeURIComponent(id)));
  storageKey='brds-attempt:'+state.userId+':'+id;
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');queue=Array.isArray(saved.updates)?saved.updates:[];flags=Array.isArray(saved.flags)?saved.flags:[];}catch{storageOk=false;}
  merged();acceptView(state);renderQuestion(true);connect();saveStatus();tick();setInterval(tick,250);
}
start().catch(error=>{text('#error',error.message);text('#save-status','Unable to open this attempt. Return to your exams and try again.');});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !closed) {
    fetch('/api/me').then(r => r.json()).then(data => {
      if (!data.user) location.assign('/login');
    }).catch(() => {});
  }
});

window.addEventListener('error', event => {
  fetch('/api/log-client-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: window.location.pathname,
      message: event.message || 'Exam UI Script Error',
      stack: event.error?.stack || null
    })
  }).catch(() => {});
});
