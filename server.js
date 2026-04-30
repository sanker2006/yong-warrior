const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createStore, publicUser } = require("./lib/store");

const PORT = Number(process.env.PORT || 4317);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "app.db");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PROGRESS_FILE = path.join(DATA_DIR, "progress.json");
const AAR_FILE = path.join(DATA_DIR, "aar.json");
const ASSESSMENTS_FILE = path.join(DATA_DIR, "assessments.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

ensureLegacyDataFiles();
const store = createStore({
  dataDir: DATA_DIR,
  dbPath: DB_FILE,
  files: {
    users: USERS_FILE,
    progress: PROGRESS_FILE,
    aar: AAR_FILE,
    assessments: ASSESSMENTS_FILE
  }
});
ensureDefaultAdmin();

function ensureLegacyDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) {
    const admin = makeUser({
      id: crypto.randomUUID(),
      phone: "18800000000",
      name: "训练管理员",
      role: "instructor",
      level: "L4",
      password: "123456"
    });
    fs.writeFileSync(USERS_FILE, JSON.stringify([admin], null, 2), "utf8");
  }
  for (const [file, fallback] of [
    [PROGRESS_FILE, {}],
    [AAR_FILE, []],
    [ASSESSMENTS_FILE, []]
  ]) {
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(fallback, null, 2), "utf8");
  }
}

function ensureDefaultAdmin() {
  if (store.findUserByPhone("18800000000")) return;
  store.insertUser(makeUser({
    phone: "18800000000",
    name: "训练管理员",
    role: "instructor",
    level: "L4",
    password: "123456"
  }));
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
}

