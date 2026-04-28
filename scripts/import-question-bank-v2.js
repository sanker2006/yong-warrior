const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "改版规格-题库-v2.md");
const outputPath = path.join(root, "public", "question-bank-v2.js");

const TYPE_MAP = new Map([
  ["概念题", "course"],
  ["理论题", "course"],
  ["实操题", "course"],
  ["分析题", "course"],
  ["情景判断题", "scenario"],
  ["情景题", "scenario"]
]);

function field(block, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`^\\*\\*${escaped}\\*\\*[：:]\\s*(.+)$`, "m"));
  return match ? match[1].trim() : "";
}

function blockField(block, label, untilLabels) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const until = untilLabels
    .map(item => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const match = block.match(new RegExp(`^\\*\\*${escaped}\\*\\*[：:]\\s*\\n([\\s\\S]*?)(?=^\\*\\*(?:${until})\\*\\*[：:]|^---\\s*$|^####\\s+Q\\d+|(?![\\s\\S]))`, "m"));
  return match ? match[1].trim() : "";
}

function parseOptions(block) {
  const raw = blockField(block, "选项", ["正确答案"]);
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^[A-Z][.、]\s*(.+)$/);
      return stripAnswerCue(match ? match[1].trim() : line);
    });
}

function stripAnswerCue(value) {
  return String(value || "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .trim();
}

function normalizeSkillDomain(value, id) {
  const questionNumber = Number(String(id || "").replace(/\D/g, ""));
  const mappedDomain = domainByQuestionNumber(questionNumber);
  if (mappedDomain) return mappedDomain;

  const domain = String(value || "").trim();
  if (domain === "队形阵型") return "班组协同";
  if (domain === "特殊环境适应") return "对抗综合";
  return domain;
}

function inSet(value, items) {
  return items.includes(value);
}

function domainByQuestionNumber(value) {
  if (inSet(value, [12, 21, 23, 24, 25, 28, 140, 155, 156, 157])) return "装备安全与规则";
  if ((value >= 1 && value <= 22) || inSet(value, [26, 27, 137, 139])) return "射击姿态与精度";
  if ((value >= 29 && value <= 34) || (value >= 69 && value <= 72) || inSet(value, [143, 144, 158])) return "通讯指挥";
  if ((value >= 35 && value <= 42) || (value >= 60 && value <= 68) || value === 138) return "班组协同";
  if ((value >= 43 && value <= 51) || (value >= 85 && value <= 88) || inSet(value, [141, 147])) return "CQB与建筑清搜";
  if ((value >= 52 && value <= 55) || inSet(value, [89, 90, 117, 131, 142, 148])) return "战术移动";
  if ((value >= 77 && value <= 84) || inSet(value, [91, 113, 146])) return "SOP任务流程";
  if (
    (value >= 104 && value <= 110) ||
    (value >= 127 && value <= 129) ||
    (value >= 132 && value <= 134) ||
    inSet(value, [112, 145, 152, 153, 154])
  ) return "领导力与心理素质";
  if (
    (value >= 56 && value <= 59) ||
    (value >= 93 && value <= 97) ||
    (value >= 114 && value <= 116) ||
    (value >= 124 && value <= 126) ||
    inSet(value, [75, 76, 103, 111, 121, 150, 159, 160])
  ) return "训练复盘与成长";
  if (
    (value >= 98 && value <= 102) ||
    (value >= 118 && value <= 120) ||
    inSet(value, [73, 74, 92, 122, 123, 130, 135, 136, 149, 151])
  ) return "对抗策略与决策";
  return "";
}

function normalizeDifficulty(question) {
  const questionNumber = Number(String(question.id || "").replace(/\D/g, ""));
  const seed = [
    question.id,
    question.type,
    question.typeLabel,
    question.timeEstimate,
    question.knowledgePoint,
    question.source
  ].join(" ");

  let score = 0;
  if (/分析|情景|判断/.test(seed)) score += 1;
  if (/90s|120s/.test(seed)) score += 1;
  if (/综合|决策|压力|危机|指挥|复盘|高级|应急|多重|复杂|推演/.test(seed)) score += 1;
  if (/概念|基础|组成|速查|核心规则/.test(seed)) score -= 1;
  if (/30s|20s/.test(seed)) score -= 1;

  if (/分析/.test(question.typeLabel)) return 3;
  if (/情景|判断/.test(question.typeLabel)) return score >= 2 || questionNumber % 2 === 0 ? 3 : 2;
  if (/实操/.test(question.typeLabel)) return score >= 2 ? 3 : 2;
  if (/理论/.test(question.typeLabel)) return score >= 2 ? 3 : 2;
  if (/概念/.test(question.typeLabel)) return score >= 2 ? 2 : 1;

  if (score <= -1) return 1;
  if (score >= 1) return 3;
  return 2;
}

function parseDifficulty(value) {
  const stars = value.match(/⭐/g);
  if (stars?.length) return stars.length;
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : 1;
}

function parseAnswer(value) {
  const match = value.match(/[A-Z]/i);
  if (!match) return -1;
  return match[0].toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
}

function normalizeQuestion(block) {
  const header = block.match(/^####\s+Q(\d+)[：:]\s*(.+)$/m);
  if (!header) return null;

  const id = `q${header[1].padStart(3, "0")}`;
  const typeLabel = field(block, "类型");
  const question = field(block, "题目");
  const skillClassification = normalizeSkillDomain(field(block, "技能分类"), id);
  const knowledgePoint = field(block, "知识点");
  const lessonMapping = field(block, "课程映射");
  const source = field(block, "理论来源");
  const options = parseOptions(block);
  const answer = parseAnswer(field(block, "正确答案"));

  return {
    id,
    type: TYPE_MAP.get(typeLabel) || "course",
    typeLabel,
    title: header[2].trim(),
    question,
    scenario: question,
    options,
    answer,
    analysis: blockField(block, "解析", ["理论来源"]),
    lessonMapping,
    skillClassification,
    difficulty: normalizeDifficulty({
      id,
      type: TYPE_MAP.get(typeLabel) || "course",
      typeLabel,
      timeEstimate: field(block, "预估用时"),
      knowledgePoint,
      source
    }),
    timeEstimate: field(block, "预估用时"),
    knowledgePoint,
    source,
    tags: [skillClassification].filter(Boolean)
  };
}

function parseMarkdown(markdown) {
  return markdown
    .split(/\r?\n(?=####\s+Q\d+[：:])/)
    .map(block => block.trim())
    .filter(block => /^####\s+Q\d+[：:]/.test(block))
    .map(normalizeQuestion)
    .filter(Boolean);
}

function validate(questions) {
  const errors = [];
  const seen = new Set();

  for (const question of questions) {
    if (seen.has(question.id)) errors.push(`duplicate id: ${question.id}`);
    seen.add(question.id);

    for (const fieldName of ["question", "lessonMapping", "skillClassification", "timeEstimate", "knowledgePoint", "source"]) {
      if (!question[fieldName]) errors.push(`${question.id} missing ${fieldName}`);
    }

    if (!Array.isArray(question.options) || question.options.length < 2) {
      errors.push(`${question.id} has fewer than 2 options`);
    }

    if (question.answer < 0 || question.answer >= question.options.length) {
      errors.push(`${question.id} has invalid answer index`);
    }
  }

  return errors;
}

const markdown = fs.readFileSync(sourcePath, "utf8");
const questions = parseMarkdown(markdown);
const errors = validate(questions);

if (errors.length) {
  console.error(errors.slice(0, 40).join("\n"));
  if (errors.length > 40) console.error(`...and ${errors.length - 40} more`);
  process.exit(1);
}

const output = `// Generated by scripts/import-question-bank-v2.js from 改版规格-题库-v2.md.
// Do not edit this file by hand; update the markdown source and re-run the importer.
(function () {
  const QUESTION_BANK_V2 = ${JSON.stringify(questions, null, 2)};

  window.QUESTION_BANK_V2 = QUESTION_BANK_V2;
  if (window.TRAINING_DATA) {
    window.TRAINING_DATA.questionBank = QUESTION_BANK_V2;
  }
})();
`;

fs.writeFileSync(outputPath, output, "utf8");

const lessons = new Set(questions.map(question => question.lessonMapping).filter(Boolean));
const skills = new Set(questions.map(question => question.skillClassification).filter(Boolean));

console.log(JSON.stringify({
  output: path.relative(root, outputPath),
  questions: questions.length,
  lessonMappings: lessons.size,
  skillClassifications: skills.size
}, null, 2));
