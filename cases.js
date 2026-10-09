(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.Cases = factory(root.Bureau);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (B) {
  'use strict';
  const ORDER = ['station', 'tuesday', 'city'];
  const DATA = {
    station: { number: '01', name: '请领取你自己', location: '雨伞失物处', intro: '雨停了十九年，站台却还是湿的。一位女人在窗口等着。她说，失物是你的。', xp: 65,
      rooms: {
        hall: { name: '招领大厅', description: '荧光灯闪了两次。取件窗口后面没有工作人员。长椅上坐着一位提伞的女人，镜子里也有她。', things: ['notice', 'mirror'] },
        bench: { name: '候车长椅', description: '女人起身时，一张纸票落在椅子上。她说：“我已经拿回我的雨。还有一个人没走。”', things: ['ticket', 'woman'] },
        records: { name: '登记室', description: '抽屉上贴着“待认领”。你翻开当天的册子，最后一行墨迹还没干。', things: ['ledger', 'handwriting'] },
        counter: { name: '取件窗口', description: '柜台上亮着四位数密码锁。旁边的表格要求填写：本次登记的失物是谁？', things: ['lock'] }
      },
      evidence: {
        notice: { name: '招领须知', read: () => '“密码为四位数：柜号在前，遗失日号在后。不足两位补零。取件人不一定是失主。”', deep: '补零的墨比其余文字更新。这套制度也曾困住上一个调查员。' },
        mirror: { name: '墙上的镜子', read: () => '镜中能看见女人和空长椅。你站在镜前，却看不见自己的倒影。', deep: '倒影没有消失。它正站在镜子的另一边看着你。' },
        ticket: { name: '女人留下的纸票', read: c => '取件联：第 ' + String(c.box).padStart(2, '0') + ' 号柜。日期那一半被撕走了。', deep: '纸票背面写着：伞只是为了让你跟来。' },
        woman: { name: '提伞女人的证词', read: () => '“我丢的是雨，已经领回来了。登记室还有一张你的单子。你不记得来过，是因为你也被寄存在这里。”', deep: '她没有恶意。只是一个比你早一步领回自己的人。' },
        ledger: { name: '待认领登记簿', read: c => '本月 ' + c.day + ' 日，仅登记一件失物。柜号被水洇坏；物品描述是：“会阅读这行字，却无法出现在镜子里的人。”', deep: '日期与纸票拼起来，正好是一把钥匙。' },
        handwriting: { name: '页边签字', read: () => '领回确认栏是空的。保管员备注：“不要替那个女人填表。她的登记已经完成。”', deep: '笔迹很像你，落款却是上一轮的日期。' },
        lock: { name: '密码锁与认领表', read: () => '锁没有倒计时。标签写着：“先核对柜号与遗失日，再确认谁被登记为失物。”', deep: '现实并不奖励猜得快的人，只奖励看得仔细的人。' }
      },
      hints: ['纸票与登记簿各保存了密码的一半。招领须知说明了顺序。', '柜号用两位数，遗失日号用两位数，连成四位。镜子与登记簿描述的是同一个人。', c => '密码是 ' + String(c.box).padStart(2, '0') + String(c.day).padStart(2, '0') + '；认领表选“我自己”。'] },
    tuesday: { number: '02', name: '星期二没有出口', location: '被扣留的一天', intro: '走廊尽头有人重复同一句话：“明天见。”你低头，手表的日期一直是星期二。', xp: 95,
      rooms: {
        hall: { name: '循环走廊', description: '三扇门分别写着“昨天”“今天”“明天”。门上的字都像是从信封上剪下来贴的。', things: ['sign', 'echo'] },
        bench: { name: '无人值班室', description: '桌上有一盘磁带。一张便笺夹在播放器里，像是专门留给你。', things: ['tape', 'memo'] },
        records: { name: '时间保管室', description: '玻璃罐里盛着迟到、等待和来不及。有人把三个标签划掉又重新写了一遍。', things: ['labels', 'log'] },
        counter: { name: '三道门', description: '依次穿过三扇门，才能把这一天接回日历。选好顺序后，拉下开门杆。', things: ['lever'] }
      },
      evidence: {
        sign: { name: '门上的提示', read: () => '“这里的路线是寄出去的顺序。离开时必须沿来路倒着走。”', deep: '你不是从星期一来的。你是从这一天的终点掉进来的。' },
        echo: { name: '走廊里的回声', read: () => '回声从最远的门传来。“明天见。”每一次，它都比刚才年轻一点。', deep: '被扣留的不是时间，是一句没能兑现的约定。' },
        tape: { name: '磁带录音', read: c => '录音：“去的时候，先过「' + c.route[0] + '」，再到「' + c.route[1] + '」，最后在「' + c.route[2] + '」等我。”', deep: '录音中的人停顿了一次。她知道你会把原路当作归路。' },
        memo: { name: '播放器便笺', read: () => '“别照抄录音。那是进来的路线。回家的人，从最后一扇门开始。”', deep: '背面写着：记得结束等待，不要替她再等一年。' },
        labels: { name: '三个时间标签', read: () => '昨天、今天、明天各只能经过一次。重复的门会把你送回原地。', deep: '没有哪一天值得永远重复，即使那天你很幸福。' },
        log: { name: '保管室记录', read: () => '“星期二：失主仍在等待来信。暂扣至约定结束。”下方有两种处置：归还等待，或封存等待。', deep: '归还让当事人释然，封存让管理局拥有更多可用的记忆。' },
        lever: { name: '开门杆', read: () => '开门杆可以反复校验。错误的路线不会杀死你，只会让这一天变得更难醒来。', deep: '先看录音，再想你究竟是在进门，还是在回家。' }
      }, hints: ['录音给的是进来的顺序，墙上与便笺说的是离开的顺序。', '将录音中三个时间词的顺序完全倒过来，每个词使用一次。', c => '离开顺序：' + [...c.route].reverse().join(' → ') + '。'] },
    city: { number: '03', name: '城市等待认领', location: '不存在的市政档案馆', intro: '所有街道都通向这栋楼。每一个窗口都写着同一个地址：失物管理局。', xp: 135,
      rooms: {
        hall: { name: '市政前厅', description: '城市模型上没有人。门牌的背面贴着一张保管标签，而你认识上面的字迹。', things: ['model', 'label'] },
        bench: { name: '局长办公室', description: '桌上的椅子为你留着。相框里没有照片，椅背上搭着与你一模一样的外套。', things: ['coat', 'letter'] },
        records: { name: '四份原始卷宗', description: '四个卷宗散落在地上。日期已被擦去，但事件之间的关系还在。', things: ['files', 'manual'] },
        counter: { name: '归还登记台', description: '你需要重建四件事的先后，再填写这座城市的失主。最后一个签字框在等你。', things: ['registry'] }
      },
      evidence: {
        model: { name: '无人的城市模型', read: () => '模型里有一间失物管理局。它的房间里又摆着这座城市的模型。最小的桌前，坐着你。', deep: '并不是模型在复制城市。可能是城市在复制模型。' },
        label: { name: '城市保管标签', read: () => '“市民遗忘这座城市后，城市才被登记为失物。”签收处是管理局局长的笔迹。', deep: '这个签字不是借来的。你的手知道它怎么写。' },
        coat: { name: '椅背上的外套', read: () => '衣袋里有你的旧工作证。职务：局长。照片被磨掉，签字却与你现在的签字一致。', deep: '你不仅来过这里。你曾在这里决定让所有人忘记。' },
        letter: { name: '寄给下一轮自己的信', read: () => '“如果你还能读到这封信，请取回你遗失的城市。那件外套是你的；局长也是你。请亲自决定这一次要不要归还。”', deep: '上一次，你留下的不是答案，是让下一次的你有权重选。' },
        files: { name: '卷宗中的先后关系', read: () => '记录甲：市民先遗忘城市，随后城市被登记。记录乙：管理局建成是为了保管已登记的城市。', deep: '两份记录把最前面的三件事接了起来。' },
        manual: { name: '旧值班手册', read: () => '“管理局建成后，你才开始第一天值班。”四件事是：市民遗忘、登记城市、建成管理局、你开始值班。', deep: '眼前的这一天是结果，不是起点。' },
        registry: { name: '归还登记台', read: () => '档案要求按真实先后排列四件事。失主姓名可以填：我自己、提伞女人、全体市民或无人。', deep: '失主不一定是最先离开的人，也可能是唯一还在寻找的人。' }
      }, hints: ['两份原始卷宗和旧手册能拼出唯一的事件顺序。外套与信件指向失主。', '先遗忘，再登记；为保管已登记城市而建局；建局之后你才开始值班。', () => '顺序：市民遗忘 → 登记城市 → 建成管理局 → 你开始值班。失主选“我自己”。'] }
  };
  function hydrate(s, raw) {
    const savedRng = s.rng;
    if (!s.casebook) {
      const route = [['昨天', '今天', '明天'], ['今天', '明天', '昨天'], ['明天', '昨天', '今天']][Math.floor(B.random(s) * 3)];
      s.casebook = { active: 'station', cases: {} };
      for (const id of ORDER) s.casebook.cases[id] = { room: 'hall', found: [], solved: false, hints: 0, attempts: 0, box: 1 + Math.floor(B.random(s) * 9), day: 10 + Math.floor(B.random(s) * 19), route: [...route], resolution: null };
    }
    if (raw && typeof raw === 'object' && raw.cases) {
      for (const id of ORDER) {
        const x = raw.cases[id], c = s.casebook.cases[id]; if (!x || typeof x !== 'object') continue;
        c.room = Object.hasOwn(DATA[id].rooms, x.room) ? x.room : 'hall'; c.found = [...new Set(Array.isArray(x.found) ? x.found.filter(k => Object.hasOwn(DATA[id].evidence, k)) : [])];
        c.solved = x.solved === true && (id === 'station' || s.casebook.cases[ORDER[ORDER.indexOf(id) - 1]].solved);
        c.hints = Number.isInteger(x.hints) ? Math.max(0, Math.min(3, x.hints)) : 0;
        c.attempts = Number.isInteger(x.attempts) ? Math.max(0, Math.min(1e6, x.attempts)) : 0;
        c.box = Number.isInteger(x.box) && x.box >= 1 && x.box <= 9 ? x.box : c.box;
        c.day = Number.isInteger(x.day) && x.day >= 10 && x.day <= 28 ? x.day : c.day;
        if (Array.isArray(x.route) && x.route.length === 3 && new Set(x.route).size === 3 && x.route.every(v => ['昨天', '今天', '明天'].includes(v))) c.route = [...x.route];
        c.resolution = ['return', 'seal'].includes(x.resolution) ? x.resolution : null;
      }
      s.casebook.active = ORDER.includes(raw.active) && unlocked(s, raw.active) ? raw.active : 'station';
      // Preserve the exact PRNG position: hydration must not reroll imported future outcomes.
      s.rng = savedRng;
    }
    return s;
  }
  function unlocked(s, id) { const i = ORDER.indexOf(id); return i === 0 || i > 0 && s.casebook.cases[ORDER[i - 1]].solved; }
  function act(s, type, p) {
    const id = s.casebook.active, c = s.casebook.cases[id], d = DATA[id];
    if (type === 'case') { if (!unlocked(s, p)) return { ok: false, message: '先破解上一份案件。' }; s.casebook.active = p; return { ok: true }; }
    if (type === 'room') { if (!d.rooms[p]) return { ok: false, message: '未知房间。' }; c.room = p; return { ok: true }; }
    if (type === 'inspect') {
      if (!d.rooms[c.room].things.includes(p)) return { ok: false, message: '这件证物不在当前房间。' };
      if (!c.found.includes(p)) { c.found.push(p); B.gainXP(s, 8); B.log(s, '发现证据：' + d.evidence[p].name + '。调查经验 +8。', 'event'); }
      return { ok: true, evidence: p };
    }
    if (type === 'hint') {
      if (c.hints >= 3) return { ok: false, message: '所有提示已记入笔记。' };
      c.hints++; B.log(s, '你在案卷边缘补了一条推理提示。'); return { ok: true };
    }
    if (type === 'solve') {
      if (c.solved) return { ok: false, message: '这份案件已经结案，可以重读证物或调查新地点。' };
      if (c.room !== 'counter') return { ok: false, message: '到登记窗口提交推理。' };
      if (c.found.length < 3) return { ok: false, message: '至少先取得三件证据，再提交推理。' };
      let correct = false;
      if (id === 'station') correct = String(p.code || '').trim() === String(c.box).padStart(2, '0') + String(c.day).padStart(2, '0') && p.owner === 'me';
      else if (id === 'tuesday') correct = Array.isArray(p.order) && p.order.join('|') === [...c.route].reverse().join('|');
      else correct = Array.isArray(p.order) && p.order.join('|') === 'forget|register|bureau|shift' && p.owner === 'me';
      if (!correct) { c.attempts++; const penalty = B.level(s) >= 2 ? 1 : 2; s.stability = Math.max(0, s.stability - penalty); B.log(s, '推理有一处矛盾。你退回现场重新核对。稳定度 −' + penalty + '。', 'warning'); return { ok: false, message: '登记被退回。检查线索之间的关系；可以随时查看分级提示。' }; }
      c.solved = true; c.resolution = p.resolution === 'seal' ? 'seal' : 'return'; B.gainXP(s, d.xp);
      const techs = id === 'station' ? ['catalog', 'imprint', 'recall'] : id === 'tuesday' ? ['mapping', 'binding', 'charter'] : ['deep', 'municipal'];
      for (const t of techs) if (!s.tech.includes(t)) s.tech.push(t);
      if (id === 'station') { s.buildings.shelf = Math.max(1, s.buildings.shelf); s.buildings.office = Math.max(1, s.buildings.office); s.buildings.inbox = Math.max(1, s.buildings.inbox); B.log(s, '你领回了自己的倒影。女人留下收件箱和一间办公室的钥匙，管理局正式开门。', 'story'); }
      if (id === 'tuesday') { s.buildings.vault = Math.max(1, s.buildings.vault); B.log(s, c.resolution === 'return' ? '你归还了那份等待。走廊的钟终于走过星期二。信任 +8。' : '你封存了那份等待。钟声归来，抽屉里多了几段记忆。信任 −3。', 'story'); s.trust = Math.max(0, Math.min(100, s.trust + (c.resolution === 'return' ? 8 : -3))); }
      if (id === 'city') { s.buildings.machine = 1; s.ended = true; B.log(s, '城市的失主，是曾经决定遗忘的你。遗忘协议已经备妥；这一次，选择权仍属于你。', 'story'); }
      const aid = id === 'station' ? ['umbrella', 'ticket'] : id === 'tuesday' ? ['clock', 'name'] : ['city', 'stamp'];
      const chosen = aid[Math.floor(B.random(s) * aid.length)];
      if (!s.artifacts.includes(chosen)) s.artifacts.push(chosen);
      if (!s.seen.includes(chosen)) s.seen.push(chosen); s.stats.rare++;
      const rewards = id === 'station' ? { clues: 28, ink: 16, memory: 8 } : id === 'tuesday' ? { clues: 40, ink: 28, memory: 18, anchors: 10, fragments: 3 } : { memory: 30, anchors: 18, ink: 35, fragments: 5 };
      if (c.resolution === 'seal') { rewards.memory = (rewards.memory || 0) + 8; s.stability = Math.max(0, s.stability - 3); }
      const cap = B.caps(s); for (const [k, v] of Object.entries(rewards)) s.r[k] = Math.min(cap[k], s.r[k] + v);
      B.log(s, '案件 ' + d.number + ' 完成，经验 +' + d.xp + '。获得藏品「' + B.ARTIFACTS[chosen].name + '」并解锁新的经营技术。', 'rare');
      return { ok: true, solved: true };
    }
    return { ok: false, message: '未知现场操作。' };
  }
  return { ORDER, DATA, hydrate, unlocked, act };
});
