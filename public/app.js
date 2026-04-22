const data = window.TRAINING_DATA;
const app = document.querySelector("#app");

const state = {
  token: localStorage.getItem("training-token") || "",
  user: null,
  progress: emptyProgress(),
  mode: "login",
  tab: "home",
  activeWeekId: "w1",
  activeQuestionType: "scenario",
  quizSubmitted: false,
  answers: {}
};

function emptyProgress() {
  return {
    lessons: {},
    quizzes: {},
    quizAttempts: [],
    questionAttempts: [],
    tagStats: {}
  };
}

function api(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  }).then(async response => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "请求失败");
    return payload;
  });
}

async function boot() {
  if (!state.token) return renderAuth();
  try {
    const payload = await api("/api/me");
    state.user = payload.user;
    state.progress = { ...emptyProgress(), ...(payload.progress || {}) };
    renderShell();
  } catch {
    localStorage.removeItem("training-token");
    state.token = "";
    renderAuth();
  }
}

function renderAuth(error = "") {
  const isRegister = state.mode === "register";
  app.innerHTML = `
    <main class="login-screen">
      <section class="login-panel terminal-panel">
        <div class="login-brand">
          <img class="brand-logo" src="/assets/yongshi-logo.jpg" alt="宁波甬士">
          <div>
            <div class="eyebrow">YONGSHI TRAINING</div>
            <h1>宁波甬士训练终端</h1>
            <p>先完成课程学习，再用题库验证判断。首版只保留学习、答题和基础记录。</p>
          </div>
        </div>
        <div class="auth-switch">
          <button class="${!isRegister ? "active" : ""}" data-mode="login" type="button">登录</button>
          <button class="${isRegister ? "active" : ""}" data-mode="register" type="button">注册</button>
        </div>
        <form id="auth-form" class="login-form">
          ${isRegister ? `<label><span>代号</span><input name="name" placeholder="例如：一班-01" required></label>` : ""}
          <label><span>手机号</span><input name="phone" inputmode="numeric" autocomplete="username" placeholder="11位手机号" required></label>
          <label><span>密码</span><input name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" placeholder="至少6位" required></label>
          ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
          <button type="submit">${isRegister ? "建立训练档案" : "继续训练"}</button>
        </form>
      </section>
    </main>
  `;
  document.querySelectorAll("[data-mode]").forEach(button => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      renderAuth();
    });
  });
  document.querySelector("#auth-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const payload = await api(isRegister ? "/api/register" : "/api/login", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          phone: form.get("phone"),
          password: form.get("password")
        })
      });
      state.token = payload.token;
      state.user = payload.user;
      localStorage.setItem("training-token", state.token);
      await boot();
    } catch (error) {
      renderAuth(error.message);
    }
  });
}

