(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cases.js'), require('./engine.js'));
  else root.Cases = factory(root.Cases, root.Bureau);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C, B) {
  'use strict';
  const ITEMS = { fuse: '备用保险丝', key: '黄铜钥匙', battery: '干电池', lens: '校准镜片' };
  const CONFIG = {
    station: { extra: ['配电间', '积水维修道', '镜后夹层'], level: 4, done: 'stamped', steps: [
      ['take-fuse', 'bench', '拾起椅底保险丝', '', '', 'fuse', '你蹲下取出一根完好的保险丝。'],
      ['power', 'workshop', '装入保险丝 · 接通照明', 'fuse', '', 'powered', '走廊的灯逐盏亮起，积水里露出一道维修入口。'],
      ['take-key', 'tunnel', '从积水中捞出钥匙', '', 'powered', 'key', '水面晃了一下。捞出的钥匙还带着体温。'],
      ['unlock', 'hall', '用钥匙打开登记室', 'key', '', 'opened', '黄铜锁转动。登记室现在可以进入。'],
      ['stamp', 'counter', '压下机械认领印章', '', 'opened', 'stamped', '机器在表格上压下一个空白人形。现在可以登记失主。']
    ] },
    tuesday: { extra: ['停摆机房', '倒行楼梯', '第零分钟'], level: 8, done: 'doors', steps: [
      ['take-battery', 'bench', '取出抽屉里的电池', '', '', 'battery', '电池上写着：不要让它替你等待。'],
      ['power', 'workshop', '给磁带机接入电池', 'battery', '', 'powered', '磁带转动。时间保管室的门松开了。'],
      ['rewind', 'records', '按住倒带键 · 倒转时间', '', 'powered', 'rewound', '楼梯向相反方向伸展。请实际穿过归途的三道门。']
    ] },
    city: { extra: ['光学校准室', '模型地下街', '无名市民档案'], level: 12, done: 'authorized', steps: [
      ['take-lens', 'bench', '从外套口袋取出镜片', '', '', 'lens', '镜片里映着另一个方向的街道。'],
      ['project', 'workshop', '把镜片装入投影仪', 'lens', '', 'projected', '模型投影启动。前厅出现三枚街区机关。'],
      ['authorize', 'tunnel', '按下地下街的档案授权台', '', 'aligned', 'authorized', '空白街道接回城市，原始卷宗室与归还台同时解锁。']
    ] }
  };
  const LINKS = { hall: ['bench', 'workshop', 'records', 'counter', 'annex'], bench: ['hall'], workshop: ['hall', 'tunnel'], tunnel: ['workshop'], records: ['hall'], counter: ['hall'], annex: ['hall'] };
  for (const id of C.ORDER) {
    const d = C.DATA[id], cfg = CONFIG[id];
    for (const [i, room] of ['workshop', 'tunnel', 'annex'].entries()) {
      const key = 'detail' + i;
      d.rooms[room] = { name: cfg.extra[i], description: [
        '机器不是装饰。检查供电和缺失部件，再试着让它运转。',
        '这是地图上没有画出的通路。机关的状态决定它通向哪里。',
        '资深调查员才能看到的侧室。这里不影响主线结案，但藏有独立的现场奖励。'
      ][i], things: [key] };
      d.evidence[key] = { name: cfg.extra[i] + '的痕迹', read: c => i === 0 ? (id === 'city' ? '投影灯片依次印着：' + symbols(c).join(' → ') + '。前厅开关必须依这个顺序按下；错按会清空机关进度。' : '墙上的线路图通往门锁。缺少电力，读再多档案也打不开门。') : i === 1 ? '地面的脚印方向与你相反。先完成现场机关，再决定遗失物的去向。' : '卷宗记载：世界还会遗失海岸、季节与人的影子。这些地点尚未开放。', deep: '这不是答案，而是下一次异常留下的入口。' };
    }
    const prior = d.hints;
    d.hints = [id === 'station' ? '先去长椅下拿保险丝，到配电间接通电源，再沿维修道寻找钥匙。' : id === 'tuesday' ? '先在值班室取电池，去机房接电，再到保管室倒带。倒行楼梯必须按归途顺序实际穿门。' : '在办公室取镜片，到校准室启动投影。按灯片的顺序操作前厅街区开关，再去地下街授权。', prior[0], c => '先完成现场操作；最后的登记答案：' + (typeof prior[2] === 'function' ? prior[2](c) : prior[2])];
  }
  function symbols(c) { return [['钟楼', '河岸', '车站'], ['车站', '钟楼', '河岸'], ['河岸', '车站', '钟楼']][c.box % 3]; }
  function field(c) { if (!c.field) c.field = { items: [], flags: [], visited: ['hall'], sequence: [] }; return c.field; }
  function hydrate(s, raw) {
    C.hydrate(s, raw);
    for (const id of C.ORDER) {
      const c = s.casebook.cases[id], x = raw && raw.cases && raw.cases[id], f = field(c);
      if (x && x.field) {
        f.items = [...new Set((Array.isArray(x.field.items) ? x.field.items : []).filter(k => Object.hasOwn(ITEMS, k)))];
        const flags = CONFIG[id].steps.map(a => a[5]).filter(k => !Object.hasOwn(ITEMS, k)).concat([CONFIG[id].done, ...(id === 'city' ? ['aligned'] : []), 'annex-reward']);
        f.flags = [...new Set((Array.isArray(x.field.flags) ? x.field.flags : []).filter(k => flags.includes(k)))];
        f.visited = [...new Set(['hall', ...(Array.isArray(x.field.visited) ? x.field.visited : []).filter(k => Object.hasOwn(C.DATA[id].rooms, k))])];
        f.sequence = (Array.isArray(x.field.sequence) ? x.field.sequence : []).filter(k => ['昨天', '今天', '明天', '钟楼', '河岸', '车站'].includes(k)).slice(0, 2);
        const expected = id === 'tuesday' ? [...c.route].reverse() : id === 'city' ? symbols(c) : [];
        if (!f.sequence.every((k, i) => k === expected[i])) f.sequence = [];
      }
      // Existing completed cases remain completed; unfinished old saves gain the new physical investigation.
      if (c.solved && !f.flags.includes(CONFIG[id].done)) f.flags.push(CONFIG[id].done);
    }
    const active = s.casebook.cases[s.casebook.active];
    if (blocked(s, active.room)) active.room = 'hall';
    if (!field(active).visited.includes(active.room)) field(active).visited.push(active.room);
    return s;
  }
  function blocked(s, room) {
    const id = s.casebook.active, c = s.casebook.cases[id], f = field(c), has = k => f.flags.includes(k);
    if (room === 'annex' && B.level(s) < CONFIG[id].level) return '侧室需要调查员 Lv.' + CONFIG[id].level + '（不影响主线）。';
    if (c.solved) return '';
    if (room === 'records' && !(id === 'station' ? has('opened') : id === 'tuesday' ? has('powered') : has('authorized'))) return '门锁未解除：先修复现场机关。';
    if (room === 'tunnel' && !(id === 'station' ? has('powered') : id === 'tuesday' ? has('rewound') : has('aligned'))) return '隐藏通路尚未显现。';
    if (room === 'counter' && !(id === 'station' ? has('opened') : id === 'tuesday' ? has('doors') : has('authorized'))) return '登记台尚未接通：先完成现场探索。';
    return '';
  }
  function objective(s) {
    const id = s.casebook.active, c = s.casebook.cases[id], f = field(c);
    if (c.solved) return '已完成现场，侧室与未记录证物仍可回访。';
    if (id === 'city' && f.flags.includes('projected') && !f.flags.includes('aligned')) return '去前厅，按校准室投影灯片顺序校准街区。';
    const next = CONFIG[id].steps.find(a => !f.flags.includes(a[5]) && !f.items.includes(a[5]));
    if (next) return C.DATA[id].rooms[next[1]].name + '：' + next[2];
    if (!f.flags.includes(CONFIG[id].done)) return id === 'tuesday' ? '去倒行楼梯，依归途顺序实际穿过三道门。' : '去前厅，按投影灯片顺序校准街区。';
    return '机关已经接通，前往登记台完成最后认领。';
  }
  function actions(s) {
    const id = s.casebook.active, c = s.casebook.cases[id], f = field(c);
    const out = CONFIG[id].steps.filter(a => a[1] === c.room).map(a => ({ id: a[0], label: a[2], done: f.flags.includes(a[5]) || f.items.includes(a[5]), reason: a[3] && !f.items.includes(a[3]) ? '需要道具：' + ITEMS[a[3]] : a[4] && !f.flags.includes(a[4]) ? '需要先完成前置机关' : '' }));
    if (id === 'tuesday' && c.room === 'tunnel' && f.flags.includes('rewound')) for (const k of ['昨天', '今天', '明天']) out.push({ id: 'sequence:' + k, label: '穿过「' + k + '」门', done: f.flags.includes('doors') });
    if (id === 'city' && c.room === 'hall' && f.flags.includes('projected')) for (const k of ['钟楼', '河岸', '车站']) out.push({ id: 'sequence:' + k, label: '按下「' + k + '」街区', done: f.flags.includes('aligned') });
    if (c.room === 'annex') out.push({ id: 'annex', label: '收容侧室异常 · +40 经验', done: f.flags.includes('annex-reward') });
    return out;
  }
  function describe(s) {
    const id = s.casebook.active, c = s.casebook.cases[id], f = field(c), has = k => f.flags.includes(k);
    const details = {
      station: {
        workshop: has('powered') ? '电表的指针开始颤动。沿墙的线缆通向大厅与维修道，地面积水映出亮着的灯，却照不出你的影子。' : '烧焦的保险丝垂在配电箱里。箱盖内侧画着维修道的线路，边缘留着一只湿手印。你需要找一根完好的保险丝。',
        tunnel: f.items.includes('key') ? '钥匙离开水面后，涟漪仍在扩散。尽头是一堵墙，湿脚印却继续爬到了墙上。出口仍是身后的配电间。' : '照明终于照到维修道底部。铁栅下有一把黄铜钥匙，每一滴水落下时，它都会向你靠近一点。',
        annex: '镜子背后不是墙，而是一间狭窄夹层。许多没有人形的影子挂在衣架上，其中一个刚刚抬起了头。'
      },
      tuesday: {
        workshop: has('powered') ? '磁带机正在转动，扬声器传出一段进门路线。配电表上没有数字，只有不断擦去重写的“星期二”。保管室已经解锁。' : '机房里所有转轴都停了。桌上磁带机缺一节电池，出线连接时间保管室。空气里有一声不肯落下的滴答。',
        tunnel: has('doors') ? '第三道门后响起了钟声。楼梯重新朝前延伸，出口指向登记台。你仍可以从机房返回大厅。' : '台阶上的灰尘向上飘。昨天、今天、明天三道门站在同一级台阶上；这里必须沿录音的来路倒着走。',
        annex: '一间夹在两次滴答之间的房间。桌上的杯子刚被人拿起过，杯沿的温度却来自几十年前。'
      },
      city: {
        workshop: has('projected') ? '投影仪照亮三个街区标记。看清灯片的先后，回前厅依次按动机关；错误顺序会让模型回到起点。' : '投影仪少了一枚校准镜片。散乱的光斑落在地板上，隐约像这座城市从未修建的地下街。',
        tunnel: has('authorized') ? '授权台打印出一张没有名字的通行单。原始卷宗与归还台现在可以进入。地下街的灯，一盏一盏朝你所在的位置亮起。' : '模型校准后，楼梯通往一条缩小的地下街。尽头的授权台还在等待你的手印，四周窗口都朝着你。',
        annex: '卷宗架上没有姓名，只有同一张被涂掉面孔的照片。你靠近时，最底层的抽屉缓缓向外滑出。'
      }
    };
    return details[id][c.room] || C.DATA[id].rooms[c.room].description;
  }
  function act(s, type, p) {
    const id = s.casebook.active, c = s.casebook.cases[id], f = field(c), cfg = CONFIG[id];
    if (type === 'room') {
      if (!LINKS[c.room].includes(p)) return { ok: false, message: '这里不能直达。请沿地图连接移动，先返回大厅或机房。' };
      const reason = blocked(s, p); if (reason) return { ok: false, message: reason };
      const result = C.act(s, type, p); if (result.ok && !f.visited.includes(p)) f.visited.push(p); return result;
    }
    if (type === 'solve' && !c.solved && !f.flags.includes(cfg.done)) return { ok: false, message: '不能只凭答案结案：现场机关尚未完成。' };
    if (type !== 'interact') return C.act(s, type, p);
    if (!actions(s).some(a => a.id === p && !a.done)) return { ok: false, message: '此操作已完成，或不在当前地点。' };
    let message;
    if (p === 'annex') { if (B.level(s) < cfg.level) return { ok: false, message: '调查资历不足，先继续主线。' }; f.flags.push('annex-reward'); B.gainXP(s, 40); s.stability = Math.min(100, s.stability + 5); message = '侧室异常已收容。经验 +40，稳定度 +5；每轮仅领取一次。'; }
    else if (p.startsWith('sequence:')) {
      const prerequisite = id === 'tuesday' ? 'rewound' : 'projected';
      if (!f.flags.includes(prerequisite)) return { ok: false, message: '机关没有启动。请先修复设备。' };
      const expected = id === 'tuesday' ? [...c.route].reverse() : symbols(c), k = p.slice(9);
      if (k !== expected[f.sequence.length]) { f.sequence = []; return { ok: false, message: '走错方向，机关回到起点。道具不会丢失，可查阅笔记再试。' }; }
      f.sequence.push(k); message = '机关进度 ' + f.sequence.length + '/3。';
      if (f.sequence.length === 3) { f.sequence = []; f.flags.push(id === 'tuesday' ? 'doors' : 'aligned'); B.gainXP(s, 12); message = '路线接通了！经验 +12，新的区域已经开放。'; }
    } else {
      const a = cfg.steps.find(a => a[0] === p);
      if (a[3] && !f.items.includes(a[3])) return { ok: false, message: '缺少道具：' + ITEMS[a[3]] + '。' };
      if (a[4] && !f.flags.includes(a[4])) return { ok: false, message: '前置机关尚未完成，请查看现场目标。' };
      (Object.hasOwn(ITEMS, a[5]) ? f.items : f.flags).push(a[5]); B.gainXP(s, 12); message = a[6] + ' 经验 +12。';
    }
    B.log(s, message, 'event'); return { ok: true, message };
  }
  return { ...C, hydrate, act, ITEMS, CONFIG, LINKS, field, blocked, objective, actions, symbols, describe };
});
