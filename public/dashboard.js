const state = {
  tab: 'overview',
  open: localStorage.getItem('northstar-sidebar') === 'open',
  exams: null,
  overviewData: null,
  analyticsData: null,
  practiceSets: null,
  activePracticeSet: null,
  practiceIndex: 0,
  userAnswers: {},
  bookmarksData: null,
  revisionData: null,
  librarySearch: '',
  libraryFilter: 'all',
  selectedPaper: null,
  loading: false,
  error: null,
  practiceSubTab: 'builder',
  practiceExamFilter: 'all',
  practiceDifficulty: 'all',
  practiceType: 'all',
  practiceSetSize: 15,
  selectedTopics: new Set(),
  practiceMatchingCount: null,
  practiceCountError: null,
  practiceActionError: null,
  practiceActionMessage: null,
  mockLoadError: null,
  analyticsLoadError: null,
  practiceFeedback: null,
  mockFilter: 'all',
  analyticsDate: 'all',
  analyticsExam: 'all'
};

const app = document.querySelector('#app');

const el = (tag, props = {}, children = []) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  children.forEach(c => n.append(c?.nodeType ? c : document.createTextNode(String(c))));
  return n;
};

const nav = [
  ['overview', 'Overview'],
  ['analytics', 'Analytics'],
  ['practice', 'Practice'],
  ['papers', 'Library'],
  ['mocks', 'Mocks'],
  ['gk', 'GK Sprint'],
  ['sketches', 'Sketches'],
  ['bookmarks', 'Bookmarks'],
  ['guides', 'Guides'],
  ['settings', 'Settings']
];

async function apiFetch(url, options = {}) {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || data.message || `HTTP ${r.status}`);
  return data;
}

function card(title, body, cls = 'card') {
  return el('section', { className: cls }, [
    el('div', { className: 'card-header-title' }, [title]),
    ...(Array.isArray(body) ? body : [el('p', {}, [body])])
  ]);
}

function sidebar() {
  const aside = el('aside', { className: `app-sidebar ${state.open ? 'sidebar-open' : 'sidebar-closed'}` });
  
  const brand = el('div', { className: 'sidebar-brand-mini' }, [
    el('img', { src: '/media/brds-logo-enhanced.png', alt: 'BRDS Logo' }),
    el('button', {
      className: 'sidebar-toggle',
      title: state.open ? 'Collapse Sidebar' : 'Expand Sidebar',
      onclick: () => {
        state.open = !state.open;
        localStorage.setItem('northstar-sidebar', state.open ? 'open' : 'closed');
        render();
      }
    }, [state.open ? '‹' : '›'])
  ]);
  
  aside.append(brand);
  
  const navEl = el('nav', { className: 'sidebar-nav' });
  nav.forEach(([id, label]) => {
    const symbol = id === 'overview' ? '⌂' : id === 'analytics' ? '▥' : id === 'papers' ? '▤' : id === 'practice' ? '◎' : id === 'mocks' ? '◷' : '◇';
    navEl.append(el('button', {
      className: `nav-icon-btn ${state.tab === id ? 'active' : ''}`,
      onclick: () => {
        state.tab = id;
        render();
      }
    }, [
      el('span', { className: 'nav-symbol' }, [symbol]),
      el('span', { className: 'tooltip' }, [label])
    ]));
  });
  
  aside.append(navEl);
  return aside;
}

function header(title, sub) {
  const user = state.overviewData?.user || {};
  const target = user.targetExam || 'UCEED 2026';
  const name = user.name || 'Student';

  return el('header', { className: 'top-header-bar' }, [
    el('div', { className: 'header-left' }, [
      el('h1', { className: 'header-title-text' }, [title]),
      el('p', { className: 'header-subtitle-text' }, [sub])
    ]),
    el('div', { className: 'header-right' }, [
      el('div', { className: 'exam-target-pill' }, [`🎯 Target: ${target}`]),
      el('div', { className: 'sparks-widget' }, [
        el('span', { className: 'sparks-icon-star' }, ['✦']),
        el('span', {}, [String(state.overviewData?.sparks ?? 0)]),
        el('span', { className: 'sparks-info-icon', title: 'Sparks earned from practice consistency' }, ['i'])
      ]),
      el('button', {
        className: 'btn btn-outline',
        onclick: () => {
          document.body.classList.toggle('light-mode');
        }
      }, ['☀ Light/Dark'])
    ])
  ]);
}

async function overview() {
  const wrap = el('div', { className: 'overview-container' });

  let data = state.overviewData;
  if (!data) {
    try {
      data = await apiFetch('/api/student/dashboard');
      state.overviewData = data;
    } catch (e) {
      console.warn('Unable to load dashboard data:', e.message);
    }
  }

  const kpis = data?.kpis || {};
  const sample = data?.sample || {};

  const metrics = el('div', { className: 'card-grid' }, [
    ['Questions Solved', String(kpis.questionsAnswered ?? 0)],
    ['Practice Time', kpis.averageTimeSeconds ? `${kpis.averageTimeSeconds}s / Q` : '0s'],
    ['Papers Attempted', String(kpis.completedAttempts ?? 0)],
    ['Overall Accuracy', kpis.accuracyPct !== null && kpis.accuracyPct !== undefined ? `${kpis.accuracyPct}%` : '—']
  ].map(([a, b]) => card(a, [
    el('h2', { className: 'card-stat-value' }, [b]),
    el('p', { className: 'card-stat-desc' }, ['Updated from your attempts'])
  ])));

  const calendarDays = data?.calendar || [];
  const activeStreak = calendarDays.length;

  const heat = card(`365-Day Consistency Calendar (${activeStreak} Active Days)`, [
    el('div', { className: 'heatmap-container' }, [
      el('div', { className: 'heatmap-grid' }, Array.from({ length: 90 }, (_, i) => {
        const item = calendarDays[i];
        const lvl = item ? (item.questions > 15 ? 'level-4' : item.questions > 8 ? 'level-3' : 'level-2') : '';
        return el('span', { className: `heatmap-cell ${lvl}`, title: item ? `${item.date}: ${item.questions} Qs` : `Day ${i + 1}` });
      }))
    ])
  ]);

  const nba = data?.nextBestAction || {
    title: 'Choose a paper from Library',
    reason: 'Start a full-length timed mock paper to test exam readiness.'
  };

  const action = card('Next Best Action', [
    el('div', { className: 'overview-cta-row' }, [
      el('div', {}, [
        el('strong', { style: 'font-size: 1.05rem; display: block;' }, [nba.title]),
        el('span', {}, [nba.reason])
      ]),
      el('button', {
        className: 'btn btn-primary',
        onclick: () => {
          if (nba.topic) {
            state.tab = 'practice';
            state.selectedTopics = new Set([nba.topic]);
          } else {
            state.tab = 'papers';
          }
          render();
        }
      }, [nba.topic ? `Practice ${nba.topic} →` : 'Open Library →'])
    ])
  ]);

  const attemptsList = data?.attempts || [];
  const recent = card('Recent Mock Attempts', [
    el('div', { className: 'overview-attempt-list' }, attemptsList.length === 0 ? [
      el('p', { className: 'card-stat-desc' }, ['No completed attempts yet. Select an assigned paper from Library to begin.'])
    ] : attemptsList.slice(0, 3).map(att => el('div', { className: 'overview-attempt-row' }, [
      el('div', {}, [
        el('strong', { style: 'display:block; color:var(--text-primary);' }, [att.title || att.examId]),
        el('span', { className: 'card-stat-desc' }, [att.submittedAt ? new Date(att.submittedAt).toLocaleDateString() : 'Active Attempt'])
      ]),
      el('div', { style: 'display:flex; gap:8px; align-items:center;' }, [
        el('span', { className: `status-chip ${att.status === 'submitted' ? 'submitted' : 'in-progress'}` }, [att.status]),
        att.score !== undefined ? el('strong', { style: 'color:var(--brds-red); font-size:1.05rem;' }, [`${att.score} Marks`]) : null
      ])
    ])))
  ]);

  const topicList = data?.topics || [];
  const insight = el('div', { className: 'overview-insight-grid' }, [
    card('Topic Mastery Breakdown', topicList.length === 0 ? [
      el('p', { className: 'card-stat-desc' }, ['Attempt at least 10 questions in a topic to calculate mastery score.'])
    ] : el('div', { style: 'display:flex; flex-direction:column; gap:10px;' }, topicList.slice(0, 4).map(t => el('div', {}, [
      el('div', { style: 'display:flex; justify-content:space-between; font-size:0.85rem; font-weight:600; margin-bottom:4px;' }, [
        el('span', {}, [t.topic]),
        el('span', { style: 'color:var(--text-muted);' }, [`${t.accuracy}% (${t.attempted} Qs)`])
      ]),
      el('div', { className: 'progress-bar-wrap' }, [
        el('div', { className: `progress-bar-fill ${t.accuracy >= 70 ? 'high' : t.accuracy >= 50 ? 'medium' : 'low'}`, style: `width:${t.accuracy}%;` })
      ])
    ])))),
    el('div', { className: 'overview-side-stack' }, [
      card('Recent Sparks', [
        el('div', {}, [
          el('span', { className: 'overview-spark-title' }, ['Daily Sign-in Streak']),
          el('span', { className: 'overview-spark-score' }, [`${data?.sparks ?? 0} Sparks`])
        ])
      ]),
      card('Recommended Sets', [
        el('p', { className: 'card-stat-desc', style: 'margin-bottom: 12px;' }, ['Build a custom practice set across Spatial Reasoning or Design Sensitivity.']),
        el('button', {
          className: 'btn btn-outline',
          onclick: () => {
            state.tab = 'practice';
            render();
          }
        }, ['Open Practice Builder →'])
      ])
    ])
  ]);

  const opt = card('Optimization Snapshot', [
    el('div', { className: 'overview-optimization-grid' }, [
      ['Active Study Days', `${activeStreak} Days`],
      ['Paper Completion', `${kpis.completedAttempts ?? 0} Papers`],
      ['Tracked Weak Topics', `${topicList.filter(t => t.accuracy < 50).length} Topics`],
      ['Avg Time per Question', kpis.averageTimeSeconds ? `${kpis.averageTimeSeconds}s` : '—']
    ].map(([x, val]) => el('div', { className: 'overview-optimization-tile' }, [
      el('div', { className: 'card-header-title' }, [x]),
      el('strong', {}, [val])
    ])))
  ]);

  wrap.append(
    header('Overview Dashboard', 'Track daily practice, full-length papers, and exam readiness.'),
    metrics,
    el('div', { className: 'overview-flow' }, [heat, action, recent, insight, opt])
  );

  return [wrap];
}

