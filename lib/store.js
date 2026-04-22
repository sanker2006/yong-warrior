const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const abilityDomains = [
  "射击基础",
  "班组协同",
  "CQB与建筑清搜",
  "战术移动",
  "SOP流程",
  "通讯指挥",
  "对抗综合",
  "领导力/心理素质"
];

const achievementRules = [
  {
    "id": "marksman",
    "title": "射击基础者",
    "tags": [
      "射击姿态与精度"
    ],
    "threshold": 10
  },
  {
    "id": "safety-keeper",
    "title": "安全规则守门人",
    "tags": [
      "装备安全与规则"
    ],
    "threshold": 6
  },
  {
    "id": "comms-node",
    "title": "通讯节点",
    "tags": [
      "通讯指挥"
    ],
    "threshold": 8
  },
  {
    "id": "team-operator",
    "title": "班组协同者",
    "tags": [
      "班组协同"
    ],
    "threshold": 10
  },
  {
    "id": "cqb-entry",
    "title": "CQB入门者",
    "tags": [
      "CQB与建筑清搜"
    ],
    "threshold": 8
  },
  {
    "id": "sop-operator",
    "title": "SOP执行者",
    "tags": [
      "SOP任务流程"
    ],
    "threshold": 8
  },
  {
    "id": "aar-keeper",
    "title": "复盘者",
    "tags": [
      "训练复盘与成长"
    ],
    "threshold": 8
  }
];

function emptyProgress() {
  return {
    lessons: {},
    quizzes: {},
    quizAttempts: [],
    questionAttempts: [],
    tagStats: {},
    achievements: {}
  };
}