function renderShell() {
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div>
          <div class="eyebrow">SPRINT 1 MVP</div>
          <h1>${escapeHtml(pageTitle())}</h1>
        </div>
        <button class="icon-button" id="logout">退出</button>
      </header>
      <main id="view" class="view"></main>
      <nav class="bottom-nav">
        ${navButton("home", "首页")}
        ${navButton("learn", "课程")}
        ${navButton("questions", "题库")}
        ${navButton("profile", "档案")}
      </nav>
    </div>
  `;
  document.querySelector("#logout").addEventListener("click", () => {
    localStorage.removeItem("training-token");
    state.token = "";
    renderAuth();
  });
  document.querySelectorAll("[data-tab]").forEach(button => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      state.quizSubmitted = false;
      state.answers = {};
      renderShell();
    });
  });
  renderView();
}

function navButton(tab, label) {
  const active = state.tab === tab || (tab === "learn" && state.tab === "week");
  return `<button data-tab="${tab}" class="${active ? "active" : ""}">${label}</button>`;
}

function pageTitle() {
  return {
    home: "今天继续什么",
    learn: "30周课程",
    week: "课程详情",
    questions: "题库验证",
    profile: "个人档案"
  }[state.tab] || "训练终端";
}

function renderView() {
  const view = document.querySelector("#view");
  if (state.tab === "home") {
    view.innerHTML = homeHtml();
    bindHome();
  }
  if (state.tab === "learn") {
    view.innerHTML = learnHtml();
    bindLearn();
  }
  if (state.tab === "week") {
    view.innerHTML = weekHtml();
    bindWeek();
  }
  if (state.tab === "questions") {
    view.innerHTML = questionsHtml();
    bindQuestions();
  }
  if (state.tab === "profile") {
    view.innerHTML = profileHtml();
  }
}

function metrics() {
  const completedWeeks = Object.values(state.progress.lessons || {}).filter(item => item.completed).length;
  const totalWeeks = data.weeks.length;
  const attempts = state.progress.questionAttempts || [];
  const latestByQuestion = new Map();
  for (const attempt of attempts) {
    if (!latestByQuestion.has(attempt.questionId)) latestByQuestion.set(attempt.questionId, attempt);
  }
  const answered = latestByQuestion.size;
  const correct = Array.from(latestByQuestion.values()).filter(item => item.correct).length;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const nextWeek = data.weeks.find(week => !state.progress.lessons?.[week.id]?.completed) || data.weeks[data.weeks.length - 1];
  const recentAttempt = attempts[0] || null;
  return { completedWeeks, totalWeeks, answered, correct, accuracy, nextWeek, recentAttempt };
}

function homeHtml() {
  const m = metrics();
  const phase = data.phases.find(item => item.id === m.nextWeek.phaseId);
  return `
    <section class="hero-command">
      <div>
        <div class="eyebrow">NEXT TRAINING</div>
        <h2>${escapeHtml(m.nextWeek.week)} ${escapeHtml(m.nextWeek.title)}</h2>
        <p>${escapeHtml(m.nextWeek.objective)}</p>
      </div>
      <div class="radar-score">
        <strong>${Math.round((m.completedWeeks / m.totalWeeks) * 100)}%</strong>
        <span>课程进度</span>
      </div>
    </section>
    <section class="metric-grid">
      ${metricTile("已完成课程", `${m.completedWeeks}/${m.totalWeeks}`, "周")}
      ${metricTile("已记录题目", `${m.answered}`, "题")}
      ${metricTile("题库正确率", `${m.accuracy}%`, `${m.correct}/${m.answered || 0}`)}
    </section>
    <section class="action-grid">
      <button class="primary-action" data-open-week="${m.nextWeek.id}">
        <span>继续课程</span>
        <strong>${escapeHtml(m.nextWeek.week)} ${escapeHtml(m.nextWeek.title)}</strong>
        <em>${escapeHtml(phase.signal)} / ${escapeHtml(phase.focus)}</em>
      </button>
      <button class="primary-action amber" data-open-questions="scenario">
        <span>推荐题组</span>
        <strong>情景判断题</strong>
        <em>先用场景验证取舍，不提前做复杂专项训练。</em>
      </button>
    </section>
    <section class="panel">
      <div class="section-head">
        <div>
          <div class="eyebrow">RECENT</div>
          <h3>最近记录</h3>
        </div>
      </div>
      ${m.recentAttempt ? `
        <div class="record-row">
          <strong>${escapeHtml(m.recentAttempt.title)}</strong>
          <span class="${m.recentAttempt.correct ? "ok" : "bad"}">${m.recentAttempt.correct ? "正确" : "错误"}</span>
        </div>
      ` : `<p class="muted">还没有答题记录。完成第一组题后，这里会显示最近一次判断结果。</p>`}
    </section>
    <section class="panel profile-preview">
      <div>
        <div class="eyebrow">SPRINT 2</div>
        <h3>能力雷达图将在下一轮上线</h3>
        <p>本轮先把课程和答题记录打准。后续会根据标签正确率生成能力画像。</p>
      </div>
    </section>
  `;
}

function bindHome() {
  document.querySelectorAll("[data-open-week]").forEach(button => {
    button.addEventListener("click", () => openWeek(button.dataset.openWeek));
  });
  document.querySelectorAll("[data-open-questions]").forEach(button => {
    button.addEventListener("click", () => {
      state.activeQuestionType = button.dataset.openQuestions;
      state.tab = "questions";
      renderShell();
    });
  });
}

function learnHtml() {
  return `
    <section class="catalog-head">
      <div>
        <div class="eyebrow">COURSE MAP</div>
        <h2>30周课程地图</h2>
        <p>按六个阶段推进。Sprint 1 只记录周完成状态，分课完成留到课程深度重构后处理。</p>
      </div>
    </section>
    ${data.phases.map(phase => `
      <section class="phase-block">
        <div class="phase-title">
          <span>${escapeHtml(phase.weeks)}</span>
          <strong>${escapeHtml(phase.name)}</strong>
          <em>${escapeHtml(phase.focus)}</em>
        </div>
        <div class="week-grid">
          ${data.weeks.filter(week => week.phaseId === phase.id).map(weekCard).join("")}
        </div>
      </section>
    `).join("")}
  `;
}

function weekCard(week) {
  const done = state.progress.lessons?.[week.id]?.completed;
  return `
    <button class="week-card ${done ? "done" : ""}" data-week="${week.id}">
      <span>${escapeHtml(week.week)}</span>
      <strong>${escapeHtml(week.title)}</strong>
      <em>${done ? "已完成" : `${week.lessons.length}个子课`}</em>
    </button>
  `;
}

function bindLearn() {
  document.querySelectorAll("[data-week]").forEach(button => {
    button.addEventListener("click", () => openWeek(button.dataset.week));
  });
}

function openWeek(id) {
  state.activeWeekId = id;
  state.tab = "week";
  renderShell();
}

function weekHtml() {
  const week = findWeek(state.activeWeekId);
  const phase = data.phases.find(item => item.id === week.phaseId);
  const done = state.progress.lessons?.[week.id]?.completed;
  const related = relatedQuestions(week).slice(0, 4);
  return `
    <section class="detail-toolbar">
      <button class="ghost-btn" data-back>返回课程地图</button>
      <span>${escapeHtml(phase.name)}</span>
    </section>
    <article class="mission-card">
      <div class="eyebrow">${escapeHtml(week.week)} COURSE</div>
      <h2>${escapeHtml(week.title)}</h2>
      <p>${escapeHtml(week.objective)}</p>
      <div class="standard-box">
        <strong>达标标准</strong>
        <span>${escapeHtml(week.standard)}</span>
      </div>
      <div class="warning-box">${escapeHtml(week.warning)}</div>
    </article>
    <section class="lesson-stack">
      ${week.lessons.map(lesson => `
        <article class="lesson-node">
          <span>${escapeHtml(lesson.code)}</span>
          <h3>${escapeHtml(lesson.title)}</h3>
          <p><b>动作标准：</b>${escapeHtml(lesson.actionStandard)}</p>
          <p><b>常见错误：</b>${escapeHtml(lesson.commonError)}</p>
          <p><b>训练动作：</b>${escapeHtml(lesson.drill)}</p>
        </article>
      `).join("")}
    </section>
    <section class="panel">
      <div class="section-head">
        <div><div class="eyebrow">LINKED QUESTIONS</div><h3>关联题目</h3></div>
      </div>
      <div class="mini-question-list">
        ${related.map(q => `<button data-question-jump="${q.type}" class="mini-question"><strong>${escapeHtml(q.title)}</strong><span>${q.tags.map(escapeHtml).join(" / ")}</span></button>`).join("") || `<p class="muted">暂无直接关联题目。题库内容补齐后会自动显示。</p>`}
      </div>
    </section>
    <button class="primary-btn" id="complete-week">${done ? "已完成本周训练" : "标记本周训练完成"}</button>
  `;
}

function bindWeek() {
  document.querySelector("[data-back]").addEventListener("click", () => {
    state.tab = "learn";
    renderShell();
  });
  document.querySelectorAll("[data-question-jump]").forEach(button => {
    button.addEventListener("click", () => {
      state.activeQuestionType = button.dataset.questionJump;
      state.tab = "questions";
      renderShell();
    });
  });
  document.querySelector("#complete-week").addEventListener("click", async () => {
    const payload = await api("/api/progress", {
      method: "POST",
      body: JSON.stringify({ type: "lesson", id: state.activeWeekId, completed: true })
    });
    state.progress = payload.progress;
    renderView();
  });
}

function questionsHtml() {
  const questions = selectedQuestions();
  const submitted = state.quizSubmitted;
  const score = submitted ? questions.reduce((sum, q) => sum + (Number(state.answers[q.id]) === q.answer ? 1 : 0), 0) : 0;
  return `
    <section class="catalog-head">
      <div>
        <div class="eyebrow">QUESTION BANK</div>
        <h2>${questionModeTitle()}</h2>
        <p>Sprint 1 固定题库接入结构。题量不作为本轮阻塞，后续直接按模板补充。</p>
      </div>
      <strong>${questions.length}题</strong>
    </section>
    <section class="sheet-tabs two">
      ${questionTab("scenario", "情景判断")}
      ${questionTab("course", "课程考核")}
    </section>
    ${questions.length ? `
      <form id="question-form" class="question-form">
        ${questions.map(questionHtml).join("")}
        ${submitted ? `<div class="result-banner"><strong>本组成绩 ${score}/${questions.length}</strong><span>答题记录已保存，Sprint 2 会用于能力画像。</span></div>` : ""}
        <button class="primary-btn" type="submit">${submitted ? "重新训练本组" : "提交答卷"}</button>
      </form>
    ` : `<section class="panel"><p class="muted">当前分类暂无题目。请按 docs/data-model.md 中的题库模板补充内容。</p></section>`}
  `;
}

function bindQuestions() {
  document.querySelectorAll("[data-question-type]").forEach(button => {
    button.addEventListener("click", () => {
      state.activeQuestionType = button.dataset.questionType;
      state.quizSubmitted = false;
      state.answers = {};
      renderView();
    });
  });
  const form = document.querySelector("#question-form");
  if (!form) return;
  form.addEventListener("change", event => {
    if (event.target.name?.startsWith("q:")) {
      state.answers[event.target.name.slice(2)] = event.target.value;
    }
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (state.quizSubmitted) {
      state.quizSubmitted = false;
      state.answers = {};
      renderView();
      return;
    }
    const questions = selectedQuestions();
    const formData = new FormData(event.currentTarget);
    const results = questions.map(question => {
      const chosen = Number(formData.get(`q:${question.id}`));
      state.answers[question.id] = String(chosen);
      return {
        questionId: question.id,
        title: question.title,
        questionType: question.type,
        correct: chosen === question.answer,
        tags: question.tags
      };
    });
    const score = results.filter(item => item.correct).length;
    const payload = await api("/api/progress", {
      method: "POST",
      body: JSON.stringify({
        type: "quiz",
        id: `bank:${state.activeQuestionType}`,
        title: questionModeTitle(),
        quizType: state.activeQuestionType,
        score,
        total: questions.length,
        results
      })
    });
    state.progress = payload.progress;
    state.quizSubmitted = true;
    renderView();
  });
}

function selectedQuestions() {
  return data.questionBank.filter(question => question.type === state.activeQuestionType);
}

function questionModeTitle() {
  if (state.activeQuestionType === "scenario") return "情景判断题";
  return "课程考核题";
}

function questionTab(type, label) {
  return `<button type="button" data-question-type="${type}" class="${state.activeQuestionType === type ? "active" : ""}">${label}</button>`;
}

function questionHtml(question) {
  const chosen = state.answers[question.id];
  const submitted = state.quizSubmitted;
  const correct = Number(chosen) === question.answer;
  return `
    <fieldset class="question-card ${submitted ? (correct ? "right" : "wrong") : ""}">
      <legend>
        <span>${escapeHtml(question.title)}</span>
        <em>${"★".repeat(question.difficulty)}</em>
      </legend>
      <p class="scenario">${escapeHtml(question.scenario)}</p>
      <div class="option-list">
        ${question.options.map((option, index) => `
          <label class="option-row ${submitted && index === question.answer ? "answer" : ""}">
            <input type="radio" name="q:${question.id}" value="${index}" ${String(chosen) === String(index) ? "checked" : ""} ${submitted ? "disabled" : ""} required>
            <span>${escapeHtml(option)}</span>
          </label>
        `).join("")}
      </div>
      <div class="tag-row">${question.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      ${submitted ? `
        <div class="analysis">
          <strong>${correct ? "判定：正确" : "判定：错误"}</strong>
          <p>${escapeHtml(question.analysis)}</p>
          <small>${escapeHtml(question.source)}</small>
        </div>
      ` : ""}
    </fieldset>
  `;
}

function profileHtml() {
  const m = metrics();
  return `
    <section class="record-hero">
      <div>
        <div class="eyebrow">PROFILE PLACEHOLDER</div>
        <h2>${escapeHtml(state.user?.name || "训练档案")}</h2>
        <p>Sprint 1 只确认记录链路。能力雷达图、弱项推荐和完整个人画像将在 Sprint 2 实现。</p>
      </div>
    </section>
    <section class="metric-grid">
      ${metricTile("课程完成", `${m.completedWeeks}/${m.totalWeeks}`, "周")}
      ${metricTile("题目记录", `${m.answered}`, "题")}
      ${metricTile("当前正确率", `${m.accuracy}%`, `${m.correct}/${m.answered || 0}`)}
    </section>
    <section class="panel">
      <div class="section-head"><div><div class="eyebrow">NEXT</div><h3>Sprint 2 计划</h3></div></div>
      <p class="muted">下一轮会按题目标签计算通讯、CQB、SOP、队形、指挥、复盘等维度，生成能力雷达图和弱项训练建议。</p>
    </section>
  `;
}

function metricTile(title, value, hint) {
  return `<div class="metric-tile"><span>${escapeHtml(title)}</span><strong>${escapeHtml(value)}</strong><em>${escapeHtml(hint)}</em></div>`;
}

function findWeek(id) {
  return data.weeks.find(week => week.id === id) || data.weeks[0];
}

function relatedQuestions(week) {
  const key = week.week;
  return data.questionBank.filter(question => question.source.includes(key) || question.tags.some(tag => week.title.includes(tag)));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

boot();
