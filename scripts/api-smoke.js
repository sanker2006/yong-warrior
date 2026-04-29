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

async function apiExpectError(path, options = {}) {
  try {
    await api(path, options);
  } catch (error) {
    return error;
  }
  throw new Error(`${path}: expected request to fail`);
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
  assert(profile.promotion && profile.promotion.currentLevel === "L0", "Profile should include promotion status");
  assert(profile.promotion.eligible === false, "Incomplete W1-W6 should not promote");

  const promo90 = await createPromotionCandidate("BMAD-Smoke-90", 9, 10);
  assert(promo90.user.level === "L0", "90% course accuracy must not promote");
  assert(promo90.profile.promotion.quiz.accuracy === 90, "90% candidate should report 90 accuracy");
  assert(promo90.history.length === 0, "90% candidate should not write level history");

  const promo91 = await createPromotionCandidate("BMAD-Smoke-91", 10, 11);
  assert(promo91.user.level === "L1", "91% course accuracy should auto-promote to L1");
  assert(promo91.history.some(item => item.toLevel === "L1"), "91% candidate should write level history");
  assert(promo91.detail.profile.levelHistory.some(item => item.toLevel === "L1"), "Admin detail should expose level history");

  // ─── ACTIVITIES TESTS ───────────────────────────────────
  // 1. Admin creates an activity
  const activityTitle = "BMAD-Smoke 活动测试";
  const createResult = await api("/api/admin/activities", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      title: activityTitle,
      description: "活动测试描述",
      location: "测试场地",
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 172800000).toISOString(),
      maxParticipants: 10,
      status: "pending"
    })
  });
  assert(createResult.activity, "Admin should create activity");
  const activityId = createResult.activity.id;

  // 2. List activities (admin)
  const adminActivities = await api("/api/admin/activities", { headers: adminHeaders });
  assert(adminActivities.activities.some(a => a.id === activityId), "Admin should list the activity");

  // 3. H5 user list active activities
  const activities = await api("/api/activities", { headers });
  assert(Array.isArray(activities.activities), "H5 should list activities");

  // 4. Get activity detail
  const activityDetail = await api(`/api/activities/${activityId}`, { headers });
  assert(activityDetail.id === activityId, "Should get activity detail");
  assert(activityDetail.registrationCount === 0, "Should have 0 registrations initially");
  assert(activityDetail.isRegistered === false, "User should not be registered initially");

  // 5. Register for activity
  const registerResult = await api(`/api/activities/${activityId}/register`, {
    method: "POST",
    headers
  });
  assert(registerResult.success, "Registration should succeed");

  const adminRegisterError = await apiExpectError(`/api/activities/${activityId}/register`, {
    method: "POST",
    headers: adminHeaders
  });
  assert(adminRegisterError.message.includes("管理员账号不能报名活动"), "Admin account must not register for H5 activities");

  // 6. Verify registration status before and after admin starts the activity
  const activityDetail2 = await api(`/api/activities/${activityId}`, { headers });
  assert(activityDetail2.registrationCount === 1, "Registration count should be 1");
  assert(activityDetail2.isRegistered === true, "User should be registered after registration");

  await api(`/api/admin/activities/${activityId}`, {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({ status: "active" })
  });
  const activeDetail = await api(`/api/activities/${activityId}`, { headers });
  assert(activeDetail.status === "active", "Activity should become active");
  assert(activeDetail.registrationCount === 1, "Starting activity must not create another registration");
  assert(activeDetail.isRegistered === true, "User should remain registered after activity starts");

  // 7. List user's activities
  const myRegistrations = await api("/api/activities/my", { headers });
  assert(Array.isArray(myRegistrations.registrations), "Should list user registrations");
  assert(myRegistrations.registrations.some(r => r.activityId === activityId), "Should include the registered activity");

  // 8. Admin view registrations
  const adminRegistrations = await api(`/api/admin/activities/${activityId}/registrations`, { headers: adminHeaders });
  assert(Array.isArray(adminRegistrations.registrations), "Admin should list registrations");
  assert(adminRegistrations.registrations.length === 1, "Admin should see 1 registration");
  assert(!adminRegistrations.registrations.some(r => r.name === "admin"), "Admin should not appear as a participant");

  // 9. Cancel registration
  const cancelResult = await api(`/api/activities/${activityId}/cancel`, {
    method: "POST",
    headers
  });
  assert(cancelResult.success, "Cancellation should succeed");

  // 10. Verify cancellation
  const activityDetail3 = await api(`/api/activities/${activityId}`, { headers });
  assert(activityDetail3.registrationCount === 0, "Registration count should be 0 after cancellation");
  assert(activityDetail3.isRegistered === false, "User should not be registered after cancellation");

  // 11. Update activity
  const updatedTitle = activityTitle + " (更新)";
  const updateResult = await api(`/api/admin/activities/${activityId}`, {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({
      title: updatedTitle,
      status: "ended"
    })
  });
  assert(updateResult.activity.title === updatedTitle, "Activity update should work");

  // 12. Delete activity
  const deleteResult = await api(`/api/admin/activities/${activityId}`, {
    method: "DELETE",
    headers: adminHeaders
  });
  assert(deleteResult.success, "Activity deletion should succeed");

  cleanupSmokeUsers();
  console.log(JSON.stringify({
    ok: true,
    phone,
    profileAnswered: profile.summary.answered,
    abilityCount: profile.ability.length,
    promotedLevel: promo91.user.level,
    adminUsers: users.users.length,
    detailAnswered: detail.profile.summary.answered
  }));
}

async function createPromotionCandidate(name, correctCount, total) {
  const phone = `198${Math.floor(10000000 + Math.random() * 89999999)}`;
  const register = await api("/api/register", {
    method: "POST",
    body: JSON.stringify({ phone, password: "123456", name })
  });
  const headers = { Authorization: `Bearer ${register.token}` };
  const lessonIds = [];
  for (let week = 1; week <= 6; week += 1) {
    const lessonCount = week === 1 ? 3 : 2;
    for (let lesson = 1; lesson <= lessonCount; lesson += 1) {
      lessonIds.push(`w${week}-l${lesson}`);
    }
  }
  for (const id of lessonIds) {
    await api("/api/progress", {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "lesson", id, completed: true })
    });
  }
  const results = Array.from({ length: total }, (_, index) => ({
    questionId: `${name}-q-${index + 1}`,
    title: `${name} 晋级题 ${index + 1}`,
    questionType: "course",
    selectedAnswer: index < correctCount ? 0 : 1,
    correct: index < correctCount,
    tags: ["射击基础"],
    skillClassification: "射击基础",
    lessonMapping: `W${(index % 6) + 1}-L1`
  }));
  await api("/api/progress", {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "quiz",
      id: `${name}-promotion`,
      title: `${name} promotion`,
      quizType: "course",
      score: correctCount,
      total,
      results
    })
  });
  const me = await api("/api/me", { headers });
  const profile = await api("/api/profile", { headers });
  const adminLogin = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ phone: "18800000000", password: "123456" })
  });
  const detail = await api(`/api/admin/users/${encodeURIComponent(register.user.id)}`, {
    headers: { Authorization: `Bearer ${adminLogin.token}` }
  });
  return { user: me.user, profile, detail, history: profile.levelHistory || [] };
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

function cleanupSmokeUsers() {
  const db = new DatabaseSync("data/app.db");
  db.prepare("DELETE FROM users WHERE name LIKE 'BMAD-Smoke%'").run();
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
