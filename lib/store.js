const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const TOTAL_LESSONS = 61;
const TOTAL_WEEKS = 30;

const levelNames = {
  L0: "新兵",
  L1: "战士",
  L2: "干员",
  L3: "核心干员",
  L4: "精英",
  L5: "队长",
  L6: "教官"
};
const levelNamesEn = {
  L0: "Recruit",
  L1: "Warrior",
  L2: "Operator",
  L3: "Core Operator",
  L4: "Elite",
  L5: "Captain",
  L6: "Instructor"
};

// Load lesson title lookup from course content (server-side only)
const lessonMeta = {};
(function loadLessonMeta() {
  try {
    const publicDir = path.join(__dirname, "..", "public");
    const filePath = path.join(publicDir, "course-content-v2.js");
    const raw = fs.readFileSync(filePath, "utf8");
    // course-content-v2.js is an IIFE: (function(){ const COURSE_CONTENT_V2 = { ... }  ... })();
    // Extract just the JSON object by matching the assignment.
    const m = raw.match(/const COURSE_CONTENT_V2 = (\{[\s\S]*?\n\});$/m);
    if (!m) return;
    const data = JSON.parse(m[1]);
    for (const week of data.weeks || []) {
      for (const lesson of week.lessons || []) {
        lessonMeta[lesson.id] = {
          code: lesson.code || lesson.id,
          title: lesson.title || "",
          weekCode: lesson.weekCode || week.week || ""
        };
      }
    }
  } catch (e) {
    // Silently ignore — lesson titles won't be available but nothing breaks
  }
})();

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

