const app = document.querySelector("#prototype-app");

const phases = [
  { id: "p1", name: "地基建设", weeks: "W1-W6", ability: "统一语言", tone: "把呼号、频道、姿势和安全边界固定下来。" },
  { id: "p2", name: "单兵成型", weeks: "W7-W10", ability: "单兵稳定", tone: "处理掩体、角度、移动和入口，不把失误转嫁给班组。" },
  { id: "p3", name: "班组磨合", weeks: "W11-W14", ability: "小组节奏", tone: "让多人动作按口令形成节奏，报告服务下一步判断。" },
  { id: "p4", name: "战术深化", weeks: "W15-W18", ability: "SOP稳定", tone: "用固定流程降低压力下跳步和混乱。" },
  { id: "p5", name: "综合演练", weeks: "W19-W24", ability: "压力验证", tone: "用全队对抗检验训练，不把输赢当成唯一结果。" },
  { id: "p6", name: "终局打磨", weeks: "W25-W30", ability: "体系传承", tone: "让骨干在教官退后时仍能计划、执行、复盘。" }
];

const weeks = [
  ["w1", "p1", "W1", "开训建制与通讯呼号", "共同语言", "已完成", ["训练纪律", "呼号/频道/角色表", "30秒班长简报"]],
  ["w2", "p1", "W2", "三姿射击基础", "姿势判断", "已完成", ["立姿/跪姿/卧姿", "姿势转换", "正面三靶"]],
  ["w3", "p1", "W3", "实战姿势与方向安全", "安全方向", "已完成", ["待命/抵腰/贴墙", "高低位", "方向安全检查"]],
  ["w4", "p1", "W4", "激光标靶与精度控制", "命中判定", "进行中", ["标靶系统", "呼吸/扳机", "环境因素排查"]],
  ["w5", "p1", "W5", "手语与静默通讯", "低噪协同", "待训", ["核心手语", "无线电静默", "传递准确性"]],
  ["w6", "p1", "W6", "基础队形与阶段验收", "队形责任", "待训", ["Column/Wedge", "Line/Echelon", "阶段验收"]],
  ["w7", "p2", "W7", "Slicing the Pie", "切派边界", "待训", ["切派原理", "拐角处理", "暴露面复盘"]],
  ["w8", "p2", "W8", "CQB入口与Fatal Funnel", "入口风险", "待训", ["入口识别", "方向分工", "堵门复训"]],
  ["w9", "p2", "W9", "战术移动与Rush", "短暴露窗口", "待训", ["低姿匍匐", "3秒冲刺", "急停识别"]],
  ["w10", "p2", "W10", "单兵综合穿越", "路线闭环", "待训", ["路线选择", "掩体-移动循环", "单兵AAR"]],
  ["w11", "p3", "W11", "Bounding Overwatch", "交替掩护", "待训", ["双组职责", "就位报告", "三轮交替"]],
  ["w12", "p3", "W12", "三三制班组战术", "三人单元", "待训", ["三人角色", "队形边界", "狭窄地形变通"]],
  ["w13", "p3", "W13", "SALUTE与ACE", "报告闭环", "待训", ["Prowords", "SALUTE限时报告", "ACE状态轮询"]],
  ["w14", "p3", "W14", "班组对抗与AAR", "复盘文化", "待训", ["观察员记录", "四步AAR", "阶段三验收"]],
  ["w15", "p4", "W15", "进攻SOP", "五步进攻", "待训", ["侦察/规划", "部署/执行", "巩固重组"]],
  ["w16", "p4", "W16", "防御SOP", "阵地组织", "待训", ["阵地选址", "射界预警", "反冲击预案"]],
  ["w17", "p4", "W17", "建筑清搜SOP", "逐区确认", "待训", ["外围封锁", "逐区处理", "汇合巩固"]],
  ["w18", "p4", "W18", "特殊任务SOP", "目标优先级", "待训", ["夺旗", "护送/VIP", "脱离接触"]],
  ["w19", "p5", "W19", "全队综合对抗I", "多科融合", "待训", ["多科目融合", "评分维度", "深度AAR"]],
  ["w20", "p5", "W20", "针对性补训", "短板闭环", "待训", ["短板分类", "根因分析", "复测闭环"]],
  ["w21", "p5", "W21", "编组融合对抗", "编组选择", "待训", ["三三制/火力组", "编组切换", "弱侧补位"]],
  ["w22", "p5", "W22", "角色轮换与指挥链", "替补机制", "待训", ["班长轮换", "替补机制", "指挥权确认"]],
  ["w23", "p5", "W23", "高强度Mega Game", "体能配速", "待训", ["能量管理", "中段经济节奏", "后段决胜"]],
  ["w24", "p5", "W24", "阶段性正式考核", "标准判定", "待训", ["静态+班组", "对抗判定", "学期总结"]],
  ["w25", "p6", "W25", "外部对抗准备", "跨队学习", "待训", ["对手情报", "备用方案", "跨队AAR"]],
  ["w26", "p6", "W26", "弱点突破", "个人补训", "待训", ["个人短板", "小组短板", "复测记录"]],
  ["w27", "p6", "W27", "L3独立指挥", "指挥承担", "待训", ["指挥判断", "分工授权", "指挥反馈"]],
  ["w28", "p6", "W28", "极限压力测试", "压力保持", "待训", ["疲劳下通讯", "复杂条件", "心理建设"]],
  ["w29", "p6", "W29", "终极综合演练", "全流程", "待训", ["全流程计划", "连续任务", "最终调整"]],
  ["w30", "p6", "W30", "结业考核与传承", "带教传承", "待训", ["结业考核", "个人风格", "下一周期带教"]]
].map(([id, phaseId, week, title, ability, status, lessons]) => ({ id, phaseId, week, title, ability, status, lessons }));

