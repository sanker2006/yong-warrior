const { DatabaseSync } = require("node:sqlite");

const port = String(Number(process.env.SMOKE_PORT || 4391));
process.env.PORT = port;
const server = require("../server");

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function api(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${payload.error || response.status}`);
  return payload;
}

async function run() {
  await wait(400);
  const phone = `199${Math.floor(10000000 + Math.random() * 89999999)}`;
  const register = await api("/api/register", {
    method: "POST",
    body: JSON.stringify({ phone, password: "123456", name: "BMAD-Smoke" })
  });
  const headers = { Authorization: `Bearer ${register.token}` };

  await api("/api/progress", {
    method: "POST",
    headers,
    body: JSON.stringify({ type: "lesson", id: "w1", completed: true })
  });

  await api("/api/progress", {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "quiz",
      id: "smoke",
      title: "Smoke",
      quizType: "scenario",
      score: 1,
      total: 2,
      results: [
        {
          questionId: "s-001",
          title: "姿势选择",
          questionType: "scenario",
          selectedAnswer: 1,
          correct: true,
          tags: ["射击", "姿势"],
          skillClassification: "射击基础",
          lessonMapping: "W1-L1"
        },
        {
          questionId: "s-002",
          title: "切派时机",
          questionType: "scenario",
          selectedAnswer: 0,
          correct: false,
          tags: ["CQB", "切派"],
          skillClassification: "CQB与建筑清搜",
          lessonMapping: "W7-L1"
        }
      ]
    })
  });

  const profile = await api("/api/profile", { headers });
  const adminLogin = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ phone: "18800000000", password: "123456" })
  });
  const adminHeaders = { Authorization: `Bearer ${adminLogin.token}` };
  const users = await api("/api/admin/users", { headers: adminHeaders });
  const detail = await api(`/api/admin/users/${encodeURIComponent(register.user.id)}`, { headers: adminHeaders });

  assert(profile.summary.answered === 2, "Profile should include 2 answered questions");
  assert(profile.ability.length === 8, "Profile should include 8 ability domains");
  assert(detail.profile.summary.answered === 2, "Admin detail should include profile answers");
  assert(users.users.some(user => user.id === register.user.id), "Admin list should include smoke user");

  cleanupSmokeUsers();
  console.log(JSON.stringify({
    ok: true,
    phone,
    profileAnswered: profile.summary.answered,
    abilityCount: profile.ability.length,
    adminUsers: users.users.length,
    detailAnswered: detail.profile.summary.answered
  }));
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

function cleanupSmokeUsers() {
  const db = new DatabaseSync("data/app.db");
  db.prepare("DELETE FROM users WHERE name = 'BMAD-Smoke'").run();
}

run()
  .catch(error => {
    try {
      cleanupSmokeUsers();
    } catch {}
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    server.close();
  });
