// BRDS CBT Admin Workspace JavaScript Logic

(function () {
  let currentUser = null;
  let sections = [{ id: 's1', title: 'General Section', durationSeconds: 3600 }];
  let questions = [];
  let currentOptions = [
    { id: 'a', text: 'Option A' },
    { id: 'b', text: 'Option B' },
    { id: 'c', text: 'Option C' },
    { id: 'd', text: 'Option D' }
  ];

  // Helper API fetcher
  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // DOM Elements
  const el = id => document.getElementById(id);
  const escapeText = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  async function init() {
    try {
      const me = await api('/api/me');
      if (!me.user || !['admin', 'teacher'].includes(me.user.role)) {
        window.location.href = '/login';
        return;
      }
      currentUser = me.user;
      el('user-info').textContent = `${currentUser.name} (${currentUser.role.toUpperCase()})`;
    } catch (e) {
      window.location.href = '/login';
      return;
    }

    setupTabs();
    setupSectionsUI();
    setupOptionsUI();

    setupEventListeners();
    updatePreview();
    if (currentUser.role === 'admin') {
      loadUsers();
    } else {
      document.querySelector('[data-tab=users]')?.remove();
      el('tab-users')?.remove();
      el('btn-export-backup')?.remove();
      loadStudentCheckboxes();
    }
    loadAuthoredExams();
  }

  // 1. Navigation Tabs
  function setupTabs() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        el('tab-' + tab.dataset.tab).classList.add('active');
      });
    });
  }

  // 2. Timed Sections Manager
  function setupSectionsUI() {
    renderSections();
    el('btn-add-section').addEventListener('click', () => {
      const id = 's' + (sections.length + 1);
      sections.push({ id, title: 'Section ' + (sections.length + 1), durationSeconds: 1800 });
      renderSections();
    });
  }

  function renderSections() {
    const container = el('sections-container');
    container.innerHTML = sections.map((sec, idx) => `
      <div class="form-row option-row" data-idx="${idx}">
        <div class="form-group flex-1">
          <label>Section ID</label>
          <input type="text" class="sec-id" value="${sec.id}" placeholder="s1" required>
        </div>
        <div class="form-group flex-2">
          <label>Section Title</label>
          <input type="text" class="sec-title" value="${sec.title}" placeholder="Section Title" required>
        </div>
        <div class="form-group flex-1">
          <label>Duration (Minutes)</label>
          <input type="number" class="sec-duration" value="${Math.round((sec.durationSeconds || 1800) / 60)}" min="1" required>
        </div>
        ${sections.length > 1 ? `<button type="button" class="btn btn-secondary btn-sm btn-remove-sec" style="margin-top:20px;">✕</button>` : ''}
      </div>
    `).join('');

    // Wire input changes
    container.querySelectorAll('.sec-id').forEach((input, i) => input.addEventListener('input', e => { sections[i].id = e.target.value.trim(); updateSectionSelect(); }));
    container.querySelectorAll('.sec-title').forEach((input, i) => input.addEventListener('input', e => { sections[i].title = e.target.value.trim(); updateSectionSelect(); }));
    container.querySelectorAll('.sec-duration').forEach((input, i) => input.addEventListener('input', e => { sections[i].durationSeconds = Number(e.target.value) * 60; }));
    container.querySelectorAll('.btn-remove-sec').forEach((btn, i) => btn.addEventListener('click', () => { sections.splice(i, 1); renderSections(); updateSectionSelect(); }));

    updateSectionSelect();
  }

  function updateSectionSelect() {
    const select = el('q-section');
    select.innerHTML = sections.map(s => `<option value="${s.id}">${s.title} (${s.id})</option>`).join('');
  }

  // 3. Choice Options UI
  function setupOptionsUI() {
    renderOptions();
    el('btn-add-option').addEventListener('click', () => {
      const char = String.fromCharCode(97 + currentOptions.length);
      currentOptions.push({ id: char, text: 'Option ' + char.toUpperCase() });
      renderOptions();
      updatePreview();
    });

    el('q-type').addEventListener('change', e => {
      const type = e.target.value;
      el('options-panel').style.display = type === 'NAT' ? 'none' : 'block';
      el('nat-panel').style.display = type === 'NAT' ? 'block' : 'none';
      renderOptions();
      updatePreview();
    });
  }

  function renderOptions() {
    const container = el('options-list');
    const type = el('q-type').value;

    container.innerHTML = currentOptions.map((opt, idx) => `
      <div class="option-row" data-idx="${idx}">
        <input type="${type === 'MCQ' ? 'radio' : 'checkbox'}" name="correct-ans" value="${opt.id}" class="opt-correct" ${idx === 0 ? 'checked' : ''}>
        <input type="text" class="opt-id" value="${escapeText(opt.id)}" style="width: 50px;" placeholder="ID">
        <input type="text" class="opt-text" value="${escapeText(opt.text)}" placeholder="Option choice text">
        ${currentOptions.length > 2 ? `<button type="button" class="btn btn-secondary btn-sm btn-remove-opt">✕</button>` : ''}
      </div>
    `).join('');

    container.querySelectorAll('.opt-id').forEach((input, i) => input.addEventListener('input', e => { currentOptions[i].id = e.target.value.trim(); updatePreview(); }));
    container.querySelectorAll('.opt-text').forEach((input, i) => input.addEventListener('input', e => { currentOptions[i].text = e.target.value; updatePreview(); }));
    container.querySelectorAll('.opt-correct').forEach(input => input.addEventListener('change', updatePreview));
    container.querySelectorAll('.btn-remove-opt').forEach((btn, i) => btn.addEventListener('click', () => { currentOptions.splice(i, 1); renderOptions(); updatePreview(); }));
  }

  // 5. Live Question Preview
  function updatePreview() {
    const prompt = el('q-prompt').value.trim() || 'Question prompt preview will display here...';
    const type = el('q-type').value;
    const imgUrl = el('q-image-url').value.trim();
    const imgAlt = el('q-image-alt').value.trim();

    let choicesHtml = '';
    if (type === 'NAT') {
      const min = el('nat-min').value;
      const max = el('nat-max').value;
      choicesHtml = `<div class="margin-top"><b>Numeric Answer Input:</b> [ Enter Number ] <span class="muted">(Accepted Range: ${min || 'min'} to ${max || 'max'})</span></div>`;
    } else {
      choicesHtml = `<div class="margin-top"><b>Choices:</b><ul style="list-style:none; padding-left:0;">` +
        currentOptions.map(o => `<li><label><input type="${type === 'MCQ' ? 'radio' : 'checkbox'}" disabled> <b>${escapeText(o.id.toUpperCase())}:</b> ${escapeText(o.text || '...')}</label></li>`).join('') +
        `</ul></div>`;
    }

    let imgHtml = '';
    if (imgUrl.startsWith('data:image/') || /^\/media\/[a-zA-Z0-9_-]+\.(svg|png|jpg|jpeg|webp)$/.test(imgUrl)) {
      imgHtml = `<div style="margin:10px 0;"><img src="${imgUrl}" alt="${escapeText(imgAlt || 'Preview image')}" style="max-width:200px; border:1px solid #ccc; border-radius:4px;"></div>`;
    }

    el('preview-render').innerHTML = `
      <div>
        <span class="badge">${type}</span> <b>Prompt:</b>
        <div class="plain-question-preview" style="white-space:pre-wrap;overflow-wrap:anywhere;">${escapeText(prompt)}</div>
        ${imgHtml}
        ${choicesHtml}
      </div>
    `;
  }

  // 6. Add Question to Paper
  function setupEventListeners() {
    ['q-prompt', 'q-image-url', 'q-image-alt', 'nat-min', 'nat-max'].forEach(id => {
      el(id).addEventListener('input', updatePreview);
    });

    el('q-prompt').addEventListener('paste', e => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          const reader = new FileReader();
          reader.onload = event => {
            el('q-image-url').value = event.target.result;
            if (!el('q-image-alt').value) el('q-image-alt').value = 'Pasted diagram image';
            updatePreview();
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    });

    el('btn-save-question').addEventListener('click', () => {
      const qId = el('q-id').value.trim();
      const secId = el('q-section').value;
      const type = el('q-type').value;
      const prompt = el('q-prompt').value.trim();
      const imgUrl = el('q-image-url').value.trim();
      const imgAlt = el('q-image-alt').value.trim();

      if (!qId || !secId || !prompt) {
        alert('Please fill in Question ID, Section, and Question Prompt.');
        return;
      }

      const correctMarks = Number(el('m-correct').value);
      const incorrectMarks = Number(el('m-incorrect').value);
      const unansweredMarks = Number(el('m-unanswered').value);

      let answer;
      let options;

      if (type === 'NAT') {
        const min = Number(el('nat-min').value);
        const max = Number(el('nat-max').value);
        if (isNaN(min) || isNaN(max) || min > max) {
          alert('Enter valid inclusive numeric minimum and maximum values.');
          return;
        }
        answer = { min, max };
      } else {
        options = currentOptions.map(o => ({ id: o.id, text: o.text }));
        const selected = Array.from(document.querySelectorAll('.opt-correct:checked')).map(i => i.value);
        if (!selected.length) {
          alert('Select at least one correct option.');
          return;
        }
        answer = type === 'MCQ' ? selected[0] : selected;
      }

      const qObj = {
        id: qId,
        sectionId: secId,
        type,
        prompt,
        ...(imgUrl ? { image: imgUrl, imageAlt: imgAlt || 'Image' } : {}),
        ...(type !== 'NAT' ? { options } : {}),
        marks: { correct: correctMarks, incorrect: incorrectMarks, unanswered: unansweredMarks },
        answer
      };

      questions.push(qObj);
      renderQuestionsSummary();

      // Reset for next question
      el('q-id').value = 'q' + (questions.length + 1);
      el('q-prompt').value = '';
      el('q-image-url').value = '';
      el('q-image-alt').value = '';
      el('image-fields').style.display = 'none';
      updatePreview();
    });

    // Save Complete Exam
    el('btn-save-exam').addEventListener('click', async () => {
      const examId = el('exam-id').value.trim();
      const title = el('exam-title').value.trim();
      const durationMins = Number(el('exam-duration').value);
      const instructions = el('exam-instructions').value.trim();

      if (!examId || !title || !durationMins || !questions.length) {
        alert('Please provide Exam ID, Title, Duration, and add at least 1 question.');
        return;
      }

      const durationSeconds = durationMins * 60;
      const totalQuestions = questions.length;
      const maxMarks = questions.reduce((sum, q) => sum + q.marks.correct, 0);

      const examPayload = {
        id: examId,
        title,
        durationSeconds,
        totalQuestions,
        maxMarks,
        instructions,
        sections: sections.map(s => ({ id: s.id, title: s.title, durationSeconds: s.durationSeconds })),
        questions
      };

      try {
        const result = await api('/api/author/exams', {
          method: 'POST',
          body: JSON.stringify(examPayload)
        });
        alert(`Success! Exam "${title}" (${result.id}) saved and ready for student assignment.`);
        loadAuthoredExams();
      } catch (e) {
        alert('Failed to save exam: ' + e.message);
      }
    });

    // User Creation Form
    el('form-create-user').addEventListener('submit', async e => {
      e.preventDefault();
      const payload = {
        loginId: el('u-id').value.trim(),
        name: el('u-name').value.trim(),
        phone: el('u-phone').value.trim(),
        role: el('u-role').value,
        password: el('u-pass').value
      };

      try {
        const res = await api('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        alert(`User account ${res.user.loginId} (${res.user.role}) successfully created!`);
        el('form-create-user').reset();
        loadUsers();
      } catch (err) {
        alert('Error creating user: ' + err.message);
      }
    });

    // Assignment Buttons
    el('btn-load-students').addEventListener('click', loadStudentCheckboxes);
    el('btn-save-assignment').addEventListener('click', async () => {
      const examId = el('assign-exam-select').value;
      const userIds = Array.from(document.querySelectorAll('.student-chk:checked')).map(c => c.value);

      if (!examId || !userIds.length) {
        alert('Select an exam and at least one student.');
        return;
      }

      try {
        const result = await api(`/api/author/exams/${examId}/assign`, {
          method: 'POST',
          body: JSON.stringify({ userIds })
        });
        alert(`Assigned paper ${examId} to ${result.assigned} student(s) successfully!`);
      } catch (err) {
        alert('Assignment error: ' + err.message);
      }
    });

    // Logout
    el('btn-logout').addEventListener('click', async () => {
      await api('/api/logout', { method: 'POST' });
      window.location.href = '/login';
    });
  }

  function renderQuestionsSummary() {
    el('q-count').textContent = questions.length;
    const container = el('questions-summary-list');
    container.innerHTML = questions.map((q, i) => `
      <div class="option-row">
        <div style="flex:1;">
          <b>#${i + 1} (${q.id})</b> [${q.type} | Sec: ${q.sectionId}] - Marks: +${q.marks.correct}/${q.marks.incorrect}<br>
          <small class="muted">${escapeText(q.prompt.slice(0, 60))}...</small>
        </div>
        <button type="button" class="btn btn-secondary btn-sm btn-del-q" data-idx="${i}">✕</button>
      </div>
    `).join('');

    container.querySelectorAll('.btn-del-q').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = Number(btn.dataset.idx);
        questions.splice(idx, 1);
        renderQuestionsSummary();
      });
    });
  }

  // Load Users
  async function loadUsers() {
    try {
      const data = await api('/api/admin/users');
      const tbody = el('users-table-body');
      tbody.innerHTML = data.users.map(u => `
        <tr>
          <td><b>${u.loginId}</b></td>
          <td>${u.name}</td>
          <td><span class="badge" style="background:#e9ecef; color:#333;">${u.role.toUpperCase()}</span></td>
          <td>${u.active ? '✅ Active' : '❌ Inactive'}</td>
        </tr>
      `).join('');

      loadStudentCheckboxesWithUsers(data.users.filter(u => u.role === 'student' && u.active));
    } catch (e) {
      console.error('Failed to load users', e);
    }
  }

  // Load Authored Exams
  async function loadAuthoredExams() {
    try {
      const data = await api('/api/author/exams');
      const select = el('assign-exam-select');
      select.innerHTML = data.exams.length
        ? data.exams.map(e => `<option value="${e.id}">${e.title} (${e.id}) - ${e.assignmentCount} assigned</option>`).join('')
        : `<option value="">No authored exams available</option>`;

      const analyticsSelect = el('analytics-exam-select');
      analyticsSelect.innerHTML = data.exams.length
        ? data.exams.map(e => `<option value="${e.id}">${e.title} (${e.id})</option>`).join('')
        : `<option value="">No authored exams available</option>`;

      if (data.exams.length && !currentAnalytics) {
        loadAnalytics(data.exams[0].id);
      }
    } catch (e) {
      console.error('Failed to load authored exams', e);
    }
  }

  // 7. Tab 5 Analytics & Leaderboard
  let currentAnalytics = null;

  async function loadAnalytics(examId) {
    if (!examId) return;
    try {
      currentAnalytics = await api(`/api/analytics/exams/${examId}`);
      renderAnalytics();
    } catch (e) {
      console.error('Failed to load analytics', e);
      alert('Failed to load exam analytics: ' + e.message);
    }
  }

  function renderAnalytics() {
    if (!currentAnalytics) return;
    const { stats, maxMarks, leaderboard } = currentAnalytics;

    el('kpi-total').textContent = stats.totalSubmitted;
    el('kpi-highest').textContent = `${stats.highestScore} / ${maxMarks}`;
    el('kpi-average').textContent = `${stats.averageScore} / ${maxMarks}`;
    el('kpi-percentage').textContent = `${stats.averagePercentage}%`;

    // Render Section Accuracy Breakdown
    const secContainer = el('section-analytics-container');
    if (!stats.sectionStats || !stats.sectionStats.length) {
      secContainer.innerHTML = '<p class="muted">No section statistics available.</p>';
    } else {
      secContainer.innerHTML = stats.sectionStats.map(sec => `
        <div class="kpi-card flex-1">
          <div class="kpi-title">${sec.title} (${sec.id})</div>
          <div class="kpi-value">${sec.accuracyPct}% <small style="font-size:0.9rem; font-weight:normal; color:#666;">Accuracy</small></div>
          <div class="margin-top" style="font-size:0.85rem; color:#555;">
            Average Score: <b>${sec.avgScore}</b><br>
            Correct: <b style="color:var(--success-green);">${sec.totalCorrect}</b> | 
            Partial: <b>${sec.totalPartial || 0}</b> | 
            Incorrect: <b style="color:var(--brds-red);">${sec.totalIncorrect}</b> | 
            Unanswered: <b>${sec.totalUnanswered}</b>
          </div>
        </div>
      `).join('');
    }

    // Render Leaderboard
    const tbody = el('leaderboard-table-body');
    if (!leaderboard || !leaderboard.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted">No student submissions recorded for this exam yet.</td></tr>';
    } else {
      tbody.innerHTML = leaderboard.map(item => {
        const rankClass = item.rank === 1 ? 'rank-1' : item.rank === 2 ? 'rank-2' : item.rank === 3 ? 'rank-3' : '';
        const rankLabel = item.rank === 1 ? '🥇 Rank 1' : item.rank === 2 ? '🥈 Rank 2' : item.rank === 3 ? '🥉 Rank 3' : `Rank ${item.rank}`;
        const mins = Math.floor(item.timeTakenSeconds / 60);
        const secs = item.timeTakenSeconds % 60;
        const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

        return `
          <tr>
            <td><span class="rank-pill ${rankClass}">${rankLabel}</span></td>
            <td><b>${item.name}</b></td>
            <td>${item.loginId}</td>
            <td><b>${item.score}</b></td>
            <td>${item.maxMarks}</td>
            <td>${item.percentage}%</td>
            <td>${timeStr}</td>
          </tr>
        `;
      }).join('');
    }
  }

  function exportCSV() {
    if (!currentAnalytics || !currentAnalytics.leaderboard || !currentAnalytics.leaderboard.length) {
      alert('No batch analytics data available to export.');
      return;
    }

    let csv = 'Rank,Student Name,Login ID,Score,Max Marks,Percentage,Time Taken (Seconds)\n';
    for (const item of currentAnalytics.leaderboard) {
      csv += `${item.rank},"${item.name.replace(/"/g, '""')}",${item.loginId},${item.score},${item.maxMarks},${item.percentage},${item.timeTakenSeconds}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BRDS-Leaderboard-${currentAnalytics.examId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function loadStudentCheckboxes() {
    try {
      const data = await api(currentUser.role === 'admin' ? '/api/admin/users' : '/api/author/students');
      const students = currentUser.role === 'admin' ? data.users.filter(u => u.role === 'student' && u.active) : data.students;
      loadStudentCheckboxesWithUsers(students);
    } catch (e) {
      const container = el('student-checkboxes');
      container.textContent = 'Unable to load active students: ' + e.message;
    }
  }

  function loadStudentCheckboxesWithUsers(students) {
    const container = el('student-checkboxes');
    if (!students.length) {
      container.innerHTML = '<p class="muted">No active students found. Create student accounts in Tab 3.</p>';
      return;
    }
    container.innerHTML = students.map(s => `
      <label class="checkbox-item">
        <input type="checkbox" class="student-chk" value="${s.id}">
        <span><b>${s.name}</b> (${s.loginId})</span>
      </label>
    `).join('');
  }

  // Setup analytics event listeners in init
  function setupAnalyticsUI() {
    el('analytics-exam-select').addEventListener('change', e => loadAnalytics(e.target.value));
    el('btn-load-analytics').addEventListener('click', () => loadAnalytics(el('analytics-exam-select').value));
    el('btn-export-csv').addEventListener('click', exportCSV);
    const printBtn = el('btn-print-scorecard');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
    const backupBtn = el('btn-export-backup');
    if (backupBtn) backupBtn.addEventListener('click', () => window.location.href = '/api/admin/backup');
  }

  // Global error telemetry logger
  window.addEventListener('error', event => {
    fetch('/api/log-client-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: window.location.pathname,
        message: event.message || 'Script error',
        stack: event.error?.stack || null
      })
    }).catch(() => {});
  });

  window.addEventListener('unhandledrejection', event => {
    fetch('/api/log-client-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: window.location.pathname,
        message: event.reason?.message || String(event.reason || 'Unhandled Promise Rejection'),
        stack: event.reason?.stack || null
      })
    }).catch(() => {});
  });

  const originalInit = init;
  init = async function() {
    await originalInit();
    setupAnalyticsUI();
  };

  // Initialize
  document.addEventListener('DOMContentLoaded', init);
})();


