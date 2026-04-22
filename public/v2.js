const app = document.querySelector("#v2-app");
const data = window.TRAINING_DATA;

const state = {
  token: localStorage.getItem("training-token") || "",
  isAuthed: false,
  authMode: "login",
  authError: "",
  user: null,
  progress: emptyProgress(),
  profile: null,
  tab: "today",
  selectedWeekId: "w1",
  questionType: "scenario",
  bankScope: "all",
  selectedCourseId: "w1",
  selectedLessonCode: "",
  selectedTag: "",
  submitted: false,
  answers: {},
  saveMessage: ""
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
  if (!state.token) {
    render();
    return;
  }
  try {
    const payload = await api("/api/me");
    applySession(payload);
    await refreshProfile();
  } catch {
    localStorage.removeItem("training-token");
    state.token = "";
    state.isAuthed = false;
  }
  render();
}

function applySession(payload) {
  state.user = payload.user;
  state.progress = { ...emptyProgress(), ...(payload.progress || {}) };
  state.isAuthed = true;
  state.authError = "";
}

function render() {
  const scrollY = window.scrollY;
  if (!state.isAuthed) {
    app.innerHTML = `<div class="app-shell auth-shell">${authView()}</div>`;
  } else {
    app.innerHTML = `
      <div class="app-shell">
        ${topbar()}
        <main class="screen">${view()}</main>
        ${nav()}
      </div>
    `;
  }
  bind();
  if (scrollY > 0 && state.isAuthed) window.scrollTo(0, scrollY);
}

function authView() {
  const isRegister = state.authMode === "register";
  return `
    <main class="auth-screen">
      <section class="auth-card-v2">
        <div class="auth-brand">
          <img src="/assets/yongshi-logo.jpg" alt="甬士">
          <div>
            <span>NINGBO YONGSHI</span>
            <h1>${isRegister ? "建立训练档案" : "进入训练终端"}</h1>
            <p>必须登录后才能学习课程和进入题库。记录先于画像，画像来自真实训练数据。</p>
          </div>
        </div>
        <div class="auth-mode-switch">
          <button class="${!isRegister ? "active" : ""}" data-auth-mode="login" type="button">登录</button>
          <button class="${isRegister ? "active" : ""}" data-auth-mode="register" type="button">注册</button>
        </div>
        <form class="auth-form-v2">
          ${isRegister ? `
            <label>
              <span>训练代号</span>
              <input name="name" placeholder="例如 一班-01" required>
            </label>
          ` : ""}
          <label>
            <span>手机号</span>
            <input name="phone" inputmode="numeric" autocomplete="username" placeholder="11位手机号" required>
          </label>
          <label>
            <span>密码</span>
            <input name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" placeholder="至少6位" required>
          </label>
          ${state.authError ? `<div class="auth-error">${escapeHtml(state.authError)}</div>` : ""}
          <button class="submit-command" type="submit">${isRegister ? "注册并进入" : "登录"}</button>
        </form>
      </section>
    </main>
  `;
}

function topbar() {
  return `
    <header class="topbar-v2">
      <div class="brand-mark">
        <img src="/assets/yongshi-logo.jpg" alt="甬士">
        <div>
          <span>${escapeHtml(state.user?.name || "训练档案")} / SPRINT 1</span>
          <strong>${pageTitle()}</strong>
        </div>
      </div>
      <button class="small-command" data-logout>退出</button>
    </header>
  `;
}

function nav() {
  return `
    <nav class="nav-v2">
      ${navItem("today", "今日")}
      ${navItem("course", "课程")}
      ${navItem("bank", "题库")}
      ${navItem("profile", "档案")}
    </nav>
  `;
}

function navItem(id, label) {
  const active = state.tab === id || (id === "course" && state.tab === "week");
  return `<button class="${active ? "active" : ""}" data-tab="${id}">${label}</button>`;
}

function pageTitle() {
  return {
    today: "今日训练",
    course: "课程地图",
    week: "课程详情",
    bank: "题库中心",
    profile: "个人档案"
  }[state.tab];
}

function view() {
  if (state.tab === "today") return todayView();
  if (state.tab === "course") return courseView();
  if (state.tab === "week") return weekView();
  if (state.tab === "bank") return bankView();
  if (state.tab === "profile") return profileView();
  return todayView();
}