const promotionStages = [
  { from: "L0", to: "L1", weeks: [1, 2, 3, 4, 5, 6] },
  { from: "L1", to: "L2", weeks: [7, 8, 9, 10] },
  { from: "L2", to: "L3", weeks: [11, 12, 13, 14] },
  { from: "L3", to: "L4", weeks: [15, 16, 17, 18] },
  { from: "L4", to: "L5", weeks: [21, 22, 23, 24] },
  { from: "L5", to: "L6", weeks: [25, 26, 27, 28, 29, 30] }
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
      ensurePromotion(db, userId);
      return buildProgress(db, userId);
    },
    saveQuestionAttempt(userId, body, timestamp = new Date().toISOString(), quizAttemptId = "") {
      insertQuestionAttempt(db, userId, body, timestamp, quizAttemptId);
      ensurePromotion(db, userId);
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
      ensurePromotion(db, userId);
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
      return this.listUsers().map(user => {
        const currentUser = ensurePromotion(db, user.id);
        const profile = buildProfile(db, currentUser);
        return {
          ...publicUser(currentUser),
          createdAt: currentUser.createdAt,
          progress: profile.progress,
          profile,
          stats: profile.adminStats
        };
      });
    },
    getAdminUserDetail(id) {
      const user = this.findUserById(id);
      if (!user) return null;
      const currentUser = ensurePromotion(db, user.id);
      const profile = buildProfile(db, currentUser);
      return {
        user: { ...publicUser(currentUser), createdAt: currentUser.createdAt },
        progress: profile.progress,
        profile
      };
    },
    getProfile(user) {
      const currentUser = ensurePromotion(db, user.id);
      return buildProfile(db, currentUser);
    },

    // ─── Activities ────────────────────────────────────────
    listActivities(status) {
      const rows = db.prepare("SELECT * FROM activities ORDER BY start_time DESC").all().map(activityFromRow);
      return status ? rows.filter(activity => activity.status === status) : rows;
    },
    getActiveActivities() {
      return db.prepare("SELECT * FROM activities WHERE status != 'cancelled' ORDER BY start_time ASC")
        .all()
        .map(activityFromRow)
        .filter(activity => activity.status === "pending" || activity.status === "active");
    },
    getActivity(activityId) {
      const row = db.prepare("SELECT * FROM activities WHERE id = ?").get(activityId);
      return row ? activityFromRow(row) : null;
    },
    createActivity(user, body) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const startTime = String(body.startTime || now);
      const endTime = String(body.endTime || startTime);
      const signupDeadline = body.signupDeadline ? String(body.signupDeadline) : endTime;
      db.prepare(`
        INSERT INTO activities (id, title, description, location, start_time, end_time, signup_deadline, max_participants, max_rental_equipment, status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        String(body.title || "未命名活动"),
        String(body.description || ""),
        String(body.location || ""),
        startTime,
        endTime,
        signupDeadline,
        Number(body.maxParticipants || 0),
        Number(body.maxRentalEquipment || 0),
        String(body.status || "pending"),
        user.id,
        now, now
      );
      return this.getActivity(id);
    },
    updateActivity(activityId, body) {
      const existing = db.prepare("SELECT * FROM activities WHERE id = ?").get(activityId);
      if (!existing) return null;
      const now = new Date().toISOString();
      const fields = [];
      const params = [];
      if (body.title !== undefined) { fields.push("title = ?"); params.push(String(body.title)); }
      if (body.description !== undefined) { fields.push("description = ?"); params.push(String(body.description)); }
      if (body.location !== undefined) { fields.push("location = ?"); params.push(String(body.location)); }
      if (body.startTime !== undefined) { fields.push("start_time = ?"); params.push(String(body.startTime)); }
      if (body.endTime !== undefined) {
        const nextEndTime = body.endTime ? String(body.endTime) : String(body.startTime || existing.start_time);
        fields.push("end_time = ?");
        params.push(nextEndTime);
      }
      if (body.signupDeadline !== undefined) { fields.push("signup_deadline = ?"); params.push(String(body.signupDeadline)); }
      if (body.maxParticipants !== undefined) { fields.push("max_participants = ?"); params.push(Number(body.maxParticipants)); }
      if (body.maxRentalEquipment !== undefined) { fields.push("max_rental_equipment = ?"); params.push(Number(body.maxRentalEquipment)); }
      if (body.status !== undefined) { fields.push("status = ?"); params.push(String(body.status)); }
      if (fields.length === 0) return this.getActivity(activityId);
      fields.push("updated_at = ?");
      params.push(now);
      params.push(activityId);
      db.prepare(`UPDATE activities SET ${fields.join(", ")} WHERE id = ?`).run(...params);
      return this.getActivity(activityId);
    },
    deleteActivity(activityId) {
      db.prepare("DELETE FROM activity_registrations WHERE activity_id = ?").run(activityId);
      db.prepare("DELETE FROM activities WHERE id = ?").run(activityId);
    },

    // ─── Activity Registrations ─────────────────────────────
    registerForActivity(userId, activityId, options = {}) {
      const row = db.prepare("SELECT * FROM activities WHERE id = ?").get(activityId);
      if (!row) return { error: "活动不存在" };
      const activity = activityFromRow(row);
      if (activity.status !== "pending" && activity.status !== "active") return { error: "活动已结束，不能报名" };
      const wantsRental = Boolean(options.rentEquipment);
      const now = new Date().toISOString();
      if (row.max_participants > 0) {
        const count = db.prepare("SELECT COUNT(*) as cnt FROM activity_registrations WHERE activity_id = ? AND status = 'registered'").get(activityId).cnt;
        if (count >= row.max_participants) return { error: "报名人数已满" };
      }
      if (wantsRental && row.max_rental_equipment > 0) {
        const rentalCount = db.prepare("SELECT COUNT(*) as cnt FROM activity_registrations WHERE activity_id = ? AND status = 'registered' AND rent_equipment = 1").get(activityId).cnt;
        if (rentalCount >= row.max_rental_equipment) return { error: "租赁设备名额已满" };
      }
      const existing = db.prepare("SELECT * FROM activity_registrations WHERE activity_id = ? AND user_id = ?").get(activityId, userId);
      if (existing) {
        if (existing.status === "registered") return { error: "已报名" };
        // Re-register after cancellation
        db.prepare("UPDATE activity_registrations SET status = 'registered', created_at = ?, cancelled_at = NULL, rent_equipment = ? WHERE id = ?").run(now, wantsRental ? 1 : 0, existing.id);
        return { success: true, registration: { id: existing.id, activityId, userId, status: "registered", rentEquipment: wantsRental } };
      }
      const regId = crypto.randomUUID();
      db.prepare("INSERT INTO activity_registrations (id, activity_id, user_id, status, created_at, rent_equipment) VALUES (?, ?, ?, 'registered', ?, ?)")
        .run(regId, activityId, userId, now, wantsRental ? 1 : 0);
      return { success: true, registration: { id: regId, activityId, userId, status: "registered", rentEquipment: wantsRental } };
    },
    cancelRegistration(userId, activityId) {
      const reg = db.prepare("SELECT * FROM activity_registrations WHERE activity_id = ? AND user_id = ? AND status = 'registered'").get(activityId, userId);
      if (!reg) return { error: "未找到有效报名记录" };
      const now = new Date().toISOString();
      db.prepare("UPDATE activity_registrations SET status = 'cancelled', cancelled_at = ? WHERE id = ?").run(now, reg.id);
      return { success: true };
    },
    getActivityRegistrations(activityId) {
      return db.prepare(
        "SELECT ar.*, u.name, u.phone FROM activity_registrations ar JOIN users u ON ar.user_id = u.id WHERE ar.activity_id = ? ORDER BY ar.created_at ASC"
      ).all(activityId).map(regFromRow);
    },
    getRegistrationCount(activityId) {
      return db.prepare("SELECT COUNT(*) as cnt FROM activity_registrations WHERE activity_id = ? AND status = 'registered'").get(activityId).cnt;
    },
    getRentalCount(activityId) {
      return db.prepare("SELECT COUNT(*) as cnt FROM activity_registrations WHERE activity_id = ? AND status = 'registered' AND rent_equipment = 1").get(activityId).cnt;
    },
    getRecentRegistrations(activityId, limit = 5) {
      return db.prepare(
        "SELECT u.name FROM activity_registrations ar JOIN users u ON ar.user_id = u.id WHERE ar.activity_id = ? AND ar.status = 'registered' ORDER BY ar.created_at DESC LIMIT ?"
      ).all(activityId, limit).map(r => r.name);
    },
    getUserRegistrations(userId) {
      return db.prepare(
        "SELECT ar.*, a.title, a.start_time, a.end_time, a.location, a.status as activity_status FROM activity_registrations ar JOIN activities a ON ar.activity_id = a.id WHERE ar.user_id = ? ORDER BY a.start_time DESC"
      ).all(userId).map(r => ({
        ...regFromRow(r),
        activityTitle: r.title,
        activityStartTime: r.start_time,
        activityEndTime: r.end_time,
        activityLocation: r.location,
        activityStatus: activityRuntimeStatus({
          status: r.activity_status,
          start_time: r.start_time,
          end_time: r.end_time
        })
      }));
    },
    isUserRegistered(userId, activityId) {
      const reg = db.prepare("SELECT status FROM activity_registrations WHERE activity_id = ? AND user_id = ? AND status = 'registered'").get(activityId, userId);
      return !!reg;
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
    CREATE TABLE IF NOT EXISTS level_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      from_level TEXT NOT NULL,
      to_level TEXT NOT NULL,
      reason TEXT NOT NULL,
      course_completed INTEGER NOT NULL,
      course_required INTEGER NOT NULL,
      quiz_correct INTEGER NOT NULL,
      quiz_answered INTEGER NOT NULL,
      quiz_accuracy INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_question_attempts_user_created ON question_attempts(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_created ON quiz_attempts(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_level_history_user_created ON level_history(user_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_level_history_unique_step ON level_history(user_id, from_level, to_level);
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      signup_deadline TEXT NOT NULL,
      max_participants INTEGER NOT NULL DEFAULT 0,
      max_rental_equipment INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS activity_registrations (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'registered',
      created_at TEXT NOT NULL,
      cancelled_at TEXT,
      rent_equipment INTEGER NOT NULL DEFAULT 0,
      UNIQUE (activity_id, user_id),
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status, start_time DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_registrations_activity ON activity_registrations(activity_id);
    CREATE INDEX IF NOT EXISTS idx_activity_registrations_user ON activity_registrations(user_id);
  `);
  ensureColumn(db, "activities", "max_rental_equipment", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "activity_registrations", "rent_equipment", "INTEGER NOT NULL DEFAULT 0");
}

