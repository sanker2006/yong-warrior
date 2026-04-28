const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { performance } = require("perf_hooks");
const { createStore } = require("../lib/store");

const users = Number(process.env.PERF_USERS || 100);
const attemptsPerUser = Number(process.env.PERF_ATTEMPTS || 300);
const tmpRoot = path.join(__dirname, "..", ".tmp");
fs.mkdirSync(tmpRoot, { recursive: true });
const tempDir = fs.mkdtempSync(path.join(tmpRoot, "perf-"));
const store = createStore({ dataDir: tempDir, dbPath: path.join(tempDir, "perf.db"), files: {} });

function makeUser(index) {
  const salt = crypto.randomBytes(16).toString("hex");
  return {
    id: crypto.randomUUID(),
    phone: `199${String(index).padStart(8, "0")}`,
    name: `Perf-${index}`,
    role: "member",
    level: "L0",
    salt,
    passwordHash: crypto.randomBytes(32).toString("hex"),
    createdAt: new Date().toISOString()
  };
}

function makeResult(index) {
  const domains = [
    "射击基础",
    "班组协同",
    "CQB与建筑清搜",
    "战术移动",
    "SOP流程",
    "通讯指挥",
    "对抗综合",
    "领导力/心理素质"
  ];
  const domain = domains[index % domains.length];
  return {
    questionId: `perf-${index}`,
    title: `${domain} 性能题 ${index}`,
    questionType: index % 2 ? "course" : "scenario",
    selectedAnswer: index % 4,
    correct: index % 3 !== 0,
    tags: [domain],
    skillClassification: domain,
    lessonMapping: `W${(index % 30) + 1}-L${(index % 2) + 1}`
  };
}

const started = performance.now();
const created = [];
for (let index = 0; index < users; index += 1) {
  const user = store.insertUser(makeUser(index));
  created.push(user);
  const results = Array.from({ length: attemptsPerUser }, (_, attemptIndex) => makeResult(attemptIndex));
  store.saveQuizAttempt(user.id, {
    type: "quiz",
    id: `perf-${index}`,
    title: "性能题组",
    quizType: "scenario",
    score: results.filter(item => item.correct).length,
    total: results.length,
    results
  });
}
const writeMs = Math.round(performance.now() - started);

const profileStarted = performance.now();
for (const user of created) {
  const profile = store.getProfile(user);
  if (profile.summary.answered !== attemptsPerUser) {
    throw new Error(`Unexpected answered count for ${user.id}`);
  }
}
const profileMs = Math.round(performance.now() - profileStarted);

const adminStarted = performance.now();
const adminUsers = store.listUsersWithProgress();
const adminMs = Math.round(performance.now() - adminStarted);

store.close();
fs.rmSync(tempDir, { recursive: true, force: true });

console.log(JSON.stringify({
  ok: true,
  users,
  attemptsPerUser,
  totalAttempts: users * attemptsPerUser,
  writeMs,
  profileMs,
  adminMs,
  avgProfileMs: Number((profileMs / users).toFixed(2)),
  adminUsers: adminUsers.length
}));