function metrics() {
  const completedWeeks = Object.values(state.progress.lessons || {}).filter(item => item.completed).length;
  const attempts = state.progress.questionAttempts || [];
  const latestByQuestion = new Map();
  for (const attempt of attempts) {
    if (!latestByQuestion.has(attempt.questionId)) latestByQuestion.set(attempt.questionId, attempt);
  }
  const answered = latestByQuestion.size;
  const correct = Array.from(latestByQuestion.values()).filter(item => item.correct).length;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const next = data.weeks.find(week => !state.progress.lessons?.[week.id]?.completed) || data.weeks[0];
  return { completedWeeks, answered, correct, accuracy, next, recent: attempts[0] || null };
}

async function refreshProfile() {
  if (!state.isAuthed) return;
  try {
    state.profile = await api("/api/profile");
  } catch {
    state.profile = null;
  }
}

function todayView() {
  const m = metrics();
  const phase = data.phases.find(item => item.id === m.next.phaseId);
  return `
    <section class="today-order">
      <div class="order-index">NEXT</div>
      <div>
        <span>${escapeHtml(phase.name)} / ${escapeHtml(phase.weeks)}</span>
        <h2>${escapeHtml(m.next.week)} ${escapeHtml(m.next.title)}</h2>
        <p>${escapeHtml(m.next.objective)}</p>
      </div>
      <button class="command-button" data-open-week="${m.next.id}">继续课程</button>
    </section>

    <section class="quick-grid">
      ${statTile("课程完成", `${m.completedWeeks}/${data.weeks.length}`, "周")}
      ${statTile("题目记录", `${m.answered}`, "题")}
      ${statTile("题库正确率", `${m.accuracy}%`, `${m.correct}/${m.answered || 0}`)}
    </section>

    <section class="training-band">
      <div>
        <span>RECOMMENDED SET</span>
        <h3>情景判断题</h3>
        <p>默认先练取舍。也可以进入题库后按课程或知识域标签筛题。</p>
      </div>
      <button data-start-bank="scenario">开始答题</button>
    </section>
    ${m.recent ? `
      <section class="save-note">
        最近记录：${escapeHtml(m.recent.title)} / ${m.recent.correct ? "正确" : "错误"}
      </section>
    ` : ""}
  `;
}

function courseView() {
  return `
    <section class="section-intro">
      <span>30 WEEK MAP</span>
      <h1>课程地图</h1>
      <p>移动端先保证可读、可找、可继续。每周进入详情后再做学习和题目关联。</p>
    </section>
    ${data.phases.map(phase => `
      <section class="phase-v2">
        <div class="phase-sticky">
          <span>${escapeHtml(phase.weeks)}</span>
          <h2>${escapeHtml(phase.name.replace("阶段", ""))}</h2>
          <p>${escapeHtml(phase.focus)}</p>
        </div>
        <div class="week-list-v2">
          ${data.weeks.filter(week => week.phaseId === phase.id).map(weekCard).join("")}
        </div>
      </section>
    `).join("")}
  `;
}

function weekCard(week) {
  const completed = state.progress.lessons?.[week.id]?.completed;
  return `
    <button class="week-line ${completed ? "complete" : ""}" data-week="${week.id}">
      <span>${escapeHtml(week.week)}</span>
      <strong>${escapeHtml(week.title)}</strong>
      <em>${completed ? "DONE" : `${week.lessons.length} LESSONS`}</em>
    </button>
  `;
}

