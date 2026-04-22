const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "改版规格-课程内容.md");
const outputPath = path.join(root, "public", "course-content-v2.js");
const assetRoot = path.join(root, "public");

const PHASE_FOCUS = {
  p1: "统一基础动作、射击姿势、标靶操作、手语和基础队形。",
  p2: "单兵在拐角、入口、移动和考核压力下形成稳定判断。",
  p3: "班组协同、交替掩护、三三制、通讯报告和AAR复盘。",
  p4: "进攻、防御、建筑清搜和特殊任务SOP。",
  p5: "全队对抗、弱项强化、角色轮换和高强度综合演练。",
  p6: "外部对抗、弱点突破、独立指挥、极限压力和结业传承。"
};

const PHASE_SIGNAL = {
  p1: "共同语言",
  p2: "单兵稳定",
  p3: "小组节奏",
  p4: "流程稳定",
  p5: "压力验证",
  p6: "体系传承"
};

const SLUGS = {
  "W1-L1": "standing-shooting",
  "W1-L2": "kneeling-shooting",
  "W1-L3": "prone-shooting",
  "W2-L1": "three-position-drill",
  "W2-L2": "position-transition",
  "W3-L1": "horizontal-angle",
  "W3-L2": "vertical-angle",
  "W4-L1": "laser-target-system",
  "W4-L2": "accuracy-training",
  "W5-L1": "hand-signals-one",
  "W5-L2": "hand-signals-two",
  "W6-L1": "column-formation",
  "W6-L2": "wedge-line-formation",
  "W7-L1": "slicing-pie-corner",
  "W7-L2": "slicing-pie-drill",
  "W8-L1": "fatal-funnel",
  "W8-L2": "room-clearing",
  "W9-L1": "low-crawl",
  "W9-L2": "rush-movement",
  "W10-L1": "individual-exam",
  "W10-L2": "personal-aar",
  "W11-L1": "bounding-overwatch",
  "W11-L2": "team-bounding",
  "W12-L1": "triangle-tactics",
  "W12-L2": "triangle-tactics-drill",
  "W13-L1": "prowords",
  "W13-L2": "salute-report",
  "W14-L1": "team-scrimmage",
  "W14-L2": "aar-review",
  "W15-L1": "offense-sop",
  "W15-L2": "offense-sop-drill",
  "W16-L1": "defense-sop",
  "W16-L2": "defense-position",
  "W17-L1": "building-clearance",
  "W17-L2": "building-clearance-drill",
  "W18-L1": "special-mission",
  "W18-L2": "special-mission-drill",
  "W19-L1": "full-team-match",
  "W19-L2": "aar-review",
  "W20-L1": "integrated-scenario",
  "W20-L2": "weakness-training",
  "W21-L1": "adverse-condition",
  "W21-L2": "asymmetric-match",
  "W22-L1": "midterm-exam",
  "W22-L2": "personal-plan",
  "W23-L1": "mega-game",
  "W23-L2": "mega-game-aar",
  "W24-L1": "final-day-one",
  "W24-L2": "final-day-two",
  "W25-L1": "external-match",
  "W25-L2": "cross-team-learning",
  "W26-L1": "weakness-breakthrough",
  "W26-L2": "personal-style",
  "W27-L1": "leadership-l3",
  "W27-L2": "command-feedback",
  "W28-L1": "stress-test",
  "W28-L2": "stress-recovery",
  "W29-L1": "final-exercise",
  "W29-L2": "final-aar",
  "W30-L1": "graduation-exam",
  "W30-L2": "graduation-future"
};

function imageFor(code, title) {
  const slug = SLUGS[code] || "course";
  return {
    src: `/assets/course-v2/${code.toLowerCase()}-${slug}.svg`,
    alt: `${code} ${title}训练示意图`
  };
}

function codeFence(block, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`^####\\s+${escaped}\\s*\\r?\\n\\\`\\\`\\\`\\r?\\n([\\s\\S]*?)\\r?\\n\\\`\\\`\\\``, "m"));
  return match ? match[1].trim() : "";
}

function firstUsefulLine(text) {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line && !line.startsWith("【") && !line.startsWith("- [ ]") && !line.startsWith("```")) || "";
}

function checklist(text) {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^-\s+\[[ xX]\]/.test(line))
    .map(line => line.replace(/^-\s+\[[ xX]\]\s*/, ""));
}

