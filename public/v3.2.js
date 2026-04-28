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
    quizFilterLesson: null,
    quizFilterSkill: null,
    quizFilterStatus: null,  // null | 'unanswered' | 'answered' | 'wrong'
    quizSession: null,        // { questions, currentIndex, answers, submitted }
    quizSessionType: null,    // 'course' | 'scenario'
    quizSource: null,        // 'lesson' | 'course' | 'quiz' | 'profile' - 记录答题入口来源
    // Profile
    profileFocusRadar: false,
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
      // 结果页直接返回，不需要确认；答题中弹出确认
      if (state.quizSession && state.quizSession.submitted) {
        navigate('quiz');
      } else {
        quizExit();
      }
    } else {
      navigate(state.currentTab || 'today');
    }
  }

  function switchTab(tab) {
    state.currentTab = tab;
    state.expandedPhase = null;
    navigate(tab);
  }

  function navigateProfileRadar() {
    state.profileFocusRadar = true;
    switchTab('profile');
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
      questionMatchesLesson(q, weekCode) ||
      questionMatchesWeek(q, weekCode) ||
      (q.tags && q.tags.includes(weekCode))
    );
  }

  function questionWeekCode(question) {
    const match = String(question.lessonMapping || '').match(/^W\d+(?=-L)/);
    return match ? match[0] : '';
  }

  function questionMatchesWeek(question, weekCode) {
    return questionWeekCode(question) === String(weekCode || '');
  }

  function questionMatchesLesson(question, lessonCode) {
    return String(question.lessonMapping || '') === String(lessonCode || '');
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

  function cleanLessonText(text) {
    return String(text || '')
      .replace(/【[^】]*】/g, '')
      .replace(/\*\*/g, '')
      .replace(/[❌✅⚠️🎯🧠🛡️⚡💡📋🌀🌿⏱️🦴🔄📊]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^[一二三四五六七八九十]+[、.．]\s*/, '')
      .replace(/[：:]\s*$/, '')
      .trim();
  }

  function compactLessonText(text, max = 110) {
    const value = cleanLessonText(text);
    return value.length > max ? value.slice(0, max - 1) + '…' : value;
  }

  function sameLessonText(a, b) {
    return cleanLessonText(a) === cleanLessonText(b);
  }

  function extractManualLine(lesson, labelPattern) {
    const lines = String(lesson.lessonManuals || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const found = lines.find(line => labelPattern.test(cleanLessonText(line)));
    if (!found) return '';
    return found.replace(/^[-\s]*/, '').replace(labelPattern, '').trim();
  }

  function extractManualBullets(lesson, headingPattern) {
    const lines = String(lesson.lessonManuals || '').split(/\r?\n/);
    const start = lines.findIndex(line => headingPattern.test(cleanLessonText(line)));
    if (start < 0) return '';
    const bullets = [];
    for (let i = start + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (bullets.length) break;
        continue;
      }
      if (/^[一二三四五六七八九十]+[、.．]/.test(line)) break;
      const item = cleanLessonText(line.replace(/^[-•\d.、\[\]\s]+/, ''));
      if (item) bullets.push(item.split(/[：:]/)[0]);
      if (bullets.length >= 3) break;
    }
    return bullets.join('；');
  }

  function lessonBriefs(lesson) {
    const manualGoal = extractManualLine(lesson, /^目标[：:]/);
    const goal = compactLessonText(manualGoal || lesson.title || lesson.goal || '完成本课训练目标', 88);
    let standard = lesson.actionStandard || '';
    if (!standard || sameLessonText(standard, lesson.goal) || sameLessonText(standard, goal)) {
      standard =
        extractManualBullets(lesson, /核心原则|标准动作|评分标准|综合评分标准|训练重点|评判标准/) ||
        extractManualLine(lesson, /^检验[：:]/) ||
        lesson.drill ||
        '完成关键动作，能说明适用场景与常见错误';
    }
    standard = compactLessonText(standard, 96);
    if (sameLessonText(goal, standard)) standard = '完成关键动作，能说明适用场景与常见错误';
    return { goal, standard };
  }

  function courseGlyph(lesson, className = 'course-glyph') {
    return `
      <div class="${className}" aria-hidden="true">
        <span>${escapeHtml(lesson?.code || 'COURSE')}</span>
        <i></i>
        <b>${escapeHtml((lesson?.title || 'TRAINING').slice(0, 10))}</b>
      </div>
    `;
  }

  function progressQuestionStats(progress) {
    const attempts = progress.questionAttempts || [];
    const latestByQuestion = new Map();
    for (const attempt of attempts) {
      if (!latestByQuestion.has(attempt.questionId)) latestByQuestion.set(attempt.questionId, attempt);
    }
    const latest = Array.from(latestByQuestion.values());
    const correct = latest.filter(item => item.correct).length;
    return {
      total: latest.length,
      correct,
      accuracy: latest.length ? Math.round(correct / latest.length * 100) : 0
    };
  }

  async function ensureProfile() {
    if (state.profile) return state.profile;
    const profileData = await api('/profile');
    if (profileData) state.profile = profileData;
    return state.profile || {};
  }

  function findNextIncompleteLesson(weeks) {
    for (const w of weeks) {
      for (const l of w.lessons) {
        if (!isLessonCompleted(l.id)) return { week: w, lesson: l };
      }
    }
    return null;
  }

  function startQuizWithSkill(skill) {
    const domain = normalizeSkillDomain(skill);
    const qs = getAllQuestions().filter(q =>
      q.skillClassification === domain ||
      (Array.isArray(q.tags) && q.tags.includes(domain))
    );
    if (!domain || qs.length === 0) return toast('该能力域暂无可用题目', 'error');
    state.quizType = 'course';
    state.quizFilterWeek = null;
    state.quizFilterLesson = null;
    state.quizFilterSkill = domain;
    state.quizSession = {
      questions: qs,
      currentIndex: 0,
      answers: new Array(qs.length).fill(null),
      submitted: false
    };
    navigate('quiz-session');
  }

  function normalizeSkillDomain(skill) {
    const raw = String(skill || '').trim();
    const aliases = {
      '射击基础': '射击姿态与精度',
      'SOP流程': 'SOP任务流程',
      '对抗综合': '对抗策略与决策',
      '领导力/心理素质': '领导力与心理素质'
    };
    return aliases[raw] || raw;
  }

  function levelLabel(level, name, showEn) {
    const code = String(level || 'L0');
    const fallback = {
      L0: '新兵',
      L1: '战士',
      L2: '干员',
      L3: '核心干员',
      L4: '精英',
      L5: '队长',
      L6: '教官'
    };
    const fallbackEn = {
      L0: 'Recruit',
      L1: 'Warrior',
      L2: 'Operator',
      L3: 'Core Operator',
      L4: 'Elite',
      L5: 'Captain',
      L6: 'Instructor'
    };
    const cnName = name || fallback[code] || '';
    const enName = fallbackEn[code] || '';
    if (showEn && enName) return `${code} ${cnName} · ${enName}`;
    return `${code} ${cnName}`.trim();
  }

  // ─── TODAY VIEW ────────────────────────────────────────
  async function renderToday() {
    const container = $('#today-content');
    if (!state.user) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state__text">加载中...</div></div>';
      fetchMe();
      return;
    }

    const weeks = getWeeks();
    const user = state.user;
    const progress = state.progress || {};
    const profile = await ensureProfile();
    if (profile.user) state.user = profile.user;
    const promotion = profile.promotion || null;

    // Calculate stats
    let completedLessons = 0;
    let totalLessons = 0;

    weeks.forEach(w => {
      totalLessons += w.lessons.length;
      w.lessons.forEach(l => { if (isLessonCompleted(l.id)) completedLessons++; });
    });

    const questionStats = progressQuestionStats(progress);
    const nextLesson = findNextIncompleteLesson(weeks);
    const accuracy = questionStats.accuracy;
    const courseProgress = totalLessons > 0 ? Math.round(completedLessons / totalLessons * 100) : 0;
    const nextWeekId = nextLesson ? nextLesson.week.id : '';
    const nextLessonId = nextLesson ? nextLesson.lesson.id : '';
    const nextQuestionCount = nextLesson ? getRelatedQuestions(nextLesson.week.id).length : getAllQuestions().length;
    const todayDate = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
    const promotionAction = promotion?.nextActions?.[0] || null;
    const promotionNeedsCourse = promotionAction?.type === 'course' && promotionAction.target;
    const promotionNeedsQuiz = promotionAction?.type === 'quiz';
    const currentLevelLabel = levelLabel(state.user.level || user.level, state.user.levelName || user.levelName);
    const nextLevelLabel = promotion?.nextLevel ? levelLabel(promotion.nextLevel, promotion.nextLevelName) : '';
    const primaryTitle = promotion && promotion.nextLevel
      ? `${currentLevelLabel} → ${nextLevelLabel}`
      : (nextLesson ? nextLesson.lesson.title : '全课时完成');
    const primaryCopy = promotion && promotion.nextLevel
      ? `${promotion.weekRange} 课程 ${promotion.course.completedLessons}/${promotion.course.requiredLessons}，课程题正确率 ${promotion.quiz.accuracy}%（需 >90%）。${promotion.blockers?.[0] || '晋级链路正常。'}`
      : (nextLesson
      ? (firstSentences(nextLesson.lesson.goal || nextLesson.lesson.lessonManuals || nextLesson.week.goal, 1) || '进入下一节课，完成学习、训练记录和对应题组。')
      : '主课程已经清空，下一步建议回到题库复盘弱项，或查看能力画像。');
    const primaryButton = promotionNeedsCourse
      ? `<button class="btn btn--primary btn--sm" onclick="V3.openLesson('${promotionAction.target.split('-')[0]}', '${promotionAction.target}')">继续晋级课程</button>`
      : (promotionNeedsQuiz
        ? `<button class="btn btn--primary btn--sm" onclick="V3.startPromotionQuiz('${promotion.weekRange}')">练习晋级题</button>`
        : (nextLesson ? `<button class="btn btn--primary btn--sm" onclick="V3.openLesson('${nextWeekId}', '${nextLessonId}')">进入课时</button>` : `<button class="btn btn--primary btn--sm" onclick="V3.switchTab('quiz')">进入题库</button>`));

    container.innerHTML = `
      <section class="v31-today-command animate-in">
        <div class="v31-today-command__sig">
          <span>TRAINING ORDER</span>
          <strong>${todayDate}</strong>
        </div>
        <div class="v31-today-command__body">
          <div class="v31-kicker">今日继续训练</div>
          <h2>${escapeHtml(primaryTitle)}</h2>
          <p>${escapeHtml(primaryCopy)}</p>
          ${promotion?.nextLevel ? `
          <div class="today-promotion-inline">
            <div><span>晋级课程</span><strong>${promotion.course.completedLessons}/${promotion.course.requiredLessons}</strong></div>
            <div><span>课程题正确率</span><strong>${promotion.quiz.answered ? promotion.quiz.accuracy + '%' : '待答题'}</strong></div>
            <div><span>完成度</span><strong>${promotion.progressPercent || 0}%</strong></div>
          </div>
          ${(promotion.course.missingLessonDetails && promotion.course.missingLessonDetails.length > 0) ? `
          <div class="missing-lessons missing-lessons--compact">
            <span class="missing-lessons__label">待完成课时</span>
            <div class="missing-lessons__btns">
              ${promotion.course.missingLessonDetails.slice(0, 6).map(l => `
                <button class="btn btn--ghost btn--xs" onclick="V3.openLesson('${l.id.split('-')[0]}', '${l.id}')">${escapeHtml(l.code)}</button>
              `).join('')}
            </div>
          </div>
          ` : ''}
          ` : ''}
          <div class="v31-action-row">
            ${primaryButton}
            <button class="btn btn--secondary btn--sm" onclick="V3.navigateProfileRadar()">能力画像</button>
          </div>
        </div>
        <div class="v31-today-command__meta">
          <span class="badge badge--amber badge--level">${escapeHtml(currentLevelLabel)}</span>
          <span class="badge badge--ghost">${user.role === 'instructor' ? '管理员' : '学员'}</span>
          ${promotion?.nextLevel ? `<span class="badge badge--cyan">${escapeHtml(promotion.weekRange)} / ${escapeHtml(nextLevelLabel)}</span>` : (nextLesson ? `<span class="badge badge--cyan">${escapeHtml(nextLesson.week.title)} / ${escapeHtml(nextLesson.lesson.code)}</span>` : '<span class="badge badge--cyan">COURSE CLEAR</span>')}
        </div>
        ${courseGlyph(nextLesson?.lesson, 'v31-today-command__glyph')}
      </section>

      <div class="v31-readout-strip animate-in animate-in-delay-1">
        <div class="v31-readout">
          <strong>${courseProgress}%</strong>
          <span>课程推进</span>
        </div>
        <div class="v31-readout">
          <strong>${completedLessons}/${totalLessons}</strong>
          <span>课时完成</span>
        </div>
        <div class="v31-readout">
          <strong>${questionStats.total}</strong>
          <span>答题记录</span>
        </div>
        <div class="v31-readout">
          <strong>${accuracy}%</strong>
          <span>正确率</span>
        </div>
      </div>

      <div class="section-header animate-in animate-in-delay-2">
        <span class="section-header__label">FIELD SHORTCUTS</span>
      </div>
      <div class="v31-ops-list animate-in animate-in-delay-2">
        <div class="v31-ops-row" onclick="V3.switchTab('course')">
          <div class="v31-ops-row__code">MAP</div>
          <div><strong>课程地图</strong><span>按 30 周路线继续推进训练内容</span></div>
          <div class="v31-ops-row__arrow">›</div>
        </div>
        <div class="v31-ops-row" onclick="V3.switchTab('quiz')">
          <div class="v31-ops-row__code">QST</div>
          <div><strong>题库练习</strong><span>${nextQuestionCount} 道相关题可用于复盘和巩固</span></div>
          <div class="v31-ops-row__arrow">›</div>
        </div>
        <div class="v31-ops-row" onclick="V3.navigateProfileRadar()">
          <div class="v31-ops-row__code">PRF</div>
          <div><strong>能力画像</strong><span>基于真实学习进度和答题记录生成</span></div>
          <div class="v31-ops-row__arrow">›</div>
        </div>
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
    const relatedQs = getAllQuestions().filter(q => questionMatchesWeek(q, week.week));

    const heroLesson = week.lessons[0];
    const completedCount = week.lessons.filter(l => isLessonCompleted(l.id)).length;
    const objective = weekContent ? weekContent.objective : week.objective;
    const standard = weekContent ? weekContent.standard : week.standard;

    container.innerHTML = `
      <section class="v31-course-hero animate-in">
        ${courseGlyph(heroLesson, 'v31-course-hero__glyph')}
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
            ${courseGlyph(l, 'lesson-card__glyph')}
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
      ` : `
      <div class="section-header mt-4">
        <span class="section-header__label">RELATED QUESTIONS</span>
      </div>
      <div class="empty-state empty-state--compact">
        <div class="empty-state__text">本周暂无精确关联题目，可回到题库按知识域练习。</div>
      </div>
      `}
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

    const manualSummary = compactLessonText(firstSentences(lesson.lessonManuals, 2), 132);
    const briefs = lessonBriefs(lesson);
    container.innerHTML = `
      <div class="v31-lesson-shell">
        <section class="v31-lesson-hero animate-in">
          ${courseGlyph(lesson, 'v31-lesson-hero__glyph')}
          <div class="v31-lesson-hero__body">
            <div class="v31-kicker">${lesson.code} / ${week.week}</div>
            <h2>${escapeHtml(lesson.title)}</h2>
            <p>${escapeHtml(manualSummary || briefs.goal || '')}</p>
          </div>
        </section>

        <div class="v31-mission-strip animate-in animate-in-delay-1">
          <div><span>目标</span><strong>${escapeHtml(briefs.goal)}</strong></div>
          <div><span>标准</span><strong>${escapeHtml(briefs.standard)}</strong></div>
        </div>

        <!-- 全部内容纵向展开，不再用Tab隐藏 -->
        <div class="lesson-section animate-in animate-in-delay-1">
          <div class="lesson-section__title">📋 训练手册</div>
          <div class="lesson-content">${formatMarkdown(lesson.lessonManuals || '暂无手册内容')}</div>
        </div>

        ${lesson.deepDives ? `
        <div class="lesson-section animate-in animate-in-delay-1">
          <div class="lesson-section__title">💡 深度拓展</div>
          <div class="lesson-content">${formatMarkdown(lesson.deepDives || '暂无拓展内容')}</div>
        </div>
        ` : ''}

        ${lesson.drill ? `
        <div class="lesson-section animate-in animate-in-delay-1">
          <div class="lesson-section__title">🎯 训练流程</div>
          <div class="lesson-content">${formatMarkdown(lesson.drill || '暂无训练流程')}</div>
        </div>
        ` : ''}

        ${lesson.commonError ? `
        <div class="lesson-section animate-in animate-in-delay-1">
          <div class="lesson-section__title">⚠️ 常见错误</div>
          <div class="lesson-content">${formatMarkdown(lesson.commonError || '暂无')}</div>
        </div>
        ` : ''}

        ${relatedQs.length > 0 ? `
        <div class="lesson-section animate-in animate-in-delay-1">
          <div class="lesson-section__title">❓ 关联题目</div>
          <div class="lesson-questions">
            ${relatedQs.map(q => `
              <div class="related-q" onclick="V3.startQuizWithQuestion('${q.id}')">
                <div class="related-q__id">${q.id.toUpperCase()}</div>
                <div class="related-q__title">${q.title}</div>
                <div class="related-q__arrow">›</div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <button class="complete-btn ${done ? 'is-done' : ''} animate-in" onclick="V3.toggleLessonComplete('${lessonId}')">
          ${done ? '✓ 已完成' : '标记完成'}
        </button>

        ${relatedQs.length > 0 ? `
        <button class="btn btn--secondary btn--block mt-3" onclick="V3.startQuizWithFilter('${lesson.code || week.week}')">
          练习关联题目 (${relatedQs.length})
        </button>
        ` : `
        <div class="empty-state empty-state--compact mt-3">
          <div class="empty-state__text">本课暂无关联题目，可按知识域进入题库练习。</div>
        </div>
        `}
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
    const briefs = lessonBriefs(lesson);
    container.innerHTML = `
      <div style="padding-top:var(--sp-3)">
        <div class="info-block animate-in">
          <div class="info-block__title">// 课时目标</div>
          <div class="info-block__text">${escapeHtml(briefs.goal)}</div>
        </div>
        <div class="info-block animate-in animate-in-delay-1">
          <div class="info-block__title">// 行动标准</div>
          <div class="info-block__text">${escapeHtml(briefs.standard)}</div>
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
      state.profile = null;
      await fetchMe();
      toast(done ? '已取消完成' : '已标记完成', 'success');
      renderLessonDetail(state.selectedLessonId, state.selectedWeekId);
    }
  }

  // ─── QUIZ LIST (V3.2)：任务情报面板 ─────────────────────────────────────────
  function renderQuizList() {
    const container = $('#quiz-list-content');
    const allQs = getAllQuestions();
    const skills = getSkillCategories();
    const attempts = latestAttemptMap(state.progress?.questionAttempts || []);

    // Get unique weeks from questions
    const weekSet = new Set();
    allQs.forEach(q => {
      if (q.lessonMapping) {
        const w = q.lessonMapping.split('-')[0];
        weekSet.add(w);
      }
    });
    const weeks = [...weekSet].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

    // Filter questions
    let filtered = allQs;
    if (state.quizType === 'course') {
      filtered = filtered.filter(q => q.type === 'course');
    } else {
      filtered = filtered.filter(q => q.type === 'scenario');
    }
    if (state.quizFilterWeek) {
      filtered = state.quizFilterLesson
        ? filtered.filter(q => questionMatchesLesson(q, state.quizFilterLesson))
        : filtered.filter(q => questionMatchesWeek(q, state.quizFilterWeek));
    }
    if (state.quizFilterSkill) {
      filtered = filtered.filter(q =>
        q.skillClassification === state.quizFilterSkill ||
        (q.tags && q.tags.includes(state.quizFilterSkill))
      );
    }
    // 按答题状态筛选
    if (state.quizFilterStatus) {
      filtered = filtered.filter(q => {
        const a = attempts[q.id];
        switch (state.quizFilterStatus) {
          case 'unanswered': return !a;
          case 'answered': return a;
          case 'wrong': return a && !a.correct;
          default: return true;
        }
      });
    }

    let answered = 0, correct = 0;
    filtered.forEach(q => {
      const a = attempts[q.id];
      if (a) { answered++; if (a.correct) correct++; }
    });

    container.innerHTML = `
      <!-- 任务情报面板 -->
      <div class="v32-quiz-intel animate-in">
        <div class="v32-quiz-intel__title">
          QUESTION BANK <span>// 战术题库</span>
        </div>
        <div style="font-family:var(--font-display);font-size:var(--fs-lg);font-weight:var(--fw-bold);color:var(--text-primary)">
          总计 ${allQs.length} 题 // 已筛选 ${filtered.length} 题
        </div>
        <div class="v32-quiz-stats">
          <div class="v32-quiz-stat">
            <span class="v32-quiz-stat__value">${answered}</span>
            <span class="v32-quiz-stat__label">已答</span>
          </div>
          <div class="v32-quiz-stat">
            <span class="v32-quiz-stat__value" style="color:var(--accent-cyan)">${correct}</span>
            <span class="v32-quiz-stat__label">正确</span>
          </div>
          <div class="v32-quiz-stat">
            <span class="v32-quiz-stat__value" style="color:${answered ? (correct/answered >= 0.8 ? 'var(--accent-cyan)' : 'var(--accent-red)') : 'var(--text-muted)'}">${answered ? Math.round(correct/answered*100) : '--'}%</span>
            <span class="v32-quiz-stat__label">正确率</span>
          </div>
        </div>
      </div>

      <!-- 筛选命令面板：题型 -->
      <div class="v32-filter-panel">
        <div class="v32-filter-row">
          <span class="v32-filter-row__label">类型</span>
          <div class="v32-filter-chips">
            <div class="v32-filter-chip ${state.quizType === 'course' ? 'active' : ''}" onclick="V3.setQuizType('course')">课程题</div>
            <div class="v32-filter-chip ${state.quizType === 'scenario' ? 'active' : ''}" onclick="V3.setQuizType('scenario')">情景题</div>
          </div>
        </div>
        <div class="v32-filter-row">
          <span class="v32-filter-row__label">周次</span>
          <div class="v32-filter-chips">
            <div class="v32-filter-chip ${!state.quizFilterWeek ? 'active' : ''}" onclick="V3.setQuizWeek(null)">全部</div>
            ${weeks.map(w => `
              <div class="v32-filter-chip ${state.quizFilterWeek === w ? 'active' : ''}" onclick="V3.setQuizWeek('${w}')">${w}</div>
            `).join('')}
          </div>
          ${state.quizFilterWeek ? `
            <button class="v32-filter-clear" onclick="V3.setQuizWeek(null)">✕</button>
          ` : ''}
        </div>
        <div class="v32-filter-row">
          <span class="v32-filter-row__label">技能</span>
          <div class="v32-filter-chips">
            <div class="v32-filter-chip ${!state.quizFilterSkill ? 'active' : ''}" onclick="V3.setQuizSkill(null)">全部</div>
            ${skills.map(s => `
              <div class="v32-filter-chip ${state.quizFilterSkill === s ? 'active' : ''}" onclick="V3.setQuizSkill('${s}')">${s.slice(0, 8)}</div>
            `).join('')}
          </div>
          ${state.quizFilterSkill ? `
            <button class="v32-filter-clear" onclick="V3.setQuizSkill(null)">✕</button>
          ` : ''}
        </div>
        <div class="v32-filter-row">
          <span class="v32-filter-row__label">状态</span>
          <div class="v32-filter-chips">
            <div class="v32-filter-chip ${!state.quizFilterStatus ? 'active' : ''}" onclick="V3.setQuizStatus(null)">全部</div>
            <div class="v32-filter-chip ${state.quizFilterStatus === 'unanswered' ? 'active' : ''}" onclick="V3.setQuizStatus('unanswered')">未做</div>
            <div class="v32-filter-chip ${state.quizFilterStatus === 'answered' ? 'active' : ''}" onclick="V3.setQuizStatus('answered')">已做</div>
            <div class="v32-filter-chip ${state.quizFilterStatus === 'wrong' ? 'active' : ''}" onclick="V3.setQuizStatus('wrong')">错题</div>
          </div>
          ${state.quizFilterStatus ? `
            <button class="v32-filter-clear" onclick="V3.setQuizStatus(null)">✕</button>
          ` : ''}
        </div>
      </div>

      ${filtered.length > 0 ? `
      <button class="btn btn--primary btn--block animate-in animate-in-delay-1" onclick="V3.startQuizSession('quiz')">
        开始答题 (${filtered.length} 题)
      </button>
      ` : `
      <div class="empty-state mt-4">
        <div class="empty-state__icon">📭</div>
        <div class="empty-state__text">没有匹配的题目</div>
        <div class="empty-state__hint mt-2" style="font-size: 13px; color: var(--text-muted);">
          ${state.quizFilterStatus === 'wrong' ? '该范围内没有错题，太棒了！' :
            state.quizFilterStatus === 'unanswered' ? '该范围内所有题目都已完成！' :
            state.quizFilterStatus === 'answered' ? '该范围内还没有做过的题目' :
            '当前筛选条件下没有题目，试试放宽筛选'}
        </div>
        <button class="btn btn--secondary btn--sm mt-3" onclick="V3.clearQuizFilters()">清空筛选</button>
      </div>
      `}

      <div class="section-header mt-4 animate-in animate-in-delay-1">
        <span class="section-header__label">QUESTION LIST // 题目列表</span>
      </div>

      ${filtered.map((q, i) => {
        const attempt = attempts[q.id];
        return `
          <div class="v32-question-card animate-in animate-in-delay-${Math.min((i % 5) + 1, 4)}"
               onclick="V3.startQuizWithQuestion('${q.id}')">
            <div class="v32-question-card__head">
              <span class="v32-question-card__id">${q.id.toUpperCase()}</span>
              <div class="v32-question-card__status">
                ${attempt ? `<span class="v32-question-badge ${attempt.correct ? 'correct' : 'wrong'}">${attempt.correct ? '✓ 正确' : '✗ 错误'}</span>` : ''}
                ${q.difficulty ? `<span class="v32-question-meta__tag">难度 ${q.difficulty}</span>` : ''}
              </div>
            </div>
            <div class="v32-question-card__title">${q.title}</div>
            <div class="v32-question-card__meta">
              ${q.skillClassification ? `<span class="v32-question-meta__tag">${q.skillClassification}</span>` : ''}
              ${q.lessonMapping ? `<span class="v32-question-meta__tag">${q.lessonMapping}</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    `;
  }

  function setQuizType(type) {
    state.quizType = type;
    state.quizFilterLesson = null;
    state.quizFilterSkill = null;
    renderQuizList();
  }

  function setQuizWeek(w) {
    state.quizFilterWeek = w;
    state.quizFilterLesson = null;
    state.quizFilterSkill = null;
    renderQuizList();
  }

  function setQuizSkill(s) {
    state.quizFilterSkill = s;
    renderQuizList();
  }

  function setQuizStatus(s) {
    state.quizFilterStatus = s;
    renderQuizList();
  }

  function clearQuizFilters() {
    state.quizFilterWeek = null;
    state.quizFilterLesson = null;
    state.quizFilterSkill = null;
    state.quizFilterStatus = null;
    renderQuizList();
  }

  function latestAttemptMap(attempts) {
    const map = {};
    for (const attempt of Array.isArray(attempts) ? attempts : []) {
      if (!attempt.questionId) continue;
      if (!map[attempt.questionId]) map[attempt.questionId] = attempt;
    }
    return map;
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
      if (String(state.quizFilterWeek).includes('-W')) {
        const weeks = weeksFromPromotionRange(state.quizFilterWeek);
        qs = qs.filter(q => weeks.includes(String(q.lessonMapping || '').split('-')[0]));
      } else {
        qs = state.quizFilterLesson
          ? qs.filter(q => questionMatchesLesson(q, state.quizFilterLesson))
          : qs.filter(q => questionMatchesWeek(q, state.quizFilterWeek));
      }
    }
    if (state.quizFilterSkill) {
      qs = qs.filter(q =>
        q.skillClassification === state.quizFilterSkill ||
        (q.tags && q.tags.includes(state.quizFilterSkill))
      );
    }
    // 答题状态筛选 - 确保和列表页一致！
    const attempts = latestAttemptMap(state.progress?.questionAttempts || []);
    if (state.quizFilterStatus) {
      qs = qs.filter(q => {
        const a = attempts[q.id];
        switch (state.quizFilterStatus) {
          case 'unanswered': return !a;
          case 'answered': return a;
          case 'wrong': return a && !a.correct;
          default: return true;
        }
      });
    }
    return qs;
  }

  function startQuizSession(source) {
    const qs = getFilteredQuestions();
    if (qs.length === 0) return toast('没有可用题目', 'error');
    state.quizSource = source || 'quiz';  // 记录答题入口来源
    state.quizSession = {
      questions: qs,
      currentIndex: 0,
      answers: new Array(qs.length).fill(null),
      submitted: false
    };
    navigate('quiz-session');
  }

  function startQuizWithFilter(weekCode) {
    const code = String(weekCode || '');
    state.quizFilterWeek = code.includes('-L') ? code.split('-')[0] : code;
    state.quizFilterLesson = code.includes('-L') ? code : null;
    state.quizType = 'course';
    state.quizFilterSkill = null;
    // 如果当前在课程/课时页，标记来源为'lesson；否则为'course'
    const source = state.selectedLessonId ? 'lesson' : 'course';
    startQuizSession(source);
  }

  function startPromotionQuiz(range) {
    const weeks = weeksFromPromotionRange(range);
    const qs = getAllQuestions().filter(q => {
      const week = String(q.lessonMapping || '').split('-')[0];
      return q.type === 'course' && weeks.includes(week);
    });
    if (qs.length === 0) return toast('该晋级阶段暂无课程题，先完成课程学习', 'error');
    state.quizType = 'course';
    state.quizFilterWeek = range;
    state.quizFilterLesson = null;
    state.quizFilterSkill = null;
    state.quizSource = 'promotion';
    state.quizSession = {
      questions: qs,
      currentIndex: 0,
      answers: new Array(qs.length).fill(null),
      submitted: false
    };
    navigate('quiz-session');
  }

  function weeksFromPromotionRange(range) {
    const match = String(range || '').match(/^W(\d+)-W(\d+)$/);
    if (!match) return [];
    const start = Number(match[1]);
    const end = Number(match[2]);
    const weeks = [];
    for (let week = start; week <= end; week += 1) weeks.push(`W${week}`);
    return weeks;
  }

  function startQuizWithQuestion(qId) {
    // Find the question and start a session with questions from same filter
    const q = getAllQuestions().find(x => x.id === qId);
    if (!q) return;

    // Set filter to include this question
    if (q.type === 'scenario') state.quizType = 'scenario';
    if (q.lessonMapping) state.quizFilterWeek = q.lessonMapping.split('-')[0];
    if (q.lessonMapping) state.quizFilterLesson = q.lessonMapping;

    // 如果当前在课程/课时页，标记来源
    const source = state.selectedLessonId ? 'lesson' : 'quiz';
    startQuizSession(source);

    // Navigate to this specific question
    if (state.quizSession) {
      const idx = state.quizSession.questions.findIndex(x => x.id === qId);
      if (idx >= 0) state.quizSession.currentIndex = idx;
    }
  }

  // ─── QUIZ SESSION (V3.2)：作战指挥终端风格 ─────────────────────────────────
  let quizTimerInterval = null;

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

    // Start timer if not already running
    if (!session.startTime) {
      session.startTime = Date.now();
      startQuizTimer();
    }

    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const isMarked = session.marked && session.marked[currentIndex];

    container.innerHTML = `
      <div class="v32-quiz-session">
        <!-- 顶部导航栏 -->
        <div class="v32-quiz-topbar">
          <button class="v32-quiz-navbtn" onclick="V3.quizExit()" aria-label="退出答题">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <div class="v32-quiz-progress">
            <div class="v32-quiz-progress__num">${currentIndex + 1} / ${total}</div>
            <div class="v32-quiz-progress__bar">
              <div class="v32-quiz-progress__fill" style="width:${((currentIndex + 1) / total * 100).toFixed(1)}%"></div>
            </div>
          </div>
          <div class="v32-quiz-timer" id="quiz-timer">00:00</div>
        </div>

        <!-- 操作栏 -->
        <div class="v32-quiz-actionbar">
          <button class="v32-quiz-actionbtn ${isMarked ? 'marked' : ''}" onclick="V3.toggleMark()">
            <span>⚑</span> 标记
          </button>
          <button class="v32-quiz-actionbtn" onclick="V3.showAnswerSheet()">
            <span>☰</span> 答题卡
          </button>
        </div>

        <!-- 题目区域 -->
        <div class="v32-quiz-scenario">
          <div class="v32-quiz-scenario__card">
            ${isMarked ? '<div class="v32-mark-badge">⚑ 已标记</div>' : ''}
            <div class="v32-quiz-scenario__label">SCENARIO // 战术情景</div>
            <div class="v32-quiz-scenario__text">${q.scenario || q.question || q.title}</div>
          </div>

          <div class="v32-quiz-options">
            ${(q.options || []).map((opt, i) => {
              const selected = answers[currentIndex] === i;
              return `
                <div class="v32-quiz-option ${selected ? 'selected' : ''}"
                     onclick="V3.selectAnswer(${i})">
                  <div class="v32-quiz-option__letter">${letters[i]}</div>
                  <div class="v32-quiz-option__text">${opt}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 底部导航 -->
        <div class="v32-quiz-bottombar">
          <button class="btn btn--secondary" ${currentIndex <= 0 ? 'disabled' : ''} onclick="V3.quizPrev()">
            ◀ 上一题
          </button>
          ${currentIndex >= total - 1
            ? `<button class="btn btn--primary" onclick="V3.submitQuiz()">提交战绩 ▶</button>`
            : `<button class="btn btn--primary" onclick="V3.quizNext()">下一题 ▶</button>`
          }
        </div>
      </div>
    `;

    // Start or update timer display
    if (!quizTimerInterval) {
      quizTimerInterval = setInterval(updateQuizTimer, 1000);
    }
    updateQuizTimer();
  }

  function updateQuizTimer() {
    const el = $('#quiz-timer');
    if (!el || !state.quizSession || state.quizSession.submitted) {
      clearInterval(quizTimerInterval);
      quizTimerInterval = null;
      return;
    }
    const elapsed = Math.floor((Date.now() - state.quizSession.startTime) / 1000);
    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const secs = (elapsed % 60).toString().padStart(2, '0');
    el.textContent = `${mins}:${secs}`;
    // Warning after 10 minutes
    if (elapsed >= 600) el.classList.add('warning');
  }

  function startQuizTimer() {
    if (quizTimerInterval) {
      clearInterval(quizTimerInterval);
    }
    quizTimerInterval = setInterval(updateQuizTimer, 1000);
  }

  function quizExit() {
    showModal(`
      <div class="modal-sheet__title">确认退出？</div>
      <p style="color:var(--text-secondary);font-size:var(--fs-sm);margin-bottom:var(--sp-4)">
        当前答题进度将丢失。
      </p>
      <div class="flex gap-2">
        <button class="btn btn--secondary flex-1" onclick="V3.closeModal()">继续答题</button>
        <button class="btn btn--ghost flex-1" onclick="V3.confirmQuizExit()">确认退出</button>
      </div>
    `);
  }

  function confirmQuizExit() {
    if (quizTimerInterval) {
      clearInterval(quizTimerInterval);
      quizTimerInterval = null;
    }
    state.quizSession = null;
    closeModal();
    navigate('quiz');
  }

  function toggleMark() {
    if (!state.quizSession || state.quizSession.submitted) return;
    if (!state.quizSession.marked) {
      state.quizSession.marked = {};
    }
    const idx = state.quizSession.currentIndex;
    state.quizSession.marked[idx] = !state.quizSession.marked[idx];
    renderQuizSession();
  }

  function showAnswerSheet() {
    const session = state.quizSession;
    if (!session) return;
    const { questions, answers, currentIndex } = session;
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    showModal(`
      <div style="padding-bottom:var(--sp-2)">
        <div class="modal-sheet__title">ANSWER SHEET // 答题卡</div>
        <div style="font-size:var(--fs-xs);color:var(--text-muted);margin-bottom:var(--sp-4)">
          已答 ${answers.filter(a => a !== null).length} / 标记 ${Object.values(session.marked || {}).filter(Boolean).length}
        </div>
        <div class="v32-answer-sheet__grid">
          ${questions.map((q, i) => {
            let status = 'unanswered';
            if (answers[i] !== null) status = 'answered';
            if (session.marked && session.marked[i]) status = 'marked';
            return `
              <button class="v32-answer-sheet__btn ${status}" onclick="V3.jumpToQuestion(${i})">
                ${i + 1}
              </button>
            `;
          }).join('')}
        </div>
        <button class="btn btn--secondary btn--block mt-4" onclick="V3.closeModal()">关闭</button>
      </div>
    `);
  }

  function jumpToQuestion(idx) {
    if (!state.quizSession) return;
    state.quizSession.currentIndex = idx;
    closeModal();
    renderQuizSession();
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
    const unanswered = session.answers.filter(a => a === null).length;
    if (unanswered > 0) {
      showModal(`
        <div style="padding-bottom:var(--sp-2)">
          <div class="modal-sheet__title">确认提交？</div>
          <p style="color:var(--text-secondary);font-size:var(--fs-sm);margin-bottom:var(--sp-4)">
            还有 ${unanswered} 题未作答。未作答的题目将计为错误。
          </p>
          <div class="v32-answer-sheet__grid" style="margin-bottom:var(--sp-4)">
            ${session.questions.map((q, i) => {
              const isUnanswered = session.answers[i] === null;
              const isMarked = session.marked && session.marked[i];
              let status = isUnanswered ? 'unanswered' : 'answered';
              if (isMarked) status = 'marked';
              return `
                <button class="v32-answer-sheet__btn ${status} ${isUnanswered ? 'pulse-warning' : ''}"
                        onclick="V3.jumpToQuestion(${i})">
                  ${i + 1}
                </button>
              `;
            }).join('')}
          </div>
          <div class="flex gap-2">
            <button class="btn btn--secondary flex-1" onclick="V3.closeModal()">继续答题</button>
            <button class="btn btn--primary flex-1" onclick="V3.confirmSubmit()">确认提交</button>
          </div>
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

    // Stop timer
    if (quizTimerInterval) {
      clearInterval(quizTimerInterval);
      quizTimerInterval = null;
    }

    // Calculate results
    let correct = 0;
    const results = session.questions.map((q, i) => {
      const userAnswer = session.answers[i];
      const isCorrect = userAnswer === q.answer;
      if (isCorrect) correct++;
      return {
        questionId: q.id,
        title: q.title || q.id,
        questionType: q.type || state.quizType,
        selectedAnswer: userAnswer,
        correct: isCorrect,
        tags: Array.isArray(q.tags) ? q.tags : [],
        skillClassification: q.skillClassification || '',
        lessonMapping: q.lessonMapping || ''
      };
    });

    // Save to server: quiz summary first
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

    // Also save individual question attempts for each question - CRITICAL for progress tracking
    for (const r of results) {
      await api('/progress', {
        method: 'POST',
        body: JSON.stringify({ type: 'question', ...r })
      });
    }

    // Refresh progress
    state.profile = null;
    await fetchMe();

    renderQuizSession();
  }

  // Track expanded question index in result review
  let quizReviewExpanded = -1;

  // ─── V3.2 等级计算 ─────────────────────────────────────
  function calculateRank(pct) {
    if (pct >= 95) return { rank: 'S', label: '战术精英', desc: '完美表现，堪称教科书级别的决策' };
    if (pct >= 85) return { rank: 'A', label: '优秀指挥员', desc: '表现出色，只有细微失误' };
    if (pct >= 70) return { rank: 'B', label: '合格队员', desc: '基本达标，但还有提升空间' };
    if (pct >= 60) return { rank: 'C', label: '需要加强', desc: '勉强及格，建议回头复习' };
    return { rank: 'D', label: '回炉重造', desc: '基础薄弱，建议重新学习相关课程' };
  }

  // ─── V3.2 弱项分析统计 ─────────────────────────────────
  function calculateWeaknesses(questions, answers, resultMap) {
    const skillStats = {};
    questions.forEach((q, i) => {
      const skill = q.skillClassification || (q.tags && q.tags[0]) || '综合能力';
      if (!skillStats[skill]) {
        skillStats[skill] = { total: 0, correct: 0 };
      }
      skillStats[skill].total++;
      if (resultMap[i]) skillStats[skill].correct++;
    });

    return Object.entries(skillStats)
      .map(([skill, stats]) => ({
        skill,
        total: stats.total,
        correct: stats.correct,
        accuracy: Math.round(stats.correct / stats.total * 100)
      }))
      .filter(s => s.accuracy < 80)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3);
  }

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
    const wrongCount = total - correct;
    const rankInfo = calculateRank(pct);
    const weaknesses = calculateWeaknesses(questions, answers, resultMap);

    // 计算下一课：根据当前筛选的课时找到下一个未完成的
    function findNextLesson() {
      const weeks = getWeeks();
      if (state.quizFilterLesson) {
        // 当前是从某课时进来的，找同一周的下一课或下一周的第一课
        const weekId = state.quizFilterWeek.toLowerCase();
        const week = weeks.find(w => w.id === weekId);
        if (week) {
          const lessons = week.lessons;
          const currentIdx = lessons.findIndex(l => l.code.toUpperCase() === state.quizFilterLesson.toUpperCase());
          // 找同一周的下一课
          for (let i = currentIdx + 1; i < lessons.length; i++) {
            if (!isLessonCompleted(lessons[i].id)) return lessons[i];
          }
          // 同一周的课都做完了，找下一周的第一课
          const weekIdx = weeks.findIndex(w => w.id === weekId);
          for (let i = weekIdx + 1; i < weeks.length; i++) {
            const nextWeek = weeks[i];
            for (const l of nextWeek.lessons) {
              if (!isLessonCompleted(l.id)) return l;
            }
          }
        }
      }
      // 默认逻辑：找全局的下一个未完成
      for (const w of weeks) {
        for (const l of w.lessons) {
          if (!isLessonCompleted(l.id)) return l;
        }
      }
      return null;
    }
    const nextLesson = findNextLesson();
    const fromLesson = state.quizSource === 'lesson' || state.quizSource === 'course';

    // 环形进度条 stroke-dashoffset: 377 * (1 - pct/100)
    const dashOffset = 377 * (1 - pct / 100);

    container.innerHTML = `
      <div class="v32-quiz-result-wrapper rank-${rankInfo.rank}">
        <!-- === 战报头部：环形进度 + 等级 === -->
        <div class="v32-quiz-result-header animate-in">
          <div class="v32-quiz-result__title">MISSION COMPLETE</div>
          <div class="v32-quiz-result__subtitle">作战评估报告</div>

          <!-- 环形进度条 -->
          <div class="v32-ring-progress">
            <svg viewBox="0 0 120 120">
              <circle class="v32-ring-progress__bg" cx="60" cy="60" r="54"/>
              <circle class="v32-ring-progress__fill" cx="60" cy="60" r="54"
                      style="stroke-dashoffset: ${dashOffset}"/>
            </svg>
            <div class="v32-ring-progress__inner">
              <div class="v32-ring-progress__score">${pct}%</div>
              <div class="v32-ring-progress__rank">${rankInfo.rank}级</div>
            </div>
          </div>

          <div class="v32-quiz-result__rank-label">${rankInfo.label}</div>
          <div class="v32-quiz-result__rank-desc">${rankInfo.desc}</div>

          <!-- 数据读数 -->
          <div class="v32-result-stats">
            <div class="v32-result-stat">
              <div class="v32-result-stat__value v32-result-stat__value--correct">${correct}</div>
              <div class="v32-result-stat__label">正确</div>
            </div>
            <div class="v32-result-stat">
              <div class="v32-result-stat__value v32-result-stat__value--wrong">${wrongCount}</div>
              <div class="v32-result-stat__label">错误</div>
            </div>
            <div class="v32-result-stat">
              <div class="v32-result-stat__value">${total}</div>
              <div class="v32-result-stat__label">总计</div>
            </div>
          </div>
        </div>

        <!-- === 弱项分析面板 === -->
        ${weaknesses.length > 0 ? `
        <div class="v32-weak-panel animate-in animate-in-delay-1">
          <div class="v32-weak-panel__title">// WEAK POINTS ANALYSIS · 弱项分析</div>
          ${weaknesses.map(w => `
            <div class="v32-weak-item">
              <span class="v32-weak-item__name">${w.skill}</span>
              <span class="v32-weak-item__rate">正确率 ${w.accuracy}%</span>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- === 复盘网格导航 === -->
        <div class="v32-review-nav animate-in animate-in-delay-1">
          <div class="v32-review-nav__legend">
            <span class="v32-review-nav__dot v32-review-nav__dot--correct"></span>
            <span class="v32-review-nav__legend-text">正确</span>
            <span class="v32-review-nav__dot v32-review-nav__dot--wrong"></span>
            <span class="v32-review-nav__legend-text">错误</span>
            <span class="v32-review-nav__dot v32-review-nav__dot--unanswered"></span>
            <span class="v32-review-nav__legend-text">未答</span>
            <span class="v32-review-nav__dot v32-review-nav__dot--marked"></span>
            <span class="v32-review-nav__legend-text">标记</span>
          </div>
          <div class="v32-review-nav__grid">
            ${questions.map((q, i) => {
              const isCorrect = resultMap[i];
              const isUnanswered = answers[i] === null || answers[i] === undefined;
              const isMarked = session.marked && session.marked[i];
              let status = isUnanswered ? 'unanswered' : (isCorrect ? 'correct' : 'wrong');
              if (isMarked) status += '-marked';
              const isExpanded = quizReviewExpanded === i;
              return `<button class="v32-review-nav__btn v32-review-nav__btn--${status} ${isExpanded ? 'active' : ''}"
                        onclick="V3.expandReviewQuestion(${i})">${i + 1}</button>`;
            }).join('')}
          </div>
        </div>

        <!-- === 展开的题目解析区 === -->
        <div class="v32-review-detail" id="v32-review-detail">
          ${quizReviewExpanded >= 0 && quizReviewExpanded < total
            ? renderReviewQuestionDetailV32(questions[quizReviewExpanded], answers[quizReviewExpanded], resultMap[quizReviewExpanded], quizReviewExpanded)
            : `
            <div class="v32-review-placeholder">
              <div class="v32-review-placeholder__icon">📋</div>
              <div class="v32-review-placeholder__text">点击上方题号查看战术分析</div>
            </div>
          `}
        </div>

        <!-- === 底部操作区 === -->
        <div class="v32-result-actions">
          <!-- 继续下一课 = 最醒目的主按钮，100%宽度 -->
          ${fromLesson && nextLesson
            ? `<button class="btn btn--primary btn--lg btn--full btn--next-lesson" onclick="V3.openLesson('${nextLesson.id.split('-')[0]}', '${nextLesson.id}')">
                <span class="btn--next-lesson__label">继续下一课</span>
                <span class="btn--next-lesson__code">${nextLesson.code}</span>
              </button>`
            : `<button class="btn btn--primary btn--lg btn--full" onclick="V3.switchTab('quiz')">返回题库</button>`
          }
          
          <!-- 次要操作按钮：2列布局 -->
          <div class="v32-result-secondary-actions">
            ${fromLesson && state.selectedLessonId
              ? `<button class="btn btn--secondary" onclick="V3.openLesson('${state.selectedLessonId.split('-')[0]}', '${state.selectedLessonId}')">返回课程</button>`
              : ''
            }
            ${wrongCount > 0 ? `<button class="btn btn--secondary" onclick="V3.retryWrongOnly()">只重做错题</button>` : ''}
            <button class="btn btn--secondary" onclick="V3.retryQuiz()">全部重做</button>
          </div>
        </div>
      </div>
    `;
  }

  function expandReviewQuestion(idx) {
    quizReviewExpanded = quizReviewExpanded === idx ? -1 : idx;
    const detailEl = document.getElementById('v32-review-detail');
    if (!detailEl || !state.quizSession) return;
    const { questions, answers } = state.quizSession;
    const isCorrect = answers[idx] === questions[idx].answer;
    if (quizReviewExpanded < 0) {
      detailEl.innerHTML = `
        <div class="v32-review-placeholder">
          <div class="v32-review-placeholder__icon">📋</div>
          <div class="v32-review-placeholder__text">点击上方题号查看战术分析</div>
        </div>`;
    } else {
      detailEl.innerHTML = renderReviewQuestionDetailV32(questions[idx], answers[idx], isCorrect, idx);
    }
    // Update active state on nav buttons
    document.querySelectorAll('.v32-review-nav__btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === quizReviewExpanded);
    });
  }

  function renderReviewQuestionDetailV32(q, userAns, isCorrect, idx) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const isUnanswered = userAns === null || userAns === undefined;
    const skill = q.skillClassification || (q.tags && q.tags[0]) || '';
    return `
      <div class="v32-review-question animate-in">
        <div class="v32-review-question__header">
          <span class="badge ${isUnanswered ? 'badge--ghost' : (isCorrect ? 'badge--cyan' : 'badge--red')}">
            ${isUnanswered ? '未答' : (isCorrect ? '正确' : '错误')}
          </span>
          <span class="v32-review-question__id">${q.id.toUpperCase()}</span>
          ${q.lessonMapping ? `<span class="v32-review-question__source">${q.lessonMapping}</span>` : ''}
        </div>
        <div class="v32-review-question__text">${q.scenario || q.question || q.title}</div>
        <div class="v32-review-question__options">
          ${(q.options || []).map((opt, oi) => {
            let cls = '';
            let icon = '';
            if (oi === q.answer) { cls = 'correct'; icon = '✓'; }
            else if (oi === userAns && !isCorrect) { cls = 'wrong'; icon = '✗'; }
            return `
              <div class="v32-review-option v32-review-option--${cls}">
                <div class="v32-review-option__letter">${letters[oi]}</div>
                <div class="v32-review-option__text">${opt}</div>
                ${icon ? `<div class="v32-review-option__icon v32-review-option__icon--${cls}">${icon}</div>` : ''}
              </div>`;
          }).join('')}
        </div>
        ${q.analysis ? `
        <div class="v32-review-analysis">
          <div class="v32-review-analysis__title">// TACTICAL ANALYSIS · 战术解析</div>
          <div class="v32-review-analysis__text">${formatMarkdown(q.analysis)}</div>
        </div>
        ` : ''}
        ${skill ? `
        <div class="v32-review-action-bar">
          <button class="btn btn--sm btn--ghost" onclick="V3.startQuizWithSkill('${skill}')">
            🎯 强化练习：${skill}
          </button>
        </div>
        ` : ''}
      </div>
    `;
  }

  // ─── 只重做错题 ────────────────────────────────────────
  function retryWrongOnly() {
    if (!state.quizSession) return;
    const { questions, answers } = state.quizSession;
    const wrongQuestions = questions.filter((q, i) => answers[i] !== q.answer);
    if (wrongQuestions.length === 0) {
      toast('没有错题需要重做', 'success');
      return;
    }
    state.quizSession = {
      questions: wrongQuestions,
      answers: new Array(wrongQuestions.length).fill(null),
      currentIndex: 0,
      submitted: false,
      marked: {},
      isRetryWrong: true
    };
    navigate('quiz-session');
  }

  function retryQuiz() {
    state.quizSession = null;
    startQuizSession(state.quizSource);  // 保持原来的来源
  }

  // ─── PROFILE ───────────────────────────────────────────
  async function renderProfile() {
    const container = $('#profile-content');
    if (!state.user) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state__text">加载中...</div></div>';
      return;
    }

    const user = state.user;
    const profile = await ensureProfile();
    const summary = profile.summary || {};
    const ability = profile.ability || [];
    const weak = (profile.weakRecommendations || []).filter(item => Number(item.score || 0) < 90);
    const promotion = profile.promotion || null;
    const levelHistory = profile.levelHistory || [];
    const hasAbilityData = ability.some(item => item.answered > 0);

    container.innerHTML = `
      <div class="profile-hero animate-in">
        <div class="profile-avatar">${(user.name || '?')[0]}</div>
        <div>
          <div class="profile-info__name">${user.name || user.phone}</div>
          <div class="profile-info__meta">
            <span class="badge badge--amber badge--level">${escapeHtml(levelLabel(user.level, user.levelName))}</span>
            <span class="badge badge--ghost">${user.role === 'instructor' ? '教官' : '队员'}</span>
          </div>
        </div>
      </div>

      <div class="stat-grid animate-in animate-in-delay-1">
        <div class="stat-card">
          <div class="stat-card__value">${summary.completedLessons || 0}</div>
          <div class="stat-card__label">课时完成</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${summary.totalQuestions || 0}</div>
          <div class="stat-card__label">答题样本</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${summary.avgAccuracy ? summary.avgAccuracy + '%' : '-'}</div>
          <div class="stat-card__label">正确率</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${summary.sampleReliable ? '稳定' : '参考'}</div>
          <div class="stat-card__label">画像状态</div>
        </div>
      </div>

      <div class="v31-brief animate-in animate-in-delay-1">
        <span>// DATA SOURCE</span>
        <p>能力画像只读取真实课程完成和答题记录；当前答题样本：${summary.totalQuestions || 0}。${summary.sampleReliable ? '样本已达到初步稳定阈值。' : '样本不足 8 题，画像仅供参考。'}</p>
      </div>

      ${promotion?.nextLevel ? `
      <div class="section-header mt-4 animate-in animate-in-delay-2">
        <span class="section-header__label">PROMOTION STATUS</span>
      </div>
      <section class="promotion-panel animate-in animate-in-delay-2">
        <div class="promotion-panel__head">
          <span>自动晋级节点</span>
          <strong>${escapeHtml(levelLabel(promotion.currentLevel, promotion.currentLevelName))} → ${escapeHtml(levelLabel(promotion.nextLevel, promotion.nextLevelName))}</strong>
        </div>
        <div class="promotion-track"><i style="width:${Math.max(0, Math.min(100, promotion.progressPercent || 0))}%"></i></div>
        <div class="promotion-grid">
          <div><span>${escapeHtml(promotion.weekRange)} 课程</span><strong>${promotion.course.completedLessons}/${promotion.course.requiredLessons}</strong></div>
          <div><span>课程题正确率</span><strong>${promotion.quiz.answered ? promotion.quiz.accuracy + '%' : '待答题'}</strong></div>
        </div>
        <p>${escapeHtml(promotion.blockers?.[0] || '')}</p>
        ${(promotion.course.missingLessonDetails && promotion.course.missingLessonDetails.length > 0) ? `
        <div class="missing-lessons">
          <span class="missing-lessons__label">差这 ${promotion.course.missingLessonDetails.length} 节课：</span>
          <div class="missing-lessons__btns">
            ${promotion.course.missingLessonDetails.map(l => `
              <button class="btn btn--ghost btn--xs"
                onclick="V3.openLesson('${l.id.split('-')[0]}', '${l.id}')">
                ${escapeHtml(l.code)}
              </button>
            `).join('')}
          </div>
        </div>
        ` : ''}
        <div class="v31-action-row mt-3">
          ${promotion.nextActions?.[0]?.type === 'course' ? `<button class="btn btn--primary btn--sm" onclick="V3.openLesson('${promotion.nextActions[0].target.split('-')[0]}', '${promotion.nextActions[0].target}')">继续下一节课</button>` : ''}
          ${promotion.nextActions?.some(item => item.type === 'quiz') ? `<button class="btn btn--secondary btn--sm" onclick="V3.startPromotionQuiz('${promotion.weekRange}')">练习晋级题</button>` : ''}
        </div>
      </section>
      ` : `
      <section class="promotion-panel mt-4 animate-in animate-in-delay-2">
        <div class="promotion-panel__head">
          <span>自动晋级节点</span>
          <strong>${escapeHtml(levelLabel(promotion?.currentLevel || user.level || 'L0', promotion?.currentLevelName || user.levelName))}</strong>
        </div>
        <p>当前已到达最高等级或暂无下一阶段规则。</p>
      </section>
      `}

      ${levelHistory.length ? `
      <div class="v31-brief mt-4 animate-in animate-in-delay-2">
        <span>// LEVEL HISTORY</span>
        ${levelHistory.slice(0, 3).map(item => `<p>${escapeHtml(item.fromLevel)} → ${escapeHtml(item.toLevel)} / ${escapeHtml(item.reason)} / ${formatDate(item.createdAt)}</p>`).join('')}
      </div>
      ` : ''}

      ${hasAbilityData ? `
      <div class="section-header mt-4 animate-in animate-in-delay-2">
        <span class="section-header__label">ABILITY RADAR</span>
      </div>
      <div class="radar-chart animate-in animate-in-delay-2">
        <canvas id="radar-canvas" width="360" height="360"></canvas>
      </div>
      <div class="profile-ability-grid animate-in animate-in-delay-2">
        ${ability.map(item => `
          <div class="profile-ability-cell">
            <span>${escapeHtml(item.domain)}</span>
            <strong>${item.score || 0}%</strong>
            <em>${item.correct || 0}/${item.answered || 0}</em>
          </div>
        `).join('')}
      </div>
      ` : `
      <div class="empty-state mt-4 animate-in animate-in-delay-2">
        <div class="empty-state__text">暂无答题记录，不能生成能力雷达图。</div>
        <button class="btn btn--secondary btn--sm mt-3" onclick="V3.switchTab('quiz')">去题库练习</button>
      </div>
      `}

      ${weak.length > 0 ? `
      <div class="section-header mt-4 animate-in animate-in-delay-3">
        <span class="section-header__label">WEAK POINTS</span>
      </div>
      ${weak.map(w => `
        <div class="weak-rec animate-in">
          <div class="weak-rec__domain">${escapeHtml(w.domain || '未知')}</div>
          <div class="weak-rec__reason">${w.reason || '需要加强训练'}</div>
          <button class="btn btn--ghost btn--sm mt-2 weak-rec__train" data-skill="${escapeHtml(w.domain || '')}">按此域练题</button>
        </div>
      `).join('')}
      ` : `
      <div class="v31-brief mt-4 animate-in animate-in-delay-3">
        <span>// WEAK POINTS</span>
        <p>暂无可用弱项建议。完成至少一组题库后，系统会按八个能力域给出 TOP 3 弱项。</p>
      </div>
      `}

      <div class="section-header mt-4 animate-in animate-in-delay-3">
        <span class="section-header__label">ACTIONS</span>
      </div>
      <div class="flex flex-col gap-2 animate-in animate-in-delay-3">
        <button class="btn btn--secondary btn--block" onclick="V3.navigateAar()">复盘记录</button>
        <button class="btn btn--danger btn--block" onclick="V3.logout()">退出登录</button>
      </div>
    `;

    container.querySelectorAll('.weak-rec__train').forEach(btn => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        startQuizWithSkill(btn.dataset.skill || '');
      });
    });

    // Draw radar chart
    if (hasAbilityData) {
      setTimeout(() => drawRadar(Object.fromEntries(ability.map(item => [item.domain, item.score]))), 100);
    }

    if (state.profileFocusRadar) {
      state.profileFocusRadar = false;
      setTimeout(() => {
        const radar = document.querySelector('.radar-chart');
        radar?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 140);
    }
  }

  function drawRadar(dimensions) {
    const canvas = document.getElementById('radar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const r = Math.min(w, h) * 0.25;
    const labelRadius = Math.min(w, h) * 0.37;
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
    ctx.font = '600 12px "Noto Sans SC", sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 4;
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.stroke();

      const lx = Math.max(54, Math.min(w - 54, cx + labelRadius * Math.cos(angle)));
      const ly = Math.max(28, Math.min(h - 28, cy + labelRadius * Math.sin(angle)));
      ctx.fillStyle = 'rgba(232,234,240,0.92)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      wrapCanvasLabel(ctx, keys[i], lx, ly, 76, 15);
    }
    ctx.shadowBlur = 0;

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

  function wrapCanvasLabel(ctx, text, x, y, maxWidth, lineHeight) {
    const chars = String(text || '').split('');
    const lines = [];
    let line = '';
    for (const char of chars) {
      const next = line + char;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = char;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.slice(0, 2).forEach((item, index) => ctx.fillText(item, x, startY + index * lineHeight));
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
    navigateProfileRadar();
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

  function formatDate(value) {
    if (!value) return '暂无';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '暂无';
    return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
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
    navigate, goBack, switchTab, navigateProfileRadar, headerAction,
    handleLogin, handleRegister, showRegister, showLogin, logout,
    togglePhase, openWeek, openLesson, switchLessonTab, toggleLessonComplete,
    setQuizType, setQuizWeek, setQuizSkill, setQuizStatus, clearQuizFilters,
    startQuizSession, startQuizWithFilter, startQuizWithQuestion, startQuizWithSkill, startPromotionQuiz,
    quizExit, confirmQuizExit, toggleMark, showAnswerSheet, jumpToQuestion,
    selectAnswer, quizNext, quizPrev, submitQuiz, confirmSubmit, retryQuiz, retryWrongOnly,
    expandReviewQuestion,
    navigateAssessment, navigateAar,
    showNewAarForm, submitAar,
    submitAssessment,
    closeModal
  };

})();