function weekView() {
  const week = data.weeks.find(item => item.id === state.selectedWeekId) || data.weeks[0];
  const phase = data.phases.find(item => item.id === week.phaseId);
  const related = relatedQuestions(week).slice(0, 3);
  const completed = state.progress.lessons?.[week.id]?.completed;
  const heroLesson = week.lessons[0];
  return `
    <button class="text-back" data-back-course>← 返回课程地图</button>
    <section class="week-hero-v2">
      <span>${escapeHtml(phase.name)} · ${escapeHtml(week.week)}</span>
      <h1>${escapeHtml(week.title)}</h1>
      <p>${escapeHtml(week.objective)}</p>
    </section>
    ${lessonImageHtml(heroLesson, "week-cover-v2", false)}
    <section class="standard-slab">
      <span>PASS STANDARD</span>
      <strong>${escapeHtml(week.standard)}</strong>
      <p>${escapeHtml(week.warning)}</p>
    </section>
    <section class="lesson-list-v2">
      ${week.lessons.map((lesson, index) => `
        <article class="lesson-row">
          <div>${String(index + 1).padStart(2, "0")}</div>
          <section>
            <span>${escapeHtml(lesson.code)}</span>
            <h3>${escapeHtml(lesson.title)}</h3>
            ${lessonImageHtml(lesson, "lesson-cover-v2", true)}
            <p><b>动作标准</b>${escapeHtml(lesson.actionStandard)}</p>
            <p><b>常见错误</b>${escapeHtml(lesson.commonError)}</p>
            <p><b>训练动作</b>${escapeHtml(lesson.drill)}</p>
            ${lessonQuestionLinks(lesson)}
            ${lessonContentHtml(lesson)}
          </section>
        </article>
      `).join("")}
    </section>
    <section class="training-band">
      <div>
        <span>LINKED QUESTIONS</span>
        <h3>${related.length ? related.map(item => item.title).join(" / ") : "题库补齐后自动关联"}</h3>
      </div>
      <button data-complete-week="${week.id}">${completed ? "已完成" : "标记完成"}</button>
    </section>
    ${state.saveMessage ? `<section class="save-note">${escapeHtml(state.saveMessage)}</section>` : ""}
  `;
}

function lessonImageHtml(lesson, className, lazy) {
  if (!lesson) return "";
  const image = lesson.image || {};
  if (image.src) {
    return `
      <figure class="${className} course-image-frame">
        <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || `${lesson.code} 训练示意图`)}" ${lazy ? `loading="lazy"` : ""}>
      </figure>
    `;
  }

  return `
    <figure class="${className} course-image-frame missing-image">
      <div>
        <span>${escapeHtml(lesson.code)}</span>
        <strong>训练图待生成</strong>
      </div>
    </figure>
  `;
}

function lessonQuestionLinks(lesson) {
  const questions = relatedQuestionsForLesson(lesson).slice(0, 3);
  return `
    <div class="lesson-question-links">
      <span>关联题目</span>
      ${questions.length ? `
        <strong>${questions.map(question => escapeHtml(question.title)).join(" / ")}</strong>
        <button type="button" data-lesson-bank="${escapeHtml(lesson.code)}">按本课练题</button>
      ` : `
        <strong>暂无直接关联题目</strong>
      `}
    </div>
  `;
}

function lessonContentHtml(lesson) {
  const manuals = String(lesson.lessonManuals || "").trim();
  const deepDives = String(lesson.deepDives || "").trim();
  if (!manuals && !deepDives) return "";

  return `
    <div class="lesson-docs">
      ${manuals ? `
        <details class="lesson-doc" open>
          <summary>学员手册</summary>
          <div class="lesson-copy">${formatDocText(manuals)}</div>
        </details>
      ` : ""}
      ${deepDives ? `
        <details class="lesson-doc">
          <summary>深度拓展</summary>
          <div class="lesson-copy">${formatDocText(deepDives)}</div>
        </details>
      ` : `
        <div class="lesson-doc missing">
          <strong>深度拓展待补齐</strong>
          <span>源文件未提供 deepDives，本课先展示手册内容。</span>
        </div>
      `}
    </div>
  `;
}