const questions = [
  {
    id: "q1",
    title: "切派时机",
    type: "情景判断",
    tags: ["切派", "CQB", "决策"],
    scenario: "你需要通过一个L型走廊拐角。你知道前方房间内可能有敌方人员，但不确定人数和位置。队友在你身后3米处准备跟进。",
    options: ["快速探头看一眼就冲过去", "非常缓慢地每次只切5度", "按标准Slicing the Pie逐步扫描", "不确认情况先使用投掷物"],
    answer: 2,
    analysis: "正确重点不是“慢”，而是用稳定节奏逐步获得信息。过快会暴露，过慢会让队伍失去节奏。"
  },
  {
    id: "q2",
    title: "三三制应用边界",
    type: "情景判断",
    tags: ["三三制", "队形", "小队指挥"],
    scenario: "三人小组需要在宽约1.2米的狭窄走廊推进。走廊两端情况不明，组长提议使用标准三角阵型前进。",
    options: ["严格执行三角阵型", "改用纵队Column", "改用楔形Wedge", "一人前行两人随意掩护"],
    answer: 1,
    analysis: "三三制需要展开空间。知道什么时候不用某项技术，是掌握这项技术的关键。"
  },
  {
    id: "q3",
    title: "AAR文化",
    type: "情景判断",
    tags: ["AAR", "复盘", "团队文化"],
    scenario: "对抗结束后队伍输了。队长说主要输在运气和判罚，大家都想附和。",
    options: ["附和队长", "保持沉默", "礼貌指出可控因素和改进动作", "跳过复盘"],
    answer: 2,
    analysis: "AAR不是找借口，也不是找人背锅。它要把失败转成下一次可训练的动作。"
  }
];

const profileTags = [
  { tag: "通讯", correct: 7, total: 12, note: "报告容易漏位置" },
  { tag: "小队指挥", correct: 10, total: 14, note: "能做取舍" },
  { tag: "CQB", correct: 5, total: 11, note: "入口停顿风险高" },
  { tag: "AAR", correct: 8, total: 9, note: "复盘意识稳定" }
];

const state = {
  tab: "today",
  selectedWeek: "w7",
  selectedQuestion: "q1",
  answered: false
};

function render() {
  app.innerHTML = `
    <div class="proto-shell">
      <header class="proto-top">
        <div>
          <span>NINGBO YONGSHI / PROTOTYPE</span>
          <h1>${pageTitle()}</h1>
        </div>
        <button class="plain-btn" data-tab="today">回到今日</button>
      </header>
      <main class="proto-view">${viewHtml()}</main>
      <nav class="proto-nav">
        ${nav("today", "今日")}
        ${nav("course", "课程")}
        ${nav("bank", "题库")}
        ${nav("profile", "档案")}
        ${nav("coach", "教官")}
      </nav>
    </div>
  `;
  bind();
}

function pageTitle() {
  return { today: "今天该干什么", course: "30周训练路线", bank: "情景判断训练", profile: "个人训练档案", coach: "教官视角" }[state.tab];
}

function nav(id, label) {
  return `<button class="${state.tab === id ? "active" : ""}" data-tab="${id}">${label}</button>`;
}

function viewHtml() {
  if (state.tab === "today") return todayHtml();
  if (state.tab === "course") return courseHtml();
  if (state.tab === "bank") return bankHtml();
  if (state.tab === "profile") return profileHtml();
  if (state.tab === "coach") return coachHtml();
  return weekDetailHtml(findWeek(state.selectedWeek));
}

