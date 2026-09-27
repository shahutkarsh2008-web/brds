const $ = selector => document.querySelector(selector);
const role = location.pathname.slice(1);
let data, receivedAt, filter = '', search = '';
async function api(path, body) {
  const response = await fetch(path, body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {});
  const result = await response.json(); if(!response.ok)throw new Error(result.error || 'Unable to load workspace.'); return result;
}
function element(tag, text, className) { const node=document.createElement(tag); if(text!==undefined)node.textContent=text; if(className)node.className=className;return node; }
function duration(seconds) { seconds=Math.max(0,Math.ceil(seconds));return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'); }
const panel=element('section',undefined,'phase-workspace');$('#role-content').after(panel);
async function student() {
  $('#intro').textContent='Choose an assigned test. Your saved attempt will be here when you return.';
  $('#role-content').hidden=true;
  const {exams}=await api('/api/exams');panel.replaceChildren();
  const heading=element('div',undefined,'workspace-heading');heading.append(element('h2','Your exams'),element('span',exams.length+' assigned','muted'));panel.append(heading);
  if(!exams.length){panel.append(element('p','No tests assigned yet. Your teacher will let you know when one is available.','empty-state'));return;}
  const grid=element('div',undefined,'exam-grid');
  for(const exam of exams){
    const card=element('article',undefined,'exam-card');
    card.append(element('span',exam.status==='available'?'READY TO START':exam.status==='active'?'IN PROGRESS':'SUBMITTED','pill'),element('h2',exam.title),
      element('p',exam.totalQuestions+' questions · '+Math.round(exam.durationSeconds/60)+' minutes · '+exam.maxMarks+' marks','muted'));
    if(exam.instructions)card.append(element('p',exam.instructions,'exam-instructions'));
    if(exam.result)card.append(element('p','Score: '+exam.result.score+' / '+exam.result.maxMarks,'score-line'));
    const button=element('button',exam.status==='available'?'Start exam →':exam.status==='active'?'Resume attempt →':'View result →');
    button.addEventListener('click',async()=>{button.disabled=true;try{const attempt=exam.attemptId?{id:exam.attemptId}:await api('/api/exams/'+exam.id+'/start',{});location.assign('/exam?id='+encodeURIComponent(attempt.id));}catch(error){$('#message').textContent=error.message;button.disabled=false;}});
    card.append(button);grid.append(card);
  }panel.append(grid);
}
function monitorShell() {
  $('#intro').textContent='A live view of your students. Changes arrive automatically.';
  $('#role-content').hidden=true;
  panel.innerHTML='<div class="workspace-heading"><div><p class="eyebrow">LIVE INVIGILATION</p><h2>Classroom overview</h2></div><span class="read-only">Read-only monitoring</span></div><div id="metrics" class="metrics"></div><div class="roster-filters"><label>Exam<select id="exam-filter"><option value="">All exams</option></select></label><label>Find a student<input id="student-search" placeholder="Name or login ID" autocomplete="off"></label></div><div class="table-scroll"><table class="roster"><thead><tr><th>Student</th><th>Connection</th><th>Exam / status</th><th>Progress</th><th>Time left</th><th>Flags</th></tr></thead><tbody id="roster-body"></tbody></table></div><p id="roster-note" class="field-note"></p><section class="activity-panel"><h2>Activity to review</h2><p class="field-note">Browser signals may be incomplete and need human review. They do not identify which external app a student uses.</p><ol id="activity-feed"></ol></section>';
  $('#exam-filter').addEventListener('change',event=>{filter=event.target.value;renderRoster();});
  $('#student-search').addEventListener('input',event=>{search=event.target.value.toLowerCase();renderRoster();});
}
function renderRoster() {
  if(!data||!$('#roster-body'))return;
  const exams=new Map();for(const student of data.students)for(const attempt of student.attempts)exams.set(attempt.examId,attempt.title);
  const select=$('#exam-filter');select.replaceChildren(new Option('All exams',''),...[...exams].map(([id,title])=>new Option(title,id)));select.value=filter;
  const students=data.students.filter(s=>(s.name+' '+s.loginId).toLowerCase().includes(search)&&(!filter||s.attempts.some(a=>a.examId===filter)));
  const attempts=students.flatMap(s=>s.attempts.filter(a=>!filter||a.examId===filter));
  $('#metrics').replaceChildren(...[['Connected',students.filter(s=>s.connected).length],['Taking an exam',attempts.filter(a=>a.status==='active').length],['Submitted',attempts.filter(a=>a.status==='submitted').length],['Activity flags',attempts.reduce((n,a)=>n+a.flagCount,0)]].map(([label,count])=>{
    const item=element('article');item.append(element('span',label),element('strong',String(count)));return item;
  }));
  const rows=[];
  for(const student of students){
    const exams=student.attempts.filter(a=>!filter||a.examId===filter);
    for(const attempt of exams.length?exams:[null]){
      const row=element('tr'),name=element('td');name.append(element('strong',student.name),element('small',student.loginId));row.append(name);
      row.append(element('td',student.connected?'● Online':'○ Offline',student.connected?'online':'offline'));
      const exam=element('td');exam.append(element('span',attempt?.title||'No attempt started'),element('small',attempt?.status||'Signed in'));row.append(exam);
      row.append(element('td',attempt?attempt.answered+' / '+attempt.total+' answered':'—'));
      const time=element('td',attempt?.status==='active'?'…':'—','time-cell');if(attempt?.status==='active')time.dataset.deadline=attempt.deadline;row.append(time);
      row.append(element('td',String(attempt?.flagCount||0),(attempt?.flagCount||0)>0?'flag-count':''));rows.push(row);
    }
  }
  $('#roster-body').replaceChildren(...rows);
  $('#roster-note').textContent=students.length?students.length+' students shown · Connection status reflects open application connections.':'No matching students are signed in or have attempts yet.';
  const ids=new Set(attempts.map(a=>a.id));
  const names={tab_hidden:'Page hidden / tab switched',window_blur:'Exam window lost focus',fullscreen_exit:'Exited fullscreen'};
  $('#activity-feed').replaceChildren(...data.flags.filter(f=>!filter||ids.has(f.attemptId)).slice(0,30).map(flag=>{
    const item=element('li');item.append(element('strong',flag.name+' ('+flag.loginId+')'),element('span',names[flag.type]||flag.type),element('time',new Date(flag.at).toLocaleTimeString()));return item;
  }));
  updateTimers();
}
function updateTimers(){if(!data)return;const time=data.serverNow+(performance.now()-receivedAt);document.querySelectorAll('[data-deadline]').forEach(node=>{node.textContent=duration((Number(node.dataset.deadline)-time)/1000);});}
let started=false;
async function start(){
  if(started)return;started=true;
  try{
    if(role==='student')await student();
    else if(role==='teacher'){monitorShell();data=await api('/api/monitor');receivedAt=performance.now();renderRoster();}
    else if(role==='admin'){const link=element('a','Open live teacher dashboard →','monitor-link');link.href='/teacher';panel.append(link);}
  }catch(error){$('#message').textContent=error.message;started=false;}
}
window.addEventListener('brds-user',start);
window.addEventListener('brds-live',event=>{
  if(role==='teacher'&&event.detail.type==='roster'){data=event.detail;receivedAt=performance.now();renderRoster();}
});
setInterval(updateTimers,1000);
if(window.brdsUser)start();