function bankView() {
  const questions = selectedQuestions();
  const score = questions.reduce((sum, question) => sum + (Number(state.answers[question.id]) === questionAnswer(question) ? 1 : 0), 0);
  const answered = questions.filter(question => state.answers[question.id] !== undefined).length;
  const passLine = Math.ceil(questions.length * 0.8);
  return `
    <section class="bank-title">
      <span>QUESTION BANK</span>
      <h1>${escapeHtml(bankTitle())}</h1>
      <p>${escapeHtml(bankSubtitle())}</p>
    </section>

    <section class="practice-entry-grid">
      <button class="${state.bankScope === "all" ? "active" : ""}" data-bank-entry="all" type="button">
        <span>快速练习</span>
        <strong>全题组</strong>
        <em>直接进入本类题目</em>
      </button>
      <button class="${state.bankScope === "course" ? "active" : ""}" data-bank-entry="course" type="button">
        <span>按课程练</span>
        <strong>课程周</strong>
        <em>学完一周后检验</em>
      </button>
      <button class="${state.bankScope === "tag" ? "active" : ""}" data-bank-entry="tag" type="button">
        <span>按知识域练</span>
        <strong>能力标签</strong>
        <em>针对薄弱项训练</em>
      </button>
    </section>

    <section class="bank-console">
      <div class="console-head">
        <span>筛选条件</span>
        <strong>${escapeHtml(bankConditionLabel())}</strong>
      </div>
      <div class="segmented">
        <button class="${state.questionType === "scenario" ? "active" : ""}" data-question-type="scenario">情景判断</button>
        <button class="${state.questionType === "course" ? "active" : ""}" data-question-type="course">课程考核</button>
      </div>
      <div class="filter-row">
        <button class="${state.bankScope === "all" ? "active" : ""}" data-bank-scope="all">全部</button>
        <button class="${state.bankScope === "course" ? "active" : ""}" data-bank-scope="course">课程</button>
        <button class="${state.bankScope === "tag" ? "active" : ""}" data-bank-scope="tag">知识域</button>
      </div>
      ${state.bankScope === "course" ? courseFilterHtml() : ""}
      ${state.bankScope === "tag" ? tagFilterHtml() : ""}
      <div class="bank-readout">
        <div><span>已作答</span><strong>${answered}/${questions.length}</strong></div>
        <div><span>命中题数</span><strong>${questions.length}</strong></div>
        <div><span>合格线</span><strong>${passLine || 0}</strong></div>
      </div>
    </section>

    <form class="question-stack" novalidate>
      ${questions.length ? `<div class="set-meta"><span>本组题目</span><strong>${bankSetLabel()}</strong></div>` : ""}
      ${questions.length ? questions.map((question, index) => questionView(question, index, questions.length)).join("") : emptyBankState()}
      ${state.submitted && questions.length ? scoreDebrief(score, questions.length, questions) : ""}
      ${state.saveMessage ? `<section class="save-note">${escapeHtml(state.saveMessage)}</section>` : ""}
      ${questions.length ? `<div class="submit-dock"><button class="submit-command" type="submit">${state.submitted ? "重新训练" : `提交练习 ${answered}/${questions.length}`}</button></div>` : ""}
    </form>
  `;
}

function courseFilterHtml() {
  return `
    <div class="chip-scroll">
      ${data.weeks.map(week => `
        <button class="${state.selectedCourseId === week.id ? "active" : ""}" data-course-filter="${week.id}">
          ${escapeHtml(week.week)}
        </button>
      `).join("")}
    </div>
  `;
}

function tagFilterHtml() {
  const tags = allTags().filter(tag => tag !== "AAR");
  return `
    <div class="chip-scroll">
      ${tags.map(tag => `
        <button class="${state.selectedTag === tag ? "active" : ""}" data-tag-filter="${escapeHtml(tag)}">
          ${escapeHtml(tag)}
        </button>
      `).join("")}
    </div>
  `;
}

function selectedQuestions() {
  let questions = data.questionBank.filter(item => questionTypeKey(item) === state.questionType);
  if (state.bankScope === "course") {
    const week = data.weeks.find(item => item.id === state.selectedCourseId) || data.weeks[0];
    questions = questions.filter(question => {
      const mapping = questionLessonMapping(question);
      if (state.selectedLessonCode) {
        return mapping.includes(state.selectedLessonCode) || questionSource(question).includes(state.selectedLessonCode);
      }
      return mapping.includes(week.week) || questionSource(question).includes(week.week) || questionTags(question).some(tag => week.title.includes(tag));
    });
  }
  if (state.bankScope === "tag") {
    const tag = state.selectedTag || selectableTags()[0] || "";
    questions = questions.filter(question => questionTags(question).includes(tag) || questionSkill(question) === tag);
  }
  return questions;
}

