const adminState = {
  token: localStorage.getItem("training-token") || "",
  user: null,
  users: [],
  selected: null,
  view: "overview"
};

const adminApp = document.querySelector("#admin-app");
const trainingData = window.TRAINING_DATA || { weeks: [] };

function adminApi(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(adminState.token ? { Authorization: `Bearer ${adminState.token}` } : {}),
      ...(options.headers || {})
    }
  }).then(async response => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "请求失败");
    return payload;
  });
}

async function bootAdmin() {
  if (!adminState.token) return renderAdminLogin();
  try {
    const me = await adminApi("/api/me");
    adminState.user = me.user;
    if (me.user.role !== "instructor") throw new Error("当前账号没有管理权限");
    const payload = await adminApi("/api/admin/users");
    adminState.users = payload.users || [];
    await syncAdminRoute();
    renderAdmin();
  } catch (error) {
    localStorage.removeItem("training-token");
    adminState.token = "";
    renderAdminLogin(error.message);
  }
}

function renderAdminLogin(error = "") {
  adminApp.innerHTML = `
    <main class="login-screen">
      <section class="login-panel terminal-panel">
        <div class="login-brand">
          <img class="brand-logo" src="/assets/yongshi-logo-transparent.png" alt="宁波甬士">
          <div>
            <div class="eyebrow">YONGSHI COMMAND</div>
            <h1>训练态势管理端</h1>
            <p>只读查看注册用户、课程进度、题目表现、能力画像和弱项建议。</p>
          </div>
        </div>
        <form id="admin-login" class="login-form">
          <label><span>管理员手机号</span><input name="phone" inputmode="numeric" placeholder="18800000000" required></label>
          <label><span>密码</span><input name="password" type="password" placeholder="请输入密码" required></label>
          ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
          <button type="submit">进入管理端</button>
        </form>
      </section>
    </main>
  `;
  document.querySelector("#admin-login").addEventListener("submit", async event => {
    event.preventDefault();
    const btn = event.currentTarget.querySelector('button[type="submit"]');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "登录中…";
    const form = new FormData(event.currentTarget);
    const phone = form.get("phone");
    const password = form.get("password");
    try {
      // Clear any stale tokens (e.g., from a previous member login)
      adminState.token = "";
      localStorage.removeItem("training-token");
      const payload = await adminApi("/api/login", {
        method: "POST",
        body: JSON.stringify({ phone, password })
      });
      adminState.token = payload.token;
      localStorage.setItem("training-token", payload.token);
      await bootAdmin();
    } catch (error) {
      renderAdminLogin(error.message);
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  });
  // Pre-fill the default admin credentials for convenience
  const phoneInput = document.querySelector('input[name="phone"]');
  const pwInput = document.querySelector('input[name="password"]');
  if (phoneInput && !phoneInput.value) phoneInput.value = "18800000000";
}

function renderAdmin() {
  const rows = adminState.users
    .filter(user => user.role !== "instructor")
    .map(user => normalizeAdminRow(user));
  const activeUsers = rows.filter(row => row.stats.hasLearningData).length;
  const avgCourse = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.stats.courseCompletionRate, 0) / rows.length) : 0;
  const totalAnswered = rows.reduce((sum, row) => sum + row.stats.answered, 0);
  const totalCorrect = rows.reduce((sum, row) => sum + row.stats.correct, 0);
  const avgAccuracy = totalAnswered ? Math.round(totalCorrect / totalAnswered * 100) : 0;

  adminApp.innerHTML = `
    <div class="admin-desktop">
      <aside class="admin-sidebar">
        <img class="brand-logo admin-logo" src="/assets/yongshi-logo-transparent.png" alt="宁波甬士">
        <div>
          <div class="eyebrow">COMMAND CENTER</div>
          <h1>甬士训练态势</h1>
          <p>后台只读展示注册用户、课程推进、题库表现和能力弱项。</p>
        </div>
        <nav class="admin-nav">
          <button class="${adminState.view === "overview" ? "active" : ""}" data-admin-route="overview">总览</button>
          <button class="${adminState.view === "detail" ? "active" : ""}" ${adminState.selected ? `data-admin-route="detail"` : "disabled"}>用户详情</button>
        </nav>
        ${sideStat("注册用户", rows.length)}
        ${sideStat("有记录用户", activeUsers)}
        ${sideStat("需关注", rows.filter(row => row.stats.riskLevel === "risk").length)}
      </aside>
      <main class="admin-main">
        ${adminState.view === "detail" && adminState.selected ? renderDetailPage(adminState.selected) : renderOverviewPage(rows, { activeUsers, avgCourse, avgAccuracy })}
      </main>
    </div>
  `;
  bindAdminEvents();
}

