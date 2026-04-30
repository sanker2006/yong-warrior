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
  const activityTitle = "BMAD-Smoke 活动测试";
  const futureStart = new Date(Date.now() + 86400000).toISOString();
  const futureEnd = new Date(Date.now() + 172800000).toISOString();
  const createResult = await api("/api/admin/activities", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      title: activityTitle,
      description: "活动测试描述",
      location: "测试场地",
      startTime: futureStart,
      endTime: futureEnd,
      maxParticipants: 10,
      maxRentalEquipment: 1,
      status: "pending"
    })
  });
  assert(createResult.activity, "Admin should create activity");
  const activityId = createResult.activity.id;

  const invalidTimeError = await apiExpectError("/api/admin/activities", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      title: "BMAD-Smoke Invalid Time",
      startTime: new Date(Date.now() + 7200000).toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString()
    })
  });
  assert(invalidTimeError.message.includes("活动结束时间不能早于开始时间"), "Admin should not create activity with end before start");

  // 2. List activities (admin)
  const adminActivities = await api("/api/admin/activities", { headers: adminHeaders });
  assert(adminActivities.activities.some(a => a.id === activityId), "Admin should list the activity");

  // 3. H5 user list active activities
  const activities = await api("/api/activities", { headers });
  assert(Array.isArray(activities.activities), "H5 should list activities");

  // 4. Get activity detail
  const activityDetail = await api(`/api/activities/${activityId}`, { headers });
  assert(activityDetail.id === activityId, "Should get activity detail");
  assert(activityDetail.status === "pending", "Future activity should be open for signup");
  assert(activityDetail.registrationCount === 0, "Should have 0 registrations initially");
  assert(activityDetail.rentalCount === 0, "Should have 0 rentals initially");
  assert(activityDetail.isRegistered === false, "User should not be registered initially");

  const registerResult = await api(`/api/activities/${activityId}/register`, {
    method: "POST",
    headers,
    body: JSON.stringify({ rentEquipment: true })
  });
  assert(registerResult.success, "Registration should succeed");
  assert(registerResult.registration.rentEquipment === true, "Registration should save rental equipment choice");

  const adminRegisterError = await apiExpectError(`/api/activities/${activityId}/register`, {
    method: "POST",
    headers: adminHeaders
  });
  assert(adminRegisterError.message.includes("管理员账号不能报名活动"), "Admin account must not register for H5 activities");

  const activityDetail2 = await api(`/api/activities/${activityId}`, { headers });
  assert(activityDetail2.registrationCount === 1, "Registration count should be 1");
  assert(activityDetail2.rentalCount === 1, "Rental count should be 1");
  assert(activityDetail2.isRegistered === true, "User should be registered after registration");

  const myRegistrations = await api("/api/activities/my", { headers });
  assert(Array.isArray(myRegistrations.registrations), "Should list user registrations");
  assert(myRegistrations.registrations.some(r => r.activityId === activityId), "Should include the registered activity");
  assert(myRegistrations.registrations.some(r => r.activityId === activityId && r.activityTitle === activityTitle), "My activity should include flattened activity title");
  assert(myRegistrations.registrations.some(r => r.activityId === activityId && r.rentEquipment === true), "My activity should include rental choice");

  const rentalOverflowUser = await api("/api/register", {
    method: "POST",
    body: JSON.stringify({ phone: `196${Math.floor(10000000 + Math.random() * 89999999)}`, password: "123456", name: "BMAD-Rental-Overflow" })
  });
  const rentalOverflowError = await apiExpectError(`/api/activities/${activityId}/register`, {
    method: "POST",
    headers: { Authorization: `Bearer ${rentalOverflowUser.token}` },
    body: JSON.stringify({ rentEquipment: true })
  });
  assert(rentalOverflowError.message.includes("租赁设备名额已满"), "Rental equipment quota should be enforced independently");

  const lateUser = await api("/api/register", {
    method: "POST",
    body: JSON.stringify({ phone: `197${Math.floor(10000000 + Math.random() * 89999999)}`, password: "123456", name: "BMAD-Late-Activity" })
  });
  await api(`/api/admin/activities/${activityId}`, {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({
      startTime: new Date(Date.now() - 300000).toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString()
    })
  });
  const activeDetail = await api(`/api/activities/${activityId}`, { headers });
  assert(activeDetail.status === "active", "Activity should become active by time range");
  const activeRegister = await api(`/api/activities/${activityId}/register`, {
    method: "POST",
    headers: { Authorization: `Bearer ${lateUser.token}` },
    body: JSON.stringify({ rentEquipment: false })
  });
  assert(activeRegister.success, "New users can register while activity is in progress");

  const tooSmallCapacity = await apiExpectError(`/api/admin/activities/${activityId}`, {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({ maxParticipants: 1 })
  });
  assert(tooSmallCapacity.message.includes("人数上限不能小于当前已报名人数"), "Admin should not lower capacity below registered count");

  const adminRegistrations = await api(`/api/admin/activities/${activityId}/registrations`, { headers: adminHeaders });
  assert(Array.isArray(adminRegistrations.registrations), "Admin should list registrations");
  assert(adminRegistrations.registrations.filter(r => r.status === "registered").length === 2, "Admin should see active registrations");
  assert(adminRegistrations.registrations.some(r => r.rentEquipment === true), "Admin registrations should expose rental choice");
  assert(!adminRegistrations.registrations.some(r => r.name === "admin"), "Admin should not appear as a participant");

  const endedUser = await api("/api/register", {
    method: "POST",
    body: JSON.stringify({ phone: `195${Math.floor(10000000 + Math.random() * 89999999)}`, password: "123456", name: "BMAD-Ended-Activity" })
  });
  await api(`/api/admin/activities/${activityId}`, {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({
      startTime: new Date(Date.now() - 7200000).toISOString(),
      endTime: new Date(Date.now() - 3600000).toISOString()
    })
  });
  const endedDetail = await api(`/api/activities/${activityId}`, { headers });
  assert(endedDetail.status === "ended", "Activity should become ended by time range");
  const endedRegisterError = await apiExpectError(`/api/activities/${activityId}/register`, {
    method: "POST",
    headers: { Authorization: `Bearer ${endedUser.token}` }
  });
  assert(endedRegisterError.message.includes("活动已结束"), "Ended activities should reject registration");

  const concurrentActivity = await api("/api/admin/activities", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      title: "BMAD-Smoke Concurrent Capacity",
      startTime: new Date(Date.now() + 3600000).toISOString(),
      endTime: new Date(Date.now() + 7200000).toISOString(),
      maxParticipants: 1,
      maxRentalEquipment: 1
    })
  });
  const concurrentUsers = await Promise.all([0, 1].map(index => api("/api/register", {
    method: "POST",
    body: JSON.stringify({ phone: `194${index}${Math.floor(1000000 + Math.random() * 8999999)}`, password: "123456", name: `BMAD-Concurrent-${index}` })
  })));
  const concurrentResults = await Promise.allSettled(concurrentUsers.map(u => api(`/api/activities/${concurrentActivity.activity.id}/register`, {
    method: "POST",
    headers: { Authorization: `Bearer ${u.token}` },
    body: JSON.stringify({ rentEquipment: true })
  })));
  assert(concurrentResults.filter(r => r.status === "fulfilled").length === 1, "Concurrent capacity should allow exactly one registration");
  assert(concurrentResults.filter(r => r.status === "rejected").length === 1, "Concurrent capacity should reject overflow registration");

  const cancelResult = await api(`/api/activities/${activityId}/cancel`, {
    method: "POST",
    headers
  });
  assert(cancelResult.success, "Cancellation should succeed");

  const activityDetail3 = await api(`/api/activities/${activityId}`, { headers });
  assert(activityDetail3.registrationCount === 1, "Registration count should exclude cancelled user");
  assert(activityDetail3.rentalCount === 0, "Rental count should drop after cancellation");
  assert(activityDetail3.isRegistered === false, "User should not be registered after cancellation");

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

  const deleteResult = await api(`/api/admin/activities/${activityId}`, {
    method: "DELETE",
    headers: adminHeaders
  });
  assert(deleteResult.success, "Activity deletion should succeed");
  await api(`/api/admin/activities/${concurrentActivity.activity.id}`, {
    method: "DELETE",
    headers: adminHeaders
  });

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
  db.prepare("DELETE FROM users WHERE name LIKE 'BMAD-Smoke%' OR name = 'BMAD-Late-Activity' OR name = 'BMAD-Rental-Overflow' OR name = 'BMAD-Ended-Activity' OR name LIKE 'BMAD-Concurrent-%'").run();
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