function parseLessons(markdown) {
  const phaseMatches = Array.from(markdown.matchAll(/^##\s+阶段[^\n]+$/gm));
  const phases = [];
  const lessons = [];

  for (let index = 0; index < phaseMatches.length; index += 1) {
    const phaseHeader = phaseMatches[index][0].replace(/^##\s+/, "").trim();
    const phaseStart = phaseMatches[index].index;
    const phaseEnd = phaseMatches[index + 1]?.index ?? markdown.length;
    const phaseText = markdown.slice(phaseStart, phaseEnd);
    const phaseId = `p${index + 1}`;

    phases.push({
      id: phaseId,
      name: phaseHeader,
      weeks: "",
      focus: PHASE_FOCUS[phaseId] || "",
      signal: PHASE_SIGNAL[phaseId] || ""
    });

    const lessonMatches = Array.from(phaseText.matchAll(/^###\s+(W(\d+)-L(\d+))[：:]\s*(.+)$/gm));
    for (let lessonIndex = 0; lessonIndex < lessonMatches.length; lessonIndex += 1) {
      const current = lessonMatches[lessonIndex];
      const next = lessonMatches[lessonIndex + 1];
      const block = phaseText.slice(current.index, next?.index ?? phaseText.length);
      const code = current[1];
      const weekNumber = Number(current[2]);
      const lessonNumber = Number(current[3]);
      const title = current[4].trim();
      const lessonManuals = codeFence(block, "lessonManuals");
      const deepDives = codeFence(block, "deepDives");
      const goals = checklist(lessonManuals);

      lessons.push({
        id: `w${weekNumber}-l${lessonNumber}`,
        phaseId,
        weekNumber,
        lessonNumber,
        weekCode: `W${weekNumber}`,
        code,
        title,
        goal: firstUsefulLine(lessonManuals) || title,
        actionStandard: goals[0] || firstUsefulLine(lessonManuals) || title,
        commonError: "按手册完成动作后，用深度拓展复盘适用边界和常见误区。",
        drill: goals.length ? goals.join("；") : "完成本课手册要求，并记录一次可复盘训练结果。",
        lessonManuals,
        deepDives,
        image: imageFor(code, title)
      });
    }
  }

  return { phases, lessons };
}

function buildWeeks(phases, lessons) {
  const byWeek = new Map();

  for (const lesson of lessons) {
    if (!byWeek.has(lesson.weekCode)) byWeek.set(lesson.weekCode, []);
    byWeek.get(lesson.weekCode).push(lesson);
  }

  const weeks = Array.from(byWeek.entries())
    .sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))
    .map(([weekCode, weekLessons]) => {
      weekLessons.sort((a, b) => a.lessonNumber - b.lessonNumber);
      const first = weekLessons[0];
      const last = weekLessons[weekLessons.length - 1];
      const title = weekLessons.map(item => item.title.replace(/[（(].*?[）)]/g, "").trim()).join(" / ");
      return {
        id: `w${first.weekNumber}`,
        phaseId: first.phaseId,
        week: weekCode,
        title,
        objective: `${weekCode} 聚焦 ${title}，完成手册学习、动作训练和深度拓展理解。`,
        standard: weekLessons.map(item => `${item.code} ${item.actionStandard}`).join("；"),
        warning: last.deepDives ? firstUsefulLine(last.deepDives) : "完成训练后必须留下记录，便于后续题库和能力画像关联。",
        lessons: weekLessons
      };
    });

  for (const phase of phases) {
    const phaseWeeks = weeks.filter(week => week.phaseId === phase.id);
    if (phaseWeeks.length) {
      phase.weeks = `${phaseWeeks[0].week}-${phaseWeeks[phaseWeeks.length - 1].week}`;
    }
  }

  return weeks;
}

function validate(phases, weeks, lessons) {
  const errors = [];

  if (phases.length !== 6) errors.push(`expected 6 phases, got ${phases.length}`);
  if (weeks.length !== 30) errors.push(`expected 30 weeks, got ${weeks.length}`);
  if (lessons.length < 60) errors.push(`expected at least 60 lessons, got ${lessons.length}`);

  for (const lesson of lessons) {
    if (!lesson.lessonManuals) errors.push(`${lesson.code} missing lessonManuals`);
    if (!lesson.deepDives) errors.push(`${lesson.code} missing deepDives`);
    if (!lesson.image?.src || !lesson.image?.alt) errors.push(`${lesson.code} missing image`);
    if (lesson.image?.src) {
      const imagePath = path.join(assetRoot, lesson.image.src.replace(/^\//, ""));
      if (!fs.existsSync(imagePath) || fs.statSync(imagePath).size === 0) {
        errors.push(`${lesson.code} missing image asset ${lesson.image.src}`);
      }
    }
  }

  return errors;
}

const markdown = fs.readFileSync(sourcePath, "utf8");
const { phases, lessons } = parseLessons(markdown);
const weeks = buildWeeks(phases, lessons);
const errors = validate(phases, weeks, lessons);

if (errors.length) {
  console.error(errors.slice(0, 60).join("\n"));
  if (errors.length > 60) console.error(`...and ${errors.length - 60} more`);
  process.exit(1);
}

const output = `// Generated by scripts/import-course-content-v2.js from 改版规格-课程内容.md.
// Do not edit this file by hand; update the markdown source and re-run the importer.
(function () {
  const COURSE_CONTENT_V2 = ${JSON.stringify({ phases, weeks }, null, 2)};

  window.COURSE_CONTENT_V2 = COURSE_CONTENT_V2;
  if (window.TRAINING_DATA) {
    window.TRAINING_DATA.phases = COURSE_CONTENT_V2.phases;
    window.TRAINING_DATA.weeks = COURSE_CONTENT_V2.weeks;
  }
})();
`;

fs.writeFileSync(outputPath, output, "utf8");

console.log(JSON.stringify({
  output: path.relative(root, outputPath),
  phases: phases.length,
  weeks: weeks.length,
  lessons: lessons.length,
  weeksWithMoreThanTwoLessons: weeks.filter(week => week.lessons.length > 2).map(week => week.week),
  missingDeepDives: lessons.filter(lesson => !lesson.deepDives).map(lesson => lesson.code),
  images: lessons.filter(lesson => lesson.image?.src).length
}, null, 2));
