const adminState = {
  token: localStorage.getItem("training-token") || "",
  user: null,
  users: [],
  selected: null,
  view: "overview"
};

const adminApp = document.querySelector("#admin-app");
const trainingData = window.TRAINING_DATA;

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
          <img class="brand-logo" src="/assets/yongshi-logo.jpg" alt="宁波甬士">
          <div>
            <div class="eyebrow">YONGSHI COMMAND</div>
            <h1>训练态势管理端</h1>
            <p>查看队员进度、题库正确率、标签强弱项和成就数量。</p>
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
    const form = new FormData(event.currentTarget);
    try {
      const payload = await adminApi("/api/login", {
        method: "POST",
        body: JSON.stringify({ phone: form.get("phone"), password: form.get("password") })
      });
      adminState.token = payload.token;
      localStorage.setItem("training-token", payload.token);
      await bootAdmin();
    } catch (error) {
      renderAdminLogin(error.message);
    }
  });
}

function renderAdmin() {
  const rows = adminState.users
    .filter(user => user.role !== "instructor")
    .map(user => ({ user, stats: userStats(user.progress || {}) }));
  const totalAnswered = rows.reduce((sum, row) => sum + row.stats.answered, 0);
  const totalCorrect = rows.reduce((sum, row) => sum + row.stats.correct, 0);
  const avgAccuracy = totalAnswered ? Math.round(totalCorrect / totalAnswered * 100) : 0;
  const totalAchievements = rows.reduce((sum, row) => sum + row.stats.achievementCount, 0);
  adminApp.innerHTML = `
    <div class="admin-desktop">
      <aside class="admin-sidebar">
        <img class="brand-logo admin-logo" src="/assets/yongshi-logo.jpg" alt="宁波甬士">
        <div>
          <div class="eyebrow">COMMAND CENTER</div>
          <h1>甬士训练态势</h1>
          <p>训练数据只认记录。题库不再考背诵，而是考判断和取舍。</p>
        </div>
        <nav class="admin-nav">
          <button class="${adminState.view === "overview" ? "active" : ""}" data-admin-route="overview">总览</button>
          <button class="${adminState.view === "detail" ? "active" : ""}" ${adminState.selected ? `data-admin-route="detail"` : "disabled"}>用户详情</button>
        </nav>
        ${sideStat("注册队员", rows.length)}
        ${sideStat("总体正确率", `${avgAccuracy}%`)}
        ${sideStat("需关注", rows.filter(row => row.stats.risk.level === "risk").length)}
      </aside>
      <main class="admin-main">
        ${adminState.view === "detail" && adminState.selected ? renderDetailPage(adminState.selected) : renderOverviewPage(rows, { totalAnswered, avgAccuracy, totalAchievements })}
      </main>
    </div>
  `;
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

function renderOverviewPage(rows, totals) {
  return `
    <header class="admin-toolbar">
      <div>
        <div class="eyebrow">TRAINING DATA CENTER</div>
        <h1>训练画像总览</h1>
        <p>主页面只展示核心指标和每个注册用户一条训练摘要。</p>
      </div>
      <button class="icon-button" id="admin-refresh">刷新数据</button>
    </header>
    <section class="metric-grid admin-metrics">
      ${summaryTile("注册队员", rows.length)}
      ${summaryTile("答题记录", totals.totalAnswered)}
      ${summaryTile("总体正确率", `${totals.avgAccuracy}%`)}
      ${summaryTile("需关注", rows.filter(row => row.stats.risk.level === "risk").length)}
    </section>
    <section class="admin-table-wrap overview-table">
      <table class="admin-table">
        <thead>
          <tr>
            <th>代号</th>
            <th>手机号</th>
            <th>状态</th>
            <th>周进度</th>
            <th>题库正确率</th>
            <th>标签强项</th>
            <th>薄弱标签</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(rowHtml).join("") || `<tr><td colspan="8">暂无注册队员</td></tr>`}
        </tbody>
      </table>
    </section>
    <section class="admin-user-cards">
      ${rows.map(userCardHtml).join("") || `<article class="admin-user-card"><p>暂无注册队员</p></article>`}
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

function userStats(progress) {
  const completedWeeks = Object.values(progress.lessons || {}).filter(item => item.completed).length;
  const attempts = progress.questionAttempts || [];
  const latestByQuestion = new Map();
  for (const attempt of attempts) {
    if (!latestByQuestion.has(attempt.questionId)) latestByQuestion.set(attempt.questionId, attempt);
  }
  const uniqueAttempts = Array.from(latestByQuestion.values());
  const answered = uniqueAttempts.length;
  const correct = uniqueAttempts.filter(item => item.correct).length;
  const accuracy = answered ? Math.round(correct / answered * 100) : 0;
  const tags = Object.entries(progress.tagStats || {})
    .map(([tag, stats]) => ({ tag, ...stats }))
    .sort((a, b) => b.correct - a.correct || b.accuracy - a.accuracy);
  const weak = tags.slice().sort((a, b) => a.accuracy - b.accuracy || a.correct - b.correct);
  return {
    completedWeeks,
    totalWeeks: trainingData.weeks.length,
    answered,
    correct,
    accuracy,
    topTag: tags[0]?.tag || "暂无",
    weakTag: weak[0]?.tag || "暂无",
    achievementCount: Object.keys(progress.achievements || {}).length,
    risk: riskState(completedWeeks, answered, accuracy),
    latest: attempts[0] || null
  };
}

function rowHtml(row) {
  const { user, stats } = row;
  return `
    <tr class="${adminState.selected?.user?.id === user.id ? "selected" : ""}">
      <td>${escapeHtml(user.name)}</td>
      <td>${escapeHtml(user.phone)}</td>
      <td><span class="status-pill ${stats.risk.level}">${escapeHtml(stats.risk.label)}</span></td>
      <td>${stats.completedWeeks}/${stats.totalWeeks}</td>
      <td>${stats.correct}/${stats.answered} · ${stats.accuracy}%</td>
      <td><span class="admin-rank">${escapeHtml(stats.topTag)}</span></td>
      <td>${escapeHtml(stats.weakTag)}</td>
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
          <span>${escapeHtml(user.phone)}</span>
        </div>
        <span class="status-pill ${stats.risk.level}">${escapeHtml(stats.risk.label)}</span>
      </header>
      <div class="admin-user-card-grid">
        <div><span>课程</span><strong>${stats.completedWeeks}/${stats.totalWeeks}</strong></div>
        <div><span>题目</span><strong>${stats.correct}/${stats.answered}</strong></div>
        <div><span>正确率</span><strong>${stats.accuracy}%</strong></div>
      </div>
      <p>强项：${escapeHtml(stats.topTag)} / 弱项：${escapeHtml(stats.weakTag)}</p>
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
  const summary = detail.profile?.summary || {};
  const ability = detail.profile?.ability || [];
  const attempts = detail.progress?.questionAttempts || [];
  const risk = riskState(summary.lessonsCompleted || 0, summary.answered || 0, summary.accuracy || 0);
  const weak = detail.profile?.weakRecommendations || [];
  const recentLessons = Object.entries(detail.progress?.lessons || {})
    .filter(([, item]) => item.completed)
    .sort((a, b) => String(b[1].updatedAt || "").localeCompare(String(a[1].updatedAt || "")))
    .slice(0, 3);
  return `
    <section class="admin-detail">
      <div class="section-head">
        <div>
          <div class="eyebrow">USER DETAIL</div>
          <h3>${escapeHtml(detail.user.name)} / ${escapeHtml(detail.user.phone)}</h3>
        </div>
        <span class="status-pill ${risk.level}">${escapeHtml(risk.label)}</span>
      </div>
      <div class="metric-grid">
        ${summaryTile("课程进度", `${summary.lessonsCompleted || 0}/${summary.totalWeeks || 30}`)}
        ${summaryTile("答题记录", summary.answered || 0)}
        ${summaryTile("正确率", `${summary.accuracy || 0}%`)}
      </div>
      <section class="admin-next-action">
        <div>
          <span>NEXT ACTION</span>
          <strong>${escapeHtml(nextAction(risk, weak))}</strong>
        </div>
        <p>${escapeHtml(risk.reason)}</p>
      </section>
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
      <section class="admin-timeline">
        <article>
          <span>最近课程</span>
          ${recentLessons.length ? recentLessons.map(([id, item]) => `<p>${escapeHtml(id)} / ${escapeHtml(item.updatedAt || "")}</p>`).join("") : "<p>暂无课程完成记录</p>"}
        </article>
        <article>
          <span>最近答题</span>
          ${attempts.length ? attempts.slice(0, 3).map(item => `<p>${escapeHtml(item.title)} / ${item.correct ? "正确" : "错误"}</p>`).join("") : "<p>暂无答题记录</p>"}
        </article>
        <article>
          <span>弱项建议</span>
          ${weak.length ? weak.slice(0, 3).map(item => `<p>${escapeHtml(item.domain)} / ${escapeHtml(item.reason)}</p>`).join("") : "<p>暂无弱项建议</p>"}
        </article>
      </section>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>题目</th><th>类型</th><th>结果</th><th>标签</th><th>时间</th></tr></thead>
          <tbody>
            ${attempts.slice(0, 20).map(item => `
              <tr>
                <td>${escapeHtml(item.title)}</td>
                <td>${escapeHtml(item.type)}</td>
                <td>${item.correct ? "正确" : "错误"}</td>
                <td>${escapeHtml((item.tags || []).slice(0, 4).join(" / "))}</td>
                <td>${escapeHtml(item.answeredAt || "")}</td>
              </tr>
            `).join("") || `<tr><td colspan="5">暂无答题记录</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function riskState(completedWeeks, answered, accuracy) {
  if (!completedWeeks && !answered) {
    return { level: "idle", label: "未启动", reason: "还没有课程或题库记录，优先推动完成第一周课程和一次题组。" };
  }
  if (answered > 0 && accuracy < 60) {
    return { level: "risk", label: "需关注", reason: "题库正确率低于 60%，需要按弱项知识域复训。" };
  }
  if (completedWeeks < 3 && answered < 10) {
    return { level: "watch", label: "观察中", reason: "已有训练记录但样本量偏少，继续积累课程和题目数据。" };
  }
  return { level: "ok", label: "稳定", reason: "课程和题库记录已形成基础闭环，按最低能力域继续补强。" };
}

function nextAction(risk, weak) {
  if (risk.level === "idle") return "安排首次课程和题组";
  if (risk.level === "risk") return `复训 ${weak[0]?.domain || "最低正确率知识域"}`;
  if (risk.level === "watch") return "补足题库样本";
  return `保持训练，关注 ${weak[0]?.domain || "最低能力域"}`;
}

function sideStat(title, value) {
  return `<div class="admin-side-stat"><span>${escapeHtml(title)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function summaryTile(title, value) {
  return `<div class="metric-tile"><span>${escapeHtml(title)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

bootAdmin();
window.addEventListener("hashchange", async () => {
  if (!adminState.user) return;
  await syncAdminRoute();
  renderAdmin();
});