function createStore(options) {
  const dataDir = options.dataDir;
  const dbPath = options.dbPath || path.join(dataDir, "app.db");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  createSchema(db);
  migrateLegacyJson(db, options.files || {});

  return {
    dbPath,
    close() {
      db.close();
    },
    findUserByPhone(phone) {
      return userFromRow(db.prepare("SELECT * FROM users WHERE phone = ?").get(phone));
    },
    findUserById(id) {
      return userFromRow(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
    },
    listUsers() {
      return db.prepare("SELECT * FROM users ORDER BY created_at ASC").all().map(userFromRow);
    },
    insertUser(user) {
      db.prepare(`
        INSERT INTO users (id, phone, name, role, level, salt, password_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(user.id, user.phone, user.name, user.role, user.level, user.salt, user.passwordHash, user.createdAt);
      return user;
    },
    createSession(token, userId, createdAt = new Date().toISOString()) {
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
      db.prepare(`
        INSERT OR REPLACE INTO sessions (token, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(token, userId, createdAt, expiresAt);
      return { token, userId, createdAt, expiresAt };
    },
    getUserByToken(token) {
      const row = db.prepare(`
        SELECT users.*
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ? AND sessions.expires_at > ?
      `).get(token, new Date().toISOString());
      return userFromRow(row);
    },
    getProgress(userId) {
      return buildProgress(db, userId);
    },
    saveLessonProgress(userId, lessonId, completed) {
      const updatedAt = new Date().toISOString();
      db.prepare(`
        INSERT INTO lesson_progress (user_id, lesson_id, completed, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, lesson_id) DO UPDATE SET
          completed = excluded.completed,
          updated_at = excluded.updated_at
      `).run(userId, lessonId, completed ? 1 : 0, updatedAt);
      return buildProgress(db, userId);
    },
    saveQuestionAttempt(userId, body, timestamp = new Date().toISOString(), quizAttemptId = "") {
      insertQuestionAttempt(db, userId, body, timestamp, quizAttemptId);
      return buildProgress(db, userId);
    },
    saveQuizAttempt(userId, body) {
      const createdAt = new Date().toISOString();
      const quizAttemptId = crypto.randomUUID();
      const score = Number(body.score || 0);
      const total = Number(body.total || 0);
      const title = String(body.title || body.id || "未命名题组");
      const questionType = String(body.quizType || body.questionType || "quiz");
      db.exec("BEGIN");
      try {
        db.prepare(`
          INSERT INTO quiz_attempts (id, user_id, quiz_key, title, question_type, score, total, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(quizAttemptId, userId, String(body.id || quizAttemptId), title, questionType, score, total, createdAt);
        for (const result of Array.isArray(body.results) ? body.results : []) {
          insertQuestionAttempt(db, userId, result, createdAt, quizAttemptId);
        }
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return buildProgress(db, userId);
    },
    addAar(user, body) {
      const record = {
        id: crypto.randomUUID(),
        userId: user.id,
        name: user.name,
        topic: String(body.topic || "未命名训练"),
        plan: String(body.plan || ""),
        actual: String(body.actual || ""),
        improve: String(body.improve || ""),
        weaknessTags: Array.isArray(body.weaknessTags) ? body.weaknessTags.map(String).slice(0, 8) : [],
        createdAt: new Date().toISOString()
      };
      db.prepare(`
        INSERT INTO aar_records (id, user_id, name, topic, plan, actual, improve, weakness_tags_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(record.id, record.userId, record.name, record.topic, record.plan, record.actual, record.improve, JSON.stringify(record.weaknessTags), record.createdAt);
      return record;
    },
    listAar(user) {
      const rows = user.role === "instructor"
        ? db.prepare("SELECT * FROM aar_records ORDER BY created_at DESC LIMIT 50").all()
        : db.prepare("SELECT * FROM aar_records WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(user.id);
      return rows.map(aarFromRow);
    },
    addAssessment(user, record) {
      db.prepare(`
        INSERT INTO assessments (id, user_id, assessor, event, squad, dimensions_json, weighted_score, weakness_tags_json, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(record.id, record.userId, record.assessor || user.name, record.event, record.squad, JSON.stringify(record.dimensions), record.weightedScore, JSON.stringify(record.weaknessTags || []), record.note || "", record.createdAt);
      return record;
    },
    listAssessments() {
      return db.prepare("SELECT * FROM assessments ORDER BY created_at DESC LIMIT 50").all().map(assessmentFromRow);
    },
    listUsersWithProgress() {
      return this.listUsers().map(user => ({
        ...publicUser(user),
        createdAt: user.createdAt,
        progress: buildProgress(db, user.id),
        stats: buildProfile(db, user).summary
      }));
    },
    getAdminUserDetail(id) {
      const user = this.findUserById(id);
      if (!user) return null;
      return {
        user: { ...publicUser(user), createdAt: user.createdAt },
        progress: buildProgress(db, user.id),
        profile: buildProfile(db, user)
      };
    },
    getProfile(user) {
      return buildProfile(db, user);
    }
  };
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      level TEXT NOT NULL DEFAULT 'L0',
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS lesson_progress (
      user_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, lesson_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      quiz_key TEXT NOT NULL,
      title TEXT NOT NULL,
      question_type TEXT NOT NULL,
      score INTEGER NOT NULL,
      total INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS question_attempts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      quiz_attempt_id TEXT,
      question_id TEXT NOT NULL,
      title TEXT NOT NULL,
      question_type TEXT NOT NULL,
      selected_answer INTEGER,
      correct INTEGER NOT NULL,
      tags_json TEXT NOT NULL,
      skill_classification TEXT,
      lesson_mapping TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS aar_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      topic TEXT NOT NULL,
      plan TEXT NOT NULL,
      actual TEXT NOT NULL,
      improve TEXT NOT NULL,
      weakness_tags_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      assessor TEXT NOT NULL,
      event TEXT NOT NULL,
      squad TEXT NOT NULL,
      dimensions_json TEXT NOT NULL,
      weighted_score INTEGER NOT NULL,
      weakness_tags_json TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_question_attempts_user_created ON question_attempts(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_created ON quiz_attempts(user_id, created_at DESC);
  `);
}

function migrateLegacyJson(db, files) {
  const alreadyMigrated = db.prepare("SELECT value FROM meta WHERE key = 'legacy_json_migrated'").get();
  if (alreadyMigrated) return;
  const users = readJson(files.users, []);
  const progress = readJson(files.progress, {});
  const aar = readJson(files.aar, []);
  const assessments = readJson(files.assessments, []);
  db.exec("BEGIN");
  try {
    for (const user of users) {
      db.prepare(`
        INSERT OR IGNORE INTO users (id, phone, name, role, level, salt, password_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(user.id, user.phone, user.name || user.phone, user.role || "member", user.level || "L0", user.salt, user.passwordHash || user.password_hash, user.createdAt || new Date().toISOString());
      migrateProgress(db, user.id, progress[user.id]);
    }
    for (const item of aar) {
      db.prepare(`
        INSERT OR IGNORE INTO aar_records (id, user_id, name, topic, plan, actual, improve, weakness_tags_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(item.id || crypto.randomUUID(), item.userId, item.name || "", item.topic || "未命名训练", item.plan || "", item.actual || "", item.improve || "", JSON.stringify(item.weaknessTags || []), item.createdAt || new Date().toISOString());
    }
    for (const item of assessments) {
      db.prepare(`
        INSERT OR IGNORE INTO assessments (id, user_id, assessor, event, squad, dimensions_json, weighted_score, weakness_tags_json, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(item.id || crypto.randomUUID(), item.userId, item.assessor || "", item.event || "未命名对抗", item.squad || "未指定班组", JSON.stringify(item.dimensions || {}), Number(item.weightedScore || 0), JSON.stringify(item.weaknessTags || []), item.note || "", item.createdAt || new Date().toISOString());
    }
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('legacy_json_migrated', ?)").run(new Date().toISOString());
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function migrateProgress(db, userId, legacyProgress) {
  const progress = normalizeProgress(legacyProgress);
  for (const [lessonId, item] of Object.entries(progress.lessons || {})) {
    db.prepare(`
      INSERT OR IGNORE INTO lesson_progress (user_id, lesson_id, completed, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, lessonId, item.completed ? 1 : 0, item.updatedAt || new Date().toISOString());
  }
  for (const attempt of progress.quizAttempts || []) {
    db.prepare(`
      INSERT OR IGNORE INTO quiz_attempts (id, user_id, quiz_key, title, question_type, score, total, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), userId, attempt.id || attempt.title || crypto.randomUUID(), attempt.title || "历史题组", attempt.type || "quiz", Number(attempt.score || 0), Number(attempt.total || 0), attempt.updatedAt || attempt.createdAt || new Date().toISOString());
  }
  for (const attempt of progress.questionAttempts || []) {
    insertQuestionAttempt(db, userId, attempt, attempt.answeredAt || new Date().toISOString(), "");
  }
}

function buildProgress(db, userId) {
  const progress = emptyProgress();
  for (const row of db.prepare("SELECT * FROM lesson_progress WHERE user_id = ?").all(userId)) {
    progress.lessons[row.lesson_id] = { completed: Boolean(row.completed), updatedAt: row.updated_at };
  }
  const quizRows = db.prepare("SELECT * FROM quiz_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(userId);
  for (const row of quizRows) {
    if (!progress.quizzes[row.quiz_key]) {
      progress.quizzes[row.quiz_key] = {
        score: row.score,
        total: row.total,
        title: row.title,
        type: row.question_type,
        updatedAt: row.created_at
      };
    }
    progress.quizAttempts.push({
      score: row.score,
      total: row.total,
      title: row.title,
      type: row.question_type,
      updatedAt: row.created_at
    });
  }
  progress.questionAttempts = db.prepare("SELECT * FROM question_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 500")
    .all(userId)
    .map(questionAttemptFromRow);
  progress.tagStats = calculateTagStats(progress.questionAttempts);
  progress.achievements = calculateAchievements(progress.tagStats, {});
  return progress;
}

function buildProfile(db, user) {
  const progress = buildProgress(db, user.id);
  const lessonsCompleted = Object.values(progress.lessons).filter(item => item.completed).length;
  const attempts = progress.questionAttempts || [];
  const latestByQuestion = new Map();
  for (const attempt of attempts) {
    if (!latestByQuestion.has(attempt.questionId)) latestByQuestion.set(attempt.questionId, attempt);
  }
  const latest = Array.from(latestByQuestion.values());
  const answered = latest.length;
  const correct = latest.filter(item => item.correct).length;
  const accuracy = answered ? Math.round(correct / answered * 100) : 0;
  const ability = calculateAbility(latest);
  const weak = ability.slice().sort((a, b) => a.score - b.score || a.answered - b.answered).slice(0, 3);
  return {
    user: publicUser(user),
    summary: {
      lessonsCompleted,
      totalWeeks: 30,
      answered,
      correct,
      accuracy,
      latestAttempt: attempts[0] || null
    },
    ability,
    weakRecommendations: weak.map(item => ({
      domain: item.domain,
      score: item.score,
      reason: item.answered ? `该技能域正确率为 ${item.score}%` : "该技能域尚无足够答题记录",
      action: "进入题库按知识域专项练习"
    })),
    progress
  };
}

function insertQuestionAttempt(db, userId, body, timestamp, quizAttemptId) {
  const questionId = String(body.questionId || body.id || "").trim();
  if (!questionId) return;
  const tags = Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean) : [];
  db.prepare(`
    INSERT INTO question_attempts
      (id, user_id, quiz_attempt_id, question_id, title, question_type, selected_answer, correct, tags_json, skill_classification, lesson_mapping, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    userId,
    quizAttemptId || "",
    questionId,
    String(body.title || questionId),
    String(body.questionType || body.type || "question"),
    Number.isFinite(Number(body.selectedAnswer)) ? Number(body.selectedAnswer) : null,
    body.correct ? 1 : 0,
    JSON.stringify(tags),
    String(body.skillClassification || ""),
    String(body.lessonMapping || ""),
    timestamp
  );
}

function calculateTagStats(attempts) {
  const latestByQuestion = new Map();
  for (const attempt of attempts) {
    if (!latestByQuestion.has(attempt.questionId)) latestByQuestion.set(attempt.questionId, attempt);
  }
  const stats = {};
  for (const attempt of latestByQuestion.values()) {
    for (const tag of attempt.tags || []) {
      if (!stats[tag]) stats[tag] = { answered: 0, correct: 0, accuracy: 0 };
      stats[tag].answered += 1;
      if (attempt.correct) stats[tag].correct += 1;
    }
  }
  for (const item of Object.values(stats)) {
    item.accuracy = item.answered ? Math.round(item.correct / item.answered * 100) : 0;
  }
  return stats;
}

function calculateAbility(attempts) {
  const buckets = new Map(abilityDomains.map(domain => [domain, { domain, answered: 0, correct: 0, score: 0 }]));
  for (const attempt of attempts) {
    const domains = domainsForAttempt(attempt);
    for (const domain of domains) {
      const item = buckets.get(domain);
      item.answered += 1;
      if (attempt.correct) item.correct += 1;
    }
  }
  for (const item of buckets.values()) {
    item.score = item.answered ? Math.round(item.correct / item.answered * 100) : 0;
  }
  return Array.from(buckets.values());
}

function domainsForAttempt(attempt) {
  if (abilityDomains.includes(attempt.skillClassification)) return [attempt.skillClassification];
  const text = `${attempt.title || ""} ${(attempt.tags || []).join(" ")}`;
  const domains = [];
  if (/射击|姿势|标靶|精度|扳机/.test(text)) domains.push("射击基础");
  if (/班组|队形|三三制|Bounding|掩护|协同/.test(text)) domains.push("班组协同");
  if (/CQB|Fatal|房间|建筑|切派|入口/.test(text)) domains.push("CQB与建筑清搜");
  if (/移动|Rush|匍匐|穿越/.test(text)) domains.push("战术移动");
  if (/SOP|进攻|防御|脱离|夺旗|护送/.test(text)) domains.push("SOP流程");
  if (/通讯|SALUTE|ACE|Prowords|手语|指挥/.test(text)) domains.push("通讯指挥");
  if (/对抗|考核|Mega|压力|综合/.test(text)) domains.push("对抗综合");
  if (/领导|心理|班长|独立指挥|复盘|AAR/.test(text)) domains.push("领导力/心理素质");
  return domains.length ? Array.from(new Set(domains)) : ["对抗综合"];
}

function calculateAchievements(tagStats, existing) {
  const next = { ...(existing || {}) };
  for (const rule of achievementRules) {
    const correct = rule.tags.reduce((sum, tag) => sum + Number(tagStats[tag]?.correct || 0), 0);
    if (correct >= rule.threshold && !next[rule.id]) {
      next[rule.id] = {
        id: rule.id,
        title: rule.title,
        unlockedAt: new Date().toISOString()
      };
    }
  }
  return next;
}

function normalizeProgress(progress) {
  return {
    ...emptyProgress(),
    ...(progress || {}),
    lessons: (progress && progress.lessons) || {},
    quizzes: (progress && progress.quizzes) || {},
    quizAttempts: (progress && progress.quizAttempts) || [],
    questionAttempts: (progress && progress.questionAttempts) || [],
    tagStats: (progress && progress.tagStats) || {},
    achievements: (progress && progress.achievements) || {}
  };
}

function publicUser(user) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    level: user.level
  };
}

function userFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    role: row.role,
    level: row.level,
    salt: row.salt,
    passwordHash: row.password_hash,
    createdAt: row.created_at
  };
}

function questionAttemptFromRow(row) {
  return {
    questionId: row.question_id,
    title: row.title,
    type: row.question_type,
    selectedAnswer: row.selected_answer,
    correct: Boolean(row.correct),
    tags: parseJson(row.tags_json, []),
    skillClassification: row.skill_classification || "",
    lessonMapping: row.lesson_mapping || "",
    answeredAt: row.created_at
  };
}

function aarFromRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    topic: row.topic,
    plan: row.plan,
    actual: row.actual,
    improve: row.improve,
    weaknessTags: parseJson(row.weakness_tags_json, []),
    createdAt: row.created_at
  };
}

function assessmentFromRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    assessor: row.assessor,
    event: row.event,
    squad: row.squad,
    dimensions: parseJson(row.dimensions_json, {}),
    weightedScore: row.weighted_score,
    weaknessTags: parseJson(row.weakness_tags_json, []),
    note: row.note,
    createdAt: row.created_at
  };
}

function readJson(file, fallback) {
  if (!file) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

module.exports = {
  abilityDomains,
  createStore,
  emptyProgress,
  publicUser
};