function todayHtml() {
  const week = findWeek("w4");
  return `
    <section class="today-hero">
      <div class="stage-line">阶段一 / 地基建设 / 第4周</div>
      <h2>今天先完成：${week.title}</h2>
      <p>目标不是多看内容，而是把标靶系统、击发动作和环境排查串成一次可复测训练。</p>
      <div class="next-actions">
        <button data-open-week="w4">查看本周训练</button>
        <button data-tab="bank">做1道情景判断</button>
      </div>
    </section>
    <section class="focus-card">
      <span>今日训练任务</span>
      <h3>15分钟标靶校准 + 10分钟精度射击 + 5分钟记录误差</h3>
      <ul>
        <li>先确认发射器、感应器、电量和光照。</li>
        <li>不要把“打不中”直接归因于人，先排除设备与环境。</li>
        <li>训练结束只记录三个事实：距离、命中、误差原因。</li>
      </ul>
    </section>
    <section class="week-progress">
      ${week.lessons.map((lesson, index) => `
        <article class="${index < 1 ? "done" : index === 1 ? "current" : ""}">
          <b>${index < 1 ? "完成" : index === 1 ? "当前" : "待做"}</b>
          <strong>L${index + 1} ${lesson}</strong>
          <span>${index === 0 ? "标靶系统操作已过" : index === 1 ? "正在做呼吸/扳机训练" : "训练后再做环境因素排查"}</span>
        </article>
      `).join("")}
    </section>
    <section class="soft-card">
      <div>
        <span>接近解锁</span>
        <h3>通讯节点</h3>
        <p>还差3道通讯/SALUTE/ACE正确题。成就只是提示你：这类能力正在成型。</p>
      </div>
      <div class="progress-ring">7/10</div>
    </section>
  `;
}

