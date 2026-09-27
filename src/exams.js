import { randomUUID } from 'node:crypto';
import { HttpError } from './auth.js';

const fail = (status, message, code) => { const error = new HttpError(status, message); error.code = code; throw error; };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const idPattern = /^[a-zA-Z0-9_-]{1,80}$/;
export function validateExam(value) {
  if (!value || typeof value !== 'object' || !idPattern.test(value.id || '') || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 200) fail(400, 'Exam ID and title are required.');
  if (!Number.isInteger(value.durationSeconds) || value.durationSeconds < 1 || value.durationSeconds > 86400) fail(400, 'Duration must be 1–86400 seconds.');
  if (!Array.isArray(value.sections) || !value.sections.length || value.sections.length > 30) fail(400, 'Define 1–30 sections.');
  if (!Array.isArray(value.questions) || !value.questions.length || value.questions.length > 500) fail(400, 'Define 1–500 questions.');
  const sectionIds = new Set();
  for (const section of value.sections) {
    if (!idPattern.test(section.id || '') || sectionIds.has(section.id) || typeof section.title !== 'string' || !section.title.trim() || section.title.length > 100) fail(400, 'Section IDs must be unique and titles are required.');
    sectionIds.add(section.id);
  }
  const timed = value.sections.some(section => section.durationSeconds !== undefined);
  if (timed && (!value.sections.every(s => Number.isInteger(s.durationSeconds) && s.durationSeconds > 0) || value.sections.reduce((sum, s) => sum + s.durationSeconds, 0) !== value.durationSeconds)) fail(400, 'Timed sections must each specify a duration and sum to the exam duration.');
  const questionIds = new Set();
  for (const q of value.questions) {
    if (!idPattern.test(q.id || '') || questionIds.has(q.id) || !sectionIds.has(q.sectionId)) fail(400, 'Question IDs must be unique and reference a section.');
    questionIds.add(q.id);
    if (!['MCQ','MSQ','NAT'].includes(q.type) || typeof q.prompt !== 'string' || !q.prompt.trim() || q.prompt.length > 10000) fail(400, 'Question type and prompt are required.');
    if (q.image !== undefined && (!/^\/media\/[a-zA-Z0-9_-]+\.(svg|png|jpg|jpeg|webp)$/.test(q.image) || typeof q.imageAlt !== 'string' || !q.imageAlt.trim())) fail(400, 'Images require a local /media/ filename and alt text.');
    if (!q.marks || !finite(q.marks.correct) || q.marks.correct < 0 || !finite(q.marks.incorrect) || q.marks.incorrect > 0 || !finite(q.marks.unanswered) || q.marks.unanswered > 0) fail(400, 'Explicit correct, incorrect and unanswered marks are required.');
    if (q.type === 'NAT') {
      if (!q.answer || !finite(q.answer.min) || !finite(q.answer.max) || q.answer.min > q.answer.max) fail(400, 'NAT questions require an inclusive numeric answer range.');
    } else {
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 10) fail(400, 'Choice questions need 2–10 options.');
      const ids = new Set();
      for (const option of q.options) {
        if (!idPattern.test(option.id || '') || ids.has(option.id) || typeof option.text !== 'string' || !option.text.trim() || option.text.length > 2000) fail(400, 'Options require unique IDs and text.');
        ids.add(option.id);
      }
      if (q.type === 'MCQ' && !ids.has(q.answer)) fail(400, 'MCQ answer must reference an option.');
      if (q.type === 'MSQ' && (!Array.isArray(q.answer) || !q.answer.length || new Set(q.answer).size !== q.answer.length || !q.answer.every(id => ids.has(id)))) fail(400, 'MSQ answers must reference distinct options.');
    }
  }
  if (!value.sections.every(s => value.questions.some(q => q.sectionId === s.id))) fail(400, 'Every section needs a question.');
  const maximum = value.questions.reduce((sum, q) => sum + q.marks.correct, 0);
  if (value.totalQuestions !== value.questions.length || !finite(value.maxMarks) || Math.abs(value.maxMarks - maximum) > 0.000001) fail(400, 'Explicit question total and maximum marks must match the questions.');
  // Only supported fields are retained. Teacher metadata can never leak through student serialization.
  return { id: value.id, title: value.title.trim(), durationSeconds: value.durationSeconds, totalQuestions: value.totalQuestions, maxMarks: value.maxMarks,
    instructions: typeof value.instructions === 'string' ? value.instructions.slice(0,10000) : '',
    sections: value.sections.map(s => ({ id: s.id, title: s.title, ...(timed ? { durationSeconds: s.durationSeconds } : {}) })),
    questions: value.questions.map(q => ({ id:q.id, sectionId:q.sectionId, type:q.type, prompt:q.prompt,
      ...(q.image ? {image:q.image,imageAlt:q.imageAlt} : {}),
      ...(q.type !== 'NAT' ? {options:q.options.map(o=>({id:o.id,text:o.text}))} : {}),
      marks:{correct:q.marks.correct,incorrect:q.marks.incorrect,unanswered:q.marks.unanswered},answer:q.answer })) };
}
export async function importExam(database, input, userIds) {
  const exam = validateExam(input);
  if (!Array.isArray(userIds) || !userIds.length || new Set(userIds).size !== userIds.length) fail(400, 'Supply distinct assigned student IDs.');
  await database.transaction(async query => {
    for (const id of userIds) {
      const user = (await query("SELECT id FROM users WHERE id=$1 AND role='student' AND active=1", [id])).rows[0];
      if (!user) fail(400, 'Every assignment must be an active student.');
    }
    const saved = await query('INSERT INTO exams(id,title,definition,created_at) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING id', [exam.id,exam.title,JSON.stringify(exam),Date.now()]);
    if (!saved.rowCount) fail(409, 'Exam ID already exists. Import a new version under a new ID.');
    for (const userId of userIds) await query('INSERT INTO exam_assignments(exam_id,user_id) VALUES($1,$2)', [exam.id,userId]);
  });
  return exam.id;
}
export function currentSection(exam, startedAt, time) {
  if (!exam.sections[0].durationSeconds) return null;
  let deadline = Number(startedAt);
  for (const section of exam.sections) { deadline += section.durationSeconds * 1000; if (time < deadline) return { id:section.id, deadline }; }
  return null;
}
export function hasAnswer(value) { return value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0); }
function normalizeAnswer(question, value) {
  if (!hasAnswer(value)) return null;
  if (question.type === 'MCQ') {
    if (typeof value !== 'string' || !question.options.some(o => o.id === value)) fail(400, 'Choose a valid option.');
    return value;
  }
  if (question.type === 'MSQ') {
    if (!Array.isArray(value) || new Set(value).size !== value.length || !value.every(id => question.options.some(o => o.id === id))) fail(400, 'Choose distinct valid options.');
    return [...value].sort();
  }
  if (typeof value !== 'string' || value.length > 40 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()) || !Number.isFinite(Number(value))) fail(400, 'Enter a finite decimal number.');
  return value.trim();
}
function score(exam, answers) {
  const breakdown = exam.sections.map(s => ({ id:s.id,title:s.title,score:0,maxMarks:0,correct:0,incorrect:0,unanswered:0 }));
  const bySection = new Map(breakdown.map(s => [s.id,s]));
  for (const q of exam.questions) {
    const value = answers[q.id]?.value;
    const correct = q.type === 'NAT' ? Number(value) >= q.answer.min && Number(value) <= q.answer.max :
      q.type === 'MSQ' ? JSON.stringify([...(value || [])].sort()) === JSON.stringify([...q.answer].sort()) : value === q.answer;
    const outcome = !hasAnswer(value) ? 'unanswered' : correct ? 'correct' : 'incorrect';
    const section = bySection.get(q.sectionId); section[outcome]++; section.score += q.marks[outcome]; section.maxMarks += q.marks.correct;
  }
  for (const s of breakdown) s.score = Number(s.score.toFixed(6));
  return { score:Number(breakdown.reduce((n,s)=>n+s.score,0).toFixed(6)), maxMarks:exam.maxMarks, sections:breakdown };
}
function studentView(row, time) {
  const exam = JSON.parse(row.exam_json), answers = JSON.parse(row.answers_json);
  const pausedAt=row.paused_at==null?null:Number(row.paused_at), offset=Number(row.offset_ms||0);
  const activeSection = currentSection(exam, Number(row.started_at)+offset, pausedAt??time);
  return { id:row.id, userId:row.user_id, examId:row.exam_id, status:row.status, version:row.version,
    startedAt:Number(row.started_at), clockStartedAt:Number(row.started_at)+offset, pausedAt, locked:!!row.locked, deadline:Number(row.deadline), serverNow:time, activeSection,
    submittedAt:row.submitted_at === null ? null : Number(row.submitted_at),
    exam:{...exam,questions:exam.questions.map(({answer,...question})=>question)}, answers,
    result:row.result_json ? JSON.parse(row.result_json) : null };
}
export function createExamEngine(database, { now=Date.now, changed=()=>{} }={}) {
  const lockSuffix = database.kind === 'postgres' ? ' FOR UPDATE' : '';
  const notify = userId => { try { changed(userId); } catch {} };
  async function finish(query, row, reason, time) {
    if (row.status !== 'active') return row;
    row.status = 'submitted'; row.submitted_at = reason === 'time_expired' ? Number(row.deadline) : time; row.version++;
    row.result_json = JSON.stringify({...score(JSON.parse(row.exam_json),JSON.parse(row.answers_json)),reason});
    await query('UPDATE attempts SET status=$1,submitted_at=$2,result_json=$3,version=$4 WHERE id=$5', [row.status,row.submitted_at,row.result_json,row.version,row.id]);
    return row;
  }
  async function controlState(query,row){const control=(await query('SELECT * FROM attempt_controls WHERE attempt_id=$1',[row.id])).rows[0];return Object.assign(row,{paused_at:null,offset_ms:0,locked:0},control||{});}
  async function owned(query,id,userId) {
    const row=(await query('SELECT * FROM attempts WHERE id=$1 AND user_id=$2'+lockSuffix,[id,userId])).rows[0];
    if (!row) fail(404,'Attempt not found.');
    return controlState(query,row);
  }
  async function list(userId) {
    await sweep();
    const rows=(await database.query('SELECT e.id,e.definition,a.id AS attempt_id,a.status,a.result_json FROM exams e JOIN exam_assignments x ON x.exam_id=e.id LEFT JOIN attempts a ON a.exam_id=e.id AND a.user_id=x.user_id WHERE x.user_id=$1 ORDER BY e.created_at DESC',[userId])).rows;
    return rows.map(row=>{const exam=JSON.parse(row.definition);return {id:row.id,title:exam.title,durationSeconds:exam.durationSeconds,totalQuestions:exam.totalQuestions,maxMarks:exam.maxMarks,instructions:exam.instructions,attemptId:row.attempt_id,status:row.status||'available',result:row.result_json?JSON.parse(row.result_json):null};});
  }
  async function start(examId,userId) {
    const view=await database.transaction(async query=>{
      const exam=(await query('SELECT e.definition FROM exams e JOIN exam_assignments x ON x.exam_id=e.id WHERE e.id=$1 AND x.user_id=$2',[examId,userId])).rows[0];
      if(!exam) fail(404,'Assigned exam not found.');
      const definition=JSON.parse(exam.definition), time=now();
      await query("INSERT INTO attempts(id,exam_id,user_id,exam_json,answers_json,status,started_at,deadline,version) VALUES($1,$2,$3,$4,'{}','active',$5,$6,0) ON CONFLICT(exam_id,user_id) DO NOTHING",
        [randomUUID(),examId,userId,exam.definition,time,time+definition.durationSeconds*1000]);
      const row=(await query('SELECT * FROM attempts WHERE exam_id=$1 AND user_id=$2'+lockSuffix,[examId,userId])).rows[0];
      await controlState(query,row);
      if(row.status==='active'&&row.paused_at==null&&Number(row.deadline)<=now()) await finish(query,row,'time_expired',now());
      return studentView(row,now());
    }); notify(view.userId);return view;
  }
  async function get(id,userId) {
    let expired=false;
    const view=await database.transaction(async query=>{
      const row=await owned(query,id,userId);
      if(row.status==='active'&&row.paused_at==null&&Number(row.deadline)<=now()){await finish(query,row,'time_expired',now());expired=true;}
      return studentView(row,now());
    }); if(expired)notify(userId); return view;
  }
  async function answer(id,userId,input) {
    if(!input||!idPattern.test(input.mutationId||'')||!Number.isInteger(input.expectedVersion)||input.expectedVersion<0||typeof input.review!=='boolean')fail(400,'Invalid answer update.');
    // Persist expiry before rejecting an answer, rather than rolling it back with the rejection.
    await get(id,userId);
    const view=await database.transaction(async query=>{
      const row=await owned(query,id,userId);
      const duplicate=(await query('SELECT id FROM answer_mutations WHERE attempt_id=$1 AND id=$2',[id,input.mutationId])).rows[0];
      if(duplicate)return studentView(row,now());
      if(row.paused_at!=null)fail(409,'Your teacher has paused this attempt.','ATTEMPT_PAUSED');
      if(row.status!=='active'||Number(row.deadline)<=now())fail(409,'The exam has ended. This edit was not saved.','EXAM_ENDED');
      if(row.version!==input.expectedVersion)fail(409,'This attempt changed in another tab. Reload the saved version before editing.','VERSION_CONFLICT');
      const exam=JSON.parse(row.exam_json), q=exam.questions.find(q=>q.id===input.questionId);
      if(!q)fail(400,'Unknown question.');
      const section=currentSection(exam,Number(row.started_at)+Number(row.offset_ms||0),now());
      if(exam.sections[0].durationSeconds&&section?.id!==q.sectionId)fail(409,'That timed section is closed. This edit was not saved.','SECTION_CLOSED');
      const answers=JSON.parse(row.answers_json);
      answers[q.id]={value:normalizeAnswer(q,input.value),visited:true,review:input.review};
      row.answers_json=JSON.stringify(answers);row.version++;
      await query('UPDATE attempts SET answers_json=$1,version=$2 WHERE id=$3',[row.answers_json,row.version,id]);
      await query('INSERT INTO answer_mutations(attempt_id,id) VALUES($1,$2)',[id,input.mutationId]);
      return studentView(row,now());
    });notify(view.userId);return view;
  }
  async function submit(id,userId,expectedVersion) {
    const current=await get(id,userId);
    if(current.status!=='active')return current;
    const view=await database.transaction(async query=>{
      const row=await owned(query,id,userId);
      if(row.status==='active'&&row.paused_at!=null)fail(409,'Your teacher has paused this attempt.','ATTEMPT_PAUSED');
      if(row.status==='active'&&row.version!==expectedVersion)fail(409,'Save all answers and refresh before submitting.','VERSION_CONFLICT');
      await finish(query,row,Number(row.deadline)<=now()?'time_expired':'student_submitted',now());
      return studentView(row,now());
    });notify(view.userId);return view;
  }
  async function flag(id,userId,input) {
    if(!input||!idPattern.test(input.eventId||'')||!['tab_hidden','window_blur','fullscreen_exit'].includes(input.type))fail(400,'Invalid activity event.');
    await get(id,userId);
    await database.transaction(async query=>{
      const row=await owned(query,id,userId);
      if(row.status!=='active')return;
      const recent=(await query('SELECT created_at FROM activity_flags WHERE attempt_id=$1 AND type=$2 ORDER BY created_at DESC LIMIT 1',[id,input.type])).rows[0];
      if(recent&&now()-Number(recent.created_at)<1000)return;
      await query('INSERT INTO activity_flags(id,attempt_id,user_id,type,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING',[input.eventId,id,userId,input.type,now()]);
    });notify(userId);return {ok:true};
  }
  async function control(id,actorId,input){
    if(!input||!idPattern.test(input.requestId||'')||!Number.isInteger(input.expectedVersion)||!['freeze','resume','force_submit','lock'].includes(input.action))fail(400,'Invalid teacher action.');
    const view=await database.transaction(async query=>{
      const actor=(await query("SELECT role FROM users WHERE id=$1 AND active=1",[actorId])).rows[0];
      if(!actor||!['teacher','admin'].includes(actor.role))fail(403,'Teacher access required.');
      const row=(await query('SELECT * FROM attempts WHERE id=$1'+lockSuffix,[id])).rows[0];
      if(!row)fail(404,'Attempt not found.');
      await controlState(query,row);
      const previous=(await query('SELECT * FROM teacher_actions WHERE id=$1',[input.requestId])).rows[0];
      if(previous){
        if(previous.attempt_id!==id||previous.actor_id!==actorId||previous.action!==input.action)fail(409,'Action ID already used.');
        return studentView(row,now());
      }
      if(row.version!==input.expectedVersion)fail(409,'Attempt changed. Review the latest state and try again.','VERSION_CONFLICT');
      if(row.status!=='active')fail(409,'This attempt is already submitted.','EXAM_ENDED');
      const time=now();
      if(row.paused_at==null&&Number(row.deadline)<=time){await finish(query,row,'time_expired',time);return studentView(row,time);}
      if(input.action==='force_submit'||input.action==='lock'){
        if(input.action==='lock'){row.locked=1;await query('INSERT INTO attempt_controls(attempt_id,paused_at,offset_ms,locked) VALUES($1,$2,$3,1) ON CONFLICT(attempt_id) DO UPDATE SET locked=1',[id,row.paused_at,row.offset_ms]);}
        await finish(query,row,input.action==='lock'?'teacher_locked':'teacher_submitted',time);
      }
      else {
        if(input.action==='freeze'){
          if(row.paused_at!=null)fail(409,'Attempt is already paused.');
          row.paused_at=time;
        }else{
          if(row.paused_at==null)fail(409,'Attempt is not paused.');
          if(row.locked)fail(409,'Unlock the attempt before resuming.');
          const elapsed=Math.max(0,time-Number(row.paused_at));
          row.deadline=Number(row.deadline)+elapsed;row.offset_ms=Number(row.offset_ms)+elapsed;row.paused_at=null;
        }
        row.version++;
        await query('INSERT INTO attempt_controls(attempt_id,paused_at,offset_ms,locked) VALUES($1,$2,$3,$4) ON CONFLICT(attempt_id) DO UPDATE SET paused_at=excluded.paused_at,offset_ms=excluded.offset_ms,locked=excluded.locked',[id,row.paused_at,row.offset_ms,row.locked]);
        await query('UPDATE attempts SET deadline=$1,version=$2 WHERE id=$3',[row.deadline,row.version,id]);
      }
      await query('INSERT INTO teacher_actions(id,attempt_id,actor_id,action,created_at) VALUES($1,$2,$3,$4,$5)',[input.requestId,id,actorId,input.action,time]);
      return studentView(row,time);
    });notify(view.userId);return view;
  }
  async function sweep() {
    const ids=(await database.query("SELECT id,user_id FROM attempts WHERE status='active' AND deadline<=$1 AND NOT EXISTS(SELECT 1 FROM attempt_controls c WHERE c.attempt_id=attempts.id AND c.paused_at IS NOT NULL)",[now()])).rows;
    for(const row of ids)await get(row.id,row.user_id);
  }
  async function roster(presence) {
    const time=now();
    const users=(await database.query("SELECT id,login_id,name FROM users u WHERE role='student' AND active=1 AND (EXISTS(SELECT 1 FROM sessions s WHERE s.user_id=u.id AND s.expires_at>$1) OR EXISTS(SELECT 1 FROM attempts a WHERE a.user_id=u.id)) ORDER BY login_id",[time])).rows;
    const attempts=(await database.query('SELECT a.*,c.paused_at,c.offset_ms,c.locked FROM attempts a LEFT JOIN attempt_controls c ON c.attempt_id=a.id ORDER BY a.started_at DESC')).rows;
    const flags=(await database.query('SELECT f.id,f.attempt_id,f.type,f.created_at,u.name,u.login_id FROM activity_flags f JOIN users u ON u.id=f.user_id ORDER BY f.created_at DESC LIMIT 100')).rows;
    const counts=new Map((await database.query('SELECT attempt_id,COUNT(*) AS count FROM activity_flags GROUP BY attempt_id')).rows.map(r=>[r.attempt_id,Number(r.count)]));
    return {type:'roster',serverNow:time,students:users.map(user=>({
      id:user.id,loginId:user.login_id,name:user.name,connected:presence(user.id).connected,lastSeen:presence(user.id).lastSeen,
      attempts:attempts.filter(a=>a.user_id===user.id).map(a=>{
        const exam=JSON.parse(a.exam_json),answers=JSON.parse(a.answers_json);
        return {id:a.id,examId:a.exam_id,title:exam.title,status:a.status,version:a.version,pausedAt:a.paused_at==null?null:Number(a.paused_at),locked:!!a.locked,deadline:Number(a.deadline),startedAt:Number(a.started_at),total:exam.questions.length,
          answered:exam.questions.filter(q=>hasAnswer(answers[q.id]?.value)).length,
          reviewed:exam.questions.filter(q=>answers[q.id]?.review).length,flagCount:counts.get(a.id)||0};
      })})),
      flags:flags.map(f=>({id:f.id,attemptId:f.attempt_id,type:f.type,at:Number(f.created_at),name:f.name,loginId:f.login_id}))};
  }
  async function saveExam(input) {
    const exam = validateExam(input);
    await database.query(
      'INSERT INTO exams(id,title,definition,created_at) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title, definition=EXCLUDED.definition',
      [exam.id, exam.title, JSON.stringify(exam), Date.now()]
    );
    return { ok: true, id: exam.id, title: exam.title };
  }
  async function assignExam(examId, userIds) {
    if (!Array.isArray(userIds) || !userIds.length || new Set(userIds).size !== userIds.length) fail(400, 'Supply distinct assigned student IDs.');
    await database.transaction(async query => {
      const exam = (await query('SELECT id FROM exams WHERE id=$1', [examId])).rows[0];
      if (!exam) fail(404, 'Exam not found.');
      for (const inputId of userIds) {
        const user = (await query("SELECT id FROM users WHERE (id=$1 OR login_id=$1) AND role='student' AND active=1", [inputId])).rows[0];
        if (!user) fail(400, 'Every assignment must be an active student.');
        await query('INSERT INTO exam_assignments(exam_id,user_id) VALUES($1,$2) ON CONFLICT(exam_id,user_id) DO NOTHING', [examId, user.id]);
      }
    });
    return { ok: true, assigned: userIds.length };
  }
  async function listAuthored() {
    const rows = (await database.query(
      `SELECT e.id, e.title, e.created_at, COUNT(a.user_id) AS assignment_count 
       FROM exams e 
       LEFT JOIN exam_assignments a ON a.exam_id=e.id 
       GROUP BY e.id, e.title, e.created_at 
       ORDER BY e.created_at DESC`
    )).rows;
    return rows.map(r => ({ id: r.id, title: r.title, createdAt: Number(r.created_at), assignmentCount: Number(r.assignment_count) }));
  }
  async function getAuthored(examId) {
    const row = (await database.query('SELECT id, title, definition, created_at FROM exams WHERE id=$1', [examId])).rows[0];
    if (!row) fail(404, 'Exam not found.');
    return JSON.parse(row.definition);
  }
  async function getExamAnalytics(examId) {
    const examRow = (await database.query('SELECT id, title, definition FROM exams WHERE id=$1', [examId])).rows[0];
    if (!examRow) fail(404, 'Exam not found.');
    const exam = JSON.parse(examRow.definition);

    const rows = (await database.query(
      `SELECT a.*, u.name, u.login_id FROM attempts a
       JOIN users u ON u.id=a.user_id
       WHERE a.exam_id=$1 AND a.status='submitted'
       ORDER BY a.submitted_at ASC`,
      [examId]
    )).rows;

    const parsed = rows.map(r => {
      const result = r.result_json ? JSON.parse(r.result_json) : { score: 0, maxMarks: exam.maxMarks, sections: [] };
      const timeTakenMs = Math.max(0, Number(r.submitted_at || Date.now()) - Number(r.started_at));
      return {
        attemptId: r.id,
        userId: r.user_id,
        name: r.name,
        loginId: r.login_id,
        score: Number(result.score || 0),
        maxMarks: Number(result.maxMarks || exam.maxMarks),
        percentage: Number(((result.score / (result.maxMarks || 1)) * 100).toFixed(2)),
        submittedAt: Number(r.submitted_at),
        timeTakenSeconds: Math.round(timeTakenMs / 1000),
        sections: result.sections || []
      };
    });

    parsed.sort((a, b) => b.score - a.score || a.timeTakenSeconds - b.timeTakenSeconds);

    let currentRank = 0;
    const leaderboard = parsed.map((item, idx) => {
      if (idx === 0 || item.score !== parsed[idx - 1].score || item.timeTakenSeconds !== parsed[idx - 1].timeTakenSeconds) {
        currentRank = idx + 1;
      }
      return { rank: currentRank, ...item };
    });

    const totalSubmitted = leaderboard.length;
    const highestScore = totalSubmitted ? leaderboard[0].score : 0;
    const totalScoreSum = leaderboard.reduce((sum, item) => sum + item.score, 0);
    const averageScore = totalSubmitted ? Number((totalScoreSum / totalSubmitted).toFixed(2)) : 0;
    const averagePercentage = exam.maxMarks ? Number(((averageScore / exam.maxMarks) * 100).toFixed(2)) : 0;

    const sectionStats = exam.sections.map(sec => {
      let secScoreSum = 0, secMax = 0, correctSum = 0, incorrectSum = 0, unansweredSum = 0;
      for (const item of leaderboard) {
        const s = item.sections.find(x => x.id === sec.id);
        if (s) {
          secScoreSum += s.score;
          secMax += s.maxMarks;
          correctSum += s.correct;
          incorrectSum += s.incorrect;
          unansweredSum += s.unanswered;
        }
      }
      const avgSecScore = totalSubmitted ? Number((secScoreSum / totalSubmitted).toFixed(2)) : 0;
      const accuracyPct = secMax ? Number(((secScoreSum / secMax) * 100).toFixed(2)) : 0;
      return {
        id: sec.id,
        title: sec.title,
        avgScore: avgSecScore,
        accuracyPct,
        totalCorrect: correctSum,
        totalIncorrect: incorrectSum,
        totalUnanswered: unansweredSum
      };
    });

    return {
      ok: true,
      examId: exam.id,
      title: exam.title,
      maxMarks: exam.maxMarks,
      stats: {
        totalSubmitted,
        highestScore,
        averageScore,
        averagePercentage,
        sectionStats
      },
      leaderboard
    };
  }

  async function getStudentHistory(userId) {
    const rows = (await database.query(
      `SELECT a.*, e.title FROM attempts a
       JOIN exams e ON e.id=a.exam_id
       WHERE a.user_id=$1 ORDER BY a.started_at DESC`,
      [userId]
    )).rows;

    const history = rows.map(r => {
      const result = r.result_json ? JSON.parse(r.result_json) : null;
      return {
        attemptId: r.id,
        examId: r.exam_id,
        title: r.title,
        status: r.status,
        startedAt: Number(r.started_at),
        submittedAt: r.submitted_at ? Number(r.submitted_at) : null,
        score: result ? result.score : null,
        maxMarks: result ? result.maxMarks : null,
        percentage: result && result.maxMarks ? Number(((result.score / result.maxMarks) * 100).toFixed(2)) : null,
        sections: result ? result.sections : []
      };
    });

    return { ok: true, history };
  }

  return {list,start,get,answer,submit,flag,sweep,roster,control,saveExam,assignExam,listAuthored,getAuthored,getExamAnalytics,getStudentHistory};
}

