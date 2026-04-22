/* ═══════════════════════════════════════════════════════════════
   甬士训练 V3 — TACTICAL COMMAND TERMINAL
   Application Logic: Routing / State / API / Views
   ═══════════════════════════════════════════════════════════════ */

const V3 = (() => {
  'use strict';

  // ─── CONSTANTS ─────────────────────────────────────────
  const API = '/api';
  const STORAGE_KEY = 'v3_token';
  const TABS = ['today', 'course', 'quiz', 'profile'];
  const SUB_VIEWS = ['course-detail', 'lesson', 'quiz-session', 'aar', 'assessment'];

  // ─── STATE ─────────────────────────────────────────────
  const state = {
    token: localStorage.getItem(STORAGE_KEY) || '',
    user: null,
    progress: {},      // { lessons: {}, questions: {}, quizzes: [] }
    profile: null,
    currentView: 'login',
    currentTab: 'today',
    // Course map
    expandedPhase: null,
    // Course detail
    selectedWeekId: null,
    selectedLessonId: null,
    // Quiz
    quizType: 'course',       // 'course' | 'scenario'
    quizFilterWeek: null,
    quizFilterSkill: null,
    quizSession: null,        // { questions, currentIndex, answers, submitted }
    quizSessionType: null,    // 'course' | 'scenario'
    // Profile
    assessments: [],
    aarRecords: [],
  };

  // ─── DOM HELPERS ───────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };

  // ─── API LAYER ─────────────────────────────────────────
  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    try {
      const res = await fetch(API + path, { ...opts, headers });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) { logout(); return null; }
        toast(data.error || '请求失败', 'error');
        return null;
      }
      return data;
    } catch (err) {
      toast('网络错误', 'error');
      return null;
    }
  }

  // ─── TOAST ─────────────────────────────────────────────
  let toastTimer;
  function toast(msg, type = '') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (type ? ' toast--' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.className = 'toast', 2500);
  }

  // ─── MODAL ─────────────────────────────────────────────
  function showModal(html) {
    $('#modal-body').innerHTML = html;
    $('#modal-overlay').classList.add('show');
  }
  function closeModal() {
    $('#modal-overlay').classList.remove('show');
  }

  // ─── NAVIGATION ────────────────────────────────────────
  function navigate(view, opts = {}) {
    const prev = state.currentView;
    state.currentView = view;

    // Update all view panels
    $$('.view-panel').forEach(p => {
      p.classList.remove('active', 'exit-left');
    });
    const panel = $(`#view-${view}`);
    if (panel) {
      panel.classList.add('active');
      // Scroll to top
      const scroller = panel.querySelector('.hud-scroll');
      if (scroller) scroller.scrollTop = 0;
    }

    // Header
    const isSubView = SUB_VIEWS.includes(view);
    const isAuth = view === 'login' || view === 'register';

    $('#header-back').classList.toggle('hidden', !isSubView || isAuth);
    $('#hud-header').classList.toggle('hidden', isAuth);

    // Title
    const titles = {
      login: '甬士训练', register: '注册账号',
      today: '今日训练', course: '课程地图',
      'course-detail': opts.title || '课程详情',
      lesson: opts.title || '课时详情',
      quiz: '题库', 'quiz-session': state.quizSession?.submitted ? '答题结果' : '答题中',
      profile: '个人档案', aar: '复盘记录', assessment: '能力评估'
    };
    $('#header-title').textContent = titles[view] || '甬士训练';

    // Tabbar
    const showTabbar = TABS.includes(view);
    $('#hud-tabbar').classList.toggle('hidden', !showTabbar);

    if (showTabbar && !state.currentTab) state.currentTab = view;

    // Update tab active state
    $$('.hud-tabbar__item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === state.currentTab);
    });

    // Content padding bottom
    const content = $('#hud-content');
    content.style.paddingBottom = showTabbar ? 'calc(var(--tabbar-h) + var(--safe-bottom))' : '0';

    // Quiz session needs safe-bottom padding on its nav
    const quizNav = $('#quiz-session-container .quiz-nav');
    // Will be handled by CSS

    // Render view content
    renderView(view, opts);
  }

  function goBack() {
    const v = state.currentView;
    if (v === 'lesson') {
      navigate('course-detail', { weekId: state.selectedWeekId });
    } else if (v === 'course-detail') {
      navigate('course');
    } else if (v === 'quiz-session') {
      navigate('quiz');
    } else {
      navigate(state.currentTab || 'today');
    }
  }

  function switchTab(tab) {
    state.currentTab = tab;
    state.expandedPhase = null;
    navigate(tab);
  }

  function headerAction() {
    // Placeholder for future use
  }

  // ─── RENDER ROUTER ─────────────────────────────────────
  function renderView(view, opts) {
    switch (view) {
      case 'today': renderToday(); break;
      case 'course': renderCourseMap(); break;
      case 'course-detail': renderCourseDetail(opts.weekId); break;
      case 'lesson': renderLessonDetail(opts.lessonId, opts.weekId); break;
      case 'quiz': renderQuizList(); break;
      case 'quiz-session': renderQuizSession(); break;
      case 'profile': renderProfile(); break;
      case 'aar': renderAar(); break;
      case 'assessment': renderAssessment(); break;
    }
  }

  // ─── AUTH ──────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault();
    const phone = $('#login-phone').value.trim();
    const password = $('#login-password').value;
    if (!phone || !password) return toast('请填写完整', 'error');

    const btn = $('#login-btn');
    btn.disabled = true;
    btn.textContent = '验证中...';

    const data = await api('/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password })
    });

    btn.disabled = false;
    btn.textContent = '进入系统';

    if (data) {
      state.token = data.token;
      state.user = data.user;
      state.progress = data.progress || {};
      localStorage.setItem(STORAGE_KEY, data.token);
      toast('登录成功', 'success');
      navigate('today');
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const name = $('#reg-name').value.trim();
    const phone = $('#reg-phone').value.trim();
    const password = $('#reg-password').value;

    if (!name || !phone || !password) return toast('请填写完整', 'error');
    if (!/^1\d{10}$/.test(phone)) return toast('请输入11位手机号', 'error');
    if (password.length < 6) return toast('密码至少6位', 'error');

    const data = await api('/register', {
      method: 'POST',
      body: JSON.stringify({ name, phone, password })
    });

    if (data) {
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem(STORAGE_KEY, data.token);
      toast('注册成功', 'success');
      navigate('today');
    }
  }

  function showRegister() { navigate('register'); }
  function showLogin() { navigate('login'); }

  function logout() {
    state.token = '';
    state.user = null;
    state.progress = {};
    state.profile = null;
    localStorage.removeItem(STORAGE_KEY);
    navigate('login');
  }

  // ─── DATA HELPERS ──────────────────────────────────────
  function getWeeks() {
    return typeof makeWeeks === 'function' ? makeWeeks() : [];
  }

  function getAllQuestions() {
    // V2 question bank
    if (typeof QUESTION_BANK_V2 !== 'undefined') return QUESTION_BANK_V2;
    if (typeof QUESTION_BANK !== 'undefined') return QUESTION_BANK;
    return [];
  }

  function getCourseContent() {
    if (typeof COURSE_CONTENT_V2 !== 'undefined') return COURSE_CONTENT_V2;
    return null;
  }

  function findWeekById(weekId) {
    return getWeeks().find(w => w.id === weekId);
  }

  function findWeekContent(weekId) {
    const cc = getCourseContent();
    if (!cc || !cc.weeks) return null;
    return cc.weeks.find(w => w.id === weekId);
  }

  function findLessonContent(lessonId) {
    const cc = getCourseContent();
    if (!cc || !cc.weeks) return null;
    for (const w of cc.weeks) {
      if (w.lessons) {
        const l = w.lessons.find(les => les.id === lessonId);
        if (l) return { lesson: l, week: w };
      }
    }
    return null;
  }

  function getLessonProgress(lessonId) {
    if (!state.progress || !state.progress.lessons) return null;
    return state.progress.lessons[lessonId] || null;
  }

  function isLessonCompleted(lessonId) {
    const p = getLessonProgress(lessonId);
    return p && p.completed;
  }

  function getWeekCompletion(week) {
    if (!week || !week.lessons) return 0;
    const total = week.lessons.length;
    if (total === 0) return 0;
    const done = week.lessons.filter(l => isLessonCompleted(l.id)).length;
    return done / total;
  }

  function getWeekStatus(week) {
    const ratio = getWeekCompletion(week);
    if (ratio >= 1) return 'done';
    if (ratio > 0) return 'partial';
    return 'pending';
  }

  function getSkillCategories() {
    const qs = getAllQuestions();
    const skills = new Set();
    qs.forEach(q => {
      if (q.skillClassification) skills.add(q.skillClassification);
      if (q.tags) q.tags.forEach(t => { if (t !== q.lessonMapping) skills.add(t); });
    });
    return [...skills].sort();
  }

  function getRelatedQuestions(weekCode) {
    return getAllQuestions().filter(q =>
      q.lessonMapping === weekCode ||
      (q.lessonMapping && q.lessonMapping.startsWith(weekCode + '-')) ||
      (q.tags && q.tags.includes(weekCode))
    );
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function firstSentences(text, count = 2) {
    return String(text || '')
      .replace(/\r?\n/g, ' ')
      .split(/[。！？]/)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, count)
      .join('。') + (text ? '。' : '');
  }

  function lessonImage(lesson, className = 'course-media') {
    if (!lesson?.image?.src) {
      return `<div class="${className} course-media--empty"><span>${lesson?.code || 'COURSE'}</span><strong>影像资产待接入</strong></div>`;
    }
    return `
      <figure class="${className}">
        <img src="${escapeHtml(lesson.image.src)}" alt="${escapeHtml(lesson.image.alt || lesson.title)}" loading="lazy">
      </figure>
    `;
  }

  // ─── TODAY VIEW ────────────────────────────────────────
  function renderToday() {
    const container = $('#today-content');
    if (!state.user) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state__text">加载中...</div></div>';
      fetchMe();
      return;
    }

    const weeks = getWeeks();
    const user = state.user;
    const progress = state.progress || {};

    // Calculate stats
    let completedLessons = 0;
    let totalLessons = 0;
    let totalQuestions = 0;
    let correctQuestions = 0;

    weeks.forEach(w => {
      totalLessons += w.lessons.length;
      w.lessons.forEach(l => { if (isLessonCompleted(l.id)) completedLessons++; });
    });

    if (progress.questions) {
      Object.values(progress.questions).forEach(q => {
        totalQuestions++;
        if (q.correct) correctQuestions++;
      });
    }

    // Find next incomplete lesson
    let nextLesson = null;
    for (const w of weeks) {
      for (const l of w.lessons) {
        if (!isLessonCompleted(l.id)) {
          nextLesson = { week: w, lesson: l };
          break;
        }
      }
      if (nextLesson) break;
    }

    const accuracy = totalQuestions > 0 ? Math.round(correctQuestions / totalQuestions * 100) : 0;

    container.innerHTML = `
      <div class="today-hero animate-in">
        <div class="today-hero__greeting">OPERATOR // ${new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}</div>
        <div class="today-hero__name">${user.name || user.phone}</div>
        <div class="today-hero__level">
          <span class="badge badge--amber">${user.level || 'L0'}</span>
          <span class="badge badge--ghost">${user.role === 'instructor' ? '教官' : '队员'}</span>
        </div>
      </div>

      <div class="stat-grid animate-in animate-in-delay-1">
        <div class="stat-card">
          <div class="stat-card__value">${completedLessons}</div>
          <div class="stat-card__label">已完成课时</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${totalLessons}</div>
          <div class="stat-card__label">总课时</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${totalQuestions}</div>
          <div class="stat-card__label">答题数</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${accuracy}%</div>
          <div class="stat-card__label">正确率</div>
        </div>
      </div>

      ${nextLesson ? `
      <div class="next-action animate-in animate-in-delay-2" onclick="V3.openLesson('${nextLesson.week.id}', '${nextLesson.lesson.id}')">
        <div class="next-action__tag">// NEXT MISSION</div>
        <div class="next-action__title">${nextLesson.lesson.goal}</div>
        <div class="next-action__desc">${nextLesson.week.title} — ${nextLesson.lesson.code}</div>
        <button class="btn btn--primary btn--sm">开始训练</button>
      </div>
      ` : `
      <div class="next-action animate-in animate-in-delay-2">
        <div class="next-action__tag">// ALL CLEAR</div>
        <div class="next-action__title">所有课时已完成</div>
        <div class="next-action__desc">回顾题库或进行能力评估</div>
      </div>
      `}

      <div class="section-header animate-in animate-in-delay-3">
        <span class="section-header__label">QUICK ACCESS</span>
      </div>
      <div class="flex gap-2 animate-in animate-in-delay-3">
        <button class="btn btn--secondary flex-1" onclick="V3.switchTab('course')">课程地图</button>
        <button class="btn btn--secondary flex-1" onclick="V3.switchTab('quiz')">题库练习</button>
        <button class="btn btn--secondary flex-1" onclick="V3.navigateAssessment()">能力评估</button>
      </div>
    `;
  }

  // ─── COURSE MAP ────────────────────────────────────────
  function renderCourseMap() {
    const container = $('#course-map-content');
    const weeks = getWeeks();
    const phases = PHASES || [];

    let html = '<div style="padding-top:var(--sp-3)">';

    phases.forEach((phase, pi) => {
      const phaseWeeks = weeks.filter(w => w.phaseId === phase.id);
      const totalLessons = phaseWeeks.reduce((sum, w) => sum + w.lessons.length, 0);
      const doneLessons = phaseWeeks.reduce((sum, w) => sum + w.lessons.filter(l => isLessonCompleted(l.id)).length, 0);
      const progressPct = totalLessons > 0 ? Math.round(doneLessons / totalLessons * 100) : 0;
      const isExpanded = state.expandedPhase === phase.id;

      html += `
        <div class="phase-block ${isExpanded ? 'expanded' : ''} animate-in animate-in-delay-${Math.min(pi + 1, 4)}">
          <div class="phase-header" onclick="V3.togglePhase('${phase.id}')">
            <div class="phase-header__num">${pi + 1}</div>
            <div class="phase-header__info">
              <div class="phase-header__name">${phase.name}</div>
              <div class="phase-header__weeks">${phase.weeks} // ${progressPct}%</div>
            </div>
            <div class="phase-header__chevron">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          </div>
          <div class="phase-progress">
            <div class="phase-progress__bar" style="width:${progressPct}%"></div>
          </div>
          <div class="week-list">
            ${phaseWeeks.map(w => {
              const status = getWeekStatus(w);
              return `
                <div class="week-item" onclick="V3.openWeek('${w.id}')">
                  <div class="week-item__code">${w.week}</div>
                  <div class="week-item__title">${w.title}</div>
                  <div class="week-item__status week-item__status--${status}"></div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;
  }

  function togglePhase(phaseId) {
    state.expandedPhase = state.expandedPhase === phaseId ? null : phaseId;
    // Re-render without full navigate
    renderCourseMap();
  }

  function openWeek(weekId) {
    state.selectedWeekId = weekId;
    const week = findWeekById(weekId);
    navigate('course-detail', { weekId, title: week ? week.title : '课程详情' });
  }

  // ─── COURSE DETAIL ─────────────────────────────────────
  function renderCourseDetail(weekId) {
    const container = $('#course-detail-content');
    const week = findWeekById(weekId);
    if (!week) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state__text">未找到课程</div></div>';
      return;
    }

    const phase = (PHASES || []).find(p => p.id === week.phaseId);
    const weekContent = findWeekContent(weekId);
    const phaseName = phase ? phase.name : '';

    // Get related questions
    const relatedQs = getAllQuestions().filter(q =>
      q.lessonMapping && q.lessonMapping.startsWith(week.week.replace('W', 'W'))
    );

    const heroLesson = week.lessons[0];
    const completedCount = week.lessons.filter(l => isLessonCompleted(l.id)).length;
    const objective = weekContent ? weekContent.objective : week.objective;
    const standard = weekContent ? weekContent.standard : week.standard;

    container.innerHTML = `
      <section class="v31-course-hero animate-in">
        ${lessonImage(heroLesson, 'v31-course-hero__media')}
        <div class="v31-course-hero__shade"></div>
        <div class="v31-course-hero__content">
          <div class="v31-kicker">${phaseName} / ${week.week}</div>
          <h2>${week.title}</h2>
          <p>${objective}</p>
          <div class="v31-hero-actions">
            <button class="btn btn--primary btn--sm" onclick="V3.openLesson('${weekId}', '${heroLesson.id}')">继续第一课</button>
            ${relatedQs.length > 0 ? `<button class="btn btn--secondary btn--sm" onclick="V3.startQuizWithFilter('${week.week}')">${relatedQs.length} 题训练</button>` : ''}
          </div>
        </div>
      </section>

      <div class="v31-brief-grid animate-in animate-in-delay-1">
        <div><span>课时进度</span><strong>${completedCount}/${week.lessons.length}</strong></div>
        <div><span>关联题目</span><strong>${relatedQs.length}</strong></div>
        <div><span>训练阶段</span><strong>${week.week}</strong></div>
      </div>

      <div class="v31-brief animate-in animate-in-delay-1">
        <span>// PASS STANDARD</span>
        <p>${standard}</p>
      </div>

      ${weekContent && weekContent.warning ? `
      <div class="v31-brief v31-brief--warn animate-in animate-in-delay-2">
        <span>// FIELD NOTE</span>
        <p>${weekContent.warning}</p>
      </div>
      ` : ''}

      <div class="section-header animate-in animate-in-delay-2">
        <span class="section-header__label">LESSONS // ${week.lessons.length}</span>
      </div>

      ${week.lessons.map((l, i) => {
        const done = isLessonCompleted(l.id);
        return `
          <div class="lesson-card lesson-card--v31 ${done ? 'completed' : ''} animate-in animate-in-delay-${Math.min(i + 2, 4)}"
               onclick="V3.openLesson('${weekId}', '${l.id}')">
            ${lessonImage(l, 'lesson-card__media')}
            <div class="lesson-card__num">${i + 1}</div>
            <div class="lesson-card__info">
              <div class="lesson-card__title">${l.title}</div>
              <div class="lesson-card__goal">${l.code}</div>
            </div>
            <div class="lesson-card__arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          </div>
        `;
      }).join('')}

      ${relatedQs.length > 0 ? `
      <div class="section-header mt-4">
        <span class="section-header__label">RELATED QUESTIONS</span>
        <button class="section-header__action" onclick="V3.startQuizWithFilter('${week.week}')">全部练习</button>
      </div>
      ${relatedQs.slice(0, 5).map(q => `
        <div class="related-q" onclick="V3.startQuizWithQuestion('${q.id}')">
          <div class="related-q__id">${q.id.toUpperCase()}</div>
          <div class="related-q__title">${q.title}</div>
          <div class="related-q__arrow">›</div>
        </div>
      `).join('')}
      ${relatedQs.length > 5 ? `
        <button class="btn btn--ghost btn--sm btn--block mt-2" onclick="V3.startQuizWithFilter('${week.week}')">
          查看全部 ${relatedQs.length} 题
        </button>
      ` : ''}
      ` : ''}
    `;
  }

  function openLesson(weekId, lessonId) {
    state.selectedWeekId = weekId;
    state.selectedLessonId = lessonId;
    const lc = findLessonContent(lessonId);
    const title = lc ? lc.lesson.title : lessonId;
    navigate('lesson', { lessonId, weekId, title });
  }

  // ─── LESSON DETAIL ─────────────────────────────────────
  let lessonTab = 'manual';

  function renderLessonDetail(lessonId, weekId) {
    const container = $('#lesson-content');
    const lc = findLessonContent(lessonId);

    if (!lc) {
      // Fallback to basic week data
      const week = findWeekById(weekId);
      const lesson = week ? week.lessons.find(l => l.id === lessonId) : null;
      if (!lesson) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state__text">未找到课时</div></div>';
        return;
      }
      renderBasicLesson(container, lesson, week);
      return;
    }

    const { lesson, week } = lc;
    const done = isLessonCompleted(lessonId);
    const relatedQs = getRelatedQuestions(lesson.code || lessonId);

    const manualSummary = firstSentences(lesson.lessonManuals, 2);
    container.innerHTML = `
      <div class="v31-lesson-shell">
        <section class="v31-lesson-hero animate-in">
          ${lessonImage(lesson, 'v31-lesson-hero__media')}
          <div class="v31-lesson-hero__body">
            <div class="v31-kicker">${lesson.code} / ${week.week}</div>
            <h2>${lesson.title}</h2>
            <p>${manualSummary || lesson.goal || ''}</p>
          </div>
        </section>

        <div class="v31-mission-strip animate-in animate-in-delay-1">
          <div><span>目标</span><strong>${lesson.goal || lesson.title}</strong></div>
          <div><span>标准</span><strong>${lesson.actionStandard || '完成手册动作并留下记录'}</strong></div>
        </div>

        <div class="lesson-tabs lesson-tabs--v31 animate-in animate-in-delay-1">
          <button class="lesson-tab ${lessonTab === 'manual' ? 'active' : ''}" onclick="V3.switchLessonTab('manual')">训练手册</button>
          <button class="lesson-tab ${lessonTab === 'deep' ? 'active' : ''}" onclick="V3.switchLessonTab('deep')">深度拓展</button>
          <button class="lesson-tab ${lessonTab === 'drill' ? 'active' : ''}" onclick="V3.switchLessonTab('drill')">训练流程</button>
          ${relatedQs.length > 0 ? `<button class="lesson-tab ${lessonTab === 'quiz' ? 'active' : ''}" onclick="V3.switchLessonTab('quiz')">关联题目</button>` : ''}
        </div>

        <div class="lesson-content" id="lesson-tab-content">
          ${renderLessonTabContent(lesson, week, relatedQs)}
        </div>

        <button class="complete-btn ${done ? 'is-done' : ''} animate-in" onclick="V3.toggleLessonComplete('${lessonId}')">
          ${done ? '✓ 已完成' : '标记完成'}
        </button>

        ${relatedQs.length > 0 ? `
        <button class="btn btn--secondary btn--block mt-3" onclick="V3.startQuizWithFilter('${lesson.code || week.week}')">
          练习关联题目 (${relatedQs.length})
        </button>
        ` : ''}
      </div>
    `;
  }

  function renderLessonTabContent(lesson, week, relatedQs) {
    switch (lessonTab) {
      case 'manual':
        return `<div class="info-block"><div class="info-block__title">训练手册</div></div>
                <div class="lesson-content">${formatMarkdown(lesson.lessonManuals || '暂无手册内容')}</div>`;
      case 'deep':
        return `<div class="info-block"><div class="info-block__title">深度拓展</div></div>
                <div class="lesson-content">${formatMarkdown(lesson.deepDives || '暂无拓展内容')}</div>`;
      case 'drill':
        return `<div class="info-block"><div class="info-block__title">训练流程</div></div>
                <div class="lesson-content">${formatMarkdown(lesson.drill || '暂无训练流程')}</div>
                <div class="info-block mt-3"><div class="info-block__title">常见错误</div></div>
                <div class="lesson-content">${formatMarkdown(lesson.commonError || '暂无')}</div>`;
      case 'quiz':
        return relatedQs.length > 0
          ? relatedQs.map(q => `
            <div class="related-q" onclick="V3.startQuizWithQuestion('${q.id}')">
              <div class="related-q__id">${q.id.toUpperCase()}</div>
              <div class="related-q__title">${q.title}</div>
              <div class="related-q__arrow">›</div>
            </div>`).join('')
          : '<div class="empty-state"><div class="empty-state__text">暂无关联题目</div></div>';
      default:
        return '';
    }
  }

  function switchLessonTab(tab) {
    lessonTab = tab;
    renderLessonDetail(state.selectedLessonId, state.selectedWeekId);
  }

  function renderBasicLesson(container, lesson, week) {
    const done = isLessonCompleted(lesson.id);
    container.innerHTML = `
      <div style="padding-top:var(--sp-3)">
        <div class="info-block animate-in">
          <div class="info-block__title">// 课时目标</div>
          <div class="info-block__text">${lesson.goal}</div>
        </div>
        <div class="info-block animate-in animate-in-delay-1">
          <div class="info-block__title">// 行动标准</div>
          <div class="info-block__text">${lesson.actionStandard}</div>
        </div>
        <div class="info-block animate-in animate-in-delay-1">
          <div class="info-block__title">// 常见错误</div>
          <div class="info-block__text">${lesson.commonError}</div>
        </div>
        <div class="info-block animate-in animate-in-delay-2">
          <div class="info-block__title">// 训练方法</div>
          <div class="info-block__text">${lesson.drill}</div>
        </div>
        <button class="complete-btn ${done ? 'is-done' : ''}" onclick="V3.toggleLessonComplete('${lesson.id}')">
          ${done ? '✓ 已完成' : '标记完成'}
        </button>
      </div>
    `;
  }

  async function toggleLessonComplete(lessonId) {
    const done = isLessonCompleted(lessonId);
    const result = await api('/progress', {
      method: 'POST',
      body: JSON.stringify({ type: 'lesson', id: lessonId, completed: !done })
    });
    if (result && result.progress) {
      state.progress = result.progress;
      toast(done ? '已取消完成' : '已标记完成', 'success');
      renderLessonDetail(state.selectedLessonId, state.selectedWeekId);
    }
  }

  // ─── QUIZ LIST ─────────────────────────────────────────
  function renderQuizList() {
    const container = $('#quiz-list-content');
    const allQs = getAllQuestions();
    const skills = getSkillCategories();

    // Get unique weeks from questions
    const weekSet = new Set();
    allQs.forEach(q => {
      if (q.lessonMapping) {
        const w = q.lessonMapping.split('-')[0];
        weekSet.add(w);
      }
    });
    const weeks = [...weekSet].sort();

    // Filter questions
    let filtered = allQs;
    if (state.quizType === 'course') {
      filtered = filtered.filter(q => q.type === 'course');
    } else {
      filtered = filtered.filter(q => q.type === 'scenario');
    }
    if (state.quizFilterWeek) {
      filtered = filtered.filter(q =>
        q.lessonMapping && q.lessonMapping.startsWith(state.quizFilterWeek)
      );
    }
    if (state.quizFilterSkill) {
      filtered = filtered.filter(q =>
        q.skillClassification === state.quizFilterSkill ||
        (q.tags && q.tags.includes(state.quizFilterSkill))
      );
    }

    container.innerHTML = `
      <div class="quiz-header animate-in">
        <div class="section-header__label">QUESTION BANK</div>
        <div style="font-family:var(--font-display);font-size:var(--fs-lg);font-weight:var(--fw-bold);color:var(--text-primary);margin-top:var(--sp-2)">
          ${allQs.length} 道题 // 筛选结果 ${filtered.length}
        </div>

        <div class="quiz-type-toggle">
          <button class="quiz-type-btn ${state.quizType === 'course' ? 'active' : ''}" onclick="V3.setQuizType('course')">课程考核</button>
          <button class="quiz-type-btn ${state.quizType === 'scenario' ? 'active' : ''}" onclick="V3.setQuizType('scenario')">情景判断</button>
        </div>
      </div>

      <div class="filter-row animate-in animate-in-delay-1">
        <div class="filter-chip ${!state.quizFilterWeek ? 'active' : ''}" onclick="V3.setQuizWeek(null)">全部</div>
        ${weeks.map(w => `
          <div class="filter-chip ${state.quizFilterWeek === w ? 'active' : ''}" onclick="V3.setQuizWeek('${w}')">${w}</div>
        `).join('')}
      </div>

      ${state.quizFilterWeek ? `
      <div class="filter-row animate-in animate-in-delay-1">
        <div class="filter-chip ${!state.quizFilterSkill ? 'active' : ''}" onclick="V3.setQuizSkill(null)">全部技能</div>
        ${skills.slice(0, 10).map(s => `
          <div class="filter-chip ${state.quizFilterSkill === s ? 'active' : ''}" onclick="V3.setQuizSkill('${s}')">${s}</div>
        `).join('')}
      </div>
      ` : ''}

      ${filtered.length > 0 ? `
      <button class="btn btn--primary btn--block mt-3 animate-in animate-in-delay-2" onclick="V3.startQuizSession()">
        开始答题 (${filtered.length} 题)
      </button>
      ` : `
      <div class="empty-state mt-4">
        <div class="empty-state__text">没有匹配的题目</div>
      </div>
      `}

      <div class="section-header mt-4 animate-in animate-in-delay-2">
        <span class="section-header__label">QUESTIONS</span>
      </div>

      ${filtered.slice(0, 20).map((q, i) => `
        <div class="question-card animate-in animate-in-delay-${Math.min((i % 5) + 1, 4)}"
             onclick="V3.startQuizWithQuestion('${q.id}')">
          <div class="question-card__head">
            <span class="question-card__id">${q.id.toUpperCase()}</span>
            ${q.difficulty ? `<span class="badge badge--ghost">D${q.difficulty}</span>` : ''}
            ${q.typeLabel ? `<span class="badge badge--blue">${q.typeLabel}</span>` : ''}
          </div>
          <div class="question-card__title">${q.title}</div>
          <div class="question-card__meta">
            ${q.skillClassification ? `<span class="badge badge--ghost">${q.skillClassification}</span>` : ''}
            ${q.lessonMapping ? `<span class="badge badge--ghost">${q.lessonMapping}</span>` : ''}
          </div>
        </div>
      `).join('')}

      ${filtered.length > 20 ? `
      <button class="btn btn--ghost btn--sm btn--block mt-2">
        还有 ${filtered.length - 20} 题... 开始答题查看全部
      </button>
      ` : ''}
    `;
  }

  function setQuizType(type) {
    state.quizType = type;
    state.quizFilterSkill = null;
    renderQuizList();
  }

  function setQuizWeek(w) {
    state.quizFilterWeek = w;
    state.quizFilterSkill = null;
    renderQuizList();
  }

  function setQuizSkill(s) {
    state.quizFilterSkill = s;
    renderQuizList();
  }

  // ─── QUIZ SESSION ──────────────────────────────────────
  function getFilteredQuestions() {
    let qs = getAllQuestions();
    if (state.quizType === 'course') {
      qs = qs.filter(q => q.type === 'course');
    } else {
      qs = qs.filter(q => q.type === 'scenario');
    }
    if (state.quizFilterWeek) {
      qs = qs.filter(q => q.lessonMapping && q.lessonMapping.startsWith(state.quizFilterWeek));
    }
    if (state.quizFilterSkill) {
      qs = qs.filter(q =>
        q.skillClassification === state.quizFilterSkill ||
        (q.tags && q.tags.includes(state.quizFilterSkill))
      );
    }
    return qs;
  }

  function startQuizSession() {
    const qs = getFilteredQuestions();
    if (qs.length === 0) return toast('没有可用题目', 'error');
    state.quizSession = {
      questions: qs,
      currentIndex: 0,
      answers: new Array(qs.length).fill(null),
      submitted: false
    };
    navigate('quiz-session');
  }

  function startQuizWithFilter(weekCode) {
    state.quizFilterWeek = weekCode;
    state.quizType = 'course';
    state.quizFilterSkill = null;
    startQuizSession();
  }

  function startQuizWithQuestion(qId) {
    // Find the question and start a session with questions from same filter
    const q = getAllQuestions().find(x => x.id === qId);
    if (!q) return;

    // Set filter to include this question
    if (q.type === 'scenario') state.quizType = 'scenario';
    if (q.lessonMapping) state.quizFilterWeek = q.lessonMapping.split('-')[0];

    startQuizSession();

    // Navigate to this specific question
    if (state.quizSession) {
      const idx = state.quizSession.questions.findIndex(x => x.id === qId);
      if (idx >= 0) state.quizSession.currentIndex = idx;
    }
  }

  function renderQuizSession() {
    const container = $('#quiz-session-container');
    const session = state.quizSession;
    if (!session) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state__text">没有进行中的答题</div></div>';
      return;
    }

    const { questions, currentIndex, answers, submitted } = session;
    const total = questions.length;
    const q = questions[currentIndex];

    if (submitted) {
      renderQuizResult(container, session);
      return;
    }

    const progressPct = ((currentIndex + 1) / total * 100).toFixed(1);
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    container.innerHTML = `
      <div class="quiz-session">
        <div class="quiz-progress">
          <div class="quiz-progress__bar">
            <div class="quiz-progress__fill" style="width:${progressPct}%"></div>
          </div>
          <div class="quiz-progress__text">${currentIndex + 1} / ${total}</div>
        </div>

        <div class="quiz-question-area">
          <div class="quiz-scenario">
            <div class="quiz-scenario__text">${q.scenario || q.question || q.title}</div>
          </div>

          <div class="quiz-options">
            ${(q.options || []).map((opt, i) => {
              const selected = answers[currentIndex] === i;
              const showResult = false; // Don't show until submit
              return `
                <div class="quiz-option ${selected ? 'selected' : ''}"
                     onclick="V3.selectAnswer(${i})">
                  <div class="quiz-option__letter">${letters[i]}</div>
                  <div class="quiz-option__text">${opt}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="quiz-nav">
          <button class="btn btn--secondary" ${currentIndex <= 0 ? 'disabled' : ''} onclick="V3.quizPrev()">上一题</button>
          ${currentIndex >= total - 1
            ? `<button class="btn btn--primary" onclick="V3.submitQuiz()">提交</button>`
            : `<button class="btn btn--primary" onclick="V3.quizNext()">下一题</button>`
          }
        </div>
      </div>
    `;
  }

  function selectAnswer(idx) {
    if (!state.quizSession || state.quizSession.submitted) return;
    state.quizSession.answers[state.quizSession.currentIndex] = idx;
    renderQuizSession();
  }

  function quizNext() {
    if (!state.quizSession) return;
    if (state.quizSession.currentIndex < state.quizSession.questions.length - 1) {
      state.quizSession.currentIndex++;
      renderQuizSession();
    }
  }

  function quizPrev() {
    if (!state.quizSession) return;
    if (state.quizSession.currentIndex > 0) {
      state.quizSession.currentIndex--;
      renderQuizSession();
    }
  }

  async function submitQuiz() {
    if (!state.quizSession) return;
    const session = state.quizSession;
    const unanswered = session.answers.findIndex(a => a === null);
    if (unanswered >= 0) {
      // Ask confirmation
      showModal(`
        <div class="modal-sheet__title">确认提交？</div>
        <p style="color:var(--text-secondary);font-size:var(--fs-sm);margin-bottom:var(--sp-4)">
          还有 ${session.answers.filter(a => a === null).length} 题未作答。未作答的题目将计为错误。
        </p>
        <div class="flex gap-2">
          <button class="btn btn--secondary flex-1" onclick="V3.closeModal()">继续答题</button>
          <button class="btn btn--primary flex-1" onclick="V3.confirmSubmit()">确认提交</button>
        </div>
      `);
      return;
    }
    await doSubmitQuiz();
  }

  async function confirmSubmit() {
    closeModal();
    await doSubmitQuiz();
  }

  async function doSubmitQuiz() {
    if (!state.quizSession) return;
    const session = state.quizSession;
    session.submitted = true;

    // Calculate results
    let correct = 0;
    const results = session.questions.map((q, i) => {
      const userAnswer = session.answers[i];
      const isCorrect = userAnswer === q.answer;
      if (isCorrect) correct++;
      return { questionId: q.id, userAnswer, correct: q.answer, isCorrect };
    });

    // Save to server
    const quizData = {
      id: 'quiz-' + Date.now(),
      type: state.quizType,
      filterWeek: state.quizFilterWeek,
      results,
      score: correct,
      total: session.questions.length,
      percentage: Math.round(correct / session.questions.length * 100),
      createdAt: new Date().toISOString()
    };

    await api('/progress', {
      method: 'POST',
      body: JSON.stringify({ type: 'quiz', ...quizData })
    });

    // Also save individual question attempts
    for (const r of results) {
      const q = session.questions.find(item => item.id === r.questionId) || {};
      await api('/progress', {
        method: 'POST',
        body: JSON.stringify({
          type: 'question',
          id: r.questionId,
          title: q.title || r.questionId,
          questionType: q.type || state.quizType,
          selectedAnswer: r.userAnswer,
          correct: r.isCorrect,
          tags: Array.isArray(q.tags) ? q.tags : [],
          skillClassification: q.skillClassification || '',
          lessonMapping: q.lessonMapping || ''
        })
      });
    }

    // Refresh progress
    await fetchMe();

    renderQuizSession();
    // Update header title to reflect result view
    $('#header-title').textContent = '答题结果';
  }

  // Track expanded question index in result review
  let quizReviewExpanded = -1;

  function renderQuizResult(container, session) {
    const { questions, answers } = session;
    let correct = 0;
    const resultMap = questions.map((q, i) => {
      const isCorrect = answers[i] === q.answer;
      if (isCorrect) correct++;
      return isCorrect;
    });
    const total = questions.length;
    const pct = Math.round(correct / total * 100);

    container.innerHTML = `
      <div class="quiz-result-wrapper">
        <!-- Score header -->
        <div class="quiz-result animate-in">
          <div class="quiz-result__score">${pct}%</div>
          <div class="quiz-result__label">MISSION COMPLETE</div>
          <div class="quiz-result__detail">
            <div class="quiz-result__item">
              <div class="quiz-result__item-value quiz-result__item-value--green">${correct}</div>
              <div class="quiz-result__item-label">正确</div>
            </div>
            <div class="quiz-result__item">
              <div class="quiz-result__item-value quiz-result__item-value--red">${total - correct}</div>
              <div class="quiz-result__item-label">错误</div>
            </div>
          </div>
        </div>

        <!-- Question number navigation grid -->
        <div class="quiz-review-nav animate-in animate-in-delay-1">
          <div class="quiz-review-nav__legend">
            <span class="quiz-review-nav__dot quiz-review-nav__dot--correct"></span>
            <span class="quiz-review-nav__legend-text">正确</span>
            <span class="quiz-review-nav__dot quiz-review-nav__dot--wrong"></span>
            <span class="quiz-review-nav__legend-text">错误</span>
            <span class="quiz-review-nav__dot quiz-review-nav__dot--unanswered"></span>
            <span class="quiz-review-nav__legend-text">未答</span>
          </div>
          <div class="quiz-review-nav__grid">
            ${questions.map((q, i) => {
              const isCorrect = resultMap[i];
              const isUnanswered = answers[i] === null || answers[i] === undefined;
              const status = isUnanswered ? 'unanswered' : (isCorrect ? 'correct' : 'wrong');
              const isExpanded = quizReviewExpanded === i;
              return `<button class="quiz-review-nav__btn quiz-review-nav__btn--${status} ${isExpanded ? 'active' : ''}"
                        onclick="V3.expandReviewQuestion(${i})">${i + 1}</button>`;
            }).join('')}
          </div>
        </div>

        <!-- Expandable question detail -->
        <div class="quiz-review-detail" id="quiz-review-detail">
          ${quizReviewExpanded >= 0 && quizReviewExpanded < total ? renderReviewQuestionDetail(questions[quizReviewExpanded], answers[quizReviewExpanded], resultMap[quizReviewExpanded], quizReviewExpanded) : `
            <div class="quiz-review-placeholder">
              <div class="quiz-review-placeholder__icon">?</div>
              <div class="quiz-review-placeholder__text">点击上方题号查看详情</div>
            </div>
          `}
        </div>

        <!-- Bottom actions -->
        <div class="quiz-result-actions">
          <button class="btn btn--secondary flex-1" onclick="V3.switchTab('quiz')">返回题库</button>
          <button class="btn btn--primary flex-1" onclick="V3.retryQuiz()">重新答题</button>
        </div>
      </div>
    `;
  }

  function expandReviewQuestion(idx) {
    quizReviewExpanded = quizReviewExpanded === idx ? -1 : idx;
    // Only re-render the detail section, not the whole thing
    const detailEl = document.getElementById('quiz-review-detail');
    if (!detailEl || !state.quizSession) return;
    const { questions, answers } = state.quizSession;
    const isCorrect = answers[idx] === questions[idx].answer;
    if (quizReviewExpanded < 0) {
      detailEl.innerHTML = `
        <div class="quiz-review-placeholder">
          <div class="quiz-review-placeholder__icon">?</div>
          <div class="quiz-review-placeholder__text">点击上方题号查看详情</div>
        </div>`;
    } else {
      detailEl.innerHTML = renderReviewQuestionDetail(questions[idx], answers[idx], isCorrect, idx);
    }
    // Update active state on nav buttons
    document.querySelectorAll('.quiz-review-nav__btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === quizReviewExpanded);
    });
  }

  function renderReviewQuestionDetail(q, userAns, isCorrect, idx) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const isUnanswered = userAns === null || userAns === undefined;
    return `
      <div class="quiz-review-question animate-in">
        <div class="quiz-review-question__header">
          <span class="badge ${isUnanswered ? 'badge--ghost' : (isCorrect ? 'badge--cyan' : 'badge--red')}">
            ${isUnanswered ? '未答' : (isCorrect ? '正确' : '错误')}
          </span>
          <span class="quiz-review-question__id">${q.id.toUpperCase()}</span>
        </div>
        <div class="quiz-review-question__text">${q.scenario || q.question || q.title}</div>
        <div class="quiz-review-question__options">
          ${(q.options || []).map((opt, oi) => {
            let cls = '';
            let icon = '';
            if (oi === q.answer) { cls = 'correct'; icon = '✓'; }
            else if (oi === userAns && !isCorrect) { cls = 'wrong'; icon = '✗'; }
            return `
              <div class="quiz-option quiz-option--review ${cls}">
                <div class="quiz-option__letter">${letters[oi]}</div>
                <div class="quiz-option__text">${opt}</div>
                ${icon ? `<div class="quiz-option__icon quiz-option__icon--${cls}">${icon}</div>` : ''}
              </div>`;
          }).join('')}
        </div>
        ${q.analysis ? `
        <div class="quiz-analysis">
          <div class="quiz-analysis__title">// 解析</div>
          <div class="quiz-analysis__text">${formatMarkdown(q.analysis)}</div>
        </div>
        ` : '<div style="color:var(--text-muted);font-size:var(--fs-sm);padding:var(--sp-3)">暂无解析</div>'}
      </div>
    `;
  }

  function retryQuiz() {
    state.quizSession = null;
    startQuizSession();
  }

  // ─── PROFILE ───────────────────────────────────────────
  async function renderProfile() {
    const container = $('#profile-content');
    if (!state.user) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state__text">加载中...</div></div>';
      return;
    }

    // Fetch profile
    const profileData = await api('/profile');
    if (profileData) state.profile = profileData;

    const user = state.user;
    const profile = state.profile || {};
    const summary = profile.summary || {};

    // Build radar data from profile
    const dimensions = profile.dimensions || {};
    const dimLabels = {
      command: '指挥决策', comms: '通讯报告', formation: '队形协同',
      sop: 'SOP执行', attrition: '损耗控制', reaction: '反应速度'
    };

    container.innerHTML = `
      <div class="profile-hero animate-in">
        <div class="profile-avatar">${(user.name || '?')[0]}</div>
        <div>
          <div class="profile-info__name">${user.name || user.phone}</div>
          <div class="profile-info__meta">
            <span class="badge badge--amber">${user.level || 'L0'}</span>
            <span class="badge badge--ghost">${user.role === 'instructor' ? '教官' : '队员'}</span>
          </div>
        </div>
      </div>

      <div class="stat-grid animate-in animate-in-delay-1">
        <div class="stat-card">
          <div class="stat-card__value">${summary.completedLessons || 0}</div>
          <div class="stat-card__label">已完成</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${summary.totalQuestions || 0}</div>
          <div class="stat-card__label">答题数</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${summary.avgAccuracy ? summary.avgAccuracy + '%' : '-'}</div>
          <div class="stat-card__label">正确率</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${summary.quizCount || 0}</div>
          <div class="stat-card__label">测验数</div>
        </div>
      </div>

      <div class="v31-brief animate-in animate-in-delay-1">
        <span>// DATA SOURCE</span>
        <p>能力画像只读取真实课程完成和答题记录；样本越多，雷达图越稳定。当前答题样本：${summary.totalQuestions || 0}。</p>
      </div>

      ${Object.keys(dimensions).length > 0 ? `
      <div class="section-header mt-4 animate-in animate-in-delay-2">
        <span class="section-header__label">ABILITY RADAR</span>
      </div>
      <div class="radar-chart animate-in animate-in-delay-2">
        <canvas id="radar-canvas" width="200" height="200"></canvas>
      </div>
      <div class="flex gap-2 flex-wrap justify-between animate-in animate-in-delay-2">
        ${Object.entries(dimLabels).map(([key, label]) => `
          <div style="width:48%;padding:var(--sp-2) var(--sp-3);background:var(--bg-secondary);border-radius:var(--radius-sm);margin-bottom:var(--sp-1)">
            <div style="font-size:11px;color:var(--text-muted)">${label}</div>
            <div style="font-family:var(--font-display);font-weight:var(--fw-bold);color:var(--accent-amber)">${dimensions[key] || 0}</div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${profile.weaknesses && profile.weaknesses.length > 0 ? `
      <div class="section-header mt-4 animate-in animate-in-delay-3">
        <span class="section-header__label">WEAK POINTS</span>
      </div>
      ${profile.weaknesses.map(w => `
        <div class="weak-rec animate-in">
          <div class="weak-rec__domain">${w.dimension || '未知'}</div>
          <div class="weak-rec__reason">${w.reason || '需要加强训练'}</div>
        </div>
      `).join('')}
      ` : ''}

      <div class="section-header mt-4 animate-in animate-in-delay-3">
        <span class="section-header__label">ACTIONS</span>
      </div>
      <div class="flex flex-col gap-2 animate-in animate-in-delay-3">
        <button class="btn btn--secondary btn--block" onclick="V3.navigateAssessment()">能力评估</button>
        <button class="btn btn--secondary btn--block" onclick="V3.navigateAar()">复盘记录</button>
        <button class="btn btn--danger btn--block" onclick="V3.logout()">退出登录</button>
      </div>
    `;

    // Draw radar chart
    if (Object.keys(dimensions).length > 0) {
      setTimeout(() => drawRadar(dimensions), 100);
    }
  }

  function drawRadar(dimensions) {
    const canvas = document.getElementById('radar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = 200, h = 200;
    const cx = w / 2, cy = h / 2;
    const r = 80;
    const keys = Object.keys(dimensions);
    const n = keys.length;
    if (n < 3) return;

    ctx.clearRect(0, 0, w, h);

    // Draw grid
    for (let ring = 1; ring <= 4; ring++) {
      const rr = r * ring / 4;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
        const x = cx + rr * Math.cos(angle);
        const y = cy + rr * Math.sin(angle);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw axes
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.stroke();
    }

    // Draw data
    ctx.beginPath();
    keys.forEach((key, i) => {
      const val = Math.min((dimensions[key] || 0) / 100, 1);
      const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
      const x = cx + r * val * Math.cos(angle);
      const y = cy + r * val * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(232, 168, 48, 0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 168, 48, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw points
    keys.forEach((key, i) => {
      const val = Math.min((dimensions[key] || 0) / 100, 1);
      const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
      const x = cx + r * val * Math.cos(angle);
      const y = cy + r * val * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#e8a830';
      ctx.fill();
    });
  }

  // ─── AAR (After Action Review) ─────────────────────────
  function navigateAar() {
    navigate('aar');
  }

  async function renderAar() {
    const container = $('#aar-content');
    const data = await api('/aar');
    const records = data ? data.records : [];

    container.innerHTML = `
      <div style="padding-top:var(--sp-3)">
        <button class="btn btn--primary btn--block animate-in" onclick="V3.showNewAarForm()">新建复盘记录</button>

        <div class="section-header mt-4 animate-in animate-in-delay-1">
          <span class="section-header__label">RECORDS // ${records.length}</span>
        </div>

        ${records.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state__text">暂无复盘记录</div>
          </div>
        ` : records.map(r => `
          <div class="aar-record animate-in">
            <div class="aar-record__topic">${r.topic || '未命名'}</div>
            <div class="aar-record__meta">${new Date(r.createdAt).toLocaleString('zh-CN')}</div>
            ${r.situation ? `
            <div class="aar-record__section">
              <div class="aar-record__section-title">SITUATION</div>
              <div class="aar-record__section-text">${r.situation}</div>
            </div>
            ` : ''}
            ${r.findings ? `
            <div class="aar-record__section">
              <div class="aar-record__section-title">FINDINGS</div>
              <div class="aar-record__section-text">${r.findings}</div>
            </div>
            ` : ''}
            ${r.actions ? `
            <div class="aar-record__section">
              <div class="aar-record__section-title">ACTIONS</div>
              <div class="aar-record__section-text">${r.actions}</div>
            </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  function showNewAarForm() {
    showModal(`
      <div class="modal-sheet__title">新建复盘记录</div>
      <div class="aar-form">
        <div class="form-group">
          <label class="form-group__label">TOPIC</label>
          <input class="form-input" id="aar-topic" placeholder="训练主题">
        </div>
        <div class="form-group">
          <label class="form-group__label">SITUATION // 情况描述</label>
          <textarea class="aar-textarea" id="aar-situation" placeholder="发生了什么"></textarea>
        </div>
        <div class="form-group">
          <label class="form-group__label">FINDINGS // 发现</label>
          <textarea class="aar-textarea" id="aar-findings" placeholder="观察到什么"></textarea>
        </div>
        <div class="form-group">
          <label class="form-group__label">ACTIONS // 行动项</label>
          <textarea class="aar-textarea" id="aar-actions" placeholder="下次怎么做"></textarea>
        </div>
        <button class="btn btn--primary btn--block" onclick="V3.submitAar()">提交</button>
      </div>
    `);
  }

  async function submitAar() {
    const topic = document.getElementById('aar-topic')?.value?.trim();
    const situation = document.getElementById('aar-situation')?.value?.trim();
    const findings = document.getElementById('aar-findings')?.value?.trim();
    const actions = document.getElementById('aar-actions')?.value?.trim();

    if (!topic) return toast('请填写主题', 'error');

    const result = await api('/aar', {
      method: 'POST',
      body: JSON.stringify({ topic, situation, findings, actions })
    });

    if (result) {
      toast('复盘记录已保存', 'success');
      closeModal();
      renderAar();
    }
  }

  // ─── ASSESSMENT ────────────────────────────────────────
  function navigateAssessment() {
    navigate('assessment');
  }

  async function renderAssessment() {
    const container = $('#assessment-content');
    const data = await api('/assessment');
    const records = data ? data.records : [];

    container.innerHTML = `
      <div style="padding-top:var(--sp-3)">
        <div class="info-block animate-in">
          <div class="info-block__title">能力评估</div>
          <div class="info-block__text">为队员或班组评分，六个维度各0-100分。系统自动计算加权总分。</div>
        </div>

        <div class="section-header mt-3 animate-in animate-in-delay-1">
          <span class="section-header__label">NEW ASSESSMENT</span>
        </div>

        <div class="info-block animate-in animate-in-delay-1">
          <div class="form-group" style="margin-bottom:var(--sp-3)">
            <label class="form-group__label">EVENT // 对抗事件</label>
            <input class="form-input" id="assess-event" placeholder="例：W15对抗赛">
          </div>
          <div class="form-group" style="margin-bottom:var(--sp-3)">
            <label class="form-group__label">SQUAD // 班组</label>
            <input class="form-input" id="assess-squad" placeholder="例：Alpha-1">
          </div>

          ${[
            ['command', '指挥决策', '0.2'],
            ['comms', '通讯报告', '0.2'],
            ['formation', '队形协同', '0.15'],
            ['sop', 'SOP执行', '0.2'],
            ['attrition', '损耗控制', '0.15'],
            ['reaction', '反应速度', '0.1']
          ].map(([key, label, weight]) => `
            <div class="assess-dimension">
              <div class="assess-dimension__label">${label}</div>
              <input class="assess-dimension__slider" type="range" min="0" max="100" value="50"
                     id="assess-${key}" oninput="document.getElementById('assess-${key}-val').textContent=this.value">
              <div class="assess-dimension__value" id="assess-${key}-val">50</div>
            </div>
          `).join('')}

          <button class="btn btn--primary btn--block mt-4" onclick="V3.submitAssessment()">提交评估</button>
        </div>

        ${records.length > 0 ? `
        <div class="section-header mt-4 animate-in animate-in-delay-2">
          <span class="section-header__label">HISTORY // ${records.length}</span>
        </div>
        ${records.slice(0, 10).map(r => `
          <div class="aar-record animate-in">
            <div class="aar-record__topic">${r.event || '未命名'} — ${r.squad || '-'}</div>
            <div class="aar-record__meta">
              ${new Date(r.createdAt).toLocaleString('zh-CN')}
              // 加权总分: <span class="text-accent">${r.weightedScore || '-'}</span>
            </div>
          </div>
        `).join('')}
        ` : ''}
      </div>
    `;
  }

  async function submitAssessment() {
    const event = document.getElementById('assess-event')?.value?.trim() || '未命名';
    const squad = document.getElementById('assess-squad')?.value?.trim() || '未指定';

    const body = { event, squad };
    ['command', 'comms', 'formation', 'sop', 'attrition', 'reaction'].forEach(key => {
      const input = document.getElementById('assess-' + key);
      body[key] = input ? parseInt(input.value) : 50;
    });

    const result = await api('/assessment', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (result) {
      toast(`评估已提交 // 总分: ${result.record.weightedScore}`, 'success');
      renderAssessment();
    }
  }

  // ─── DATA FETCH ────────────────────────────────────────
  async function fetchMe() {
    const data = await api('/me');
    if (data) {
      state.user = data.user;
      state.progress = data.progress || {};
    }
  }

  // ─── MARKDOWN FORMATTER (simple) ───────────────────────
  function formatMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/- \[ \]/g, '☐ ')
      .replace(/- \[x\]/gi, '☑ ')
      .replace(/^- /gm, '• ');
  }

  // ─── INIT ──────────────────────────────────────────────
  function init() {
    // Check token
    if (state.token) {
      fetchMe().then(() => {
        if (state.user) {
          navigate('today');
        } else {
          logout();
        }
      });
    } else {
      navigate('login');
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── PUBLIC API ────────────────────────────────────────
  return {
    navigate, goBack, switchTab, headerAction,
    handleLogin, handleRegister, showRegister, showLogin, logout,
    togglePhase, openWeek, openLesson, switchLessonTab, toggleLessonComplete,
    setQuizType, setQuizWeek, setQuizSkill,
    startQuizSession, startQuizWithFilter, startQuizWithQuestion,
    selectAnswer, quizNext, quizPrev, submitQuiz, confirmSubmit, retryQuiz,
    expandReviewQuestion,
    navigateAssessment, navigateAar,
    showNewAarForm, submitAar,
    submitAssessment,
    closeModal
  };

})();