async function library() {
  const wrap = el('div', { className: 'library-container' });
  wrap.append(header('Papers Library', 'Select an official question paper or diagnostic test to start your timed exam.'));

  const filterBar = el('div', { className: 'filter-bar-row' }, [
    el('div', { className: 'filter-group-inline' }, [
      el('input', {
        type: 'text',
        className: 'form-control',
        placeholder: 'Search papers by title, year or topic...',
        style: 'max-width: 280px;',
        value: state.librarySearch || '',
        oninput: (e) => {
          state.librarySearch = e.target.value.toLowerCase();
          renderLibraryContent();
        }
      }),
      el('select', {
        className: 'filter-select',
        onchange: (e) => {
          state.libraryFilter = e.target.value;
          renderLibraryContent();
        }
      }, [
        el('option', { value: 'all' }, ['All Papers']),
        el('option', { value: 'pyq' }, ['Official PYQs']),
        el('option', { value: 'diagnostic' }, ['Diagnostic Tests']),
        el('option', { value: 'mock' }, ['Mini Mocks'])
      ])
    ]),
    el('button', {
      className: 'btn btn-outline',
      onclick: () => {
        state.exams = null;
        render();
      }
    }, ['🔄 Refresh Library'])
  ]);

  wrap.append(filterBar);

  const contentArea = el('div', { className: 'library-content-area' });
  wrap.append(contentArea);

  function renderLibraryContent() {
    contentArea.replaceChildren();

    if (state.loading) {
      contentArea.append(card('Loading Library', [
        el('p', { className: 'card-stat-desc' }, ['Fetching available papers and assigned exam catalog...'])
      ]));
      return;
    }

    if (state.error) {
      contentArea.append(card('Unable to load Library', [
        el('p', { style: 'color:#ef4444; margin-bottom: 12px; font-weight:600;' }, [state.error]),
        el('button', {
          className: 'btn btn-primary',
          onclick: () => {
            state.exams = null;
            render();
          }
        }, ['🔄 Retry'])
      ]));
      return;
    }

    let list = state.exams || [];

    if (state.librarySearch) {
      list = list.filter(x => (x.title || x.examId || x.id || '').toLowerCase().includes(state.librarySearch));
    }

    if (state.libraryFilter === 'pyq') {
      list = list.filter(x => (x.title || '').match(/20\d{2}/));
    } else if (state.libraryFilter === 'diagnostic') {
      list = list.filter(x => (x.title || '').toLowerCase().includes('diagnostic') || (x.title || '').toLowerCase().includes('spatial'));
    } else if (state.libraryFilter === 'mock') {
      list = list.filter(x => (x.title || '').toLowerCase().includes('mock'));
    }

    if (list.length === 0) {
      contentArea.append(card('No Papers Found', [
        el('p', { className: 'card-stat-desc', style: 'margin-bottom: 14px;' }, [
          state.librarySearch ? 'No papers match your search criteria. Try resetting filters.' : 'No papers available in your Library yet.'
        ]),
        el('button', {
          className: 'btn btn-outline',
          onclick: () => {
            state.librarySearch = '';
            state.libraryFilter = 'all';
            renderLibraryContent();
          }
        }, ['Reset Filters'])
      ]));
      return;
    }

    const headerTitle = el('div', { className: 'card-header-title', style: 'margin-bottom: 16px;' }, [
      `Available Papers (${list.length})`
    ]);

    const cardsGrid = el('div', { className: 'mock-card-grid' }, list.map(x => {
      const yearMatch = (x.title || '').match(/20\d{2}/)?.[0] || 'Paper';
      const questionCount = x.totalQuestions != null && Number.isFinite(Number(x.totalQuestions)) ? Number(x.totalQuestions) : null;
      const duration = x.durationSeconds != null && Number.isFinite(Number(x.durationSeconds)) ? Math.round(Number(x.durationSeconds) / 60) : null;
      const totalMarks = x.maxMarks != null && Number.isFinite(Number(x.maxMarks)) ? Number(x.maxMarks) : null;
      const paperId = x.examId || x.id;
      const isSelected = state.selectedPaper === paperId;
      const status = x.status || 'available'; // 'available' | 'active' | 'submitted'

      return el('div', { className: `mock-card ${isSelected ? 'selected' : ''}` }, [
        el('div', { className: 'mock-card-header' }, [
          el('div', { style: 'display:flex; align-items:center; justify-content:space-between;' }, [
            el('span', { className: 'year-badge' }, [yearMatch]),
            el('span', { className: `status-chip ${status === 'active' ? 'in-progress' : status === 'submitted' ? 'submitted' : 'ready'}` }, [
              status === 'active' ? 'In Progress' : status === 'submitted' ? 'Completed' : 'Assigned'
            ])
          ]),
          el('h3', { className: 'mock-card-title', style: 'margin-top:10px;' }, [x.title || paperId || 'Question Paper'])
        ]),
        el('div', { className: 'mock-card-meta' }, [
          el('span', {}, [`📝 ${questionCount ?? '—'} Questions`]),
          el('span', {}, [`⏱️ ${duration ?? '—'} Mins`]),
          el('span', {}, [`🏆 ${totalMarks ?? '—'} Marks`]),
          el('span', {}, [x.hasImages ? '🖼️ Diagrams Included' : 'No diagrams'])
        ]),
        isSelected ? el('div', { style: 'background:var(--bg-input); padding:14px; border-radius:12px; border:1px solid var(--brds-red); margin-top:8px;' }, [
          el('div', { style: 'font-weight:700; font-size:0.85rem; color:var(--brds-red); margin-bottom:4px;' }, ['Selected Paper Ready for Launch']),
          el('p', { style: 'font-size:0.78rem; color:var(--text-secondary); margin-bottom:12px;' }, ['Ensure a stable connection. Timed exam session begins immediately upon launch.']),
          el('div', { style: 'display:flex; gap:8px;' }, [
            el('button', {
              className: 'btn btn-primary',
              onclick: async (evt) => {
                const btn = evt.currentTarget;
                btn.disabled = true;
                btn.textContent = 'Launching Exam...';
                try {
                  const startData = await apiFetch(`/api/exams/${encodeURIComponent(paperId)}/start`, { method: 'POST' });
                  const attemptId = startData.id || startData.attemptId;
                  if (!attemptId) throw new Error('Server did not return a valid attempt ID');
                  location.assign(`/exam.html?id=${encodeURIComponent(attemptId)}`);
                } catch (error) {
                  alert(error.message);
                  btn.disabled = false;
                  btn.textContent = 'Start Timed Exam →';
                }
              }
            }, ['Start Timed Exam →']),
            el('button', {
              className: 'btn btn-outline',
              onclick: () => {
                state.selectedPaper = null;
                renderLibraryContent();
              }
            }, ['Cancel'])
          ])
        ]) : el('div', { className: 'mock-card-footer' }, [
          el('span', { className: 'card-stat-desc' }, ['Part-A Computer Based Test']),
          el('button', {
            className: 'btn btn-primary',
            onclick: () => {
              if (status === 'active' && x.attemptId) {
                location.assign(`/exam.html?id=${encodeURIComponent(x.attemptId)}`);
              } else if (status === 'submitted') {
                if (x.attemptId) {
                  location.assign(`/exam.html?id=${encodeURIComponent(x.attemptId)}`);
                } else {
                  state.tab = 'analytics';
                  render();
                }
              } else {
                state.selectedPaper = paperId;
                renderLibraryContent();
              }
            }
          }, [status === 'active' ? 'Resume Exam →' : status === 'submitted' ? 'View Scorecard →' : 'Select Paper →'])
        ])
      ]);
    }));

    contentArea.append(headerTitle, cardsGrid);
  }

  if (!state.exams && !state.loading) {
    state.loading = true;
    renderLibraryContent();
    try {
      const data = await apiFetch('/api/exams');
      state.exams = data.exams || [];
      state.loading = false;
      state.error = null;
    } catch (e) {
      state.loading = false;
      state.error = e.message || 'Failed to connect to exam server.';
    }
    renderLibraryContent();
  } else {
    renderLibraryContent();
  }

  return [wrap];
}