function bankTitle() {
  if (state.bankScope === "course") {
    const week = data.weeks.find(item => item.id === state.selectedCourseId) || data.weeks[0];
    if (state.selectedLessonCode) {
      const lesson = week.lessons.find(item => item.code === state.selectedLessonCode);
      return `${state.selectedLessonCode} ${lesson?.title || ""} 题组`;
    }
    return `${week.week} ${week.title} 题组`;
  }
  if (state.bankScope === "tag") {
    return `${state.selectedTag || selectableTags()[0] || "知识域"} 专项题组`;
  }
  return state.questionType === "scenario" ? "情景判断题组" : "课程考核题组";
}

function bankSubtitle() {
  if (state.bankScope === "course") return "按课程周抽取关联题，学完一周后直接做闭环检验。";
  if (state.bankScope === "tag") return "按知识域标签进入专项训练，后续会沉淀到能力画像。";
  return "先定题型，再切课程或知识域。每次提交都会留下真实训练记录。";
}

function questionModeLabel() {
  return state.questionType === "scenario" ? "情景判断" : "课程考核";
}

function bankConditionLabel() {
  return `${questionModeLabel()} / ${state.bankScope === "course" ? "课程周" : state.bankScope === "tag" ? "知识域" : "全部"} / ${bankSetLabel()}`;
}

function bankSetLabel() {
  if (state.bankScope === "course") {
    const week = data.weeks.find(item => item.id === state.selectedCourseId) || data.weeks[0];
    if (state.selectedLessonCode) return `${state.selectedLessonCode} / ${week.week}`;
    return `${week.week} / ${week.title}`;
  }
  if (state.bankScope === "tag") return state.selectedTag || selectableTags()[0] || "未选择知识域";
  return state.questionType === "scenario" ? "全量情景题" : "全量课程题";
}

function emptyBankState() {
  return `
    <section class="empty-state">
      <strong>当前条件没有命中题目</strong>
      <p>可以返回全题组，或者切换课程周、知识域标签继续训练。</p>
      <button data-bank-scope="all" type="button">返回全题组</button>
    </section>
  `;
}

function scoreDebrief(score, total, questions) {
  const passLine = Math.ceil(total * 0.8);
  const passed = score >= passLine;
  const wrong = questions
    .map((question, index) => ({ question, index }))
    .filter(item => Number(state.answers[item.question.id]) !== questionAnswer(item.question));
  const wrongLabels = wrong.length ? wrong.map(item => `Q${String(item.index + 1).padStart(2, "0")}`).join(" / ") : "无";
  const wrongTags = Array.from(new Set(wrong.flatMap(item => questionTags(item.question)))).slice(0, 5).join(" / ") || "无";
  return `
    <section class="score-slab ${passed ? "pass" : "fail"}">
      <div>
        <span>训练复盘</span>
        <strong>${score}/${total}</strong>
      </div>
      <p>${passed ? "达到本轮合格线，记录已归档。" : `未达到 ${passLine}/${total} 合格线，建议立即复盘错误题。`} 错题：${escapeHtml(wrongLabels)}。标签：${escapeHtml(wrongTags)}。</p>
    </section>
  `;
}

function difficultyLabel(value) {
  return ["", "基础", "标准", "进阶", "高压"][Number(value)] || "标准";
}

function questionView(question, index, total) {
  const selected = state.answers[question.id];
  const correct = Number(selected) === questionAnswer(question);
  return `
    <fieldset class="question-v2 ${state.submitted ? (correct ? "right" : "wrong") : ""}">
      <legend>
        <small>Q${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")} · ${escapeHtml(difficultyLabel(question.difficulty))}</small>
        <span>${escapeHtml(question.title)}</span>
        <em>${escapeHtml(questionTags(question).slice(0, 4).join(" / "))}</em>
      </legend>
      <p>${escapeHtml(questionText(question))}</p>
      <div class="option-v2-list">
        ${question.options.map((option, index) => `
          <label class="${state.submitted && index === questionAnswer(question) ? "answer" : ""}">
            <input type="radio" name="${question.id}" value="${index}" ${String(selected) === String(index) ? "checked" : ""} ${state.submitted ? "disabled" : ""} required>
            <span>${state.submitted && index === questionAnswer(question) ? "<i>正确答案</i>" : ""}${escapeHtml(option)}</span>
          </label>
        `).join("")}
      </div>
      ${state.submitted ? `
        <section class="analysis-v2">
          <b>${correct ? "正确" : "需要复盘"}</b>
          <span>${escapeHtml(question.analysis)}</span>
          <small>来源：${escapeHtml(questionSource(question))}</small>
        </section>
      ` : ""}
    </fieldset>
  `;
}