function ensureColumn(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
  if (!columns.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
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
  const courseCompletionRate = TOTAL_LESSONS ? Math.round(lessonsCompleted / TOTAL_LESSONS * 100) : 0;
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
  const weak = ability
    .filter(item => item.answered > 0 && item.score < 90)
    .sort((a, b) => a.score - b.score || a.answered - b.answered)
    .slice(0, 3);
  const recentLessons = Object.entries(progress.lessons || {})
    .filter(([, item]) => item.completed)
    .sort((a, b) => String(b[1].updatedAt || "").localeCompare(String(a[1].updatedAt || "")))
    .slice(0, 8)
    .map(([lessonId, item]) => ({ lessonId, updatedAt: item.updatedAt }));
  const recentQuestions = attempts.slice(0, 20);
  const latestLessonAt = recentLessons[0]?.updatedAt || "";
  const latestQuestionAt = attempts[0]?.answeredAt || "";
  const lastActivityAt = [latestLessonAt, latestQuestionAt].filter(Boolean).sort().pop() || "";
  const promotion = calculatePromotion(user, progress);
  const levelHistory = listLevelHistory(db, user.id);
  const adminStats = buildAdminStats({
    lessonsCompleted,
    courseCompletionRate,
    answered,
    correct,
    accuracy,
    lastActivityAt,
    weakestDomain: weak[0]?.domain || "",
    promotion
  });
  return {
    user: publicUser(user),
    summary: {
      lessonsCompleted,
      completedLessons: lessonsCompleted,
      totalLessons: TOTAL_LESSONS,
      totalWeeks: TOTAL_WEEKS,
      answered,
      totalQuestions: answered,
      correct,
      accuracy,
      avgAccuracy: accuracy,
      quizCount: progress.quizAttempts.length,
      courseCompletionRate,
      latestAttempt: attempts[0] || null,
      lastActivityAt,
      sampleReliable: answered >= 8
    },
    ability,
    dimensions: Object.fromEntries(ability.map(item => [item.domain, item.score])),
    weakRecommendations: weak.map(item => ({
      domain: item.domain,
      score: item.score,
      answered: item.answered,
      correct: item.correct,
      reason: `该能力域正确率为 ${item.score}%（${item.correct}/${item.answered}）`,
      action: "进入题库按知识域专项练习"
    })),
    weaknesses: weak.map(item => ({
      dimension: item.domain,
      score: item.score,
      reason: `该能力域正确率为 ${item.score}%（${item.correct}/${item.answered}）`
    })),
    promotion,
    levelHistory,
    recentLessons,
    recentQuestions,
    nextLesson: null,
    adminStats,
    progress
  };
}

function buildAdminStats(input) {
  const risk = riskState(input.lessonsCompleted, input.answered, input.accuracy);
  return {
    completedLessons: input.lessonsCompleted,
    totalLessons: TOTAL_LESSONS,
    courseCompletionRate: input.courseCompletionRate,
    answered: input.answered,
    correct: input.correct,
    accuracy: input.accuracy,
    weakestDomain: input.weakestDomain || "暂无",
    lastActivityAt: input.lastActivityAt || "",
    riskLevel: risk.level,
    riskLabel: risk.label,
    riskReason: risk.reason,
    hasLearningData: Boolean(input.lessonsCompleted || input.answered),
    promotionLevel: input.promotion?.currentLevel || "",
    promotionLevelName: levelName(input.promotion?.currentLevel || ""),
    promotionNextLevel: input.promotion?.nextLevel || "",
    promotionNextLevelName: levelName(input.promotion?.nextLevel || ""),
    promotionProgressPercent: input.promotion?.progressPercent || 0,
    promotionEligible: Boolean(input.promotion?.eligible),
    promotionBlockerSummary: input.promotion?.blockers?.[0] || ""
  };
}

function ensurePromotion(db, userId) {
  let user = userFromRow(db.prepare("SELECT * FROM users WHERE id = ?").get(userId));
  if (!user || user.role === "instructor") return user;
  let guard = 0;
  while (guard < promotionStages.length) {
    guard += 1;
    const progress = buildProgress(db, user.id);
    const promotion = calculatePromotion(user, progress);
    if (!promotion.eligible || !promotion.nextLevel) break;
    const createdAt = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO level_history
        (id, user_id, from_level, to_level, reason, course_completed, course_required, quiz_correct, quiz_answered, quiz_accuracy, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      user.id,
      promotion.currentLevel,
      promotion.nextLevel,
      `自动晋级：完成 ${promotion.weekRange} 课程，阶段课程题正确率 ${promotion.quiz.accuracy}% > 90%。`,
      promotion.course.completedLessons,
      promotion.course.requiredLessons,
      promotion.quiz.correct,
      promotion.quiz.answered,
      promotion.quiz.accuracy,
      createdAt
    );
    db.prepare("UPDATE users SET level = ? WHERE id = ?").run(promotion.nextLevel, user.id);
    user = userFromRow(db.prepare("SELECT * FROM users WHERE id = ?").get(user.id));
  }
  return user;
}

function calculatePromotion(user, progress) {
  const currentLevel = normalizeLevel(user.level);
  const stage = promotionStages.find(item => item.from === currentLevel);
  if (!stage) {
    return {
      currentLevel,
      currentLevelName: levelName(currentLevel),
      currentLevelNameEn: levelName(currentLevel, true),
      nextLevel: "",
      nextLevelName: "",
      nextLevelNameEn: "",
      weekRange: "",
      eligible: false,
      progressPercent: 100,
      course: { requiredWeeks: [], requiredLessons: 0, completedLessons: 0, complete: true, missingLessons: [] },
      quiz: { answered: 0, correct: 0, accuracy: 0, threshold: 90, complete: true },
      blockers: [],
      nextActions: []
    };
  }

  const requiredLessons = lessonIdsForWeeks(stage.weeks);
  const completed = progress.lessons || {};
  const missingLessons = requiredLessons.filter(lessonId => !completed[lessonId]?.completed);
  const latestAttempts = latestQuestionAttempts(progress.questionAttempts || []);
  const stageAttempts = latestAttempts.filter(attempt => {
    const week = weekNumberFromLessonMapping(attempt.lessonMapping);
    return attempt.type === "course" && stage.weeks.includes(week);
  });
  const answered = stageAttempts.length;
  const correct = stageAttempts.filter(attempt => attempt.correct).length;
  const accuracy = answered ? Math.round(correct / answered * 100) : 0;
  const courseComplete = missingLessons.length === 0;
  const quizComplete = answered > 0 && accuracy > 90;
  const eligible = courseComplete && quizComplete;
  const blockers = [];
  const nextActions = [];
  const weekRange = `W${stage.weeks[0]}-W${stage.weeks[stage.weeks.length - 1]}`;

  if (!courseComplete) {
    // Build a human-readable list of missing lesson names
    const missingDetails = missingLessons.slice(0, 5).map(id => {
      const meta = lessonMeta[id];
      return meta ? `${meta.code} ${meta.title}` : id;
    });
    const extra = missingLessons.length > 5 ? ` 等共${missingLessons.length}节` : `共${missingLessons.length}节`;
    blockers.push(`还差 ${missingDetails.join("、")}${extra}未完成。`);
    nextActions.push({ type: "course", label: `继续 ${missingLessons[0]?.toUpperCase() || weekRange}`, target: missingLessons[0] || "" });
  }
  if (!quizComplete) {
    if (!answered) {
      blockers.push(`还需完成 ${weekRange} 的课程题，当前正确率 0%，需达到 90% 以上才能晋级。`);
    } else {
      blockers.push(`当前正确率 ${accuracy}%（${correct}/${answered}题），需达到 90% 以上才能晋级。`);
    }
    nextActions.push({ type: "quiz", label: `练习 ${weekRange} 课程题`, target: weekRange });
  }
  if (eligible) {
    blockers.push(`已自动满足 ${stage.from}->${stage.to} 晋级条件。`);
  }

  const coursePercent = requiredLessons.length ? (requiredLessons.length - missingLessons.length) / requiredLessons.length * 70 : 70;
  const quizPercent = quizComplete ? 30 : (answered ? Math.min(29, accuracy / 91 * 30) : 0);

  return {
    currentLevel,
    currentLevelName: levelName(currentLevel),
    currentLevelNameEn: levelName(currentLevel, true),
    nextLevel: stage.to,
    nextLevelName: levelName(stage.to),
    nextLevelNameEn: levelName(stage.to, true),
    weekRange,
    eligible,
    progressPercent: eligible ? 100 : Math.round(coursePercent + quizPercent),
    course: {
      requiredWeeks: stage.weeks.map(week => `W${week}`),
      requiredLessons: requiredLessons.length,
      completedLessons: requiredLessons.length - missingLessons.length,
      complete: courseComplete,
      missingLessons,
      missingLessonDetails: missingLessons.map(id => {
        const meta = lessonMeta[id] || {};
        return { id, code: meta.code || id, title: meta.title || id };
      })
    },
    quiz: {
      answered,
      correct,
      accuracy,
      threshold: 90,
      complete: quizComplete
    },
    blockers,
    nextActions
  };
}

function latestQuestionAttempts(attempts) {
  const latestByQuestion = new Map();
  for (const attempt of attempts) {
    if (!latestByQuestion.has(attempt.questionId)) latestByQuestion.set(attempt.questionId, attempt);
  }
  return Array.from(latestByQuestion.values());
}

function lessonIdsForWeeks(weeks) {
  const ids = [];
  for (const week of weeks) {
    const lessonCount = week === 1 ? 3 : 2;
    for (let lesson = 1; lesson <= lessonCount; lesson += 1) {
      ids.push(`w${week}-l${lesson}`);
    }
  }
  return ids;
}

function normalizeLevel(level) {
  return /^L[0-6]$/.test(String(level || "")) ? String(level) : "L0";
}

function levelName(level, en) {
  const normalized = normalizeLevel(level);
  return en ? (levelNamesEn[normalized] || "") : (levelNames[normalized] || "");
}

function weekNumberFromLessonMapping(lessonMapping) {
  const match = String(lessonMapping || "").match(/^W(\d+)-L\d+$/i);
  return match ? Number(match[1]) : 0;
}

function listLevelHistory(db, userId) {
  return db.prepare("SELECT * FROM level_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20")
    .all(userId)
    .map(levelHistoryFromRow);
}

function riskState(lessonsCompleted, answered, accuracy) {
  if (!lessonsCompleted && !answered) {
    return { level: "idle", label: "待训练", reason: "暂无课程或题目记录，优先完成首节课程和一次题组。" };
  }
  if (answered > 0 && accuracy < 60) {
    return { level: "risk", label: "高风险", reason: "题库正确率低于 60%，需要按弱项知识域复训。" };
  }
  if (lessonsCompleted < 3 || answered < 8) {
    return { level: "watch", label: "待训练", reason: "已有训练记录但样本量不足，继续积累课程和题目数据。" };
  }
  return { level: "ok", label: "正常", reason: "课程和题库记录已形成基础闭环，按最低能力域继续补强。" };
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
  const text = `${attempt.title || ""} ${attempt.skillClassification || ""} ${(attempt.tags || []).join(" ")}`;
  const domains = [];
  if (/射击|姿势|姿态|标靶|精度|扳机/.test(text)) domains.push("射击基础");
  if (/装备|安全|规则|护具|故障|穿戴|SOP|流程|进攻|防御|脱离|夺旗|护送/.test(text)) domains.push("SOP流程");
  if (/通讯|SALUTE|ACE|Prowords|手语|指挥/.test(text)) domains.push("通讯指挥");
  if (/班组|队形|三三制|Bounding|掩护|协同/.test(text)) domains.push("班组协同");
  if (/CQB|Fatal|房间|建筑|切派|入口/.test(text)) domains.push("CQB与建筑清搜");
  if (/移动|Rush|匍匐|穿越/.test(text)) domains.push("战术移动");
  if (/复盘|成长|AAR|训练优先级|样本|雷达图|对抗|考核|Mega|压力|综合|决策|策略/.test(text)) domains.push("对抗综合");
  if (/领导|心理|班长|独立指挥|责任|士气/.test(text)) domains.push("领导力/心理素质");
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
    level: user.level,
    levelName: levelName(user.level),
    levelNameEn: levelName(user.level, true)
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

function levelHistoryFromRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    fromLevel: row.from_level,
    toLevel: row.to_level,
    reason: row.reason,
    courseCompleted: row.course_completed,
    courseRequired: row.course_required,
    quizCorrect: row.quiz_correct,
    quizAnswered: row.quiz_answered,
    quizAccuracy: row.quiz_accuracy,
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

function activityRuntimeStatus(row, now = new Date()) {
  if (row.status === "cancelled") return "cancelled";
  const start = new Date(row.start_time);
  const end = new Date(row.end_time || row.start_time);
  if (Number.isNaN(start.getTime())) return row.status || "pending";
  if (now < start) return "pending";
  if (!Number.isNaN(end.getTime()) && now > end) return "ended";
  return "active";
}

function activityFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    startTime: row.start_time,
    endTime: row.end_time,
    signupDeadline: row.signup_deadline,
    maxParticipants: row.max_participants,
    maxRentalEquipment: row.max_rental_equipment || 0,
    status: activityRuntimeStatus(row),
    storedStatus: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function regFromRow(row) {
  return {
    id: row.id,
    activityId: row.activity_id,
    userId: row.user_id,
    status: row.status,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
    rentEquipment: Boolean(row.rent_equipment),
    name: row.name || "",
    phone: row.phone || ""
  };
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
  levelNames,
  createStore,
  emptyProgress,
  publicUser
};
