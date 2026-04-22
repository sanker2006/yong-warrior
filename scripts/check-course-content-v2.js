const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const generatedPath = path.join(root, "public", "course-content-v2.js");
const publicRoot = path.join(root, "public");

if (!fs.existsSync(generatedPath)) {
  console.error("Missing generated course content: public/course-content-v2.js");
  process.exit(1);
}

const sandbox = {
  window: {
    TRAINING_DATA: {}
  }
};

vm.runInNewContext(fs.readFileSync(generatedPath, "utf8"), sandbox, {
  filename: generatedPath
});

const content = sandbox.window.COURSE_CONTENT_V2;
const errors = [];

if (!content || !Array.isArray(content.phases) || !Array.isArray(content.weeks)) {
  errors.push("window.COURSE_CONTENT_V2 must expose phases and weeks arrays");
} else {
  const lessons = content.weeks.flatMap(week => week.lessons || []);
  const codes = new Set();

  if (content.phases.length !== 6) errors.push(`expected 6 phases, got ${content.phases.length}`);
  if (content.weeks.length !== 30) errors.push(`expected 30 weeks, got ${content.weeks.length}`);
  if (lessons.length < 60) errors.push(`expected at least 60 lessons, got ${lessons.length}`);

  for (const week of content.weeks) {
    if (!week.id || !week.week || !week.title || !week.objective) {
      errors.push(`${week.week || "unknown week"} missing core fields`);
    }
    if (!Array.isArray(week.lessons) || week.lessons.length < 2) {
      errors.push(`${week.week} needs at least two lessons`);
    }
  }

  for (const lesson of lessons) {
    if (codes.has(lesson.code)) errors.push(`duplicate lesson code: ${lesson.code}`);
    codes.add(lesson.code);

    for (const fieldName of ["id", "code", "title", "goal", "actionStandard", "lessonManuals"]) {
      if (!lesson[fieldName]) errors.push(`${lesson.code || "unknown lesson"} missing ${fieldName}`);
    }
    if (!lesson.deepDives) errors.push(`${lesson.code || "unknown lesson"} missing deepDives`);
    if (!lesson.image?.src || !lesson.image?.alt) {
      errors.push(`${lesson.code || "unknown lesson"} missing image metadata`);
    } else {
      const imagePath = path.join(publicRoot, lesson.image.src.replace(/^\//, ""));
      if (!fs.existsSync(imagePath) || fs.statSync(imagePath).size === 0) {
        errors.push(`${lesson.code} image asset missing or empty: ${lesson.image.src}`);
      }
    }
  }
}

if (errors.length) {
  console.error(errors.slice(0, 50).join("\n"));
  if (errors.length > 50) console.error(`...and ${errors.length - 50} more`);
  process.exit(1);
}

const lessons = content.weeks.flatMap(week => week.lessons || []);

console.log(JSON.stringify({
  status: "course content v2 check passed",
  phases: content.phases.length,
  weeks: content.weeks.length,
  lessons: lessons.length,
  missingDeepDives: lessons.filter(lesson => !lesson.deepDives).length,
  images: lessons.filter(lesson => lesson.image?.src).length
}, null, 2));
