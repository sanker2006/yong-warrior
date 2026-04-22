const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "v2.html"), "utf8");
const js = fs.readFileSync(path.join(root, "public", "v2.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "v2.css"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "public", "admin.html"), "utf8");
const adminJs = fs.readFileSync(path.join(root, "public", "admin.js"), "utf8");
const adminCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const v31Html = fs.readFileSync(path.join(root, "public", "v3.1.html"), "utf8");
const v31Js = fs.readFileSync(path.join(root, "public", "v3.1.js"), "utf8");
const v31Css = fs.readFileSync(path.join(root, "public", "v3.1.css"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

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
  ["v3.1 image-first course hero exists", /v31-course-hero/.test(v31Js) && /v31-course-hero/.test(v31Css)],
  ["v3.1 lesson hero exists", /v31-lesson-hero/.test(v31Js) && /v31-lesson-hero/.test(v31Css)],
  ["v3.1 data-source profile copy exists", /DATA SOURCE/.test(v31Js)],
  ["profile radar visual is not shipped", !/radar-placeholder/.test(js)],
  ["mobile touch CSS exists", /min-height:\s*(4[8-9]|[5-9][0-9])px/.test(css) && /chip-scroll/.test(css)]
];

const failures = checks.filter(([, passed]) => !passed);

if (failures.length) {
  console.error(failures.map(([name]) => `Missing Sprint 1 v2 requirement: ${name}`).join("\n"));
  process.exit(1);
}

console.log("V2 Sprint 1 check passed");
