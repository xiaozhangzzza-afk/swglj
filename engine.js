(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Bureau = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const RES = {
    items: { name: '失物', unit: '件', stage: 0, text: '世界遗漏的小东西。可拆出线索。' },
    clues: { name: '线索', unit: '缕', stage: 0, text: '失物上的来历。用于研究、造墨与追忆。' },
    ink: { name: '档案墨', unit: '瓶', stage: 0, text: '把来历写成档案。研究和记忆加工都需要它。' },
    memory: { name: '记忆', unit: '段', stage: 1, text: '被追回的过去。储量越高，现实负担越重。' },
    anchors: { name: '现实锚', unit: '枚', stage: 2, text: '将记忆固定为现实。提高稳定度，也能修建高阶设施。' },
    fragments: { name: '异常碎片', unit: '片', stage: 2, text: '调查中的稀有发现。用于理解异常与封存。' }
  };
  const BUILDINGS = {
    inbox: { name: '街角收件箱', stage: 0, cost: { items: 10, clues: 4 }, text: '失物 +0.32/秒。无需员工，城市会自行投递。' },
    shelf: { name: '分拣货架', stage: 0, cost: { items: 14, clues: 8 }, text: '失物容量 +80，线索 +60，档案墨 +40。' },
    office: { name: '借来的办公室', tech: 'catalog', cost: { items: 18, clues: 12, ink: 4 }, text: '员工席位 +3。员工入职后需要分配岗位。' },
    press: { name: '来历印刷机', tech: 'imprint', cost: { items: 24, clues: 16, ink: 10 }, text: '每秒消耗 0.24 线索，生产 0.16 档案墨。' },
    studio: { name: '追忆室', tech: 'recall', cost: { items: 28, ink: 16, memory: 6 }, text: '每秒消耗 0.18 线索、0.05 墨，追回 0.10 记忆。' },
    vault: { name: '记忆保险柜', tech: 'recall', cost: { items: 22, ink: 12, memory: 4 }, text: '记忆容量 +36，现实锚容量 +30；减轻满库压力。' },
    ward: { name: '现实校准器', tech: 'binding', cost: { clues: 30, ink: 20, anchors: 6 }, text: '稳定度目标 +8；自动把记忆与墨转成现实锚。' },
    observatory: { name: '空白街道观测站', tech: 'mapping', cost: { items: 40, ink: 22, memory: 12 }, text: '调查速度 +15%，最多叠加到 +60%。' },
    machine: { name: '全城遗忘机', tech: 'municipal', max: 1, cost: { memory: 60, ink: 100, anchors: 35, fragments: 6 }, text: '完成本章。可主动开启下一轮，保留传承与见闻。' }
  };
  const TECH = {
    catalog: { name: '给无主之物编号', cost: { clues: 12 }, deps: [], text: '建立档案制度，开放员工、加工链与研究。' },
    imprint: { name: '印下物品的来历', cost: { clues: 22, ink: 8 }, deps: ['catalog'], text: '开放印刷机与造墨员，让档案墨持续生产。' },
    recall: { name: '追忆术', cost: { clues: 30, ink: 15 }, deps: ['imprint'], text: '开启第一章：过去有了重量。开放记忆加工。' },
    names: { name: '员工姓名登记', cost: { clues: 32, memory: 10 }, deps: ['recall'], text: '生产效率 +15%。姓名登记让员工更安心。' },
    mapping: { name: '绘制不存在的街道', cost: { clues: 40, ink: 20, memory: 12 }, deps: ['recall'], text: '开启第二章与调查。至少派一名调查员外出。' },
    binding: { name: '现实装订法', cost: { clues: 45, ink: 24, memory: 18 }, deps: ['mapping'], text: '开放现实锚生产与现实校准器。' },
    charter: { name: '管理局章程', cost: { clues: 50, memory: 16, anchors: 4 }, deps: ['binding'], text: '开放三种社会方针：保全、寻奇和共益。' },
    logistics: { name: '折叠投递路线', cost: { clues: 65, ink: 30, anchors: 8 }, deps: ['binding'], text: '收件员效率 +35%，调查时间缩短 20%。' },
    deep: { name: '读懂异常的语法', cost: { memory: 30, ink: 36, anchors: 12, fragments: 2 }, deps: ['binding'], text: '开启市政档案馆，调查保底周期缩短。' },
    municipal: { name: '城市其实也是失物', cost: { memory: 45, ink: 60, anchors: 22, fragments: 4 }, deps: ['deep', 'charter'], text: '开启第三章。世界能够被整理，也能够被忘记。' }
  };
  const JOBS = {
    runner: { name: '收件员', tech: 'catalog', text: '收取失物 +0.50/秒', inputs: {}, outputs: { items: 0.50 } },
    sorter: { name: '分拣员', tech: 'catalog', text: '0.65 失物 → 0.42 线索/秒', inputs: { items: 0.65 }, outputs: { clues: 0.42 } },
    printer: { name: '造墨员', tech: 'imprint', text: '0.30 线索 → 0.22 墨/秒', inputs: { clues: 0.30 }, outputs: { ink: 0.22 } },
    archivist: { name: '追忆员', tech: 'recall', text: '0.26 线索 +0.08 墨 → 0.18 记忆/秒', inputs: { clues: 0.26, ink: 0.08 }, outputs: { memory: 0.18 } },
    binder: { name: '装订员', tech: 'binding', text: '0.13 记忆 +0.09 墨 → 0.10 锚/秒', inputs: { memory: 0.13, ink: 0.09 }, outputs: { anchors: 0.10 } },
    detective: { name: '调查员', tech: 'mapping', text: '外出时不生产；留局时 0.06 墨 → 0.10 线索/秒', inputs: { ink: 0.06 }, outputs: { clues: 0.10 } }
  };
  const POLICIES = {
    preserve: { name: '保全', text: '加工投入减少 15%，调查稀有率为基础值。', input: 0.85, output: 1, luck: 0, trust: 0.006 },
    curious: { name: '寻奇', text: '稀有发现概率 +15 个百分点，稳定目标 −8。', input: 1, output: 1.08, luck: 0.15, trust: -0.003 },
    mutual: { name: '共益', text: '生产 −8%，员工信任更快恢复，稳定目标 +6。', input: 1, output: 0.92, luck: 0, trust: 0.025 }
  };
  const ARTIFACTS = {
    umbrella: { name: '永远湿着的伞', text: '失物生产 +20%。伞下的雨不属于今天。' },
    ticket: { name: '开往昨日的车票', text: '调查速度 +20%。票面日期会向后退。' },
    name: { name: '没人用过的姓名', text: '员工效率 +12%。念出来时，多了一声回答。' },
    clock: { name: '缺一刻的钟', text: '线索与墨生产 +15%。它每天省下十五分钟。' },
    city: { name: '掌心里的城市', text: '记忆容量 +30，稳定目标 +6。灯火在手心醒着。' },
    stamp: { name: '准予存在之印', text: '现实锚生产 +25%。批准生效前，切勿眨眼。' }
  };
  const SITES = {
    station: { name: '雨伞失物处', subtitle: '你知道这个站台，地图却坚持这里是一条河。', time: 32, cost: { items: 8, ink: 4 }, tech: 'mapping', risk: 0.12, rewards: { clues: [10, 20], ink: [3, 8], fragments: [1, 2] }, artifacts: ['umbrella', 'ticket'] },
    tuesday: { name: '失踪的星期二', subtitle: '走进去的人，会在星期三收到自己的来信。', time: 50, cost: { ink: 8, memory: 4 }, tech: 'binding', risk: 0.22, rewards: { memory: [7, 16], anchors: [3, 7], fragments: [1, 3] }, artifacts: ['clock', 'name'] },
    city: { name: '被删去的市政档案馆', subtitle: '卷宗记录了这座城市不曾发生的诞生。', time: 68, cost: { ink: 12, anchors: 4 }, tech: 'deep', risk: 0.30, rewards: { memory: [12, 22], anchors: [7, 13], fragments: [2, 4] }, artifacts: ['city', 'stamp'] }
  };
  const EVENTS = {
    visitor: { title: '一位没有影子的失主', body: '她说自己来取一把伞。登记簿上写的却是：一场下了十九年的雨。', choices: [{ name: '归还她的雨', text: '信任 +6，获得 6 线索', reward: { clues: 6 }, trust: 6 }, { name: '暂留作研究', text: '获得 5 墨；稳定度 −4', reward: { ink: 5 }, stability: -4 }] },
    box: { title: '箱子里面又是箱子', body: '最后一个纸箱没有底。有人在里面敲了三下，像在请求签收。', choices: [{ name: '逐层登记', text: '获得 14 失物、5 线索', reward: { items: 14, clues: 5 } }, { name: '拆开最后一层', text: '65% 获得 10 墨，否则稳定度 −7', chance: 0.65, reward: { ink: 10 }, failStability: -7 }] },
    salary: { title: '员工请求领取自己的名字', body: '工资单上空了一格。有人问：我们是在找回失物，还是慢慢变成失物？', stage: 1, choices: [{ name: '为每个人重写姓名', text: '花费 6 墨，信任 +12', cost: { ink: 6 }, trust: 12 }, { name: '组织一次休息', text: '信任 +5，稳定度 +3', trust: 5, stability: 3 }] },
    noise: { title: '三楼传来海浪声', body: '这栋楼只有两层。楼梯尽头，有人摆好了去海边的行李。', stage: 2, choices: [{ name: '贴上封条', text: '获得 3 现实锚，稳定度 +4', reward: { anchors: 3 }, stability: 4 }, { name: '沿着潮声走', text: '55% 获得 2 碎片，否则失去 6 线索', chance: 0.55, reward: { fragments: 2 }, failLoss: { clues: 6 } }] },
    birthday: { title: '一封寄给明天的生日卡', body: '收件人已经离世，但卡片上的蜡烛还温热。每个人都说记得她。', stage: 1, choices: [{ name: '保存这份记忆', text: '获得 7 记忆，信任 +3', reward: { memory: 7 }, trust: 3 }, { name: '让它成为公共档案', text: '获得 10 线索，稳定度 +4', reward: { clues: 10 }, stability: 4 }] }
  };
  const OMENS = {
    rain: { name: '长雨', text: '这一轮失物生产 +12%。城市总有东西落在雨里。' },
    quiet: { name: '静默', text: '这一轮记忆容量 +16。空白的柜子比平时更深。' },
    dawn: { name: '迟来的清晨', text: '这一轮稳定目标 +6。至少今天，城市愿意醒来。' }
  };
  const NAMES = ['林折', '许未闻', '陈雨停', '周拾一', '陆空白', '孟小满', '沈昨日', '唐照夜', '于无声', '白知返', '何页', '叶留灯'];
  const LOST = ['少了一齿的钥匙', '写着陌生地址的信', '一只左手手套', '没有照片的相框', '淋过晴天的雨伞', '温着的空茶杯', '没人说过的道歉', '丢失的第十三月'];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const LEVELS = [0, 24, 60, 110, 175, 260, 360, 480, 620, 800, 1100, 1450, 1850, 2300, 2800];
  const LEVEL_REWARDS = ['见习：进入异常现场', '直觉：错误推理的稳定损失由 2 降至 1', '记录：线索生产 +10%，员工席位 +1', '辨识：深层证物与镜后夹层开放', '定心：稳定目标 +8', '勘察：短程调查收益 +20%', '留痕：记忆容量 +20', '寻奇：稀有收件率 +5 个百分点；第零分钟开放', '传承：轮回额外获得 1 回声', '执印：所有生产 +10%', '扩容：失物、线索、墨容量各 +60', '阅密：无名市民档案开放', '人事：员工席位额外 +3', '复原：记忆容量额外 +40', '守城：所有生产再 +15%'];
  function level(s) { return LEVELS.reduce((n, threshold, i) => s.career.xp >= threshold ? i + 1 : n, 1); }
  function gainXP(s, n) { const before = level(s); s.career.xp += n; if (level(s) > before) log(s, '调查员升至 ' + level(s) + ' 级。' + LEVEL_REWARDS[level(s) - 1], 'rare'); }
  function fresh(seed = Date.now(), legacy = null) {
    const s = { version: VERSION, rng: (seed >>> 0) || 123456789, time: 0, era: legacy ? legacy.era + 1 : 1,
      r: { items: 6, clues: 0, ink: 2, memory: 0, anchors: 0, fragments: 0 }, buildings: {}, tech: [], jobs: {}, workers: [],
      stability: 90, trust: 70, policy: 'preserve', artifacts: [], seen: legacy ? [...legacy.seen] : [], visits: {}, pity: 0,
      expedition: null, event: null, nextEvent: 65, cooldown: 0, logs: [], stats: { searches: 0, expeditions: 0, rare: 0, seconds: 0 },
      legacy: legacy ? { echoes: legacy.echoes, archive: legacy.archive, industry: legacy.industry, humanity: legacy.humanity } : { echoes: 0, archive: 0, industry: 0, humanity: 0 },
      omen: 'rain', paused: false, lastSaved: Date.now(), ended: false, career: { xp: legacy && legacy.xp || 0 }, ui: { introduced: !!legacy, notebookOpened: false, walkthrough: false } };
    Object.keys(BUILDINGS).forEach(k => s.buildings[k] = 0);
    Object.keys(JOBS).forEach(k => s.jobs[k] = 0);
    s.omen = Object.keys(OMENS)[Math.floor(random(s) * 3)];
    log(s, '你接过一枚印章。门牌写着「失物管理局」。背面写着：请勿寻找自己。', 'story');
    if (legacy) log(s, '全城遗忘之后，门牌仍在。你带着 ' + s.legacy.echoes + ' 点回声回到收件桌。', 'story');
    return s;
  }
  function random(s) { let x = s.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s.rng = x >>> 0; return s.rng / 4294967296; }
  function integer(s, a, b) { return a + Math.floor(random(s) * (b - a + 1)); }
  function log(s, message, type = 'normal') { s.logs.unshift({ time: Math.floor(s.time), message, type }); s.logs.length = Math.min(s.logs.length, 60); }
  function has(s, id) { return s.tech.includes(id); }
  function stage(s) { return has(s, 'municipal') ? 3 : has(s, 'mapping') ? 2 : has(s, 'recall') ? 1 : 0; }
  function caps(s) { const bonus = level(s) >= 11 ? 60 : 0; return { items: 60 + s.buildings.shelf * 80 + bonus, clues: 50 + s.buildings.shelf * 60 + bonus, ink: 35 + s.buildings.shelf * 40 + bonus, memory: 24 + s.buildings.vault * 36 + s.legacy.archive * 12 + (s.omen === 'quiet' ? 16 : 0) + (s.artifacts.includes('city') ? 30 : 0) + (level(s) >= 7 ? 20 : 0) + (level(s) >= 14 ? 40 : 0), anchors: 20 + s.buildings.vault * 30, fragments: 30 }; }
  function add(s, rewards) { const c = caps(s); for (const k of Object.keys(rewards || {})) if (k in RES) s.r[k] = clamp(s.r[k] + rewards[k], 0, c[k]); }
  function affordable(s, cost) { return Object.entries(cost).every(([k, v]) => s.r[k] + 1e-8 >= v); }
  function pay(s, cost) { if (!affordable(s, cost)) return false; for (const [k, v] of Object.entries(cost)) s.r[k] = Math.max(0, s.r[k] - v); return true; }
  function cost(s, id) { const d = BUILDINGS[id]; return Object.fromEntries(Object.entries(d.cost).map(([k, v]) => [k, Math.ceil(v * Math.pow(1.48, s.buildings[id]))])); }
  function seats(s) { return s.buildings.office * 3 + (has(s, 'municipal') ? 3 : 0) + (level(s) >= 3 ? 1 : 0) + (level(s) >= 13 ? 3 : 0); }
  function assigned(s) { return Object.values(s.jobs).reduce((a, b) => a + b, 0); }
  function hireCost(s) { return { clues: 12 + s.workers.length * 5, ink: 5 + s.workers.length * 2 }; }
  function available(s, d) { return (!d.tech || has(s, d.tech)) && (d.stage === undefined || stage(s) >= d.stage); }
  function target(s) { return clamp(98 - 32 * s.r.memory / caps(s).memory - s.workers.length * 0.7 + Math.min(s.r.anchors * 0.65, 18) + s.buildings.ward * 8 + (s.policy === 'curious' ? -8 : s.policy === 'mutual' ? 6 : 0) + (s.omen === 'dawn' ? 6 : 0) + (s.artifacts.includes('city') ? 6 : 0) + s.legacy.humanity * 3 + (level(s) >= 5 ? 8 : 0), 24, 100); }
  function multiplier(s, resource) {
    let m = (1 + s.legacy.echoes * 0.035 + s.legacy.industry * 0.08) * (0.72 + s.trust * 0.004) * (s.stability < 35 ? 0.65 : 1) * POLICIES[s.policy].output;
    if (has(s, 'names')) m *= 1.15;
    if (level(s) >= 3 && resource === 'clues') m *= 1.1;
    if (level(s) >= 10) m *= 1.1;
    if (level(s) >= 15) m *= 1.15;
    if (s.artifacts.includes('name')) m *= 1.12;
    if (resource === 'items') { if (s.omen === 'rain') m *= 1.12; if (s.artifacts.includes('umbrella')) m *= 1.2; }
    if ((resource === 'clues' || resource === 'ink') && s.artifacts.includes('clock')) m *= 1.15;
    if (resource === 'anchors' && s.artifacts.includes('stamp')) m *= 1.25;
    return m;
  }
  function producers(s) {
    const out = [{ count: 1, inputs: {}, outputs: { items: 0.12 + s.buildings.inbox * 0.32 }, label: '收件箱' }];
    if (has(s, 'catalog')) out.push({ count: 1, inputs: { items: 0.16 }, outputs: { clues: 0.09 }, label: '基础分拣' });
    for (const [id, job] of Object.entries(JOBS)) {
      if (id === 'detective' && s.expedition) continue;
      if (has(s, job.tech)) out.push({ count: s.jobs[id], inputs: job.inputs, outputs: { ...job.outputs, ...(id === 'runner' && has(s, 'logistics') ? { items: 0.675 } : {}) }, label: job.name });
    }
    out.push({ count: s.buildings.press, inputs: { clues: 0.24 }, outputs: { ink: 0.16 }, label: '印刷机' });
    out.push({ count: s.buildings.studio, inputs: { clues: 0.18, ink: 0.05 }, outputs: { memory: 0.10 }, label: '追忆室' });
    out.push({ count: s.buildings.ward, inputs: { memory: 0.09, ink: 0.07 }, outputs: { anchors: 0.07 }, label: '校准器' });
    return out;
  }
  // Each producer scales to its available inputs AND output space. A full cabinet does not burn inputs.
  function produce(s, dt) {
    const c = caps(s), inputM = has(s, 'charter') ? POLICIES[s.policy].input : 1;
    for (const p of producers(s)) {
      if (!p.count) continue;
      let f = 1;
      for (const [k, v] of Object.entries(p.inputs)) f = Math.min(f, s.r[k] / (v * p.count * dt * inputM));
      for (const [k, v] of Object.entries(p.outputs)) f = Math.min(f, (c[k] - s.r[k]) / (v * p.count * dt * multiplier(s, k)));
      f = clamp(f, 0, 1);
      for (const [k, v] of Object.entries(p.inputs)) s.r[k] = Math.max(0, s.r[k] - v * p.count * dt * inputM * f);
      for (const [k, v] of Object.entries(p.outputs)) s.r[k] = Math.min(c[k], s.r[k] + v * p.count * dt * multiplier(s, k) * f);
    }
  }
  function rates(s) { const copy = JSON.parse(JSON.stringify(s)), before = { ...copy.r }; produce(copy, 1); return Object.fromEntries(Object.keys(RES).map(k => [k, copy.r[k] - before[k]])); }
  function artifact(s, candidates) {
    const id = candidates[integer(s, 0, candidates.length - 1)];
    if (s.artifacts.includes(id)) { add(s, { fragments: 2 }); log(s, '重复藏品「' + ARTIFACTS[id].name + '」化成了 2 片异常碎片。', 'rare'); }
    else { s.artifacts.push(id); if (!s.seen.includes(id)) s.seen.push(id); s.stats.rare++; log(s, '获得异常藏品「' + ARTIFACTS[id].name + '」。' + ARTIFACTS[id].text, 'rare'); }
  }
  function completeExpedition(s) {
    const e = s.expedition; s.expedition = null;
    const site = SITES[e.site];
    const first = !s.visits[e.site]; s.visits[e.site] = (s.visits[e.site] || 0) + 1; s.stats.expeditions++;
    const mishap = random(s) < Math.max(0, site.risk - (e.mode === 'careful' ? 0.1 : 0) - (e.party - 1) * 0.04);
    const rewards = {}; for (const [k, range] of Object.entries(site.rewards)) rewards[k] = integer(s, ...range) * (e.mode === 'bold' ? 1.35 : 1) * (mishap ? 0.55 : 1) * (level(s) >= 6 ? 1.2 : 1);
    gainXP(s, first ? 12 : 4);
    rewards.fragments = Math.max(1, Math.floor(rewards.fragments)); add(s, rewards);
    log(s, site.name + '调查结束。' + Object.entries(rewards).map(([k, v]) => RES[k].name + ' +' + Math.floor(v * 10) / 10).join('，') + (mishap ? '。遭遇异常干扰，收益减半；稳定度 −5。' : '。调查员平安归来。'), mishap ? 'warning' : 'normal');
    if (mishap) s.stability = Math.max(0, s.stability - 5);
    const guarantee = has(s, 'deep') ? 3 : 4;
    const chance = 0.32 + POLICIES[s.policy].luck + (e.mode === 'bold' ? 0.15 : 0) + s.pity * 0.1;
    if (first || s.pity >= guarantee - 1 || random(s) < chance) { artifact(s, site.artifacts); s.pity = 0; }
    else { s.pity++; log(s, '没有发现藏品。下次稀有发现概率增加，最多 ' + guarantee + ' 次调查必获一次。'); }
    if (first) log(s, e.site === 'station' ? '站台公告写着：失主与失物，有时只是登记顺序不同。' : e.site === 'tuesday' ? '你发现这一天不是消失了，而是被人保存起来了。' : '最古老的卷宗里，城市被归类为「等待失主认领」。', 'story');
  }
  function advance(s, seconds) {
    if (s.paused) return s;
    let left = clamp(Number(seconds) || 0, 0, 7200);
    while (left > 1e-8) {
      const dt = Math.min(1, left); left -= dt; s.time += dt; s.stats.seconds += dt; s.cooldown = Math.max(0, s.cooldown - dt);
      produce(s, dt); s.stability += (target(s) - s.stability) * 0.016 * dt;
      s.trust = clamp(s.trust + (has(s, 'charter') ? POLICIES[s.policy].trust : 0.006) * dt + (has(s, 'names') ? 0.005 * dt : 0), 0, 100);
      if (s.expedition) { s.expedition.remaining -= dt; if (s.expedition.remaining <= 0) completeExpedition(s); }
      // At most one pending decision. Offline simulation never chooses on the player's behalf.
      if (!s.event && s.time >= s.nextEvent) {
        const ids = Object.keys(EVENTS).filter(k => (EVENTS[k].stage || 0) <= stage(s));
        s.event = ids[integer(s, 0, ids.length - 1)]; s.nextEvent = s.time + integer(s, 75, 130);
        log(s, EVENTS[s.event].title, 'event');
      }
    }
    return s;
  }
  function goal(s) {
    if (!has(s, 'catalog')) return { title: '先给失物编号', text: '外出拾取失物，分拣出 12 缕线索，再研究「给无主之物编号」。', tab: 'work' };
    if (!has(s, 'imprint')) return { title: '让管理局自己运转', text: '修建收件箱、办公室，招聘并分配员工。研究印刷技术建立造墨链。', tab: 'staff' };
    if (!has(s, 'recall')) return { title: '追回物品背后的过去', text: '积累 30 线索与 15 墨，研究追忆术。', tab: 'research' };
    if (!has(s, 'mapping')) return { title: '地图少了一条街', text: '加工记忆，研究不存在的街道，寻找第一件异常藏品。', tab: 'research' };
    if (!has(s, 'binding')) return { title: '给现实一个固定点', text: '派调查员去站台；研究装订法，把记忆转为现实锚。', tab: 'explore' };
    if (!has(s, 'deep')) return { title: '理解失踪的星期二', text: '调查获取异常碎片，建立现实锚生产，再读懂异常的语法。', tab: 'explore' };
    if (!has(s, 'municipal')) return { title: '找到城市的失主', text: '完善管理局章程，调查市政档案馆，研究城市的来历。', tab: 'research' };
    if (!s.buildings.machine) return { title: '准备一次全城遗忘', text: '至少 2 个保险柜与 2 个货架能容纳材料。建造遗忘机，完成这一轮。', tab: 'work' };
    return { title: '这一页已经写完', text: '你可以继续经营，也可以选择一份永久传承，主动开启下一轮。', tab: 'legacy' };
  }
  function act(s, type, payload) {
    const fail = message => ({ ok: false, message });
    if (s.paused && type !== 'pause') return fail('管理局已暂停，请先继续时间。');
    if (type === 'search') {
      if (s.cooldown > 0) return fail('稍等，上一件失物还没签收。');
      const roll = random(s); s.cooldown = 1.4; s.stats.searches++;
      const name = LOST[integer(s, 0, LOST.length - 1)];
      if (roll < 0.015 && stage(s) >= 2) { add(s, { items: 2, fragments: 1 }); log(s, '罕见收件：「' + name + '」裂开一道不属于这里的光。碎片 +1。', 'rare'); }
      else if (roll < 0.075 + (level(s) >= 8 ? 0.05 : 0)) { add(s, { items: 3, ink: 2, ...(stage(s) >= 1 ? { memory: 1 } : { clues: 2 }) }); log(s, '稀有收件：「' + name + '」。失物 +3、墨 +2，另附一段来历。', 'rare'); }
      else if (roll < 0.3) { add(s, { items: 3, clues: 1 }); log(s, '拾到「' + name + '」。失物 +3，线索 +1。'); }
      else { add(s, { items: 3 }); if (s.stats.searches % 4 === 1) log(s, '拾到「' + name + '」。失物 +3。'); }
    } else if (type === 'craft') {
      const recipes = { sort: { cost: { items: 6 }, reward: { clues: 4 } }, ink: { cost: { clues: 6 }, reward: { ink: 3 } }, memory: { tech: 'recall', cost: { clues: 6, ink: 2 }, reward: { memory: 4 } }, anchor: { tech: 'binding', cost: { memory: 5, ink: 3 }, reward: { anchors: 4 } } };
      const recipe = Object.hasOwn(recipes, payload) ? recipes[payload] : null; if (!recipe || (recipe.tech && !has(s, recipe.tech))) return fail('尚未掌握这项加工。');
      if (Object.entries(recipe.reward).some(([k, v]) => caps(s)[k] - s.r[k] < v - 1e-8)) return fail('成品储位不足，请先扩建或消耗库存。');
      if (!pay(s, recipe.cost)) return fail('材料还不够。'); add(s, recipe.reward);
    } else if (type === 'build') {
      const d = Object.hasOwn(BUILDINGS, payload) ? BUILDINGS[payload] : null; if (!d || !available(s, d)) return fail('这项设施还未解锁。');
      if (s.buildings[payload] >= (d.max || 30)) return fail('已达到设施上限。');
      if (!pay(s, cost(s, payload))) return fail('建造材料不足。');
      s.buildings[payload]++; log(s, '建成「' + d.name + '」。');
      if (payload === 'machine') { s.ended = true; log(s, '城市的所有门牌，同时翻到了背面。那里写着你的名字。第一章完成：你可以继续经营，或选择传承，发动全城遗忘。', 'story'); }
    } else if (type === 'research') {
      const d = Object.hasOwn(TECH, payload) ? TECH[payload] : null; if (!d || has(s, payload) || !d.deps.every(k => has(s, k))) return fail('研究的前置条件还未满足。');
      if (!pay(s, d.cost)) return fail('研究材料不足。'); s.tech.push(payload); gainXP(s, 6); log(s, '研究完成：「' + d.name + '」。' + d.text, 'story');
    } else if (type === 'hire') {
      if (!has(s, 'catalog') || s.workers.length >= seats(s)) return fail('没有空余员工席位，请先建办公室。');
      if (!pay(s, hireCost(s))) return fail('入职登记材料不足。');
      const idx = s.workers.length; s.workers.push(NAMES[idx % NAMES.length] + (idx >= NAMES.length ? '·' + (idx + 1) : '')); log(s, '「' + s.workers[idx] + '」入职了。请为新员工分配岗位。');
    } else if (type === 'job') {
      const { id, delta } = payload || {}; if (!JOBS[id] || !has(s, JOBS[id].tech) || ![1, -1].includes(delta)) return fail('无效岗位调整。');
      if (id === 'detective' && s.expedition) return fail('调查员正在外出，归来后才能调整。');
      if (delta > 0 && assigned(s) >= s.workers.length) return fail('没有待命员工；可先从其他岗位调出一人。');
      if (delta < 0 && s.jobs[id] === 0) return fail('这个岗位已经无人。'); s.jobs[id] += delta;
    } else if (type === 'policy') {
      if (!has(s, 'charter') || !POLICIES[payload]) return fail('先研究管理局章程。'); s.policy = payload; log(s, '方针改为「' + POLICIES[payload].name + '」。');
    } else if (type === 'explore') {
      const { site: id, mode } = payload || {}, d = SITES[id];
      if (!d || !has(s, d.tech) || !['careful', 'bold'].includes(mode)) return fail('尚不能开展这项调查。');
      if (s.expedition) return fail('上一支队伍尚未归来。'); if (s.jobs.detective < 1) return fail('至少安排一名调查员。');
      if (!pay(s, d.cost)) return fail('调查准备材料不足。');
      const speed = 1 + Math.min(0.6, s.buildings.observatory * 0.15) + (has(s, 'logistics') ? 0.25 : 0) + (s.artifacts.includes('ticket') ? 0.2 : 0);
      const duration = d.time / speed * (mode === 'careful' ? 1.15 : 0.9);
      s.expedition = { site: id, mode, party: s.jobs.detective, duration, remaining: duration }; log(s, s.jobs.detective + ' 名调查员出发前往「' + d.name + '」。');
    } else if (type === 'event') {
      const d = EVENTS[s.event], choice = d && d.choices[payload]; if (!choice) return fail('这个事件已经结束。');
      if (choice.cost && !pay(s, choice.cost)) return fail('处理这件事所需材料不足，可选另一个方案。');
      const won = choice.chance === undefined || random(s) < choice.chance;
      if (won) { add(s, choice.reward); s.trust = clamp(s.trust + (choice.trust || 0), 0, 100); s.stability = clamp(s.stability + (choice.stability || 0), 0, 100); }
      else { for (const [k, v] of Object.entries(choice.failLoss || {})) s.r[k] = Math.max(0, s.r[k] - v); s.stability = clamp(s.stability + (choice.failStability || 0), 0, 100); }
      log(s, d.title + '：' + choice.name + (choice.chance ? (won ? '，这次运气站在你这边。' : '，这次未能如愿。') : '。'), won ? 'normal' : 'warning'); s.event = null;
      // Give the player breathing room after an offline backlog.
      s.nextEvent = Math.max(s.nextEvent, s.time + 30);
    } else if (type === 'forget') {
      if (!pay(s, { memory: 5 })) return fail('至少需要 5 段记忆。'); s.stability = clamp(s.stability + 12, 0, 100); s.trust = clamp(s.trust - 2, 0, 100); log(s, '你主动遗忘了 5 段记忆。稳定度 +12，信任 −2。', 'warning');
    } else if (type === 'pause') s.paused = !s.paused;
    else return fail('未知操作。');
    return { ok: true };
  }
  function reset(s, choice) {
    if (!s.buildings.machine || !['archive', 'industry', 'humanity'].includes(choice)) return null;
    const gain = 3 + s.artifacts.length + Math.floor(s.stats.expeditions / 8) + (level(s) >= 9 ? 1 : 0);
    const legacy = { ...s.legacy, era: s.era, seen: s.seen, echoes: s.legacy.echoes + gain, xp: s.career.xp };
    legacy[choice]++; const next = fresh(s.rng, legacy); next.r.items += Math.min(30, next.legacy.echoes); return next;
  }
  // Whitelist the saved schema; imported data never becomes HTML or executable code.
  function restore(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION) throw new Error('存档版本不受支持。');
    const bounded = (v, lo, hi, fallback = 0) => typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
    if (!raw.r || !raw.buildings || !Array.isArray(raw.tech)) throw new Error('存档缺少必要数据。');
    const s = fresh(bounded(raw.rng, 1, 4294967295, 123456789));
    s.career.xp = bounded(raw.career && raw.career.xp, 0, 1e8);
    s.ui = { introduced: raw.ui && raw.ui.introduced === true, notebookOpened: raw.ui && raw.ui.notebookOpened === true, walkthrough: raw.ui && raw.ui.walkthrough === true };
    s.time = bounded(raw.time, 0, 1e10); s.era = Math.floor(bounded(raw.era, 1, 1e6, 1)); s.rng = Math.floor(bounded(raw.rng, 1, 4294967295, 123456789));
    for (const k of Object.keys(BUILDINGS)) s.buildings[k] = Math.floor(bounded(raw.buildings[k], 0, BUILDINGS[k].max || 30));
    s.tech = [...new Set(raw.tech.filter(k => typeof k === 'string' && Object.hasOwn(TECH, k)))];
    for (const k of Object.keys(s.legacy)) s.legacy[k] = Math.floor(bounded(raw.legacy && raw.legacy[k], 0, 1e5));
    s.omen = Object.hasOwn(OMENS, raw.omen) ? raw.omen : 'rain'; s.policy = Object.hasOwn(POLICIES, raw.policy) && has(s, 'charter') ? raw.policy : 'preserve';
    s.artifacts = [...new Set(Array.isArray(raw.artifacts) ? raw.artifacts.filter(k => Object.hasOwn(ARTIFACTS, k)) : [])];
    s.seen = [...new Set([...(Array.isArray(raw.seen) ? raw.seen.filter(k => Object.hasOwn(ARTIFACTS, k)) : []), ...s.artifacts])];
    const c = caps(s); for (const k of Object.keys(RES)) s.r[k] = bounded(raw.r[k], 0, c[k]);
    s.workers = Array.isArray(raw.workers) ? raw.workers.slice(0, seats(s)).map((_, i) => NAMES[i % NAMES.length] + (i >= NAMES.length ? '·' + (i + 1) : '')) : [];
    let free = s.workers.length; for (const k of Object.keys(JOBS)) { s.jobs[k] = has(s, JOBS[k].tech) ? Math.floor(bounded(raw.jobs && raw.jobs[k], 0, free)) : 0; free -= s.jobs[k]; }
    s.stability = bounded(raw.stability, 0, 100, 90); s.trust = bounded(raw.trust, 0, 100, 70); s.pity = Math.floor(bounded(raw.pity, 0, 4)); s.cooldown = bounded(raw.cooldown, 0, 1.4);
    s.event = Object.hasOwn(EVENTS, raw.event) ? raw.event : null; s.nextEvent = bounded(raw.nextEvent, s.time, s.time + 130, s.time + 65);
    for (const k of Object.keys(SITES)) s.visits[k] = Math.floor(bounded(raw.visits && raw.visits[k], 0, 1e8));
    const e = raw.expedition; if (e && Object.hasOwn(SITES, e.site) && has(s, SITES[e.site].tech) && ['careful', 'bold'].includes(e.mode) && s.jobs.detective > 0) s.expedition = { site: e.site, mode: e.mode, party: s.jobs.detective, duration: bounded(e.duration, 1, 200, 50), remaining: bounded(e.remaining, 0, 200, 50) };
    s.paused = raw.paused === true; s.ended = !!s.buildings.machine;
    s.lastSaved = bounded(raw.lastSaved, 0, Date.now(), Date.now());
    for (const k of Object.keys(s.stats)) s.stats[k] = bounded(raw.stats && raw.stats[k], 0, 1e10);
    s.logs = Array.isArray(raw.logs) ? raw.logs.slice(0, 60).filter(l => l && typeof l.message === 'string').map(l => ({ time: bounded(l.time, 0, s.time), message: l.message.slice(0, 500), type: ['normal', 'story', 'rare', 'warning', 'event'].includes(l.type) ? l.type : 'normal' })) : s.logs;
    return s;
  }
  return { VERSION, RES, BUILDINGS, TECH, JOBS, POLICIES, ARTIFACTS, SITES, EVENTS, OMENS, LEVELS, LEVEL_REWARDS, level, gainXP, fresh, random, advance, act, reset, restore, stage, caps, cost, seats, assigned, hireCost, affordable, available, rates, goal, target, log, has, producers };
});
