(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./exploration.js'), require('./engine.js'));
  else root.Cases = factory(root.Cases, root.Bureau);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E, B) {
  'use strict';
  Object.assign(E.ITEMS, { pin: '弯曲的发夹', receipt: '潮湿纸票', glass: '手持旧镜片' });
  B.LEVEL_REWARDS[1] += '；开放听取残响（可发现支路）';
  B.LEVEL_REWARDS[3] += '；开放主动辨读隐去的痕迹';
  B.LEVEL_REWARDS[5] += '；开放主动证物关系比对';
  B.LEVEL_REWARDS[8] += '；每轮可携带旧镜片工具';
  const EXTRA = [
    ['take-pin', 'bench', '拿取长椅缝里的发夹', '', '', 'pin', '发夹可以撬开松动的镜框。镜中那扇门，也许能绕开正面的锁。'],
    ['take-receipt', 'bench', '拿取潮湿纸票', '', '', 'receipt', '纸票上的墨水被雨洇开。请将它放到登记室台灯下透光观察。'],
    ['take-glass', 'hall', '拿取窗口旁的旧镜片', '', '', 'glass', '旧镜片可以映出被擦掉的墨迹。它只是调查工具，不是你的倒影。'],
    ['mirror-route', 'hall', '用发夹撬开镜框 · 走镜中通路', 'pin', '', 'mirror-route', '镜后的狭道直通登记室。你没有修电，却看见灯一盏盏亮起。影子比你晚走了一步。'],
    ['lamp-ticket', 'records', '将纸票放到台灯下 · 透光观察', 'receipt', '', 'ticket-lit', '柜号重新显现：'],
    ['mirror-ledger', 'records', '用旧镜片映照登记簿 · 显露擦痕', 'glass', '', 'erasure', '被擦去的日期重新浮现。笔迹旁写着：失物正是读到这一行的人。']
  ];
  const TRUTH = [
    ['truth-paper', 'records', '将纸票与登记簿叠在灯下 · 检查寄存底联', ['ticket-lit', 'erasure'], '两层纸的针孔完全重合。底联的日期比认领日晚一天，寄存栏写着“本人交付”。你不是被别人送进来的，至少纸面上不是。'],
    ['truth-reflection', 'hall', '将底联贴在旧镜片后 · 检验倒影', ['truth-paper'], '正面仍照不出你。翻转旧镜片，底联背面却映出一只刚刚松手的手；拇指上的缺口与你相同。镜中的手先动，你的手才跟着动。'],
    ['truth-handoff', 'bench', '用底联拓取长椅压痕 · 核验交接记录', ['truth-reflection'], '压痕上留下同一枚缺口和“下一班由她接你”。女人说：“我只负责交接。把你寄在这里的，是签字的那个你。”她不是寄存人，是被你提前指定的接班人。'],
    ['truth-sealed', 'counter', '装订寄存人调查记录 · 保留到下一案', ['truth-handoff'], '寄存人核验完成：交付者与认领者具有相同的手部痕迹，签名方向相反。你将“上一班的自己”记为暂定寄存人；他的动机仍不明。女人留下一个称呼：“交接员”。第二案会保留这条关系。']
  ];
  const EXPERIMENTS = [
    ['test-dust', '将墙边粉末铺在湿脚印旁', [], '你用剥落的墙灰铺出一条浅线。只有跨过它的实体，才会留下连续脚印。'],
    ['test-chase', '循着脚步声追到镜前', ['test-dust'], '你追到镜前，脚步却从身后响起。粉末之外没有新脚印：声音的方向不等于实体的位置。追逐失败，稳定 -1；改用地面痕迹验证，而不是再追一次。'],
    ['test-watch', '停在粉末线旁 · 比较脚印与倒影', ['test-dust'], '你没有移动，镜中的鞋尖却跨过浅线。地上粉末纹丝不动。记录：倒影的动作并不对应现场实体；镜面与声音不能单独作为位置证据。'],
    ['test-cover', '用潮湿纸票遮住镜面 · 再听脚步', ['test-watch'], '遮住镜面的瞬间，身后的第二声脚步消失。移开纸票，脚步再次出现，而粉末仍未改变。记录：异常与镜面暴露有关，不是有人沿走廊尾随。']
  ];
  const SIDE_FLAGS = ['ticket-lit', 'erasure', 'mirror-route', 'niche-reward', 'niche-open', 'legacy-pocket', ...TRUTH.map(a => a[0]), ...EXPERIMENTS.map(a => a[0])];
  const oldTicket = E.DATA.station.evidence.ticket.read, oldLedger = E.DATA.station.evidence.ledger.read;
  E.DATA.station.evidence.ticket.read = c => E.field(c).flags.includes('ticket-lit') ? oldTicket(c) : '纸票被雨浸透了。墨迹只能看到一个柜子的轮廓。把纸票拿到登记室台灯下，柜号才会显现。';
  E.DATA.station.evidence.ledger.read = c => E.field(c).flags.includes('erasure') ? oldLedger(c) : '登记簿最后一行被擦过。肉眼看不到日号，物品描述仍是：“会阅读这行字，却无法出现在镜子里的人。”用旧镜片映照纸面，试着读取擦痕。';
  E.DATA.station.rooms.niche = { name: '通风壁龛', description: '冷风从松动的柜子背后吹来。里面只有一封没能寄出的信。', things: ['unsent'] };
  E.DATA.station.evidence.unsent = { name: '未寄出的信', read: () => '“镜子里的路不是捷径，是另一个人的来路。你经过那里时，他也经过了你。”信封上没有收件地址。', deep: '不影响认领，却让这次调查留下了不同的故事。' };
  E.LINKS.hall.push('niche'); E.LINKS.niche = ['hall'];
  const VARIANTS = ['冷风', '脚步', '静默'];
  function prepare(s) {
    for (const id of E.ORDER) { const c = s.casebook.cases[id], f = E.field(c); f.variation ||= VARIANTS[(c.box + c.day + s.era) % 3]; }
    return s;
  }
  function hydrate(s, raw) {
    E.hydrate(s, raw); prepare(s);
    for (const id of E.ORDER) {
      const c = s.casebook.cases[id], f = E.field(c), x = raw && raw.cases && raw.cases[id] && raw.cases[id].field;
      const valid = [...SIDE_FLAGS, ...Object.keys(E.DATA[id].rooms).flatMap(k => ['sense:' + k, 'read:' + k]), 'comparison'];
      if (x && Array.isArray(x.flags)) for (const k of x.flags) if (valid.includes(k) && !f.flags.includes(k)) f.flags.push(k);
      if (x && Array.isArray(x.flags)) f.flags = [...new Set([...x.flags.filter(k => f.flags.includes(k)), ...f.flags])];
      if (x && VARIANTS.includes(x.variation)) f.variation = x.variation;
      if (id === 'station' && c.solved) for (const k of ['ticket-lit', 'erasure']) if (!f.flags.includes(k)) f.flags.push(k);
    }
    return s;
  }
  function blocked(s, room) {
    if (room === 'niche') { const f = E.field(s.casebook.cases[s.casebook.active]); return s.casebook.active !== 'station' || !f.flags.includes('niche-open') ? '风口尚未确认。尝试调查大厅的残响，或寻找冷风来源。' : ''; }
    return E.blocked(s, room);
  }
  function nextStep(s) {
    const id = s.casebook.active, c = s.casebook.cases[id], f = E.field(c), done = a => f.flags.includes(a[5]) || f.items.includes(a[5]);
    if (id !== 'station') return E.CONFIG[id].steps.find(a => !done(a));
    if (!f.flags.includes('opened')) {
      if (f.items.includes('pin') && !f.items.includes('fuse')) return EXTRA[3];
      return E.CONFIG.station.steps.slice(0, 4).find(a => !done(a));
    }
    for (const i of [1, 2, 4, 5]) if (!done(EXTRA[i])) return EXTRA[i];
    return E.CONFIG.station.steps.find(a => a[0] === 'stamp' && !done(a));
  }
  function objective(s) {
    const c = s.casebook.cases[s.casebook.active];
    if (c.solved) return '已结案。可回访支路、使用新能力，或进入下一案。';
    const f = E.field(c), next = nextStep(s);
    if (s.casebook.active === 'station' && !f.flags.includes('opened') && !f.items.includes('pin') && !f.items.includes('fuse')) return '选择进入路线：长椅取保险丝修电，或取发夹走镜中通路。';
    return next ? E.DATA[s.casebook.active].rooms[next[1]].name + '：' + next[2] : E.objective(s);
  }
  function actions(s) {
    const id = s.casebook.active, c = s.casebook.cases[id], f = E.field(c), out = E.actions(s);
    if (id === 'station') {
      if (c.room === 'hall' && f.flags.includes('opened')) for (const a of EXPERIMENTS) out.push({ id: a[0], label: a[1], group: 'experiment', done: f.flags.includes(a[0]), reason: a[2].some(k => !f.flags.includes(k)) ? '先铺粉末并观察地面痕迹，再改变实验条件' : a[0] === 'test-cover' && !f.items.includes('receipt') ? '需要长椅上的潮湿纸票' : '' });
      for (const a of EXTRA.filter(a => a[1] === c.room)) out.push({ id: a[0], label: a[2], done: f.flags.includes(a[5]) || f.items.includes(a[5]), reason: a[3] && !f.items.includes(a[3]) ? '需要道具：' + E.ITEMS[a[3]] : '' });
      if (c.room === 'hall' && f.variation === '冷风') out.push({ id: 'niche-open', label: '沿冷风寻找柜后通路', done: f.flags.includes('niche-open') });
      if (c.room === 'niche') out.push({ id: 'niche-reward', label: '收容未寄出的信 · 随机补给', done: f.flags.includes('niche-reward') });
      if (f.flags.includes('stamped') || c.solved) for (const a of TRUTH.filter(a => a[1] === c.room)) out.push({ id: a[0], label: a[2], done: f.flags.includes(a[0]), reason: !f.items.includes('receipt') || !f.items.includes('glass') ? '需要潮湿纸票与旧镜片，可回到长椅与大厅拿取' : a[3].some(k => !f.flags.includes(k)) ? '先完成前一处寄存痕迹核验；查看下方寄存人调查记录' : '' });
    }
    out.push({ id: 'sense', label: '听取现场残响 · Lv.2', done: f.flags.includes('sense:' + c.room), reason: B.level(s) < 2 ? '资历达到 Lv.2 后获得；主线无需此能力' : '' });
    out.push({ id: 'read', label: '辨读隐去的痕迹 · Lv.4', done: f.flags.includes('read:' + c.room), reason: B.level(s) < 4 ? '资历达到 Lv.4 后获得；主线无需此能力' : '' });
    if (c.found.length >= 2) out.push({ id: 'compare', label: '比对已记录证物 · Lv.6', done: f.flags.includes('comparison'), reason: B.level(s) < 6 ? '资历达到 Lv.6 后获得；也可自行查阅笔记' : '' });
    if (B.level(s) >= 9 && !f.flags.includes('legacy-pocket')) out.push({ id: 'legacy-pocket', label: '取出跨轮回调查工具 · 旧镜片', done: false });
    return out;
  }
  function describe(s) {
    const id = s.casebook.active, c = s.casebook.cases[id], f = E.field(c);
    let text = E.describe(s);
    if (id === 'station' && c.room === 'hall') text = f.flags.includes('mirror-route') ? '镜框已经敞开。提伞女人的位置没有变，镜中的她却转过了头。狭道通向登记室；你经过后，身后的脚步晚了一拍。' : f.flags.includes('powered') ? '荧光灯完全亮了。通往登记室的湿脚印刚刚出现，女人却说她一直没站起来。镜子仍看不见你。' : '荧光灯闪了两次。镜框的一角松了，正门的锁却完好无损。你可以修电寻找钥匙，也可以拿细工具试试镜后的通路。';
    if (id === 'station' && c.room === 'bench') text = '长椅缝里露着一根发夹，椅底有备用保险丝。女人把潮湿纸票推到你面前：“进来的路不只一条。取走什么，自己决定。”';
    if (id === 'station' && c.room === 'records') text = '台灯一直亮着，即使外面的灯熄了。把纸票放到灯下观察；再用旧镜片映照被擦过的登记簿。' + (f.flags.includes('ticket-lit') ? '纸票柜号已经显现。' : '') + (f.flags.includes('erasure') ? '你已经读出登记日期与那行被擦去的文字。' : '');
    if (f.variation === '冷风') text += ' 一股冷风贴着地面流动，却找不到窗户。';
    if (f.variation === '脚步') text += ' 你停下时，身后的脚步还多走了一步。';
    if (f.variation === '静默') text += ' 钟在动，这里却听不到任何滴答声。';
    return text;
  }
  function hint(s) {
    const id = s.casebook.active, c = s.casebook.cases[id];
    if (id === 'station') return [
      '正门钥匙藏在修电后的维修道；镜框则可以用长椅发夹撬开。两条路都能进入登记室，任选其一。',
      '带上潮湿纸票和大厅的旧镜片。在登记室分别对台灯和登记簿使用。之后到窗口压印章，柜号在前、日号在后。',
      '完整认领码：' + String(c.box).padStart(2, '0') + String(c.day).padStart(2, '0') + '。失主选“我自己”。现场仍需实际处理纸票与登记簿。'
    ];
    return E.DATA[id].hints.map(h => typeof h === 'function' ? h(c) : h);
  }
  function act(s, type, p) {
    prepare(s);
    const id = s.casebook.active, c = s.casebook.cases[id], f = E.field(c);
    if (type === 'room' && p === 'niche') {
      if (c.room !== 'hall' || blocked(s, p)) return { ok: false, message: blocked(s, p) || '请先回大厅。' };
      c.room = p; if (!f.visited.includes(p)) f.visited.push(p); return { ok: true };
    }
    if (type === 'solve' && id === 'station' && !c.solved && (!f.flags.includes('ticket-lit') || !f.flags.includes('erasure'))) return { ok: false, message: '请亲自用台灯观察纸票，并用旧镜片读取登记簿。只填写答案无法跳过现场。' };
    if (type !== 'interact') return E.act(s, type, p);
    const entry = actions(s).find(a => a.id === p);
    if (!entry || entry.done || entry.reason) return { ok: false, message: entry && entry.reason || '操作已完成或不在当前地点。' };
    const a = id === 'station' && EXTRA.find(a => a[0] === p);
    let message;
    if (a) {
      (Object.hasOwn(E.ITEMS, a[5]) ? f.items : f.flags).push(a[5]);
      if (p === 'mirror-route') { if (!f.flags.includes('opened')) f.flags.push('opened'); s.stability = Math.max(0, s.stability - 2); }
      B.gainXP(s, 12); message = a[6] + (p === 'lamp-ticket' ? String(c.box).padStart(2, '0') + '。' : '') + (p === 'mirror-ledger' ? ' 登记日号：' + c.day + '。' : '') + ' 经验 +12。';
    } else if (id === 'station' && EXPERIMENTS.some(a => a[0] === p)) {
      const a = EXPERIMENTS.find(a => a[0] === p);
      f.flags.push(p); if (p === 'test-chase') s.stability = Math.max(0, s.stability - 1);
      message = a[3];
    } else if (id === 'station' && TRUTH.some(a => a[0] === p)) {
      const a = TRUTH.find(a => a[0] === p), xp = p === 'truth-sealed' ? 60 : 12;
      f.flags.push(p); B.gainXP(s, xp); message = a[4] + ' 经验 +' + xp + '。';
    } else if (['sense', 'read', 'compare'].includes(p)) {
      const flag = p === 'compare' ? 'comparison' : p + ':' + c.room; f.flags.push(flag);
      if (p === 'sense') { if (id === 'station' && c.room === 'hall' && !f.flags.includes('niche-open')) f.flags.push('niche-open'); message = id === 'station' ? c.room === 'hall' ? '残响：柜后还有一声呼吸。大厅的隐藏壁龛显现了。' : '残响从大厅柜后传来。回到大厅再听，才能确认那条通路。' : '残响：这里留下了进来者的回声。请分清进入与离开的方向。'; }
      if (p === 'read') message = '隐去的痕迹：' + (id === 'station' ? '镜框的擦痕朝向登记室；纸票需要透光，擦去的墨需要映照。' : id === 'tuesday' ? '地面的磨痕与录音方向相反。归途应从来路的末端开始。' : '投影灯片决定机关顺序，卷宗决定历史顺序。这两种次序不是同一回事。');
      if (p === 'compare') message = '关系比对：' + (id === 'station' ? '纸票给柜号，登记簿给日期；倒影与物品描述共同指向失主。' : id === 'tuesday' ? '录音是去程，便笺要求反向；三道门每扇只走一次。' : '先遗忘才能登记，登记后才建局，建局后才开始值班。');
    } else if (p === 'niche-open') { f.flags.push(p); message = '柜后的冷风通向一处壁龛。随机支路已显现，不影响主线。'; }
    else if (p === 'niche-reward') { f.flags.push(p); const reward = B.random(s) < 0.5 ? 'ink' : 'clues', amount = reward === 'ink' ? 4 : 8; s.r[reward] = Math.min(B.caps(s)[reward], s.r[reward] + amount); B.gainXP(s, 20); message = '收容未寄出的信。经验 +20，获得' + B.RES[reward].name + ' +' + amount + '。'; }
    else if (p === 'legacy-pocket') { f.flags.push(p); if (!f.items.includes('glass')) f.items.push('glass'); message = '长期资历让你提前备好一枚旧镜片；此工具可在每次轮回重新取出，不替你完成机关。'; }
    else return E.act(s, type, p);
    B.log(s, message, 'event'); return { ok: true, message };
  }
  function truth(s) {
    const c = s.casebook.cases.station, f = E.field(c);
    return { available: c.solved || f.flags.includes('stamped'), complete: f.flags.includes('truth-sealed'), steps: TRUTH.map(a => ({ label: a[2], room: E.DATA.station.rooms[a[1]].name, done: f.flags.includes(a[0]), record: a[4] })) };
  }
  function opening(s, id) {
    return id === 'tuesday' && truth(s).complete ? '入口多出一张交接条：“你追到了寄存底联。这次别把来路当成归途。”落款不是女人的名字，只有你记下的称呼：交接员。她记得你问过谁把你寄存在这里。' : '';
  }
  function experiments(s) { const f = E.field(s.casebook.cases.station); return EXPERIMENTS.filter(a => f.flags.includes(a[0])).map(a => ({ label: a[1], record: a[3] })); }
  return { ...E, hydrate, act, blocked, nextStep, objective, actions, describe, hint, EXTRA, TRUTH, EXPERIMENTS, experiments, truth, opening, optional: room => ['annex', 'niche'].includes(room) };
});