function renderOverviewPage(rows, totals) {
  return `
    <header class="admin-toolbar">
      <div>
        <div class="eyebrow">TRAINING DATA CENTER</div>
        <h1>训练闭环总览</h1>
        <p>每个注册用户一条记录，优先判断是否开始训练、进度是否推进、题目表现是否低于风险线。</p>
      </div>
      <button class="icon-button" id="admin-refresh">刷新数据</button>
    </header>
    <section class="metric-grid admin-metrics">
      ${summaryTile("注册用户", rows.length)}
      ${summaryTile("有学习记录", totals.activeUsers)}
      ${summaryTile("平均课程完成率", `${totals.avgCourse}%`)}
      ${summaryTile("平均答题正确率", `${totals.avgAccuracy}%`)}
    </section>
    <section class="admin-table-wrap overview-table">
      <table class="admin-table">
        <thead>
          <tr>
            <th>用户</th>
            <th>手机号</th>
            <th>等级</th>
            <th>风险</th>
            <th>课程</th>
            <th>题目</th>
            <th>晋级</th>
            <th>弱项知识域</th>
            <th>最近活动</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(rowHtml).join("") || `<tr><td colspan="10">暂无注册用户</td></tr>`}
        </tbody>
      </table>
    </section>
    <section class="admin-user-cards">
      ${rows.map(userCardHtml).join("") || `<article class="admin-user-card"><p>暂无注册用户</p></article>`}
    </section>
  `;
}

function renderDetailPage(detail) {
  return `
    <header class="admin-toolbar detail-toolbar">
      <div>
        <div class="eyebrow">USER DETAIL PROFILE</div>
        <h1>${escapeHtml(detail.user.name)}</h1>
        <p>${escapeHtml(detail.user.phone)} / 只读训练档案</p>
      </div>
      <button class="icon-button" data-admin-back>返回总览</button>
    </header>
    ${detailHtml(detail)}
  `;
}

function normalizeAdminRow(user) {
  const stats = user.stats || user.profile?.adminStats || fallbackStats(user.progress || {});
  return { user, stats };
}

function fallbackStats(progress) {
  const completedLessons = Object.values(progress.lessons || {}).filter(item => item.completed).length;
  const attempts = progress.questionAttempts || [];
  const latestByQuestion = new Map();
  for (const attempt of attempts) {
    if (!latestByQuestion.has(attempt.questionId)) latestByQuestion.set(attempt.questionId, attempt);
  }
  const latest = Array.from(latestByQuestion.values());
  const answered = latest.length;
  const correct = latest.filter(item => item.correct).length;
  const accuracy = answered ? Math.round(correct / answered * 100) : 0;
  const weakestDomain = weakestFromTags(progress.tagStats || {});
  const latestLessonAt = Object.values(progress.lessons || {}).map(item => item.updatedAt).filter(Boolean).sort().pop() || "";
  const latestQuestionAt = attempts[0]?.answeredAt || "";
  const lastActivityAt = [latestLessonAt, latestQuestionAt].filter(Boolean).sort().pop() || "";
  const risk = riskState(completedLessons, answered, accuracy);
  return {
    completedLessons,
    totalLessons: 61,
    courseCompletionRate: Math.round(completedLessons / 61 * 100),
    answered,
    correct,
    accuracy,
    weakestDomain,
    lastActivityAt,
    riskLevel: risk.level,
    riskLabel: risk.label,
    riskReason: risk.reason,
    hasLearningData: Boolean(completedLessons || answered),
    promotionLevel: "",
    promotionLevelName: "",
    promotionNextLevel: "",
    promotionNextLevelName: "",
    promotionProgressPercent: 0,
    promotionEligible: false,
    promotionBlockerSummary: ""
  };
}

function rowHtml(row) {
  const { user, stats } = row;
  return `
    <tr class="${adminState.selected?.user?.id === user.id ? "selected" : ""}">
      <td>${escapeHtml(user.name)}</td>
      <td>${escapeHtml(user.phone)}</td>
      <td><span class="admin-rank">${escapeHtml(levelLabel(user.level, user.levelName || stats.promotionLevelName))}</span></td>
      <td><span class="status-pill ${stats.riskLevel}">${escapeHtml(stats.riskLabel)}</span></td>
      <td>${stats.completedLessons}/${stats.totalLessons} · ${stats.courseCompletionRate}%</td>
      <td>${stats.correct}/${stats.answered} · ${stats.accuracy}%</td>
      <td>${promotionSummary(stats)}</td>
      <td>${escapeHtml(stats.weakestDomain || "暂无")}</td>
      <td>${formatDate(stats.lastActivityAt)}</td>
      <td><button class="icon-button" data-user-detail="${escapeHtml(user.id)}">详情</button></td>
    </tr>
  `;
}

function userCardHtml(row) {
  const { user, stats } = row;
  return `
    <article class="admin-user-card ${adminState.selected?.user?.id === user.id ? "selected" : ""}">
      <header>
        <div>
          <strong>${escapeHtml(user.name)}</strong>
          <span>${escapeHtml(user.phone)} / ${escapeHtml(levelLabel(user.level, user.levelName || stats.promotionLevelName))}</span>
        </div>
        <span class="status-pill ${stats.riskLevel}">${escapeHtml(stats.riskLabel)}</span>
      </header>
      <div class="admin-user-card-grid">
        <div><span>课程</span><strong>${stats.completedLessons}/${stats.totalLessons}</strong></div>
        <div><span>题目</span><strong>${stats.correct}/${stats.answered}</strong></div>
        <div><span>正确率</span><strong>${stats.accuracy}%</strong></div>
        <div><span>晋级</span><strong>${escapeHtml(stats.promotionNextLevel ? levelLabel(stats.promotionNextLevel, stats.promotionNextLevelName) : "MAX")}</strong></div>
      </div>
      <p>晋级：${escapeHtml(stats.promotionBlockerSummary || promotionSummary(stats))}</p>
      <p>弱项：${escapeHtml(stats.weakestDomain || "暂无")} / 最近：${formatDate(stats.lastActivityAt)}</p>
      <button class="icon-button" data-user-detail="${escapeHtml(user.id)}">查看详情</button>
    </article>
  `;
}