function profileView() {
  const m = metrics();
  const profile = state.profile;
  const summary = profile?.summary || {
    lessonsCompleted: m.completedWeeks,
    answered: m.answered,
    correct: m.correct,
    accuracy: m.accuracy
  };
  const ability = profile?.ability || [];
  const latest = summary.latestAttempt || profile?.progress?.questionAttempts?.[0] || null;
  const hasRecords = Number(summary.answered || 0) > 0 || Number(summary.lessonsCompleted || 0) > 0;
  return `
    <section class="profile-cover">
      <span>SPRINT 2 PROFILE</span>
      <h1>${escapeHtml(state.user?.name || "训练档案")} 的训练档案</h1>
      <p>能力画像只读取真实课程完成和题库记录。没有数据时，不伪造能力结论。</p>
    </section>
    <section class="quick-grid">
      ${statTile("课程完成", `${summary.lessonsCompleted || 0}`, "周")}
      ${statTile("题目记录", `${summary.answered || 0}`, "题")}
      ${statTile("正确率", `${summary.accuracy || 0}%`, `${summary.correct || 0}/${summary.answered || 0}`)}
    </section>
    <section class="profile-source">
      <span>DATA SOURCE</span>
      <h3>${hasRecords ? "真实训练记录已接入" : "等待第一条训练记录"}</h3>
      <p>${hasRecords ? "课程完成、题组提交和每题结果都写入 SQLite。能力画像按每题最新记录计算，不使用展示用假数据。" : "完成一周课程或提交一次题组后，这里会生成第一版训练档案。"}</p>
      ${latest ? `<div class="latest-attempt"><strong>最近答题</strong><span>${escapeHtml(latest.title)} / ${latest.correct ? "正确" : "错误"}</span></div>` : ""}
    </section>
    <section class="radar-panel">
      <span>ABILITY RADAR</span>
      ${ability.length ? radarSvg(ability) : `<p>暂无足够题库记录。先完成一次题组训练后生成能力画像。</p>`}
    </section>
    <section class="profile-next">
      <span>WEAK POINTS</span>
      ${(profile?.weakRecommendations || []).length ? profile.weakRecommendations.map(item => `
        <article class="weak-row">
          <strong>${escapeHtml(item.domain)}</strong>
          <span>${escapeHtml(item.reason)}</span>
        </article>
      `).join("") : `<p>暂无弱项推荐。完成题库训练后按技能域生成。</p>`}
    </section>
    ${hasRecords ? "" : `
      <section class="profile-actions">
        <button data-tab="course">去学课程</button>
        <button data-start-bank="scenario">去做题组</button>
      </section>
    `}
  `;
}

function radarSvg(items) {
  const size = 240;
  const center = size / 2;
  const maxRadius = 86;
  const points = items.map((item, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / items.length;
    const radius = maxRadius * Math.max(0, Math.min(100, item.score || 0)) / 100;
    return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
  }).join(" ");
  const axes = items.map((item, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / items.length;
    const x = center + Math.cos(angle) * maxRadius;
    const y = center + Math.sin(angle) * maxRadius;
    const lx = center + Math.cos(angle) * (maxRadius + 20);
    const ly = center + Math.sin(angle) * (maxRadius + 20);
    return `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}"></line><text x="${lx}" y="${ly}">${escapeHtml(item.domain.slice(0, 4))}</text>`;
  }).join("");
  return `
    <svg class="ability-radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="能力雷达图">
      <circle cx="${center}" cy="${center}" r="30"></circle>
      <circle cx="${center}" cy="${center}" r="58"></circle>
      <circle cx="${center}" cy="${center}" r="${maxRadius}"></circle>
      ${axes}
      <polygon points="${points}"></polygon>
    </svg>
    <div class="ability-list">
      ${items.map(item => `<div><span>${escapeHtml(item.domain)}</span><strong>${item.score || 0}%</strong></div>`).join("")}
    </div>
  `;
}