async function practiceView() {
  const wrap = el('div', { className: 'practice-container' });
  wrap.append(header('Practice Set Builder', 'Build topic-wise practice sets, review saved sets, or practice bookmarked questions.'));

  // Sub-navigation bar
  const subNav = el('div', { className: 'filter-bar-row', style: 'margin-bottom: 20px;' }, [
    el('div', { className: 'pill-group' }, [
      ['builder', '⚡ Custom Set Builder'],
      ['archive', '📦 Saved Sets Archive'],
      ['bookmarks', '🔖 Bookmarks & Revision Queue']
    ].map(([id, label]) => el('button', {
      className: `pill-btn ${state.practiceSubTab === id ? 'active' : ''}`,
      onclick: () => {
        state.practiceSubTab = id;
        render();
      }
    }, [label])))
  ]);

  wrap.append(subNav);

  // Active Practice Question Session Renderer
  if (state.activePracticeSet) {
    const set = state.activePracticeSet;
    const qList = set.questions || [];
    const qIndex = state.practiceIndex || 0;
    const currentQ = qList[qIndex];

    if (!currentQ) {
      state.activePracticeSet = null;
      render();
      return [wrap];
    }

    const qCard = el('div', { className: 'practice-question-card' }, [
      el('div', { style: 'display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-subtle); padding-bottom:12px;' }, [
        el('div', { style: 'display:flex; gap:8px; align-items:center;' }, [
          el('span', { className: 'year-badge' }, [`Question ${qIndex + 1} of ${qList.length}`]),
          el('span', { className: 'question-tag' }, [currentQ.topic || 'Practice Topic']),
          el('span', { className: 'question-tag', style: 'background:rgba(91,92,226,0.12); color:#5b5ce2;' }, [currentQ.type])
        ]),
        el('button', {
          className: 'btn btn-outline',
          style: 'padding:4px 10px; font-size:0.75rem;',
          onclick: () => {
            state.activePracticeSet = null;
            render();
          }
        }, ['✕ Exit Practice Session'])
      ]),
      el('p', { className: 'practice-question-prompt' }, [currentQ.prompt || currentQ.text || 'Practice Question Prompt']),
      currentQ.image ? el('div', { style: 'margin:14px 0; text-align:center;' }, [
        el('img', { src: currentQ.image, alt: 'Question Diagram', style: 'max-width:100%; border-radius:10px; border:1px solid var(--border-subtle);' })
      ]) : null,
      currentQ.options && Array.isArray(currentQ.options) ? el('div', { className: 'option-choice-list' }, currentQ.options.map(opt => {
        const isMsq = currentQ.type === 'MSQ';
        const userAns = state.userAnswers[currentQ.id] ?? set.answers?.[currentQ.id]?.value;
        const isSel = isMsq
          ? (Array.isArray(userAns) ? userAns.includes(opt.id) : userAns === opt.id)
          : userAns === opt.id;
        return el('button', {
          className: `option-choice-btn ${isSel ? 'selected' : ''}`,
          onclick: async () => {
            let newVal;
            if (isMsq) {
              let arr = Array.isArray(userAns) ? [...userAns] : userAns ? [userAns] : [];
              if (arr.includes(opt.id)) {
                arr = arr.filter(x => x !== opt.id);
              } else {
                arr.push(opt.id);
                arr.sort();
              }
              newVal = arr;
            } else {
              newVal = opt.id;
            }
            try {
              await apiFetch('/api/student/practice/answer', {
                method: 'POST',
                body: JSON.stringify({ setId: set.id, questionId: currentQ.id, value: newVal })
              });
              state.userAnswers[currentQ.id] = newVal;
              state.practiceActionError = null;
              set.answers = { ...(set.answers || {}), [currentQ.id]: { value: newVal } };
              state.practiceSets = null;
            } catch (err) {
              state.practiceActionError = `Answer was not saved: ${err.message}`;
            }
            render();
          }
        }, [
          el('span', { className: 'option-choice-key' }, [opt.id ? opt.id.toUpperCase() : '•']),
          el('span', {}, [opt.text || opt])
        ]);
      })) : el('div', { style: 'margin-top:14px;' }, [
        el('label', { style: 'font-size:0.82rem; font-weight:700; color:var(--text-secondary); margin-bottom:6px; display:block;' }, ['Your Answer:']),
        el('input', {
          type: 'text',
          className: 'form-control',
          placeholder: 'Enter numerical or text answer...',
          value: state.userAnswers[currentQ.id] ?? set.answers?.[currentQ.id]?.value ?? '',
          onchange: async (e) => {
            const val = e.target.value;
            try {
              await apiFetch('/api/student/practice/answer', {
                method: 'POST',
                body: JSON.stringify({ setId: set.id, questionId: currentQ.id, value: val })
              });
              state.userAnswers[currentQ.id] = val;
              state.practiceActionError = null;
              set.answers = { ...(set.answers || {}), [currentQ.id]: { value: val } };
              state.practiceSets = null;
            } catch (err) {
              state.practiceActionError = `Answer was not saved: ${err.message}`;
            }
            render();
          }
        })
      ]),
      state.practiceActionError ? el('p', { role: 'alert', className: 'practice-error-message' }, [state.practiceActionError]) : null,
      el('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-top:24px; padding-top:16px; border-top:1px solid var(--border-subtle);' }, [
        el('button', {
          className: 'btn btn-outline',
          disabled: qIndex === 0,
          onclick: () => { state.practiceIndex--; render(); }
        }, ['← Previous']),
        el('button', {
          className: 'btn btn-outline',
          onclick: async () => {
            try {
              await apiFetch('/api/student/bookmarks', {
                method: 'POST',
                body: JSON.stringify({ examId: currentQ.examId, questionId: currentQ.id, bookmarked: true })
              });
              state.bookmarksData = null;
              state.revisionData = null;
              alert('Question added to your Revision Queue bookmarks!');
            } catch (err) {
              alert(err.message);
            }
          }
        }, ['★ Bookmark Question']),
        el('button', {
          className: 'btn btn-primary',
          onclick: () => {
            if (qIndex < qList.length - 1) {
              state.practiceIndex++;
              render();
            } else {
              alert('Practice Set Complete! Answers saved to your practice stats.');
              state.activePracticeSet = null;
              state.practiceSets = null;
              render();
            }
          }
        }, [qIndex < qList.length - 1 ? 'Next Question →' : 'Finish Practice Set ✓'])
      ])
    ]);

    wrap.append(qCard);
    return [wrap];
  }

  if (state.practiceSubTab === 'archive') {
    let sets = state.practiceSets;
    if (!sets) {
      try {
        const res = await apiFetch('/api/student/practice/sets');
        sets = res.sets || [];
        state.practiceSets = sets;
      } catch (e) {
        sets = [];
      }
    }

    const archiveGrid = el('div', { className: 'mock-card-grid' }, sets.length === 0 ? [
      el('p', { className: 'card-stat-desc' }, ['No saved practice sets found yet. Use the Custom Set Builder to create one!'])
    ] : sets.map(s => el('div', { className: 'mock-card' }, [
      el('div', { className: 'mock-card-header' }, [
        el('div', { style: 'display:flex; justify-content:space-between; align-items:center;' }, [
          el('span', { className: `status-chip ${s.status === 'completed' ? 'submitted' : 'in-progress'}` }, [
            s.status === 'completed' ? 'Completed' : s.status === 'empty' ? 'No Questions' : 'In Progress'
          ]),
          el('span', { className: 'card-stat-desc' }, [s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'Practice Set'])
        ]),
        el('h3', { className: 'mock-card-title', style: 'margin-top:8px;' }, [s.title || 'Custom Practice Set'])
      ]),
      el('div', { className: 'mock-card-meta' }, [
        el('span', {}, [`📝 ${s.completedQuestions || 0} / ${s.totalQuestions} Answered`]),
        el('span', {}, [`📌 ${s.filters?.difficulty || 'Mixed'} Level`]),
        el('span', {}, [`${s.questionIds?.length || 0} Questions`])
      ]),
      el('div', { className: 'mock-card-footer' }, [
        el('span', { className: 'card-stat-desc' }, ['Practice Mode']),
        el('button', {
          className: 'btn btn-primary',
          onclick: async () => {
            try {
              const data = await apiFetch(`/api/student/practice/sets/${encodeURIComponent(s.id)}`);
              state.activePracticeSet = data.set;
              state.practiceIndex = 0;
              state.userAnswers = Object.fromEntries(Object.entries(data.set.answers || {}).map(([id, answer]) => [id, answer.value]));
              render();
            } catch (err) {
              alert(err.message);
            }
          }
        }, [s.status === 'completed' ? 'Review Set →' : 'Resume Practice →'])
      ])
    ])));

    wrap.append(card('Saved Practice Sets', [archiveGrid]));
    return [wrap];
  }

  if (state.practiceSubTab === 'bookmarks') {
    let reviewQuestions = state.revisionData;
    if (!reviewQuestions || !state.bookmarksData) {
      try {
        const [revisionResponse, bookmarkResponse] = await Promise.all([
          apiFetch('/api/student/practice/revision'), apiFetch('/api/student/bookmarks')
        ]);
        state.revisionData = revisionResponse.questions || [];
        state.bookmarksData = bookmarkResponse.bookmarks || [];
        reviewQuestions = state.revisionData;
      } catch (e) {
        state.practiceActionError = `Unable to load revision queue: ${e.message}`;
        reviewQuestions = state.revisionData || [];
      }
    }
    const merged = new Map();
    for (const question of [...(reviewQuestions || []), ...(state.bookmarksData || [])]) {
      const key = `${question.examId}:${question.id || question.questionId}`;
      merged.set(key, { ...merged.get(key), ...question, bookmarked: Boolean(question.bookmarked || merged.get(key)?.bookmarked) });
    }
    const questions = [...merged.values()];

    const bookmarksList = el('div', {}, [
      el('div', { className: 'filter-bar-row', style: 'margin-bottom: 16px;' }, [
        el('span', { className: 'card-stat-desc' }, [`Showing ${questions.length} bookmarked or missed revision questions`]),
        el('button', {
          className: 'btn btn-outline',
          onclick: () => { state.revisionData = null; state.bookmarksData = null; state.practiceActionError = null; render(); }
        }, ['🔄 Refresh Queue'])
      ]),
      state.practiceActionError ? el('p', { role: 'alert', className: 'practice-error-message' }, [state.practiceActionError]) : null,
      el('div', { className: 'bookmarks-grid' }, questions.length === 0 ? [
        el('p', { className: 'card-stat-desc' }, ['Your revision queue is clean! Bookmark questions during practice or mocks to review them here.'])
      ] : questions.map(q => el('div', { className: 'question-preview-tile' }, [
        el('div', { className: 'question-preview-header' }, [
          el('div', { style: 'display:flex; gap:8px; align-items:center;' }, [
            el('span', { className: 'question-tag' }, [q.topic || 'Revision Topic']),
            el('span', { className: 'question-tag', style: 'background:rgba(91,92,226,0.12); color:#5b5ce2;' }, [q.type || 'Q']),
            el('span', { className: 'card-stat-desc' }, [q.examTitle || 'Revision Question'])
          ]),
          el('span', { className: `status-chip ${q.bookmarked ? 'ready' : 'watch'}` }, [q.bookmarked ? 'Bookmarked' : 'Needs Revision'])
        ]),
        el('p', { style: 'font-weight:600; font-size:0.9rem; color:var(--text-primary); margin:6px 0;' }, [q.prompt || q.text]),
        el('div', { style: 'display:flex; justify-content:flex-end;' }, [
          q.setId ? el('button', { className: 'btn btn-primary', style: 'padding:6px 14px; font-size:0.8rem;', onclick: async () => {
            try {
              const response = await apiFetch(`/api/student/practice/sets/${encodeURIComponent(q.setId)}`);
              state.activePracticeSet = response.set;
              state.practiceIndex = Math.max(0, response.set.questionIds.indexOf(q.id));
              render();
            } catch (error) { state.practiceActionError = error.message; render(); }
          } }, ['Review Missed Item →']) : el('button', { className: 'btn btn-outline', style: 'padding:6px 14px; font-size:0.8rem;', onclick: () => {
            state.tab = 'papers'; state.selectedPaper = q.examId; render();
          } }, ['Open Source Paper →']),
          q.bookmarked ? el('button', { className: 'btn btn-outline', style: 'padding:6px 14px; font-size:0.8rem;', onclick: async () => {
            try {
              await apiFetch('/api/student/bookmarks', { method: 'POST', body: JSON.stringify({ examId: q.examId, questionId: q.id || q.questionId, bookmarked: false }) });
              state.bookmarksData = null; render();
            } catch (error) { state.practiceActionError = error.message; render(); }
          } }, ['Remove Bookmark']) : null
        ])
      ])))
    ]);

    wrap.append(card('Revision Queue & Bookmarks', [bookmarksList]));
    return [wrap];
  }

  // Builder View
  const updateMatchingCount = async () => {
    try {
      const res = await apiFetch('/api/student/practice/count', {
        method: 'POST',
        body: JSON.stringify({
          exam: state.practiceExamFilter,
          topics: Array.from(state.selectedTopics),
          difficulty: state.practiceDifficulty,
          type: state.practiceType
        })
      });
      state.practiceMatchingCount = res.count ?? 0;
      state.practiceCountError = null;
      const countEl = document.querySelector('#matching-count-pill');
      if (countEl) countEl.textContent = `✨ ${state.practiceMatchingCount} Questions Available in Bank`;
    } catch (e) {
      state.practiceMatchingCount = null;
      state.practiceCountError = `Question count unavailable: ${e.message}`;
      const countEl = document.querySelector('#matching-count-pill');
      if (countEl) countEl.textContent = 'Question count unavailable';
    }
  };

  const filtersCard = card('Step 1: Configure Practice Parameters', [
    el('div', { className: 'filter-bar-row', style: 'margin-bottom: 0;' }, [
      el('div', { className: 'form-group', style: 'margin:0; min-width: 180px;' }, [
        el('label', {}, ['Target Exam']),
        el('select', {
          className: 'filter-select',
          style: 'width:100%;',
          value: state.practiceExamFilter || 'all',
          onchange: (e) => { state.practiceExamFilter = e.target.value; updateMatchingCount(); render(); }
        }, [
          el('option', { value: 'all' }, ['All Papers & Diagnostic']),
          el('option', { value: 'uceed-2026' }, ['UCEED 2026']),
          el('option', { value: 'uceed-2025' }, ['UCEED 2025']),
          el('option', { value: 'uceed-2024' }, ['UCEED 2024']),
          el('option', { value: 'spatial' }, ['Spatial Reasoning Diagnostic'])
        ])
      ]),
      el('div', { className: 'form-group', style: 'margin:0; min-width: 150px;' }, [
        el('label', {}, ['Difficulty']),
        el('select', {
          className: 'filter-select',
          style: 'width:100%;',
          value: state.practiceDifficulty || 'all',
          onchange: (e) => { state.practiceDifficulty = e.target.value; updateMatchingCount(); render(); }
        }, [
          el('option', { value: 'all' }, ['All Levels (Mixed)']),
          el('option', { value: 'easy' }, ['Easy (+1.0)']),
          el('option', { value: 'medium' }, ['Medium (+2.0)']),
          el('option', { value: 'hard' }, ['Hard (+3.0)'])
        ])
      ]),
      el('div', { className: 'form-group', style: 'margin:0; min-width: 160px;' }, [
        el('label', {}, ['Question Format']),
        el('select', {
          className: 'filter-select',
          style: 'width:100%;',
          value: state.practiceType || 'all',
          onchange: (e) => { state.practiceType = e.target.value; updateMatchingCount(); render(); }
        }, [
          el('option', { value: 'all' }, ['All Formats (MCQ+MSQ+NAT)']),
          el('option', { value: 'mcq' }, ['MCQ (Single Choice)']),
          el('option', { value: 'msq' }, ['MSQ (Multiple Choice)']),
          el('option', { value: 'nat' }, ['NAT (Numerical)'])
        ])
      ]),
      el('div', { className: 'form-group', style: 'margin:0;' }, [
        el('label', {}, ['Question Count']),
        el('div', { className: 'pill-group' }, [5, 10, 15, 20, 30].map(cnt => el('button', {
          className: `pill-btn ${state.practiceSetSize === cnt ? 'active' : ''}`,
          onclick: () => { state.practiceSetSize = cnt; render(); }
        }, [`${cnt} Qs`])))
      ])
    ])
  ]);

  const syllabusDomains = [
    {
      id: 'spatial',
      part: 'part-a',
      title: '🔷 Spatial Reasoning & Visualization',
      topics: ['3D Isometric Rotations', 'Pattern Counting', 'Paper Folding & Unfolding', 'Spatial Assembly', 'Orthographic Projections', 'Surface Development']
    },
    {
      id: 'observation',
      part: 'part-a',
      title: '👁️ Observation & Design Sensitivity',
      topics: ['Visual Acuity', 'Shadow & Light Analysis', 'Font & Logo Identification', 'Aesthetic Golden Ratio', 'Texture & Pattern Matching']
    },
    {
      id: 'env',
      part: 'part-a',
      title: '🌿 Environmental & Social Awareness',
      topics: ['Eco-Design & Sustainability', 'Indian Art & Craft Culture', 'Architectural History', 'Design Icons & Products', 'Climate & Renewable Energy']
    },
    {
      id: 'analytical',
      part: 'part-a',
      title: '🧩 Analytical & Logical Reasoning',
      topics: ['Pattern Sequences', 'Mechanical Reasoning', 'Spatial Puzzles', 'Venn Diagrams', 'Ratio & Proportion']
    },
    {
      id: 'language',
      part: 'part-a',
      title: '🔤 Language & Creativity',
      topics: ['Typography & Fonts', 'Visual Analogies', 'Idiom Visualization', 'Poster & Branding Concepts']
    },
    {
      id: 'drawing',
      part: 'part-b',
      title: '✏️ Part-B Drawing & Composition',
      topics: ['Perspective & Grid Drawing', 'Human Anatomy & Proportion', 'Object & Environment Study', 'Storyboard Sequence']
    }
  ];

  const syllabusCard = card('Step 2: Select UCEED Syllabus Topics', [
    el('div', {}, syllabusDomains.map(d => el('div', { className: 'syllabus-category-card' }, [
      el('div', { className: 'syllabus-category-header' }, [
        el('div', { className: 'syllabus-category-title' }, [
          d.title,
          el('span', { className: `syllabus-part-badge ${d.part}` }, [d.part.toUpperCase()])
        ]),
        el('span', { className: 'card-stat-desc' }, [`${d.topics.length} Subtopics`])
      ]),
      el('div', { className: 'topic-subchips-grid' }, d.topics.map(t => {
        const isSel = state.selectedTopics && state.selectedTopics.has(t);
        return el('div', {
          className: `topic-subchip ${isSel ? 'selected' : ''}`,
          onclick: () => {
            if (!state.selectedTopics) state.selectedTopics = new Set();
            if (state.selectedTopics.has(t)) state.selectedTopics.delete(t);
            else state.selectedTopics.add(t);
            updateMatchingCount();
            render();
          }
        }, [isSel ? '✓ ' : '+ ', t]);
      }))
    ])))
  ]);

  const selectedCount = state.selectedTopics ? state.selectedTopics.size : 0;
  const matchDisplay = state.practiceMatchingCount !== null ? state.practiceMatchingCount : 'Loading…';

  const generatorCard = card('Step 3: Generate Practice Set', [
    el('div', { style: 'display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;' }, [
      el('div', { className: 'filter-group-inline' }, [
        el('div', { id: 'matching-count-pill', className: 'matching-counter-pill', role: 'status' }, [state.practiceCountError || `✨ ${matchDisplay}${typeof matchDisplay === 'number' ? ' Questions Available in Bank' : ''}`]),
        el('span', { className: 'card-stat-desc' }, [
          selectedCount === 0 ? 'All syllabus topics included' : `${selectedCount} topics selected`
        ])
      ]),
      el('button', {
        className: 'btn btn-primary',
        style: 'padding:12px 24px; font-size:0.95rem;',
        onclick: async (evt) => {
          const btn = evt.currentTarget;
          btn.disabled = true;
          btn.textContent = 'Creating Set...';
          try {
            const data = await apiFetch('/api/student/practice/create', {
              method: 'POST',
              body: JSON.stringify({
                exam: state.practiceExamFilter,
                topics: Array.from(state.selectedTopics),
                difficulty: state.practiceDifficulty,
                type: state.practiceType,
                setSize: state.practiceSetSize
              })
            });
            if (data.set) {
              if (data.set.totalQuestions === 0 || !data.set.questionIds || data.set.questionIds.length === 0) {
                state.activePracticeSet = null;
                state.practiceFeedback = '⚠️ No matching questions found in the bank for these filters. Try selecting different topics or setting difficulty to "All Levels".';
              } else {
                const fullRes = await apiFetch(`/api/student/practice/sets/${encodeURIComponent(data.set.id)}`);
                state.activePracticeSet = fullRes.set;
                state.practiceIndex = 0;
                state.userAnswers = Object.fromEntries(Object.entries(fullRes.set.answers || {}).map(([id, answer]) => [id, answer.value]));
                state.practiceSets = null;
                state.practiceFeedback = `🚀 Custom practice set generated with ${state.activePracticeSet?.questions?.length || data.set.totalQuestions} questions!`;
              }
              render();
            }
          } catch (err) {
            alert(err.message);
            btn.disabled = false;
            btn.textContent = '🚀 Generate Custom Practice Set';
          }
        }
      }, ['🚀 Generate Custom Practice Set'])
    ]),
    state.practiceFeedback ? el('div', { role: 'status', style: `margin-top:14px; background:${state.practiceFeedback.startsWith('⚠️') ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)'}; border:1px solid ${state.practiceFeedback.startsWith('⚠️') ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}; color:${state.practiceFeedback.startsWith('⚠️') ? '#f59e0b' : '#10b981'}; padding:12px 16px; border-radius:10px; font-weight:700; font-size:0.88rem;` }, [
      state.practiceFeedback
    ]) : null
  ]);

  wrap.append(filtersCard, syllabusCard, generatorCard);

  if (state.practiceMatchingCount === null) {
    updateMatchingCount();
  }

  return [wrap];
}

