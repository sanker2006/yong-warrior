const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const trainingDataPath = path.join(root, "public", "training-data.js");
const code = fs.readFileSync(trainingDataPath, "utf8");
const context = { window: {} };

vm.createContext(context);
vm.runInContext(`${code}\nwindow.__TRAINING_DATA__ = window.TRAINING_DATA;`, context);

const data = context.window.__TRAINING_DATA__;
const errors = [];

if (!data) {
  errors.push("window.TRAINING_DATA is missing");
} else {
  if (!Array.isArray(data.phases) || data.phases.length !== 6) {
    errors.push("Expected exactly 6 phases");
  }
  if (!Array.isArray(data.weeks) || data.weeks.length !== 30) {
    errors.push("Expected exactly 30 weeks");
  }
  if (!Array.isArray(data.questionBank)) {
    errors.push("questionBank must be an array");
  }
}

if (data?.questionBank) {
  const ids = new Set();
  for (const question of data.questionBank) {
    if (!question.id) errors.push("Question is missing id");
    if (ids.has(question.id)) errors.push(`Duplicate question id: ${question.id}`);
    ids.add(question.id);

    if (!["scenario", "course"].includes(question.type)) {
      errors.push(`Unsupported Sprint 1 question type for ${question.id}: ${question.type}`);
    }
    if (!Array.isArray(question.options) || question.options.length < 2) {
      errors.push(`Question ${question.id} must have at least 2 options`);
    }
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.options.length) {
      errors.push(`Question ${question.id} has invalid answer index`);
    }
    if (!Array.isArray(question.tags) || question.tags.length === 0) {
      errors.push(`Question ${question.id} must include tags for Sprint 2 profile calculations`);
    }
    for (const field of ["title", "scenario", "analysis", "source"]) {
      if (!String(question[field] || "").trim()) {
        errors.push(`Question ${question.id} is missing ${field}`);
      }
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Data check passed");
