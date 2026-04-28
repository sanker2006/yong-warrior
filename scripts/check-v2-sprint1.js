const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "v2.html"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "public", "v2.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "v2.css"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "public", "admin.html"), "utf8");
const adminJs = fs.readFileSync(path.join(root, "public", "admin.js"), "utf8");
const adminCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const v31Html = fs.readFileSync(path.join(root, "public", "v3.1.html"), "utf8");
const v31Js = fs.readFileSync(path.join(root, "public", "v3.1.js"), "utf8");
const v31Css = fs.readFileSync(path.join(root, "public", "v3.1.css"), "utf8");
const v32Html = fs.readFileSync(path.join(root, "public", "v3.2.html"), "utf8");
const v32Js = fs.readFileSync(path.join(root, "public", "v3.2.js"), "utf8");
const v32Css = fs.readFileSync(path.join(root, "public", "v3.2.css"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const store = fs.readFileSync(path.join(root, "lib", "store.js"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const sprint5Demo = fs.readFileSync(path.join(root, "docs", "bmad", "12-sprint5-demo-checklist.md"), "utf8");
const roadmap = fs.readFileSync(path.join(root, "docs", "bmad", "13-sprint6-8-roadmap.md"), "utf8");
const deployment = fs.readFileSync(path.join(root, "docs", "bmad", "14-deployment-and-version-governance.md"), "utf8");
const sprint6Prd = fs.readFileSync(path.join(root, "docs", "bmad", "15-sprint6-prd.md"), "utf8");
const promotionRules = fs.readFileSync(path.join(root, "docs", "bmad", "16-promotion-rules.md"), "utf8");

const checks = [
  ["v2.html uses versioned JS", /\/v2\.js\?v=/.test(html)],
  ["v2.html uses versioned CSS", /\/v2\.css\?v=/.test(html)],
  ["v2.html loads generated v2 course content", /\/course-content-v2\.js\?v=/.test(html)],
  ["v2.html loads generated v2 question bank", /\/question-bank-v2\.js\?v=/.test(html)],
  ["admin.html loads generated v2 course content", /\/course-content-v2\.js\?v=/.test(adminHtml)],
  ["admin.html loads generated v2 question bank", /\/question-bank-v2\.js\?v=/.test(adminHtml)],
  ["auth gate exists", /isAuthed:\s*false/.test(js) && /authView\(\)/.test(js)],
  ["login/register form exists", /auth-form-v2/.test(js) && /data-auth-mode/.test(js)],
  ["logout exists", /data-logout/.test(js)],
  ["question bank title exists", /bank-title/.test(js) && /bankTitle\(\)/.test(js)],
  ["question type switch exists", /data-question-type="scenario"/.test(js) && /data-question-type="course"/.test(js)],
  ["course filter exists", /data-bank-scope="course"/.test(js) && /data-course-filter/.test(js)],
  ["tag filter exists", /data-bank-scope="tag"/.test(js) && /data-tag-filter/.test(js)],
  ["real API auth exists", /\/api\/login/.test(js) && /\/api\/register/.test(js) && /\/api\/me/.test(js)],
  ["real progress API exists", /\/api\/progress/.test(js)],
  ["profile API exists", /\/api\/profile/.test(js) && /\/api\/profile/.test(server)],
  ["admin user detail API exists", /adminUserMatch/.test(server) && /getAdminUserDetail/.test(server)],
  ["admin overview route exists", /#\/overview/.test(adminJs) && /renderOverviewPage/.test(adminJs)],
  ["admin detail route exists", /#\/users\//.test(adminJs) && /renderDetailPage/.test(adminJs)],
  ["admin mobile cards exist", /admin-user-cards/.test(adminJs) && /admin-user-card/.test(adminCss)],
  ["question source is shown", /来源：/.test(js) && /question\.source/.test(js)],
  ["course manuals are shown", /lessonContentHtml/.test(js) && /学员手册/.test(js) && /深度拓展/.test(js)],
  ["course images are shown", /lessonImageHtml/.test(js) && /loading="lazy"/.test(js) && /missing-image/.test(js)],
  ["lesson precise question links exist", /data-lesson-bank/.test(js) && /selectedLessonCode/.test(js)],
  ["v3.1 entry exists", /v3\.1\.css/.test(v31Html) && /v3\.1\.js/.test(v31Html)],
  ["v3.1 non-image course hero exists", /v31-course-hero/.test(v31Js) && /courseGlyph/.test(v31Js) && /v31-course-hero__glyph/.test(v31Css)],
  ["v3.1 tactical today command exists", /v31-today-command/.test(v31Js) && /v31-today-command/.test(v31Css)],
  ["v3.1 camo motion background exists", /body::before/.test(v31Css) && /camo-drift/.test(v31Css) && /mask-image/.test(v31Css)],
  ["v3.1 lesson hero exists", /v31-lesson-hero/.test(v31Js) && /v31-lesson-hero/.test(v31Css)],
  ["v3.1 does not render course images", !/lessonImage/.test(v31Js) && !/lesson\.image\.src/.test(v31Js)],
  ["v3.1 data-source profile copy exists", /DATA SOURCE/.test(v31Js)],
  ["v3.1 public quiz helpers exist", /startQuizWithSkill/.test(v31Js) && /clearQuizFilters/.test(v31Js) && /startQuizWithSkill,\s*clearQuizFilters|clearQuizFilters,[\s\S]*startQuizWithSkill/.test(v31Js)],
  ["v3.1 profile ability grid exists", /profile-ability-grid/.test(v31Js) && /profile-ability-cell/.test(v31Css)],
  ["v3.2 entry exists", /v3\.2\.css/.test(v32Html) && /v3\.2\.js/.test(v32Html)],
  ["v3.2 does not render course images", !/lessonImage/.test(v32Js) && !/lesson\.image\.src/.test(v32Js) && !/assets\/course-v2/.test(v32Js)],
  ["v3.2 public quiz helpers exist", /quizExit/.test(v32Js) && /toggleMark/.test(v32Js) && /showAnswerSheet/.test(v32Js) && /jumpToQuestion/.test(v32Js) && /quizExit,[\s\S]*toggleMark,[\s\S]*showAnswerSheet,[\s\S]*jumpToQuestion/.test(v32Js)],
  ["v3.2 single quiz submit exists", /const results = session\.questions\.map/.test(v32Js) && /correct: isCorrect/.test(v32Js) && !/Also save individual question attempts/.test(v32Js)],
  ["v3.2 latest attempt map exists", /function latestAttemptMap/.test(v32Js) && /latestAttemptMap\(state\.progress\?\.questionAttempts/.test(v32Js)],
  ["v3.2 skill filter is first-class", /<span class="v32-filter-row__label">技能<\/span>/.test(v32Js) && !/\$\{state\.quizFilterWeek \? `\s*<div class="v32-filter-row">\s*<span class="v32-filter-row__label">技能<\/span>/.test(v32Js)],
  ["promotion schema exists", /CREATE TABLE IF NOT EXISTS level_history/.test(store) && /ensurePromotion/.test(store) && /calculatePromotion/.test(store)],
  ["promotion API payload exists", /promotion/.test(server) && /levelHistory/.test(store)],
  ["admin sprint4 read model exists", /adminStats/.test(adminJs) && /riskLevel/.test(adminJs) && /admin-profile-grid/.test(adminCss)],
  ["admin promotion detail exists", /admin-promotion/.test(adminJs) && /promotionSummary/.test(adminJs) && /levelHistory/.test(adminJs)],
  ["root redirects to v3.2", /url=\/v3\.2\.html/.test(indexHtml) && /href="\/v3\.2\.html"/.test(indexHtml)],
  ["README documents main entries", /v3\.2\.html/.test(readme) && /admin\.html/.test(readme) && /npm run start/.test(readme)],
  ["Sprint demo checklist is Chinese and V3.2", /五分钟演示路径/.test(sprint5Demo) && /http:\/\/127\.0\.0\.1:4317\/v3\.2\.html/.test(sprint5Demo)],
  ["Sprint 6-8 roadmap is Chinese", /Sprint 6：V3\.2 稳定化与自动晋级/.test(roadmap) && /Sprint 8：部署交付与版本治理/.test(roadmap)],
  ["deployment governance is Chinese and V3.2", /根路径 `\/` 跳转到 `\/v3\.2\.html`/.test(deployment) && /data\/app\.db|data\\app\.db/.test(deployment)],
  ["Sprint 6 PRD exists", /Sprint 6 PRD/.test(sprint6Prd) && /自动晋级/.test(sprint6Prd)],
  ["promotion rules doc exists", /自动晋级规则/.test(promotionRules) && /90%/.test(promotionRules)],
  ["admin remains read-only", !/\/api\/admin\/users[^"'`]*["'`][\s\S]{0,120}method:\s*["'`](POST|PUT|PATCH|DELETE)/.test(adminJs) && !/method:\s*["'`](POST|PUT|PATCH|DELETE)["'`][\s\S]{0,120}\/api\/admin\/users/.test(adminJs)],
  ["profile radar visual is not shipped", !/radar-placeholder/.test(js)],
  ["mobile touch CSS exists", /min-height:\s*(4[8-9]|[5-9][0-9])px/.test(css) && /chip-scroll/.test(css)]
];

const failures = checks.filter(([, passed]) => !passed);

if (failures.length) {
  console.error(failures.map(([name]) => `Missing Sprint 1 v2 requirement: ${name}`).join("\n"));
  process.exit(1);
}

console.log("V2 Sprint 1 check passed");
