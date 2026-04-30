const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "v5.html"), "utf8");
const js = fs.readFileSync(path.join(root, "public", "v5.js"), "utf8");
const adminJs = fs.readFileSync(path.join(root, "public", "admin-v5.js"), "utf8");
const adminCss = fs.readFileSync(path.join(root, "public", "admin-v5.css"), "utf8");

const onclickCalls = new Set(
  [
    ...Array.from(html.matchAll(/onclick="V5\.([A-Za-z0-9_]+)\(/g)).map(match => match[1]),
    ...Array.from(js.matchAll(/onclick="V5\.([A-Za-z0-9_]+)\(/g)).map(match => match[1])
  ]
);
const exportMatch = js.match(/window\.V5\s*=\s*\{([\s\S]*?)\};\s*boot\(\);/);
if (!exportMatch) {
  console.error("Missing V5 public API export");
  process.exit(1);
}

const exportBody = exportMatch[1];
const exported = new Set();
for (const part of exportBody.split(",")) {
  const key = part.trim().split(":")[0]?.trim();
  if (key) exported.add(key);
}

const missing = Array.from(onclickCalls).filter(name => !exported.has(name));
const checks = [
  ["all V5 onclick handlers are exported", missing.length === 0],
  ["V5 boot initializes the active navigation stack", /S\.stack\s*=\s*\['home'\]/.test(js)],
  ["admin v5 modal footer CSS is valid", !/border-top:var\(--border-subtle;/.test(adminCss)],
  ["V5 uses numeric question answer field", /qAnswer\(/.test(js) && !/correctAnswer/.test(js)],
  ["V5 reads QUESTION_BANK_V2 array", /Array\.isArray\(QB\)\?QB/.test(js)],
  ["V5 quiz page can start practice", /function sql\(\)/.test(js) && !/题目详情功能开发中/.test(js)],
  ["V5 filters by lessonMapping instead of weekMapping", /questionMatchesWeek\(/.test(js) && !/weekMapping/.test(js)],
  ["V5 filters by skillClassification instead of domain", /qSkill\(/.test(js) && !/q\.domain/.test(js)],
  ["V5 AAR uses server record fields", /topic,plan,actual,improve/.test(js) && !/event:title,squad,note/.test(js)],
  ["V5 H5 and admin auth tokens are separated", /training-h5-token/.test(js) && /training-admin-token/.test(adminJs)],
  ["V5 rejects instructor accounts in H5 shell", /role==='instructor'/.test(js) && /管理员账号请使用管理端登录/.test(js)],
  ["V5 inactive views are hidden from accessibility tree", /function syncViews\(/.test(js) && /aria-hidden/.test(js) && /\.inert/.test(js)],
  ["V5 quiz submission does not swallow save failures", /答题结果保存失败/.test(js) && !/function fqz\(\)[\s\S]*?catch\(e\)\{\}[\s\S]*?nav\('quiz-result'\)/.test(js)],
  ["V5 my activities supports flattened server activity fields", /activityTitle/.test(js) && /activityStartTime/.test(js) && /activityLocation/.test(js)],
  ["V5 profile my activities opens registration history", /V5\.nav\('my-activities'\)/.test(js)],
  ["V5 pending and active activities can show signup CTA", /报名中/.test(js) && /\['pending','active'\]\.includes\(a\.status\)/.test(js)],
  ["V5 activity registration carries rental equipment choice", /rentEquipment/.test(js) && /maxRentalEquipment/.test(adminJs)],
  ["V5 activity detail shows the current user's rental choice", /userRegistration/.test(js)],
  ["V5 admin activity API validates time and capacity", /validateActivityPayload/.test(fs.readFileSync(path.join(root, "server.js"), "utf8"))],
  ["admin v5 deletes activities with confirmation", /function dact\(/.test(adminJs) && /confirm\('确定删除这个活动吗/.test(adminJs)],
  ["admin v5 renders real user detail", /api\(`\/api\/admin\/users\/\$\{encodeURIComponent\(id\)\}`\)/.test(adminJs) && !/用户详情功能开发中/.test(adminJs)],
  ["admin v5 datetime-local values preserve local wall time", /function dtl\(/.test(adminJs) && !/toISOString\(\)\.slice\(0,16\)/.test(adminJs)]
];

const failures = checks.filter(([, passed]) => !passed);
if (failures.length) {
  for (const [name] of failures) {
    console.error(`Missing V5 requirement: ${name}${name.includes("onclick") ? ` (${missing.join(", ")})` : ""}`);
  }
  process.exit(1);
}

console.log("V5 entrypoint check passed");