async function mocksView() {
  const wrap = el('div', { className: 'mocks-container' });
  wrap.append(header('Mock Exams & Practice Papers', 'Timed exam simulations with official UCEED Part-A scoring and detailed scorecards.'));

  let list = state.exams;
  if (!list) {
    try {
      const data = await apiFetch('/api/exams');
      list = data.exams || [];
      state.exams = list;
      state.mockLoadError = null;
    } catch (e) {
      list = [];
      state.mockLoadError = e.message;
    }
  }

  const filterBar = el('div', { className: 'filter-bar-row' }, [
    el('div', { className: 'filter-group-inline' }, [
      el('select', {
        className: 'filter-select',
        value: state.mockFilter || 'all',
        onchange: (e) => { state.mockFilter = e.target.value; render(); }
      }, [
        el('option', { value: 'all' }, ['All Mocks']),
        el('option', { value: 'ready' }, ['Available / Ready']),
        el('option', { value: 'in-progress' }, ['In Progress']),
        el('option', { value: 'completed' }, ['Completed / Submitted'])
      ])
    ]),
    el('span', { className: 'card-stat-desc' }, [`${list.length} Mocks Available`])
  ]);

  wrap.append(filterBar);
  if (state.mockLoadError) {
    wrap.append(card('Unable to load mocks', [
      el('p', { role: 'alert', className: 'card-stat-desc' }, [state.mockLoadError]),
      el('button', { className: 'btn btn-primary', onclick: () => { state.exams = null; state.mockLoadError = null; render(); } }, ['Retry'])
    ]));
    return [wrap];
  }

  let filtered = list;
  if (state.mockFilter === 'ready') filtered = list.filter(m => (m.status || 'available') === 'available');
  else if (state.mockFilter === 'in-progress') filtered = list.filter(m => m.status === 'active');
  else if (state.mockFilter === 'completed') filtered = list.filter(m => m.status === 'submitted');

  const grid = el('div', { className: 'mock-card-grid' }, filtered.length === 0 ? [
    el('p', { className: 'card-stat-desc' }, ['No mocks match the selected status filter.'])
  ] : filtered.map(m => {
    const status = m.status || 'available';
    const paperId = m.examId || m.id;
    const duration = Number.isFinite(Number(m.durationSeconds)) ? Math.round(Number(m.durationSeconds) / 60) : null;

    return el('div', { className: 'mock-card' }, [
      el('div', { className: 'mock-card-header' }, [
        el('div', { style: 'display:flex; justify-content:space-between; align-items:center;' }, [
          el('span', { className: 'year-badge' }, [(m.title || '').match(/20\d{2}/)?.[0] || 'Official']),
          el('span', { className: `status-chip ${status === 'active' ? 'in-progress' : status === 'submitted' ? 'submitted' : 'ready'}` }, [
            status === 'active' ? 'In Progress' : status === 'submitted' ? 'Completed' : 'Ready'
          ])
        ]),
        el('h3', { className: 'mock-card-title', style: 'margin-top:10px;' }, [m.title || paperId])
      ]),
      el('div', { className: 'mock-card-meta' }, [
        el('span', {}, [`📝 ${m.totalQuestions ?? '—'} Qs`]),
        el('span', {}, [`⏱️ ${duration ?? '—'} Mins`]),
        el('span', {}, [`🏆 ${m.maxMarks ?? '—'} Marks`])
      ]),
      el('div', { className: 'mock-card-footer' }, [
        el('span', { className: 'card-stat-desc' }, ['Server Scored']),
        el('button', {
          className: 'btn btn-primary',
          onclick: async () => {
            if (status === 'active' && m.attemptId) {
              location.assign(`/exam.html?id=${encodeURIComponent(m.attemptId)}`);
            } else if (status === 'submitted' && m.attemptId) {
              location.assign(`/exam.html?id=${encodeURIComponent(m.attemptId)}`);
            } else {
              state.tab = 'papers';
              state.selectedPaper = paperId;
              render();
            }
          }
        }, [status === 'submitted' ? 'View Scorecard →' : status === 'active' ? 'Resume Mock →' : 'Start Timed Mock →'])
      ])
    ]);
  }));

  wrap.append(card('Available Mock Papers', [grid]));
  return [wrap];
}