function statTile(label, value, hint) {
  return `<article class="stat-tile"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><em>${escapeHtml(hint)}</em></article>`;
}

function bind() {
  document.querySelectorAll("[data-auth-mode]").forEach(button => {
    button.addEventListener("click", () => {
      state.authMode = button.dataset.authMode;
      state.authError = "";
      render();
    });
  });
  document.querySelector(".auth-form-v2")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const payload = await api(state.authMode === "register" ? "/api/register" : "/api/login", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          phone: form.get("phone"),
          password: form.get("password")
        })
      });
      state.token = payload.token;
      localStorage.setItem("training-token", state.token);
      applySession({ user: payload.user, progress: emptyProgress() });
      await refreshMe();
      await refreshProfile();
      state.tab = "today";
      render();
    } catch (error) {
      state.authError = error.message;
      render();
    }
  });
  document.querySelector("[data-logout]")?.addEventListener("click", () => {
    localStorage.removeItem("training-token");
    state.token = "";
    state.isAuthed = false;
    state.user = null;
    state.progress = emptyProgress();
    state.submitted = false;
    state.answers = {};
    state.saveMessage = "";
    render();
  });
  document.querySelectorAll("[data-tab]").forEach(button => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      state.submitted = false;
      state.saveMessage = "";
      if (state.tab === "profile") refreshProfile().then(render);
      render();
    });
  });
  document.querySelectorAll("[data-open-week], [data-week]").forEach(button => {
    button.addEventListener("click", () => {
      state.selectedWeekId = button.dataset.openWeek || button.dataset.week;
      state.tab = "week";
      state.saveMessage = "";
      render();
    });
  });
  document.querySelector("[data-back-course]")?.addEventListener("click", () => {
    state.tab = "course";
    render();
  });
  document.querySelector("[data-start-bank]")?.addEventListener("click", () => {
    state.questionType = "scenario";
    state.bankScope = "all";
    state.selectedLessonCode = "";
    state.tab = "bank";
    state.saveMessage = "";
    render();
  });
  document.querySelectorAll("[data-lesson-bank]").forEach(button => {
    button.addEventListener("click", () => {
      const code = button.dataset.lessonBank;
      const weekCode = code.split("-")[0].toLowerCase();
      state.questionType = "course";
      state.bankScope = "course";
      state.selectedCourseId = weekCode;
      state.selectedLessonCode = code;
      state.tab = "bank";
      state.submitted = false;
      state.answers = {};
      state.saveMessage = "已按本课筛选题目，当前题组从头开始。";
      render();
    });
  });
  document.querySelector("[data-complete-week]")?.addEventListener("click", async event => {
    try {
      const payload = await api("/api/progress", {
        method: "POST",
        body: JSON.stringify({ type: "lesson", id: event.currentTarget.dataset.completeWeek, completed: true })
      });
      state.progress = { ...emptyProgress(), ...(payload.progress || {}) };
      state.saveMessage = "课程完成状态已保存。";
    } catch (error) {
      state.saveMessage = error.message;
    }
    render();
  });
  document.querySelectorAll("[data-bank-entry]").forEach(button => {
    button.addEventListener("click", () => {
      state.bankScope = button.dataset.bankEntry;
      state.selectedLessonCode = "";
      if (state.bankScope === "tag" && !state.selectedTag) state.selectedTag = selectableTags()[0] || "";
      state.submitted = false;
      state.answers = {};
      state.saveMessage = "已切换练习入口，当前题组从头开始。";
      render();
    });
  });
  document.querySelectorAll("[data-question-type]").forEach(button => {
    button.addEventListener("click", () => {
      state.questionType = button.dataset.questionType;
      state.submitted = false;
      state.answers = {};
      state.saveMessage = "已切换题型，当前题组从头开始。";
      render();
    });
  });
  document.querySelectorAll("[data-bank-scope]").forEach(button => {
    button.addEventListener("click", () => {
      state.bankScope = button.dataset.bankScope;
      state.selectedLessonCode = "";
      if (state.bankScope === "tag" && !state.selectedTag) state.selectedTag = selectableTags()[0] || "";
      state.submitted = false;
      state.answers = {};
      state.saveMessage = "已切换筛选维度，当前题组从头开始。";
      render();
    });
  });
  document.querySelectorAll("[data-course-filter]").forEach(button => {
    button.addEventListener("click", () => {
      state.selectedCourseId = button.dataset.courseFilter;
      state.selectedLessonCode = "";
      state.submitted = false;
      state.answers = {};
      state.saveMessage = "已切换课程周，当前题组从头开始。";
      render();
    });
  });
  document.querySelectorAll("[data-tag-filter]").forEach(button => {
    button.addEventListener("click", () => {
      state.selectedTag = button.dataset.tagFilter;
      state.submitted = false;
      state.answers = {};
      state.saveMessage = "已切换知识域，当前题组从头开始。";
      render();
    });
  });
  document.querySelector(".question-stack")?.addEventListener("change", event => {
    if (event.target.name) state.answers[event.target.name] = event.target.value;
  });
  document.querySelector(".question-stack")?.addEventListener("submit", async event => {
    event.preventDefault();
    const questions = selectedQuestions();
    if (state.submitted) {
      state.submitted = false;
      state.answers = {};
      state.saveMessage = "";
      render();
      return;
    }

    const unanswered = questions.filter(question => state.answers[question.id] === undefined);
    if (unanswered.length) {
      state.saveMessage = `还有 ${unanswered.length} 道题未作答，完成后才能提交训练记录。`;
      render();
      return;
    }

    const results = questions.map(question => {
      const chosen = Number(state.answers[question.id]);
      return {
        questionId: question.id,
        title: question.title,
        questionType: questionTypeKey(question),
        selectedAnswer: chosen,
        correct: chosen === questionAnswer(question),
        tags: questionTags(question),
        skillClassification: questionSkill(question),
        lessonMapping: questionLessonMapping(question)
      };
    });
    const score = results.filter(item => item.correct).length;
    try {
      const payload = await api("/api/progress", {
        method: "POST",
        body: JSON.stringify({
          type: "quiz",
          id: `v2:${state.questionType}:${state.bankScope}:${state.bankScope === "course" ? state.selectedCourseId : state.selectedTag || "all"}`,
          title: bankTitle(),
          quizType: state.questionType,
          score,
          total: questions.length,
          results
        })
      });
      state.progress = { ...emptyProgress(), ...(payload.progress || {}) };
      await refreshProfile();
      state.submitted = true;
      state.saveMessage = "答题记录已保存。";
    } catch (error) {
      state.saveMessage = error.message;
    }
    render();
  });
}