function makeUser(input) {
  const salt = crypto.randomBytes(16).toString("hex");
  return {
    id: input.id || crypto.randomUUID(),
    phone: input.phone,
    name: input.name || input.phone,
    role: input.role || "member",
    level: input.level || "L0",
    salt,
    passwordHash: hashPassword(input.password, salt),
    createdAt: new Date().toISOString()
  };
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function getToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function getSessionUser(req) {
  const token = getToken(req);
  return token ? store.getUserByToken(token) : null;
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readBody(req);
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const user = store.findUserByPhone(phone);
    if (!user || hashPassword(password, user.salt) !== user.passwordHash) {
      return sendJson(res, 401, { error: "手机号或密码错误" });
    }
    const token = crypto.randomBytes(24).toString("hex");
    store.createSession(token, user.id);
    return sendJson(res, 200, { token, user: publicUser(user) });
  }

  if (req.method === "POST" && url.pathname === "/api/register") {
    const body = await readBody(req);
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const name = String(body.name || "").trim() || phone;
    if (!/^1\d{10}$/.test(phone)) return sendJson(res, 400, { error: "请输入11位手机号" });
    if (password.length < 6) return sendJson(res, 400, { error: "密码至少6位" });
    if (store.findUserByPhone(phone)) return sendJson(res, 409, { error: "该手机号已注册" });
    const user = store.insertUser(makeUser({ phone, password, name, role: "member", level: "L0" }));
    const token = crypto.randomBytes(24).toString("hex");
    store.createSession(token, user.id);
    return sendJson(res, 200, { token, user: publicUser(user) });
  }

  if (req.method === "GET" && url.pathname === "/api/me") {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    const profile = store.getProfile(user);
    return sendJson(res, 200, {
      user: profile.user,
      progress: profile.progress,
      stats: profile.summary,
      promotion: profile.promotion
    });
  }

  if (req.method === "GET" && url.pathname === "/api/profile") {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    return sendJson(res, 200, store.getProfile(user));
  }

  if (req.method === "POST" && url.pathname === "/api/progress") {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    const body = await readBody(req);
    let progress = store.getProgress(user.id);
    if (body.type === "lesson" && body.id) {
      progress = store.saveLessonProgress(user.id, String(body.id), Boolean(body.completed));
    } else if (body.type === "question") {
      progress = store.saveQuestionAttempt(user.id, body);
    } else if (body.type === "quiz" && body.id) {
      progress = store.saveQuizAttempt(user.id, body);
    }
    return sendJson(res, 200, { progress });
  }

  if (req.method === "POST" && url.pathname === "/api/aar") {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    const record = store.addAar(user, await readBody(req));
    return sendJson(res, 200, { record });
  }

  if (req.method === "GET" && url.pathname === "/api/aar") {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    return sendJson(res, 200, { records: store.listAar(user) });
  }

  if (req.method === "POST" && url.pathname === "/api/assessment") {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    const body = await readBody(req);
    const dimensions = {
      command: clampScore(body.command),
      comms: clampScore(body.comms),
      formation: clampScore(body.formation),
      sop: clampScore(body.sop),
      attrition: clampScore(body.attrition),
      reaction: clampScore(body.reaction)
    };
    const weightedScore = Math.round(
      dimensions.command * 0.2 +
      dimensions.comms * 0.2 +
      dimensions.formation * 0.15 +
      dimensions.sop * 0.2 +
      dimensions.attrition * 0.15 +
      dimensions.reaction * 0.1
    );
    const record = store.addAssessment(user, {
      id: crypto.randomUUID(),
      userId: user.id,
      assessor: user.name,
      event: String(body.event || "未命名对抗"),
      squad: String(body.squad || "未指定班组"),
      dimensions,
      weightedScore,
      weaknessTags: Array.isArray(body.weaknessTags) ? body.weaknessTags.map(String).slice(0, 8) : [],
      note: String(body.note || ""),
      createdAt: new Date().toISOString()
    });
    return sendJson(res, 200, { record });
  }

  if (req.method === "GET" && url.pathname === "/api/assessment") {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    return sendJson(res, 200, { records: store.listAssessments() });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/users") {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    if (user.role !== "instructor") return sendJson(res, 403, { error: "无管理权限" });
    return sendJson(res, 200, { users: store.listUsersWithProgress() });
  }

  const adminUserMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (req.method === "GET" && adminUserMatch) {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    if (user.role !== "instructor") return sendJson(res, 403, { error: "无管理权限" });
    const detail = store.getAdminUserDetail(decodeURIComponent(adminUserMatch[1]));
    if (!detail) return sendJson(res, 404, { error: "用户不存在" });
    return sendJson(res, 200, detail);
  }

  // ─── Activities API ────────────────────────────────────

  // GET /api/activities — H5端获取有效活动列表
  if (req.method === "GET" && url.pathname === "/api/activities") {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    const activities = store.getActiveActivities();
    // Attach registration count, user's registration status, and recent registrant names
    const result = activities.map(a => ({
      ...a,
      registrationCount: store.getRegistrationCount(a.id),
      rentalCount: store.getRentalCount(a.id),
      isRegistered: store.isUserRegistered(user.id, a.id),
      recentRegistrations: store.getRecentRegistrations(a.id, 3)
    }));
    return sendJson(res, 200, { activities: result });
  }

  // GET /api/activities/my — 我的活动记录（必须放在:id路由前面，否则会被误匹配）
  if (req.method === "GET" && url.pathname === "/api/activities/my") {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    const registrations = store.getUserRegistrations(user.id);
    return sendJson(res, 200, { registrations });
  }

  // POST /api/activities/:id/register — 报名
  const registerMatch = url.pathname.match(/^\/api\/activities\/([^/]+)\/register$/);
  if (req.method === "POST" && registerMatch) {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    if (user.role === "instructor") return sendJson(res, 403, { error: "管理员账号不能报名活动，请使用学员账号" });
    const activityId = decodeURIComponent(registerMatch[1]);
    const body = await readBody(req);
    const result = store.registerForActivity(user.id, activityId, { rentEquipment: Boolean(body.rentEquipment) });
    if (result.error) return sendJson(res, 400, result);
    return sendJson(res, 200, result);
  }

  // POST /api/activities/:id/cancel — 取消报名
  const cancelMatch = url.pathname.match(/^\/api\/activities\/([^/]+)\/cancel$/);
  if (req.method === "POST" && cancelMatch) {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    if (user.role === "instructor") return sendJson(res, 403, { error: "管理员账号不能取消学员活动报名" });
    const activityId = decodeURIComponent(cancelMatch[1]);
    const result = store.cancelRegistration(user.id, activityId);
    if (result.error) return sendJson(res, 400, result);
    return sendJson(res, 200, result);
  }

  // GET /api/activities/:id — 活动详情
  const activityDetailMatch = url.pathname.match(/^\/api\/activities\/([^/]+)$/);
  if (req.method === "GET" && activityDetailMatch && !url.pathname.includes("/register") && !url.pathname.includes("/registrations")) {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    const activityId = decodeURIComponent(activityDetailMatch[1]);
    const activity = store.getActivity(activityId);
    if (!activity) return sendJson(res, 404, { error: "活动不存在" });
    return sendJson(res, 200, {
      ...activity,
      registrationCount: store.getRegistrationCount(activityId),
      rentalCount: store.getRentalCount(activityId),
      isRegistered: store.isUserRegistered(user.id, activityId),
      recentRegistrations: store.getRecentRegistrations(activityId, 10)
    });
  }

  // ─── Admin Activities API ───────────────────────────────

  // GET /api/admin/activities — 管理端活动列表
  if (req.method === "GET" && url.pathname === "/api/admin/activities") {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    if (user.role !== "instructor") return sendJson(res, 403, { error: "无管理权限" });
    const activities = store.listActivities();
    const result = activities.map(a => ({
      ...a,
      registrationCount: store.getRegistrationCount(a.id),
      rentalCount: store.getRentalCount(a.id),
      recentRegistrations: store.getRecentRegistrations(a.id, 3)
    }));
    return sendJson(res, 200, { activities: result });
  }

  // POST /api/admin/activities — 新建活动
  if (req.method === "POST" && url.pathname === "/api/admin/activities") {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    if (user.role !== "instructor") return sendJson(res, 403, { error: "无管理权限" });
    const body = await readBody(req);
    if (!body.title) return sendJson(res, 400, { error: "活动名称必填" });
    const activity = store.createActivity(user, body);
    return sendJson(res, 200, { activity });
  }

  // PUT /api/admin/activities/:id — 更新活动
  const adminActivityMatch = url.pathname.match(/^\/api\/admin\/activities\/([^/]+)$/);
  if (req.method === "PUT" && adminActivityMatch) {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    if (user.role !== "instructor") return sendJson(res, 403, { error: "无管理权限" });
    const activityId = decodeURIComponent(adminActivityMatch[1]);
    const body = await readBody(req);
    const activity = store.updateActivity(activityId, body);
    if (!activity) return sendJson(res, 404, { error: "活动不存在" });
    return sendJson(res, 200, { activity });
  }

  // DELETE /api/admin/activities/:id — 删除活动
  if (req.method === "DELETE" && adminActivityMatch) {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    if (user.role !== "instructor") return sendJson(res, 403, { error: "无管理权限" });
    const activityId = decodeURIComponent(adminActivityMatch[1]);
    store.deleteActivity(activityId);
    return sendJson(res, 200, { success: true });
  }

  // GET /api/admin/activities/:id/registrations — 查看报名人员
  const adminRegMatch = url.pathname.match(/^\/api\/admin\/activities\/([^/]+)\/registrations$/);
  if (req.method === "GET" && adminRegMatch) {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: "未登录" });
    if (user.role !== "instructor") return sendJson(res, 403, { error: "无管理权限" });
    const activityId = decodeURIComponent(adminRegMatch[1]);
    const registrations = store.getActivityRegistrations(activityId);
    return sendJson(res, 200, { registrations });
  }

  sendJson(res, 404, { error: "接口不存在" });
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

function serveStatic(req, res) {
  const requestPath = decodeURIComponent(req.url.split("?")[0]);
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  const relative = path.relative(PUBLIC_DIR, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (indexErr, indexData) => {
        if (indexErr) {
          res.writeHead(404);
          return res.end("Not found");
        }
        res.writeHead(200, { "Content-Type": mimeTypes[".html"] });
        res.end(indexData);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res).catch(error => sendJson(res, 400, { error: error.message }));
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Laser training H5 is running at http://localhost:${PORT}`);
});

module.exports = server;