async function analyticsView() {
  const wrap = el('div', { className: 'analytics-container' });
  wrap.append(header('Performance Analytics & Marks Leakage', 'Comprehensive score breakdown, accuracy trends, marks leaks, and topic risk analysis.'));

  const filterBar = el('div', { className: 'filter-bar-row' }, [
    el('div', { className: 'filter-group-inline' }, [
      el('select', {
        className: 'filter-select',
        value: state.analyticsDate || 'all',
        onchange: (e) => { state.analyticsDate = e.target.value; render(); }
      }, [
        el('option', { value: 'all' }, ['All Time']),
        el('option', { value: '30days' }, ['Last 30 Days']),
        el('option', { value: '7days' }, ['Last 7 Days'])
      ]),
      el('select', {
        className: 'filter-select',
        value: state.analyticsExam || 'all',
        onchange: (e) => { state.analyticsExam = e.target.value; render(); }
      }, [
        el('option', { value: 'all' }, ['All Papers & Mocks']),
        el('option', { value: 'uceed-2026' }, ['UCEED 2026']),
        el('option', { value: 'uceed-2025' }, ['UCEED 2025']),
        el('option', { value: 'spatial' }, ['Spatial Reasoning Diagnostic'])
      ])
    ]),
    el('button', {
      className: 'btn btn-outline',
      onclick: () => {
        state.analyticsData = null;
        render();
      }
    }, ['🔄 Refresh Analytics'])
  ]);

  wrap.append(filterBar);

  let data = state.analyticsData;
  if (!data) {
    try {
      data = await apiFetch('/api/student/analytics');
      state.analyticsData = data;
    } catch (e) {
      console.warn('Analytics fetch error:', e.message);
    }
  }

  const sample = data?.sample || {};
  const kpis = data?.kpis || {};
  const completedCount = sample.completedAttempts || kpis.completedAttempts || 0;

  // Respect sample thresholds: empty history must remain non-diagnostic
  if (completedCount === 0) {
    wrap.append(card('No Completed Exam Attempts Found', [
      el('p', { className: 'card-stat-desc', style: 'margin-bottom:14px; font-size:0.9rem;' }, [
        'Attempt at least 1 timed mock paper from Library to unlock score trends, marks leakage diagnostic, and SWOT performance analysis.'
      ]),
      el('button', {
        className: 'btn btn-primary',
        onclick: () => { state.tab = 'papers'; render(); }
      }, ['Open Library to Take First Mock →'])
    ]));
    return [wrap];
  }

  // Sample Threshold Warning Banner if trends require 3 completed mocks
  if (!sample.reliableTrends && completedCount < 3) {
    wrap.append(el('div', { className: 'sample-threshold-banner' }, [
      el('span', {}, [`ℹ️ Baseline analytics loaded from ${completedCount} completed attempt. Complete 3 full-length mocks to unlock reliable trend graphs.`]),
      el('button', {
        className: 'btn btn-outline',
        style: 'padding:4px 10px; font-size:0.75rem;',
        onclick: () => { state.tab = 'papers'; render(); }
      }, ['Take Next Mock →'])
    ]));
  }

  // Hero Metric Stat Tiles (6 Cards)
  const heroMetrics = el('div', { className: 'card-grid' }, [
    ['Mock Score Average', kpis.marks !== null && kpis.marks !== undefined ? `${kpis.marks} Marks` : '—', `${completedCount} mock(s) completed`],
    ['Best Mock Score', data?.trend && data.trend.length ? `${Math.max(...data.trend.map(t => t.score))} Marks` : (kpis.marks ? `${kpis.marks} Marks` : '—'), 'Peak performance'],
    ['Overall Accuracy', kpis.accuracyPct !== null && kpis.accuracyPct !== undefined ? `${kpis.accuracyPct}%` : '—', `${kpis.questionsAnswered || 0} total questions answered`],
    ['Active Day Streak', `${data?.calendar ? data.calendar.length : 1} Days`, '365-day consistency grid'],
    ['Avg Time / Question', kpis.averageTimeSeconds ? `${kpis.averageTimeSeconds}s` : '—', 'Target: <90s per question'],
    ['Total Solved', `${kpis.questionsAnswered || 0} Qs`, `Skipped: ${kpis.skipped || 0} Qs`]
  ].map(([title, val, desc]) => card(title, [
    el('h2', { className: 'card-stat-value' }, [val]),
    el('p', { className: 'card-stat-desc' }, [desc])
  ])));

  // Marks Leakage Panel
  const leaks = data?.marksLeaks || [];
  const negMarks = kpis.negativeMarks || 0;

  const leakagePanel = el('div', { className: 'leakage-card' }, [
    el('div', { className: 'leakage-header' }, [
      el('div', { className: 'leakage-title' }, [
        '⚠️ Marks Leakage Diagnostic Engine',
        el('span', { className: 'status-chip', style: 'background:rgba(239,68,68,0.15); color:#ef4444;' }, [
          `-${(negMarks + (kpis.skipped || 0) * 0.5).toFixed(1)} Marks Total Leak`
        ])
      ]),
      el('span', { className: 'card-stat-desc' }, ['Data-backed from your attempts'])
    ]),
    el('div', { className: 'leakage-grid' }, [
      el('div', { className: 'leakage-item' }, [
        el('div', { className: 'card-header-title' }, ['Negative Marks Lost']),
        el('div', { className: 'leakage-item-val' }, [`-${negMarks} Marks`]),
        el('div', { className: 'leakage-item-desc' }, ['From incorrect MSQ/MCQ guesses'])
      ]),
      el('div', { className: 'leakage-item' }, [
        el('div', { className: 'card-header-title' }, ['Skipped Questions']),
        el('div', { className: 'leakage-item-val', style: 'color:#f59e0b;' }, [`${kpis.skipped || 0} Skipped`]),
        el('div', { className: 'leakage-item-desc' }, ['Unattempted potential marks'])
      ]),
      el('div', { className: 'leakage-item' }, [
        el('div', { className: 'card-header-title' }, ['Tracked Score Leaks']),
        el('div', { className: 'leakage-item-val', style: 'color:#ef4444;' }, [`${leaks.length} Items`]),
        el('div', { className: 'leakage-item-desc' }, ['Questions with lost marks'])
      ])
    ]),
    el('div', { style: 'margin-top:16px; background:var(--bg-input); padding:12px 16px; border-radius:10px; border:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;' }, [
      el('div', { style: 'font-size:0.82rem; font-weight:700; color:var(--text-primary);' }, [
        '💡 Strategy Tip: Eliminating low-confidence MSQ guesses will prevent negative mark penalties.'
      ]),
      el('button', {
        className: 'btn btn-outline',
        style: 'padding:6px 12px; font-size:0.78rem;',
        onclick: () => { state.tab = 'practice'; state.practiceType = 'msq'; render(); }
      }, ['Practice MSQs →'])
    ])
  ]);

  // Strategy Breakdown by Question Type
  const qStrategy = data?.questionStrategy || [];
  const strategyCard = card('Question-Type Strategy & Accuracy Breakdown', [
    el('div', { style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:18px; margin-top:10px;' }, qStrategy.length === 0 ? [
      el('p', { className: 'card-stat-desc' }, ['Attempt more questions to break down MCQ, MSQ, and NAT performance.'])
    ] : qStrategy.map(st => el('div', { style: 'background:var(--bg-input); border:1px solid var(--border-subtle); padding:16px; border-radius:14px;' }, [
      el('div', { style: 'display:flex; justify-content:space-between; align-items:center;' }, [
        el('strong', { style: 'font-size:0.92rem; color:var(--text-primary);' }, [st.type]),
        el('span', { className: 'card-stat-desc' }, [`${st.attempted} Attempted`])
      ]),
      el('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-top:8px;' }, [
        el('span', { style: 'font-size:1.4rem; font-weight:800; color:var(--text-primary);' }, [st.accuracy !== null ? `${st.accuracy}%` : '—']),
        el('span', { className: 'card-stat-desc' }, [`Marks: ${st.marks}/${st.maxMarks}`])
      ]),
      el('div', { className: 'progress-bar-wrap' }, [
        el('div', { className: `progress-bar-fill ${st.accuracy >= 70 ? 'high' : st.accuracy >= 50 ? 'medium' : 'low'}`, style: `width:${st.accuracy || 0}%;` })
      ])
    ])))
  ]);

  // Topic Risk Map Table
  const riskList = data?.riskMap || [];
  const riskCard = card('Syllabus Topic Risk Map', [
    el('div', { style: 'overflow-x:auto;' }, [
      el('table', { className: 'risk-table' }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {}, ['Syllabus Topic Domain']),
            el('th', {}, ['Accuracy']),
            el('th', {}, ['Attempt Sample']),
            el('th', {}, ['Sample Reliability']),
            el('th', {}, ['Risk Status'])
          ])
        ]),
        el('tbody', {}, riskList.length === 0 ? [
          el('tr', {}, [el('td', { colSpan: 5, className: 'card-stat-desc' }, ['No topic data available yet.'])])
        ] : riskList.map(r => el('tr', {}, [
          el('td', { style: 'font-weight:700; color:var(--text-primary);' }, [r.topic]),
          el('td', {}, [r.accuracy !== null ? `${r.accuracy}%` : '—']),
          el('td', {}, [`${r.attempts} Qs`]),
          el('td', {}, [
            el('span', { className: `status-chip ${r.reliable ? 'ready' : 'insufficient_data'}` }, [
              r.reliable ? 'Reliable (≥10 Qs)' : 'Insufficient Sample'
            ])
          ]),
          el('td', {}, [
            el('span', { className: `status-chip ${r.risk === 'high' ? 'high' : r.risk === 'watch' ? 'watch' : r.risk === 'steady' ? 'steady' : 'insufficient_data'}` }, [
              r.risk === 'high' ? 'High Risk' : r.risk === 'watch' ? 'Watch' : r.risk === 'steady' ? 'Steady' : 'Insufficient Sample'
            ])
          ])
        ])))
      ])
    ])
  ]);

  // Dynamic SWOT Matrix
  const topics = data?.topics || [];
  const strongTopics = topics.filter(t => t.accuracy >= 70);
  const weakTopics = topics.filter(t => t.accuracy < 50);

  const swotMatrix = card('SWOT Performance Matrix', [
    el('div', { className: 'swot-grid', style: 'margin-top:10px;' }, [
      el('div', { className: 'swot-card strength' }, [
        el('div', { className: 'swot-card-title' }, ['💪 Strengths']),
        el('ul', { className: 'swot-list' }, strongTopics.length ? strongTopics.map(t => el('li', {}, [`${t.topic} accuracy (${t.accuracy}%)`])) : [
          el('li', {}, [`Overall accuracy: ${kpis.accuracyPct || 0}%`]),
          el('li', {}, [`Active streak: ${calendarDays.length} days`])
        ])
      ]),
      el('div', { className: 'swot-card weakness' }, [
        el('div', { className: 'swot-card-title' }, ['⚠️ Weaknesses']),
        el('ul', { className: 'swot-list' }, weakTopics.length ? weakTopics.map(t => el('li', {}, [`${t.topic} accuracy (${t.accuracy}%)`])) : [
          el('li', {}, [`Negative mark penalty: -${negMarks} marks`]),
          el('li', {}, [`Skipped questions: ${kpis.skipped || 0} Qs`])
        ])
      ]),
      el('div', { className: 'swot-card opportunity' }, [
        el('div', { className: 'swot-card-title' }, ['🎯 Opportunities']),
        el('ul', { className: 'swot-list' }, [
          el('li', {}, ['Eliminate negative MSQ guesses to save marks']),
          el('li', {}, ['Practice weak syllabus topics before next mock'])
        ])
      ]),
      el('div', { className: 'swot-card threat' }, [
        el('div', { className: 'swot-card-title' }, ['🚨 Threats']),
        el('ul', { className: 'swot-list' }, [
          el('li', {}, [`Unattempted items causing score drops`]),
          el('li', {}, [`Time management on high-density NAT items`])
        ])
      ])
    ])
  ]);

  // Next Best Action Recommendation
  const nba = data?.nextBestAction || { title: 'Complete a Practice Set', reason: 'Attempt questions to unlock weak topic analysis.' };
  const nextActionCard = card('Targeted Action Plan', [
    el('div', { className: 'overview-cta-row' }, [
      el('div', {}, [
        el('strong', { style: 'font-size:1.05rem; display:block;' }, [nba.title]),
        el('span', {}, [nba.reason])
      ]),
      el('button', {
        className: 'btn btn-primary',
        onclick: () => {
          if (nba.topic) {
            state.tab = 'practice';
            state.selectedTopics = new Set([nba.topic]);
          } else {
            state.tab = 'practice';
          }
          render();
        }
      }, [nba.topic ? `Practice ${nba.topic} →` : 'Start Practice →'])
    ])
  ]);

  wrap.append(heroMetrics, leakagePanel, strategyCard, riskCard, swotMatrix, nextActionCard);
  return [wrap];
}