function courseHtml() {
  return `
    <section class="course-intro">
      <h2>训练路线不是教材目录</h2>
      <p>学员先看到阶段目标，再进入周任务。周内L1/L2/L3用于解释训练顺序，而不是把首页变成密密麻麻的课程表。</p>
    </section>
    <div class="phase-road">
      ${phases.map(phase => `
        <section class="phase-section">
          <div class="phase-copy">
            <span>${phase.weeks}</span>
            <h3>${phase.name}</h3>
            <p>${phase.tone}</p>
          </div>
          <div class="week-rail">
            ${weeks.filter(w => w.phaseId === phase.id).map(weekCard).join("")}
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

function weekCard(week) {
  return `
    <button class="week-tile ${week.status === "已完成" ? "done" : week.status === "进行中" ? "current" : ""}" data-open-week="${week.id}">
      <span>${week.week}</span>
      <strong>${week.title}</strong>
      <em>${week.ability}</em>
    </button>
  `;
}

function weekDetailHtml(week) {
  const phase = phases.find(p => p.id === week.phaseId);
  return `
    <button class="back-btn" data-tab="course">返回课程路线</button>
    <section class="week-detail">
      <span>${phase.name} / ${week.week}</span>
      <h2>${week.title}</h2>
      <p>本周关键能力：${week.ability}。学员要知道自己为什么练、练到什么标准、错误出现时怎么复训。</p>
    </section>
    <section class="lesson-flow">
      ${week.lessons.map((lesson, index) => `
        <article>
          <b>L${index + 1}</b>
          <h3>${lesson}</h3>
          <p>${index === 0 ? "先建立概念和适用边界。" : index === 1 ? "再把动作放进小组或时间压力。" : "最后用观察记录和AAR收口。"}</p>
          <small>${index === 0 ? "错误警示：只背术语。" : index === 1 ? "错误警示：动作完成但没有报告。" : "错误警示：复盘只谈输赢。"}</small>
        </article>
      `).join("")}
    </section>
    <section class="related-card">
      <span>关联题</span>
      <h3>${week.id === "w7" ? "切派时机" : week.id === "w13" ? "SALUTE报告完整性" : "AAR文化"}</h3>
      <p>题目不是课后作业，而是让学员确认自己能不能在场景里做判断。</p>
      <button data-tab="bank">进入题库训练</button>
    </section>
  `;
}

function bankHtml() {
  const question = questions.find(q => q.id === state.selectedQuestion) || questions[0];
  return `
    <section class="bank-layout">
      <aside class="question-list">
        <span>题型优先级</span>
        <h2>先做情景判断</h2>
        <p>课程考核用于查漏，标签训练用于补短板；原型先把“场景题”体验打磨好。</p>
        ${questions.map(q => `<button class="${q.id === question.id ? "active" : ""}" data-question="${q.id}">${q.title}<em>${q.tags.join(" / ")}</em></button>`).join("")}
      </aside>
      <article class="scenario-card">
        <span>${question.type}</span>
        <h2>${question.title}</h2>
        <p>${question.scenario}</p>
        <div class="choice-stack">
          ${question.options.map((option, index) => `
            <button class="${state.answered && index === question.answer ? "correct" : ""}" data-answer="${index}">
              <b>${String.fromCharCode(65 + index)}</b>
              <span>${option}</span>
            </button>
          `).join("")}
        </div>
        ${state.answered ? `
          <div class="answer-panel">
            <strong>为什么是 ${String.fromCharCode(65 + question.answer)}</strong>
            <p>${question.analysis}</p>
            <div>${question.tags.map(tag => `<span>${tag}</span>`).join("")}</div>
          </div>
        ` : `<div class="hint-panel">点一个选项，原型会展示解析。重点是让学员看懂“为什么”。</div>`}
      </article>
    </section>
  `;
}

function profileHtml() {
  return `
    <section class="profile-hero">
      <div>
        <span>当前训练身份</span>
        <h2>L1 正式队员 / 偏通讯短板</h2>
        <p>档案页不应该是奖章墙。它应该告诉学员：你现在最该补什么。</p>
      </div>
      <strong>72%</strong>
    </section>
    <section class="tag-board">
      ${profileTags.map(item => `
        <article>
          <div><b>${item.tag}</b><span>${item.correct}/${item.total}</span></div>
          <i style="width:${Math.round(item.correct / item.total * 100)}%"></i>
          <p>${item.note}</p>
        </article>
      `).join("")}
    </section>
    <section class="achievement-strip">
      <article class="unlocked"><span>已解锁</span><h3>复盘者</h3><p>AAR类题目正确率稳定。</p></article>
      <article><span>接近</span><h3>通讯节点</h3><p>还差3题，建议做SALUTE/ACE专项。</p></article>
      <article><span>未解锁</span><h3>CQB入门者</h3><p>入口和Fatal Funnel判断仍需训练。</p></article>
    </section>
    <section class="recent-list">
      <h3>最近训练记录</h3>
      <p>W4 标靶校准完成，记录2条误差原因。</p>
      <p>情景题“切派时机”答错，已查看解析。</p>
    </section>
  `;
}

function coachHtml() {
  const rows = [
    ["一班-01", "W4", "通讯", "7/12", "通讯节点 70%"],
    ["一班-02", "W7", "CQB", "5/11", "CQB入门者 50%"],
    ["一班-03", "W11", "小队指挥", "10/14", "指挥官 已解锁"]
  ];
  return `
    <section class="coach-hero">
      <h2>教官视角先回答：这周该补什么？</h2>
      <p>不是做复杂后台，而是帮教官快速看到队伍共同短板、个体短板和下一次训练安排。</p>
    </section>
    <section class="coach-grid">
      <article><span>班级共同短板</span><strong>通讯闭环</strong><p>SALUTE报告漏位置，ACE报告不完整。</p></article>
      <article><span>建议补训</span><strong>15分钟限时报告</strong><p>每人完成3轮：观察、报告、复述确认。</p></article>
      <article><span>题库表现</span><strong>67%</strong><p>场景题高于课程题，说明会判断但基础术语不稳。</p></article>
    </section>
    <section class="coach-table">
      <div class="table-head"><b>队员</b><b>进度</b><b>薄弱标签</b><b>标签正确</b><b>成就</b></div>
      ${rows.map(row => `<div>${row.map(cell => `<span>${cell}</span>`).join("")}</div>`).join("")}
    </section>
  `;
}

function findWeek(id) {
  return weeks.find(w => w.id === id) || weeks[0];
}

function bind() {
  document.querySelectorAll("[data-tab]").forEach(button => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      state.answered = false;
      render();
    });
  });
  document.querySelectorAll("[data-open-week]").forEach(button => {
    button.addEventListener("click", () => {
      state.selectedWeek = button.dataset.openWeek;
      state.tab = "week";
      state.answered = false;
      render();
    });
  });
  document.querySelectorAll("[data-question]").forEach(button => {
    button.addEventListener("click", () => {
      state.selectedQuestion = button.dataset.question;
      state.answered = false;
      render();
    });
  });
  document.querySelectorAll("[data-answer]").forEach(button => {
    button.addEventListener("click", () => {
      state.answered = true;
      render();
    });
  });
}

render();