async function refreshMe() {
  const payload = await api("/api/me");
  applySession(payload);
}

function relatedQuestions(week) {
  return data.questionBank.filter(question => questionSource(question).includes(week.week) || questionLessonMapping(question).includes(week.week) || questionTags(question).some(tag => week.title.includes(tag)));
}

function relatedQuestionsForLesson(lesson) {
  return data.questionBank.filter(question => questionLessonMapping(question).includes(lesson.code) || questionSource(question).includes(lesson.code));
}

function allTags() {
  return Array.from(new Set(data.questionBank.flatMap(question => questionTags(question)))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function selectableTags() {
  return allTags().filter(tag => tag !== "AAR");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDocText(value) {
  return escapeHtml(value)
    .split(/\n{2,}/)
    .map(block => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function questionTypeKey(question) {
  const raw = String(question.type || "");
  if (raw === "scenario" || raw.includes("情景")) return "scenario";
  return "course";
}

function questionText(question) {
  return question.scenario || question.question || question.prompt || "";
}

function questionAnswer(question) {
  if (Number.isInteger(question.answer)) return question.answer;
  const value = String(question.answer || question.correctAnswer || "").trim().toUpperCase();
  if (/^[A-Z]$/.test(value)) return value.charCodeAt(0) - 65;
  return Number(value) || 0;
}

function questionTags(question) {
  const tags = Array.isArray(question.tags) ? question.tags : [];
  return Array.from(new Set([
    ...tags,
    question.skillClassification
  ].filter(Boolean).map(String)));
}

function questionSkill(question) {
  return String(question.skillClassification || question.tags?.[0] || "");
}

function questionLessonMapping(question) {
  return String(question.lessonMapping || question.source || "");
}

function questionSource(question) {
  return String(question.source || question.theorySource || question.lessonMapping || "");
}

boot();
