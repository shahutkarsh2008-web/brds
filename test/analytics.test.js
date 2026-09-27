import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createUser } from '../src/auth.js';
import { createApp } from '../src/app.js';

test('Phase 7: Analytics, Section Score Breakdowns, Batch Ranks & Scorecards', async () => {
  const database = await openDatabase({ SQLITE_PATH: ':memory:' });
  await migrate(database);

  const otp = {
    async send() { return 'session-123'; },
    async verify(id, code) { return code === '123456'; }
  };

  await createUser(database, { loginId: 'admin', name: 'Admin User', role: 'admin', phone: '919999999999', password: 'AdminPass123!' });
  await createUser(database, { loginId: 'student1', name: 'Student One', role: 'student', phone: '918888888881', password: 'StudentPass123!' });
  await createUser(database, { loginId: 'student2', name: 'Student Two', role: 'student', phone: '918888888882', password: 'StudentPass123!' });
  await createUser(database, { loginId: 'student3', name: 'Student Three', role: 'student', phone: '918888888883', password: 'StudentPass123!' });

  const app = createApp(database, { otp, env: {} });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;

  async function login(loginId, password) {
    const res = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ loginId, password })
    });
    assert.equal(res.status, 200, 'Login step 1 failed');
    const challengeCookie = res.headers.get('set-cookie').split(';')[0];

    const verify = await fetch(`${base}/api/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, Cookie: challengeCookie },
      body: JSON.stringify({ code: '123456' })
    });
    assert.equal(verify.status, 200, 'Login verify failed');
    return verify.headers.get('set-cookie').split(';')[0];
  }

  try {
    const adminCookie = await login('admin', 'AdminPass123!');
    const s1Cookie = await login('student1', 'StudentPass123!');
    const s2Cookie = await login('student2', 'StudentPass123!');
    const s3Cookie = await login('student3', 'StudentPass123!');

    // 1. Author an exam
    const examPayload = {
      id: 'analytics-exam-1',
      title: 'BRDS Analytics Test Paper 2026',
      durationSeconds: 1800,
      totalQuestions: 2,
      maxMarks: 8,
      instructions: 'Analytics Test Paper',
      sections: [
        { id: 'sec1', title: 'Aptitude' }
      ],
      questions: [
        {
          id: 'q1',
          sectionId: 'sec1',
          type: 'MCQ',
          prompt: 'Question 1 MCQ',
          options: [{ id: 'a', text: 'Option A' }, { id: 'b', text: 'Option B' }],
          marks: { correct: 4, incorrect: -1, unanswered: 0 },
          answer: 'a'
        },
        {
          id: 'q2',
          sectionId: 'sec1',
          type: 'MCQ',
          prompt: 'Question 2 MCQ',
          options: [{ id: 'x', text: 'Option X' }, { id: 'y', text: 'Option Y' }],
          marks: { correct: 4, incorrect: -1, unanswered: 0 },
          answer: 'x'
        }
      ]
    };

    const saveRes = await fetch(`${base}/api/author/exams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, Cookie: adminCookie },
      body: JSON.stringify(examPayload)
    });
    assert.equal(saveRes.status, 200);

    // Assign exam to student1, student2, student3
    const assignRes = await fetch(`${base}/api/author/exams/analytics-exam-1/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, Cookie: adminCookie },
      body: JSON.stringify({ userIds: ['student1', 'student2', 'student3'] })
    });
    assert.equal(assignRes.status, 200);

    // Student 1 starts and submits (Score: 8 - Perfect)
    const start1 = await (await fetch(`${base}/api/exams/analytics-exam-1/start`, { method: 'POST', headers: { Origin: base, Cookie: s1Cookie } })).json();
    const a1_q1 = await (await fetch(`${base}/api/attempts/${start1.id}/answers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: s1Cookie },
      body: JSON.stringify({ mutationId: 's1m1', questionId: 'q1', value: 'a', review: false, expectedVersion: start1.version })
    })).json();
    const a1_q2 = await (await fetch(`${base}/api/attempts/${start1.id}/answers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: s1Cookie },
      body: JSON.stringify({ mutationId: 's1m2', questionId: 'q2', value: 'x', review: false, expectedVersion: a1_q1.version })
    })).json();
    await fetch(`${base}/api/attempts/${start1.id}/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: s1Cookie },
      body: JSON.stringify({ expectedVersion: a1_q2.version })
    });

    // Student 2 starts and submits (Score: 3 - 1 correct [q1=a], 1 wrong [q2=y])
    const start2 = await (await fetch(`${base}/api/exams/analytics-exam-1/start`, { method: 'POST', headers: { Origin: base, Cookie: s2Cookie } })).json();
    const a2_q1 = await (await fetch(`${base}/api/attempts/${start2.id}/answers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: s2Cookie },
      body: JSON.stringify({ mutationId: 's2m1', questionId: 'q1', value: 'a', review: false, expectedVersion: start2.version })
    })).json();
    const a2_q2 = await (await fetch(`${base}/api/attempts/${start2.id}/answers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: s2Cookie },
      body: JSON.stringify({ mutationId: 's2m2', questionId: 'q2', value: 'y', review: false, expectedVersion: a2_q1.version })
    })).json();
    await fetch(`${base}/api/attempts/${start2.id}/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: s2Cookie },
      body: JSON.stringify({ expectedVersion: a2_q2.version })
    });

    // Student 3 starts and submits (Score: 3 - 1 correct [q1=a], 1 wrong [q2=y])
    const start3 = await (await fetch(`${base}/api/exams/analytics-exam-1/start`, { method: 'POST', headers: { Origin: base, Cookie: s3Cookie } })).json();
    const a3_q1 = await (await fetch(`${base}/api/attempts/${start3.id}/answers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: s3Cookie },
      body: JSON.stringify({ mutationId: 's3m1', questionId: 'q1', value: 'a', review: false, expectedVersion: start3.version })
    })).json();
    const a3_q2 = await (await fetch(`${base}/api/attempts/${start3.id}/answers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: s3Cookie },
      body: JSON.stringify({ mutationId: 's3m2', questionId: 'q2', value: 'y', review: false, expectedVersion: a3_q1.version })
    })).json();
    await fetch(`${base}/api/attempts/${start3.id}/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: s3Cookie },
      body: JSON.stringify({ expectedVersion: a3_q2.version })
    });

    // 2. Student 1 History Check
    const historyRes = await fetch(`${base}/api/analytics/student`, { headers: { Cookie: s1Cookie } });
    assert.equal(historyRes.status, 200);
    const historyData = await historyRes.json();
    assert.equal(historyData.ok, true);
    assert.equal(historyData.history.length, 1);
    assert.equal(historyData.history[0].examId, 'analytics-exam-1');
    assert.equal(historyData.history[0].score, 8);
    assert.equal(historyData.history[0].percentage, 100);

    // 3. Student tries to access batch analytics endpoint -> 403 Forbidden
    const unauthAnalytics = await fetch(`${base}/api/analytics/exams/analytics-exam-1`, { headers: { Cookie: s1Cookie } });
    assert.equal(unauthAnalytics.status, 403, 'Student should be forbidden from batch analytics');

    // 4. Admin accesses batch analytics
    const analyticsRes = await fetch(`${base}/api/analytics/exams/analytics-exam-1`, { headers: { Cookie: adminCookie } });
    assert.equal(analyticsRes.status, 200);
    const analyticsData = await analyticsRes.json();
    assert.equal(analyticsData.ok, true);
    assert.equal(analyticsData.stats.totalSubmitted, 3);
    assert.equal(analyticsData.stats.highestScore, 8);
    assert.equal(analyticsData.stats.averageScore, 4.67); // (8 + 3 + 3) / 3 = 4.6666...
    assert.equal(analyticsData.stats.sectionStats.length, 1);
    assert.equal(analyticsData.stats.sectionStats[0].id, 'sec1');

    // Verify Leaderboard Rankings
    assert.equal(analyticsData.leaderboard.length, 3);
    assert.equal(analyticsData.leaderboard[0].loginId, 'student1');
    assert.equal(analyticsData.leaderboard[0].rank, 1);
    assert.equal(analyticsData.leaderboard[0].score, 8);

    // student2 and student3 both got score 3; tie-breaker ranks them by time taken or ties
    assert.ok(analyticsData.leaderboard[1].rank >= 2);
    assert.ok(analyticsData.leaderboard[2].rank >= 2);
  } finally {
    app.server.close();
    await database.close();
  }
});