async function loadUserDetail(id) {
  adminState.selected = await adminApi(`/api/admin/users/${encodeURIComponent(id)}`);
}

async function syncAdminRoute() {
  const route = parseAdminRoute();
  adminState.view = route.view;
  if (route.view === "detail" && route.id) {
    await loadUserDetail(route.id);
  } else {
    adminState.selected = null;
  }
}

function parseAdminRoute() {
  const hash = window.location.hash || "#/overview";
  const match = hash.match(/^#\/users\/(.+)$/);
  if (match) return { view: "detail", id: decodeURIComponent(match[1]) };
  return { view: "overview" };
}

function setAdminRoute(view, id, shouldRender = true) {
  if (view === "detail" && id) {
    adminState.view = "detail";
    window.location.hash = `#/users/${encodeURIComponent(id)}`;
  } else if (view === "detail" && adminState.selected) {
    adminState.view = "detail";
    window.location.hash = `#/users/${encodeURIComponent(adminState.selected.user.id)}`;
  } else {
    adminState.view = "overview";
    adminState.selected = null;
    window.location.hash = "#/overview";
  }
  if (shouldRender) renderAdmin();
}

function detailHtml(detail) {
  const profile = detail.profile || {};
  const summary = profile.summary || {};
  const stats = profile.adminStats || fallbackStats(detail.progress || {});
  const ability = profile.ability || [];
  const attempts = profile.recentQuestions || detail.progress?.questionAttempts || [];
  const weak = (profile.weakRecommendations || []).filter(item => Number(item.score || 0) < 90);
  const recentLessons = profile.recentLessons || recentLessonRows(detail.progress || {});
  const nextLesson = findNextLesson(detail.progress || {});
  const promotion = profile.promotion || {};
  const levelHistory = profile.levelHistory || [];

  return `
    <section class="admin-detail">
      <div class="section-head">
        <div>
          <div class="eyebrow">USER DETAIL</div>
          <h3>${escapeHtml(detail.user.name)} / ${escapeHtml(detail.user.phone)}</h3>
          <p>注册时间：${formatDate(detail.user.createdAt)} / 最近活动：${formatDate(stats.lastActivityAt)}</p>
        </div>
        <span class="status-pill ${stats.riskLevel}">${escapeHtml(stats.riskLabel)}</span>
      </div>
      <div class="metric-grid">
        ${summaryTile("课程完成率", `${stats.courseCompletionRate}%`)}
        ${summaryTile("课时完成", `${stats.completedLessons}/${stats.totalLessons}`)}
        ${summaryTile("答题正确率", `${stats.accuracy}%`)}
        ${summaryTile("答题记录", summary.answered || 0)}
      </div>
      <section class="admin-next-action">
        <div>
          <span>NEXT ACTION</span>
          <strong>${escapeHtml(nextAction(stats, weak, nextLesson))}</strong>
        </div>
        <p>${escapeHtml(stats.riskReason)}</p>
      </section>
      <section class="admin-promotion">
        <div class="admin-promotion-head">
          <div>
            <span>PROMOTION ROUTE</span>
            <strong>${escapeHtml(levelLabel(promotion.currentLevel || detail.user.level || "L0", promotion.currentLevelName || detail.user.levelName))}${promotion.nextLevel ? ` → ${escapeHtml(levelLabel(promotion.nextLevel, promotion.nextLevelName))}` : ""}</strong>
          </div>
          <em>${promotion.nextLevel ? `${promotion.progressPercent || 0}%` : "MAX"}</em>
        </div>
        ${promotion.nextLevel ? `
        <i class="admin-promotion-track" style="--value:${Math.max(0, Math.min(100, Number(promotion.progressPercent || 0)))}%"></i>
        <div class="admin-profile-grid">
          <article>
            <span>晋级课程</span>
            <strong>${promotion.course?.completedLessons || 0}/${promotion.course?.requiredLessons || 0} · ${escapeHtml(promotion.weekRange || "")}</strong>
          </article>
          <article>
            <span>课程题正确率</span>
            <strong>${promotion.quiz?.answered ? `${promotion.quiz.accuracy}% (${promotion.quiz.correct}/${promotion.quiz.answered})` : "待答题"}</strong>
          </article>
        </div>
        <p>${escapeHtml((promotion.blockers || [])[0] || "完成对应课程且阶段课程题正确率大于 90% 后自动晋级。")}</p>
        ${promotion.course?.missingLessonDetails?.length ? `
          <div class="admin-missing-lessons">
            ${promotion.course.missingLessonDetails.slice(0, 8).map(item => `<span>${escapeHtml(item.code)} ${escapeHtml(item.title)}</span>`).join("")}
          </div>
        ` : ""}
        ` : `<p>当前已达到最高等级或暂无下一等级规则。</p>`}
      </section>
      ${levelHistory.length ? `
      <section class="admin-timeline">
        <article>
          <span>晋级历史</span>
          ${levelHistory.slice(0, 5).map(item => `<p>${escapeHtml(item.fromLevel)} → ${escapeHtml(item.toLevel)} / ${escapeHtml(item.reason)} / ${formatDate(item.createdAt)}</p>`).join("")}
        </article>
      </section>
      ` : ""}
      <div class="admin-profile-grid">
        <article>
          <span>下一节推荐</span>
          <strong>${nextLesson ? escapeHtml(`${nextLesson.code} ${nextLesson.title}`) : "课程已完成或暂无课程数据"}</strong>
        </article>
        <article>
          <span>当前弱项</span>
          <strong>${escapeHtml(weak[0]?.domain || "暂无")}</strong>
        </article>
      </div>
      ${ability.some(item => item.answered > 0) ? `
      <div class="admin-ability-grid">
        ${ability.map(item => `
          <div>
            <span>${escapeHtml(item.domain)}</span>
            <strong>${item.score || 0}%</strong>
            <em>${item.correct || 0}/${item.answered || 0}</em>
            <i style="--value:${Math.max(0, Math.min(100, Number(item.score || 0)))}%"></i>
          </div>
        `).join("")}
      </div>
      ` : emptyPanel("能力画像", "暂无答题记录，不能生成能力画像。")}
      <section class="admin-timeline">
        <article>
          <span>最近课程</span>
          ${recentLessons.length ? recentLessons.slice(0, 5).map(item => `<p>${escapeHtml(item.lessonId)} / ${formatDate(item.updatedAt)}</p>`).join("") : "<p>暂无课程完成记录</p>"}
        </article>
        <article>
          <span>最近答题</span>
          ${attempts.length ? attempts.slice(0, 5).map(item => `<p>${escapeHtml(item.title)} / ${item.correct ? "正确" : "错误"} / ${formatDate(item.answeredAt)}</p>`).join("") : "<p>暂无答题记录</p>"}
        </article>
        <article>
          <span>弱项建议</span>
          ${weak.length ? weak.slice(0, 3).map(item => `<p>${escapeHtml(item.domain)} / ${escapeHtml(item.reason)}</p>`).join("") : "<p>暂无弱项建议，先完成一组题库。</p>"}
        </article>
      </section>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>题目</th><th>类型</th><th>结果</th><th>知识域</th><th>课程映射</th><th>时间</th></tr></thead>
          <tbody>
            ${attempts.slice(0, 20).map(item => `
              <tr>
                <td>${escapeHtml(item.title)}</td>
                <td>${escapeHtml(item.type)}</td>
                <td>${item.correct ? "正确" : "错误"}</td>
                <td>${escapeHtml(item.skillClassification || (item.tags || [])[0] || "暂无")}</td>
                <td>${escapeHtml(item.lessonMapping || "暂无")}</td>
                <td>${formatDate(item.answeredAt)}</td>
              </tr>
            `).join("") || `<tr><td colspan="6">暂无答题记录</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function bindAdminEvents() {
  document.querySelector("#admin-refresh")?.addEventListener("click", bootAdmin);
  document.querySelector("[data-admin-back]")?.addEventListener("click", () => setAdminRoute("overview"));
  document.querySelectorAll("[data-admin-route]").forEach(button => {
    button.addEventListener("click", () => setAdminRoute(button.dataset.adminRoute));
  });
  document.querySelectorAll("[data-user-detail]").forEach(button => {
    button.addEventListener("click", async () => {
      await loadUserDetail(button.dataset.userDetail);
      setAdminRoute("detail", button.dataset.userDetail, false);
      renderAdmin();
    });
  });
}

function findNextLesson(progress) {
  const completed = progress.lessons || {};
  for (const week of trainingData.weeks || []) {
    for (const lesson of week.lessons || []) {
      if (!completed[lesson.id]?.completed) {
        return { ...lesson, weekId: week.id, week: week.week };
      }
    }
  }
  return null;
}

function recentLessonRows(progress) {
  return Object.entries(progress.lessons || {})
    .filter(([, item]) => item.completed)
    .sort((a, b) => String(b[1].updatedAt || "").localeCompare(String(a[1].updatedAt || "")))
    .slice(0, 8)
    .map(([lessonId, item]) => ({ lessonId, updatedAt: item.updatedAt }));
}

function weakestFromTags(tagStats) {
  const tags = Object.entries(tagStats)
    .map(([tag, stats]) => ({ tag, ...stats }))
    .filter(item => item.answered > 0)
    .sort((a, b) => a.accuracy - b.accuracy || a.correct - b.correct);
  return tags[0]?.tag || "暂无";
}

function riskState(completedLessons, answered, accuracy) {
  if (!completedLessons && !answered) return { level: "idle", label: "待训练", reason: "暂无课程或题目记录。" };
  if (answered > 0 && accuracy < 60) return { level: "risk", label: "高风险", reason: "题库正确率低于 60%。" };
  if (completedLessons < 3 || answered < 8) return { level: "watch", label: "待训练", reason: "样本量不足，需要继续训练。" };
  return { level: "ok", label: "正常", reason: "训练闭环稳定。" };
}

function nextAction(stats, weak, nextLesson) {
  if (stats.promotionNextLevel && stats.promotionBlockerSummary) return stats.promotionBlockerSummary;
  if (stats.riskLevel === "idle") return nextLesson ? `安排 ${nextLesson.code}` : "安排首轮训练";
  if (stats.riskLevel === "risk") return `复训 ${weak[0]?.domain || stats.weakestDomain || "最低正确率知识域"}`;
  if (stats.riskLevel === "watch") return "补足题库样本和课程完成记录";
  return `保持训练，关注 ${weak[0]?.domain || "最低能力域"}`;
}

function promotionSummary(stats) {
  if (!stats.promotionNextLevel) return escapeHtml(levelLabel(stats.promotionLevel || "L6", stats.promotionLevelName) || "MAX");
  const label = `${levelLabel(stats.promotionLevel || "L0", stats.promotionLevelName)}→${levelLabel(stats.promotionNextLevel, stats.promotionNextLevelName)} ${stats.promotionProgressPercent || 0}%`;
  return `<span class="admin-rank">${escapeHtml(label)}</span>`;
}

function levelLabel(level, name, showEn) {
  const code = String(level || "L0");
  const fallback = {
    L0: "新兵",
    L1: "战士",
    L2: "干员",
    L3: "核心干员",
    L4: "精英",
    L5: "队长",
    L6: "教官"
  };
  const fallbackEn = {
    L0: "Recruit",
    L1: "Warrior",
    L2: "Operator",
    L3: "Core Operator",
    L4: "Elite",
    L5: "Captain",
    L6: "Instructor"
  };
  const cnName = name || fallback[code] || '';
  const enName = fallbackEn[code] || '';
  if (showEn && enName) return `${code} ${cnName} · ${enName}`;
  return `${code} ${cnName}`.trim();
}

function sideStat(title, value) {
  return `<div class="admin-side-stat"><span>${escapeHtml(title)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function summaryTile(title, value) {
  return `<div class="metric-tile"><span>${escapeHtml(title)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function emptyPanel(title, text) {
  return `<div class="admin-empty-panel"><span>${escapeHtml(title)}</span><p>${escapeHtml(text)}</p></div>`;
}

function formatDate(value) {
  if (!value) return "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ─── 活动管理模块 ──────────────────────────────────────── */
async function loadActivities() {
  try {
    const payload = await adminApi("/api/admin/activities");
    adminState.activities = payload.activities || [];
  } catch (error) {
    adminState.activities = [];
  }
}

function setAdminView(view) {
  adminState.view = view;
  adminState.selected = null;
  adminState.selectedActivity = null;
  renderAdmin();
}

function renderActivityPage() {
  // 按状态排序：进行中 > 即将开始 > 已结束 > 已取消
  const statusOrder = { active: 0, pending: 1, ended: 2, cancelled: 3 };
  const sorted = [...(adminState.activities || [])].sort((a, b) => {
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return new Date(b.startTime) - new Date(a.startTime);
  });
  const filtered = adminState.activityFilter
    ? sorted.filter(a => a.status === adminState.activityFilter)
    : sorted;

  const statusLabels = {
    pending: { text: "即将开始", class: "badge--amber" },
    active: { text: "进行中", class: "badge--cyan" },
    ended: { text: "已结束", class: "badge--ghost" },
    cancelled: { text: "已取消", class: "badge--red" }
  };

  return `
    <header class="admin-toolbar">
      <div>
        <div class="eyebrow">ACTIVITY MANAGEMENT CENTER</div>
        <h1>活动管理中心</h1>
        <p>创建、管理训练活动，查看活动报名人员，更新活动状态。</p>
      </div>
      <button class="btn btn--primary" id="btn-new-activity">新建活动</button>
    </header>

    <section class="metric-grid admin-metrics">
      ${summaryTile("全部活动", sorted.length)}
      ${summaryTile("进行中", sorted.filter(a => a.status === 'active').length)}
      ${summaryTile("即将开始", sorted.filter(a => a.status === 'pending').length)}
      ${summaryTile("已结束", sorted.filter(a => a.status === 'ended').length)}
    </section>
    
    <section class="admin-table-wrap">
      <div class="admin-table-header">
        <div class="admin-filters">
          <button class="btn btn--sm ${adminState.activityFilter === null ? 'btn--primary' : 'btn--ghost'}" onclick="setActivityFilter(null)">全部</button>
          <button class="btn btn--sm ${adminState.activityFilter === 'active' ? 'btn--primary' : 'btn--ghost'}" onclick="setActivityFilter('active')">进行中</button>
          <button class="btn btn--sm ${adminState.activityFilter === 'pending' ? 'btn--primary' : 'btn--ghost'}" onclick="setActivityFilter('pending')">即将开始</button>
          <button class="btn btn--sm ${adminState.activityFilter === 'ended' ? 'btn--primary' : 'btn--ghost'}" onclick="setActivityFilter('ended')">已结束</button>
        </div>
      </div>
      <table class="admin-table">
        <thead>
          <tr>
            <th>活动名称</th>
            <th>状态</th>
            <th>报名人数</th>
            <th>开始时间</th>
            <th>地点</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length ? filtered.map(activity => `
            <tr onclick="openActivityDetail('${activity.id}')" style="cursor: pointer;">
              <td>
                <strong style="color: var(--text-primary);">${escapeHtml(activity.title)}</strong>
              </td>
              <td>
                <span class="badge ${statusLabels[activity.status].class}">${statusLabels[activity.status].text}</span>
              </td>
              <td>${activity.registrationCount || 0} 人</td>
              <td>${formatDate(activity.startTime)}</td>
              <td>${escapeHtml(activity.location || '待定')}</td>
              <td>
                <button class="btn btn--sm btn--ghost" onclick="event.stopPropagation(); editActivity('${activity.id}')">编辑</button>
                ${activity.status !== 'cancelled' && activity.status !== 'ended' ? `
                  <button class="btn btn--sm ${activity.status === 'active' ? 'btn--danger' : 'btn--success'}" onclick="event.stopPropagation(); toggleActivityStatus('${activity.id}', '${activity.status === 'active' ? 'ended' : 'active'}')">
                    ${activity.status === 'active' ? '结束' : '开始'}
                  </button>
                ` : ''}
              </td>
            </tr>
          `).join("") : `
            <tr>
              <td colspan="6" style="text-align: center; padding: var(--sp-8) 0; color: var(--text-secondary);">
                暂无活动数据
              </td>
            </tr>
          `}
        </tbody>
      </table>
    </section>
  `;
}

function renderActivityDetailPage(activity) {
  const statusLabels = {
    pending: "即将开始",
    active: "进行中",
    ended: "已结束",
    cancelled: "已取消"
  };

  return `
    <header class="admin-toolbar detail-toolbar">
      <div>
        <div class="eyebrow">ACTIVITY DETAIL</div>
        <h1>${escapeHtml(activity.title)}</h1>
        <p>创建于 ${formatDate(activity.createdAt)}</p>
      </div>
      <button class="icon-button" onclick="setAdminView('activities')">返回列表</button>
    </header>

    <section class="metric-grid">
      ${summaryTile("报名人数", activity.registrationCount || 0)}
      ${summaryTile("活动状态", statusLabels[activity.status] || activity.status)}
      ${summaryTile("开始时间", formatDate(activity.startTime))}
      ${activity.endTime ? summaryTile("结束时间", formatDate(activity.endTime)) : ''}
    </section>

    ${activity.description ? `
      <section class="info-section">
        <h3>活动说明</h3>
        <p style="color: var(--text-secondary); line-height: 1.7;">${escapeHtml(activity.description)}</p>
      </section>
    ` : ''}

    ${activity.requirements ? `
      <section class="info-section">
        <h3>注意事项</h3>
        <p style="color: var(--text-secondary); line-height: 1.7;">${escapeHtml(activity.requirements)}</p>
      </section>
    ` : ''}

    ${activity.location ? `
      <section class="info-section">
        <h3>活动地点</h3>
        <p style="color: var(--text-secondary); line-height: 1.7;">📍 ${escapeHtml(activity.location)}</p>
      </section>
    ` : ''}

    ${activity.contact ? `
      <section class="info-section">
        <h3>联系方式</h3>
        <p style="color: var(--text-secondary); line-height: 1.7;">📞 ${escapeHtml(activity.contact)}</p>
      </section>
    ` : ''}

    <section class="admin-table-wrap">
      <h3 style="margin-bottom: var(--sp-4); font-size: 1rem;">报名人员列表</h3>
      <table class="admin-table" id="registration-list-container">
        <thead>
          <tr>
            <th>姓名</th>
            <th>手机号</th>
            <th>报名时间</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">加载中...</td></tr>
        </tbody>
      </table>
    </section>
  `;
}

async function openActivityDetail(activityId) {
  const activity = adminState.activities?.find(a => a.id === activityId);
  if (!activity) return;
  adminState.selectedActivity = activity;
  renderAdmin();
  
  // 加载报名人员列表
  try {
    const payload = await adminApi(`/api/admin/activities/${activityId}/registrations`);
    const registrations = payload.registrations || [];
    const container = document.getElementById("registration-list-container");
    if (container) {
      const tbody = container.querySelector("tbody");
      if (tbody) {
        if (registrations.length === 0) {
          tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: var(--sp-6) 0; color: var(--text-secondary);">暂无报名人员</td></tr>`;
        } else {
          tbody.innerHTML = registrations.map(r => `
            <tr>
              <td><strong>${escapeHtml(r.name || r.user?.name || '-')}</strong></td>
              <td>${escapeHtml(r.phone || r.user?.phone || '-')}</td>
              <td>${formatDate(r.createdAt || r.registeredAt)}</td>
              <td>
                <span class="badge ${r.status === 'registered' ? 'badge--cyan' : 'badge--ghost'}">
                  ${r.status === 'registered' ? '已报名' : r.status === 'cancelled' ? '已取消' : r.status}
                </span>
              </td>
            </tr>
          `).join("");
        }
      }
    }
  } catch (error) {
    const container = document.getElementById("registration-list-container");
    if (container) {
      const tbody = container.querySelector("tbody");
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: var(--sp-6) 0; color: var(--text-secondary);">加载失败</td></tr>`;
      }
    }
  }
}

function openActivityForm(activity = null) {
  const isEdit = !!activity;
  const modal = document.createElement("div");
  modal.className = "admin-modal-overlay";
  modal.innerHTML = `
    <div class="admin-modal">
      <div class="admin-modal__header">
        <h3>${isEdit ? "编辑活动" : "新建活动"}</h3>
        <button class="icon-button" onclick="this.closest('.admin-modal-overlay').remove()">✕</button>
      </div>
      <div class="admin-modal__body">
        <form class="activity-form" id="activity-form">
          <div class="form-group">
            <label class="form-group__label">活动名称 *</label>
            <input class="form-input" name="title" value="${activity?.title || ''}" placeholder="请输入活动名称" required>
          </div>
          <div class="form-group">
            <label class="form-group__label">活动状态</label>
            <select class="form-input" name="status">
              <option value="pending" ${activity?.status === 'pending' ? 'selected' : ''}>即将开始</option>
              <option value="active" ${activity?.status === 'active' ? 'selected' : ''}>进行中</option>
              <option value="ended" ${activity?.status === 'ended' ? 'selected' : ''}>已结束</option>
              <option value="cancelled" ${activity?.status === 'cancelled' ? 'selected' : ''}>已取消</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-group__label">开始时间 *</label>
            <input class="form-input" type="datetime-local" name="startTime" value="${activity?.startTime ? new Date(activity.startTime).toISOString().slice(0, 16) : ''}" required>
          </div>
          <div class="form-group">
            <label class="form-group__label">结束时间</label>
            <input class="form-input" type="datetime-local" name="endTime" value="${activity?.endTime ? new Date(activity.endTime).toISOString().slice(0, 16) : ''}">
          </div>
          <div class="form-group">
            <label class="form-group__label">活动地点</label>
            <input class="form-input" name="location" value="${activity?.location || ''}" placeholder="请输入活动地点">
          </div>
          <div class="form-group">
            <label class="form-group__label">联系方式</label>
            <input class="form-input" name="contact" value="${activity?.contact || ''}" placeholder="请输入联系方式">
          </div>
          <div class="form-group">
            <label class="form-group__label">活动说明</label>
            <textarea class="form-input" name="description" placeholder="请输入活动详细说明" rows="4">${activity?.description || ''}</textarea>
          </div>
          <div class="form-group">
            <label class="form-group__label">注意事项</label>
            <textarea class="form-input" name="requirements" placeholder="请输入注意事项" rows="3">${activity?.requirements || ''}</textarea>
          </div>
          <div class="form-group">
            <label class="form-group__label">报名人数上限 (0表示不限制)</label>
            <input class="form-input" type="number" name="maxParticipants" value="${activity?.maxParticipants ?? 0}" min="0">
          </div>
          <div class="activity-form__actions">
            <button type="button" class="btn btn--secondary" onclick="this.closest('.admin-modal-overlay').remove()">取消</button>
            <button type="submit" class="btn btn--primary">${isEdit ? "保存修改" : "创建活动"}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const form = modal.querySelector("#activity-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "保存中...";

    const formData = new FormData(form);
    const data = {
      title: formData.get("title"),
      status: formData.get("status"),
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime") || null,
      location: formData.get("location") || null,
      contact: formData.get("contact") || null,
      description: formData.get("description") || null,
      requirements: formData.get("requirements") || null,
      maxParticipants: parseInt(formData.get("maxParticipants")) || 0,
      createdBy: adminState.user.id
    };

    try {
      if (isEdit) {
        await adminApi(`/api/admin/activities/${activity.id}`, {
          method: "PUT",
          body: JSON.stringify(data)
        });
      } else {
        await adminApi("/api/admin/activities", {
          method: "POST",
          body: JSON.stringify(data)
        });
      }
      modal.remove();
      await loadActivities();
      renderAdmin();
    } catch (error) {
      alert(error.message);
      btn.disabled = false;
      btn.textContent = origText;
    }
  });
}

function editActivity(activityId) {
  const activity = adminState.activities?.find(a => a.id === activityId);
  if (activity) openActivityForm(activity);
}

async function toggleActivityStatus(activityId, newStatus) {
  if (!confirm(`确定要将此活动状态更改为"${newStatus === 'active' ? '进行中' : '已结束'}"吗？`)) {
    return;
  }
  try {
    await adminApi(`/api/admin/activities/${activityId}`, {
      method: "PUT",
      body: JSON.stringify({ status: newStatus })
    });
    await loadActivities();
    renderAdmin();
  } catch (error) {
    alert(error.message);
  }
}

function setActivityFilter(filter) {
  adminState.activityFilter = filter;
  renderAdmin();
}

// 修改 renderAdmin 函数，添加活动管理导航和视图
const originalRenderAdmin = renderAdmin;
renderAdmin = function() {
  if (!adminState.user) {
    originalRenderAdmin();
    return;
  }

  // 加载活动数据
  if (adminState.view === "activities" && !adminState.activities) {
    loadActivities().then(() => renderAdmin());
    return;
  }

  // 如果是活动详情页
  if (adminState.view === "activity-detail" && adminState.selectedActivity) {
    adminApp.innerHTML = `
      <div class="admin-desktop">
        <aside class="admin-sidebar">
          <img class="brand-logo admin-logo" src="/assets/yongshi-logo-transparent.png" alt="宁波甬士">
          <div>
            <div class="eyebrow">COMMAND CENTER</div>
            <h1>甬士训练态势</h1>
            <p>后台只读展示注册用户、课程推进、题库表现和能力弱项。</p>
          </div>
          <nav class="admin-nav">
            <button class="${adminState.view === "overview" || adminState.view === "detail" ? "active" : ""}" onclick="setAdminView('overview')">总览</button>
            <button class="${adminState.view === "activities" || adminState.view === "activity-detail" ? "active" : ""}" onclick="setAdminView('activities')">活动管理</button>
          </nav>
        </aside>
        <main class="admin-main">
          ${renderActivityDetailPage(adminState.selectedActivity)}
        </main>
      </div>
    `;
    bindAdminActivityEvents();
    return;
  }

  // 活动列表页
  if (adminState.view === "activities") {
    const rows = adminState.users.filter(user => user.role !== "instructor").map(user => normalizeAdminRow(user));

    adminApp.innerHTML = `
      <div class="admin-desktop">
        <aside class="admin-sidebar">
          <img class="brand-logo admin-logo" src="/assets/yongshi-logo-transparent.png" alt="宁波甬士">
          <div>
            <div class="eyebrow">COMMAND CENTER</div>
            <h1>甬士训练态势</h1>
            <p>后台只读展示注册用户、课程推进、题库表现和能力弱项。</p>
          </div>
          <nav class="admin-nav">
            <button class="${adminState.view === "overview" ? "active" : ""}" onclick="setAdminView('overview')">总览</button>
            <button class="${adminState.view === "activities" ? "active" : ""}" onclick="setAdminView('activities')">活动管理</button>
          </nav>
          ${sideStat("活动总数", adminState.activities?.length || 0)}
          ${sideStat("进行中", (adminState.activities || []).filter(a => a.status === 'active').length)}
          ${sideStat("即将开始", (adminState.activities || []).filter(a => a.status === 'pending').length)}
        </aside>
        <main class="admin-main">
          ${renderActivityPage()}
        </main>
      </div>
    `;
    bindAdminActivityEvents();
    return;
  }

  // 原总览页面
  const rows = adminState.users.filter(user => user.role !== "instructor").map(user => normalizeAdminRow(user));
  const activeUsers = rows.filter(row => row.stats.hasLearningData).length;
  const avgCourse = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.stats.courseCompletionRate, 0) / rows.length) : 0;
  const totalAnswered = rows.reduce((sum, row) => sum + row.stats.answered, 0);
  const totalCorrect = rows.reduce((sum, row) => sum + row.stats.correct, 0);
  const avgAccuracy = totalAnswered ? Math.round(totalCorrect / totalAnswered * 100) : 0;

  adminApp.innerHTML = `
    <div class="admin-desktop">
      <aside class="admin-sidebar">
        <img class="brand-logo admin-logo" src="/assets/yongshi-logo-transparent.png" alt="宁波甬士">
        <div>
          <div class="eyebrow">COMMAND CENTER</div>
          <h1>甬士训练态势</h1>
          <p>后台只读展示注册用户、课程推进、题库表现和能力弱项。</p>
        </div>
        <nav class="admin-nav">
          <button class="${adminState.view === "overview" ? "active" : ""}" onclick="setAdminView('overview')">总览</button>
          <button class="${adminState.view === "activities" ? "active" : ""}" onclick="setAdminView('activities')">活动管理</button>
        </nav>
        ${sideStat("注册用户", rows.length)}
        ${sideStat("有记录用户", activeUsers)}
        ${sideStat("需关注", rows.filter(row => row.stats.riskLevel === "risk").length)}
      </aside>
      <main class="admin-main">
        ${renderOverviewPage(rows, { activeUsers, avgCourse, avgAccuracy })}
      </main>
    </div>
  `;
  bindAdminActivityEvents();
};

function bindAdminActivityEvents() {
  bindAdminEvents();
  
  // 新建活动按钮
  const newActivityBtn = document.getElementById("btn-new-activity");
  if (newActivityBtn) {
    newActivityBtn.addEventListener("click", () => openActivityForm());
  }
}

bootAdmin();
window.addEventListener("hashchange", async () => {
  if (!adminState.user) return;
  await syncAdminRoute();
  renderAdmin();
});
