const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const generatedPath = path.join(root, "public", "question-bank-v2.js");

if (!fs.existsSync(generatedPath)) {
  console.error("Missing generated question bank: public/question-bank-v2.js");
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

const questions = sandbox.window.QUESTION_BANK_V2;
const errors = [];

if (!Array.isArray(questions)) {
  errors.push("window.QUESTION_BANK_V2 must be an array");
} else {
  const ids = new Set();

  for (const question of questions) {
    if (!question.id) errors.push("question missing id");
    if (ids.has(question.id)) errors.push(`duplicate id: ${question.id}`);
    ids.add(question.id);

    for (const fieldName of ["type", "title", "question", "scenario", "lessonMapping", "skillClassification", "timeEstimate", "knowledgePoint", "source"]) {
      if (!question[fieldName]) errors.push(`${question.id || "unknown"} missing ${fieldName}`);
    }

    if (!Array.isArray(question.options) || question.options.length < 2) {
      errors.push(`${question.id} needs at least two options`);
    }

    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.options.length) {
      errors.push(`${question.id} answer index is invalid`);
    }
  }

  const lessonMappings = new Set(questions.map(item => item.lessonMapping).filter(Boolean));
  const skillClassifications = new Set(questions.map(item => item.skillClassification).filter(Boolean));

  if (questions.length < 120) errors.push(`expected at least 120 v2 questions, got ${questions.length}`);
  if (lessonMappings.size < 40) errors.push(`expected broad lesson coverage, got ${lessonMappings.size}`);
  if (skillClassifications.size < 6) errors.push(`expected at least 6 skill domains, got ${skillClassifications.size}`);
}

if (errors.length) {
  console.error(errors.slice(0, 50).join("\n"));
  if (errors.length > 50) console.error(`...and ${errors.length - 50} more`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: "question bank v2 check passed",
  questions: questions.length,
  lessonMappings: new Set(questions.map(item => item.lessonMapping).filter(Boolean)).size,
  skillClassifications: new Set(questions.map(item => item.skillClassification).filter(Boolean)).size
}, null, 2));
