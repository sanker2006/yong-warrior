const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const dataPath = path.join(root, "public", "course-content-v2.js");
const assetDir = path.join(root, "public", "assets", "course-v2");

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

function loadCourseData() {
  const sandbox = { window: { TRAINING_DATA: {} } };
  vm.runInNewContext(fs.readFileSync(dataPath, "utf8"), sandbox, { filename: dataPath });
  return sandbox.window.COURSE_CONTENT_V2;
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function filenameFor(lesson) {
  const slug = SLUGS[lesson.code] || lesson.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "course";
  return `${lesson.code.toLowerCase()}-${slug}.svg`;
}

function palette(lesson) {
  const hue = (lesson.weekNumber * 37 + lesson.lessonNumber * 19) % 360;
  return {
    glow: `hsl(${hue} 28% 42%)`,
    dark: `hsl(${hue} 18% 9%)`,
    mid: `hsl(${hue} 16% 18%)`
  };
}

function svgFor(lesson, index) {
  const colors = palette(lesson);
  const title = `${lesson.code} ${lesson.title}`;
  const silhouettes = Array.from({ length: 4 }, (_, i) => {
    const x = 345 + i * 92 + (index % 3) * 8;
    const y = 318 + (i % 2) * 22;
    return `
      <g opacity="${0.72 - i * 0.08}" transform="translate(${x} ${y})">
        <circle cx="0" cy="-80" r="18" fill="#1c211d"/>
        <path d="M-22 -58 L22 -58 L32 72 L-30 72 Z" fill="#151a16"/>
        <path d="M-36 -32 L76 -54 L82 -42 L-30 -18 Z" fill="#222922"/>
        <path d="M-18 72 L-42 152 L-16 152 L4 72 Z" fill="#0d100e"/>
        <path d="M18 72 L34 152 L60 152 L36 72 Z" fill="#0d100e"/>
        <path d="M78 -53 L138 -59" stroke="#d8b84e" stroke-width="3" opacity=".42"/>
      </g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-label="${escapeXml(title)} 训练示意图">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#050605"/>
      <stop offset=".44" stop-color="${colors.dark}"/>
      <stop offset="1" stop-color="#11160f"/>
    </linearGradient>
    <radialGradient id="lamp" cx=".73" cy=".2" r=".64">
      <stop offset="0" stop-color="${colors.glow}" stop-opacity=".6"/>
      <stop offset=".38" stop-color="#d8b84e" stop-opacity=".13"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="table" tableValues="0 .12"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <rect width="1600" height="900" fill="url(#lamp)"/>
  <path d="M0 690 C280 650 408 720 642 684 C934 640 1160 640 1600 702 L1600 900 L0 900 Z" fill="#080a08"/>
  <path d="M0 690 C260 648 486 720 734 682 C1010 640 1200 650 1600 704" fill="none" stroke="#d8b84e" stroke-opacity=".22" stroke-width="2"/>
  <g opacity=".32">
    ${Array.from({ length: 22 }, (_, i) => `<path d="M${i * 78} 0 L${i * 78 - 430} 900" stroke="#9aa7a0" stroke-opacity=".06"/>`).join("")}
    ${Array.from({ length: 10 }, (_, i) => `<path d="M0 ${i * 94} H1600" stroke="#9aa7a0" stroke-opacity=".04"/>`).join("")}
  </g>
  <g transform="translate(88 110)">
    <rect x="0" y="0" width="520" height="170" fill="#0b0d0b" fill-opacity=".62" stroke="#9aa7a0" stroke-opacity=".22"/>
    <path d="M0 0 H520 L490 28 H0 Z" fill="#d8b84e" opacity=".18"/>
    <text x="30" y="58" fill="#d8b84e" font-family="Bahnschrift, Arial, sans-serif" font-size="34" font-weight="800">${escapeXml(lesson.code)}</text>
    <text x="30" y="110" fill="#eef0e9" font-family="Microsoft YaHei, Arial, sans-serif" font-size="42" font-weight="800">${escapeXml(lesson.title.slice(0, 18))}</text>
    <text x="30" y="145" fill="#9aa7a0" font-family="Microsoft YaHei, Arial, sans-serif" font-size="22">NON-LETHAL LASER TRAINING / DOCUMENTARY COVER</text>
  </g>
  ${silhouettes}
  <g transform="translate(1030 250)" opacity=".55">
    <rect x="0" y="0" width="380" height="240" fill="${colors.mid}" stroke="#9aa7a0" stroke-opacity=".2"/>
    <path d="M0 80 H380 M0 160 H380 M126 0 V240 M252 0 V240" stroke="#d8b84e" stroke-opacity=".16"/>
  </g>
  <rect width="1600" height="900" fill="#000" opacity=".14"/>
  <rect width="1600" height="900" filter="url(#grain)" opacity=".65"/>
</svg>
`;
}

fs.mkdirSync(assetDir, { recursive: true });

const data = loadCourseData();
const lessons = data.weeks.flatMap(week => week.lessons);
const files = [];

lessons.forEach((lesson, index) => {
  const filename = filenameFor(lesson);
  const outputPath = path.join(assetDir, filename);
  fs.writeFileSync(outputPath, svgFor(lesson, index), "utf8");
  files.push(`/assets/course-v2/${filename}`);
});

console.log(JSON.stringify({
  output: path.relative(root, assetDir),
  assets: files.length
}, null, 2));