function generic(name, desc) {
  const isGk = name === 'GK Sprint';
  const isSketch = name === 'Sketches';
  const isBookmarks = name === 'Bookmarks';
  const isGuides = name === 'Guides';
  const isSettings = name === 'Settings';

  const cards = isGk ? [
    card('GK Sprint', [
      el('p', { className: 'card-stat-desc' }, ['Short flashcard rounds for Indian art, architecture, craft history, and current affairs.'])
    ]),
    card('Retention Box', [
      el('p', { className: 'card-stat-desc' }, ['Missed cards return to the revision box until mastered.'])
    ])
  ] : isSketch ? [
    card('Sketch Studio', [
      el('p', { className: 'card-stat-desc' }, ['Open a drawing prompt, set your timer, and upload your artwork response.'])
    ]),
    card('Gallery', [
      el('p', { className: 'card-stat-desc' }, ['Saved sketch attempts and feedback will appear here.'])
    ])
  ] : isBookmarks ? [
    card('Revision Queue', [
      el('p', { className: 'card-stat-desc' }, ['Bookmarked and previously missed questions appear here.'])
    ]),
    card('Filters', [
      el('p', { className: 'card-stat-desc' }, ['Filter by syllabus topic, paper, and question type.'])
    ])
  ] : isGuides ? [
    card('Guides & Notes', [
      el('p', { className: 'card-stat-desc' }, ['Topic guides, worked solutions, and visual formula references from UCEED syllabus.'])
    ]),
    card('Quick Quizzes', [
      el('p', { className: 'card-stat-desc' }, ['Short 5-question checkpoints keep revision sharp.'])
    ])
  ] : isSettings ? [
    card('Profile Preferences', [
      el('p', { className: 'card-stat-desc' }, ['Target exam selection and notification preferences.'])
    ]),
    card('Appearance', [
      el('p', { className: 'card-stat-desc' }, ['Dark/Light workspace preferences saved locally.'])
    ])
  ] : [
    card('Study Workspace', [
      el('p', { className: 'card-stat-desc' }, ['Select a feature tab from the sidebar navigation.'])
    ])
  ];

  return [
    header(name, desc),
    el('div', { className: 'card-grid feature-placeholder-grid' }, cards)
  ];
}

async function render() {
  app.replaceChildren();
  app.append(sidebar());
  
  const main = el('main', { className: `app-main ${state.open ? 'main-sidebar-open' : 'main-sidebar-closed'}` });
  app.append(main);

  let nodes = state.tab === 'overview' ? await overview()
    : state.tab === 'papers' ? await library()
    : state.tab === 'practice' ? await practiceView()
    : state.tab === 'mocks' ? await mocksView()
    : state.tab === 'analytics' ? await analyticsView()
    : generic(nav.find(x => x[0] === state.tab)?.[1] || 'Workspace', 'Your study workspace.');

  main.append(...nodes);
}

render().catch(e => {
  app.replaceChildren(el('main', { className: 'app-main' }, [
    card('Workspace Error', [
      el('p', { style: 'color:#ef4444;' }, [e.message])
    ])
  ]));
});
