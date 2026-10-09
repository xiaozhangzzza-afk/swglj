(function () {
  'use strict';
  const B = window.Bureau, C = window.Cases, P = window.Progression, H = window.BureauHelp;
  const params = new URLSearchParams(location.search), testSlot = (params.get('slot') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
  const KEY = 'lost-property-bureau-v1' + (params.get('test') === '1' ? '-test' + (testSlot ? '-' + testSlot : '') : ''), BACKUP = KEY + '-backup', LEASE = KEY + '-lease';
  const session = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
  const $ = id => document.getElementById(id);
  const esc = x => String(x).replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]);
  const fmt = n => n >= 10000 ? (n / 1000).toFixed(1) + 'k' : n >= 100 ? Math.floor(n).toString() : Math.floor(n * 10) / 10 + '';
  let state, tab = 'case', lastStructure = '', lastView = '', lastJournal = '', lastEvent = '', introOpen = false, toastTimer, saveAvailable = true, owner = true, lastTick = Date.now(), lastSave = 0, pendingImport = null;
  function warn(message) { $('storage-warning').hidden = false; $('storage-warning').textContent = message; }
  function deserialize(raw) { const data = typeof raw === 'string' ? JSON.parse(raw) : raw; const s = B.restore(data); const rng = s.rng; C.hydrate(s, data.casebook); s.rng = rng; return s; }
  function claim(force = false) {
    try {
      const lock = JSON.parse(localStorage.getItem(LEASE) || 'null');
      if (!force && lock && lock.session !== session && Date.now() - lock.time < 12000) { owner = false; return false; }
      localStorage.setItem(LEASE, JSON.stringify({ session, time: Date.now() })); owner = true; return true;
    } catch { saveAvailable = false; return true; }
  }
  function save() {
    if (!owner) return false;
    state.lastSaved = Date.now();
    try {
      const old = localStorage.getItem(KEY);
      if (old) { try { deserialize(old); localStorage.setItem(BACKUP, old); } catch { /* Retain valid backup when main data is corrupt. */ } }
      localStorage.setItem(KEY, JSON.stringify(state)); saveAvailable = true; lastSave = Date.now();
      $('save-status').textContent = '已保存 · ' + new Date(lastSave).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); return true;
    } catch { saveAvailable = false; $('save-status').textContent = '未能自动保存'; warn('浏览器未允许本地存档。请在「存档与说明」中导出存档，避免关闭后丢失进度。'); return false; }
  }
  function load() {
    let raw;
    try { raw = localStorage.getItem(KEY); }
    catch { saveAvailable = false; }
    if (raw) {
      try { state = deserialize(raw); }
      catch {
        try { state = deserialize(localStorage.getItem(BACKUP)); warn('主存档无法读取，已恢复上一次自动备份。'); }
        catch { state = C.hydrate(B.fresh()); warn('存档无法读取，已建立新局；原数据未删除，可在设置中导出备份。'); }
      }
    } else state = C.hydrate(B.fresh());
    if (!claim()) { warn('另一个页面正在值班。本页仅供查看；关闭另一个页面后，可在设置中接管值班。'); return; }
    const elapsed = Math.max(0, (Date.now() - state.lastSaved) / 1000);
    if (elapsed > 15 && !state.paused) { B.advance(state, Math.min(7200, elapsed)); B.log(state, '离开期间经营了 ' + Math.floor(Math.min(elapsed, 7200) / 60) + ' 分钟（上限 2 小时）。证物不会自动调查，待处理事件仍等你决定。', 'story'); }
    if (!saveAvailable) warn('本地存储不可用。仍可游玩，请定期导出存档。');
  }
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4300); }
  function modal(title, body) { $('modal-title').textContent = title; $('modal-body').innerHTML = body; if (!$('modal').open) $('modal').showModal(); }
  function helpResults(query = '') {
    const results = H.search(query);
    $('help-results').innerHTML = '<p class="progress-label">' + (query.trim() ? '找到 ' + results.length + ' 条说明' : '你可能想问') + '</p>' + (results.length ? results.map(e => button(esc(e.question), 'help-question', e.id, null, 'secondary')).join('') : '<p>暂时没有对应说明。试试“经验”“道具”“存档”或“实验”。</p>');
  }
  function showHelp() {
    modal('查阅玩法', '<div class="help-search"><label for="help-query">搜索玩法问题</label><input type="search" id="help-query" maxlength="80" placeholder="例如：经验、道具、存档" autocomplete="off"><div id="help-results"></div><section id="help-answer" aria-live="polite"></section><small>本机说明检索 · 不联网 · 不自动泄露谜底</small></div>');
    helpResults(); $('help-query').focus();
  }
  function showHelpAnswer(id) {
    const entry = H.entries.find(e => e.id === id); if (!entry || !$('help-answer')) return;
    const context = id === 'next' ? '此刻的目标：' + (P.has(state, 'map') ? C.objective(state) : '观察大厅的招领须知，再查看旁边的镜子。') : '';
    $('help-answer').innerHTML = '<h3>' + esc(entry.question) + '</h3><p>' + esc(entry.answer) + '</p>' + (context ? '<p class="hint-note">' + esc(context) + '</p>' : '');
  }
  function experimentRecord(controls = false) {
    if (state.casebook.active !== 'station') return '';
    const actions = controls ? C.actions(state).filter(a => a.group === 'experiment') : [], records = C.experiments(state);
    if (!actions.length && !records.length) return '';
    return '<details class="experiment-record"><summary>现场验证 · 可选' + (records.length ? ' / 已记录 ' + records.length + ' 次' : '') + '</summary><p>改变现场条件，再比较结果。实验不加经验，不影响结案。</p>' + actions.map(a => a.done ? '<p>✓ ' + esc(a.label) + '</p>' : '<div>' + button(esc(a.label), 'interact', a.id, null, 'secondary') .replace('data-do=', (a.reason ? 'disabled ' : '') + 'data-do=') + (a.reason ? '<small class="action-requirement">' + esc(a.reason) + '</small>' : '') + '</div>').join('') + records.map(r => '<article><strong>' + esc(r.label) + '</strong><p>' + esc(r.record) + '</p></article>').join('') + '</details>';
  }
  function costs(cost) { return Object.entries(cost).map(([k, v]) => '<span data-material="' + k + '" data-needed="' + v + '" class="' + (state.r[k] + 1e-8 < v ? 'shortage' : '') + '">' + B.RES[k].name + ' ' + v + '</span>').join(' · '); }
  function button(label, action, value = '', cost = null, extra = '') { return '<button class="button ' + extra + '" data-do="' + action + '" data-value="' + esc(value) + '"' + (cost ? ' data-cost="' + esc(JSON.stringify(cost)) + '"' : '') + '>' + label + '</button>'; }
  function heading(title, desc, label = 'BUREAU / 009') { return '<div class="page-heading"><div><span class="tiny-label">' + label + '</span><h1>' + title + '</h1><p>' + desc + '</p></div><div class="folio">案卷 ' + state.era.toString().padStart(3, '0') + '<br>保管中</div></div>'; }
  function caseTabs() { if (C.ORDER.filter(id => C.unlocked(state, id)).length === 1) return ''; return '<div class="case-tabs">' + C.ORDER.filter(id => C.unlocked(state, id)).map(id => '<button class="case-tab ' + (state.casebook.active === id ? 'active' : '') + '" data-do="case" data-value="' + id + '"' + (!C.unlocked(state, id) ? ' disabled' : '') + '><strong>' + C.DATA[id].number + '</strong>' + C.DATA[id].name + '<span>' + (state.casebook.cases[id].solved ? '已结案' : C.unlocked(state, id) ? '待查' : '未显现') + '</span></button>').join('') + '</div>'; }
  function currentGuide() {
    const id = state.casebook.active, c = state.casebook.cases[id], d = C.DATA[id];
    if (!c.solved && (!C.field(c).flags.includes(C.CONFIG[id].done) || id === 'station' && C.nextStep(state))) return { step: '实操', title: '先改变现场，再提交推理', text: C.objective(state) + '。沿地图连接移动；道具不会因重试丢失。' };
    if (c.solved) return { step: '已结案', title: id === 'city' ? '决定这座城市的去向' : '下一处异常已经显现', text: id === 'city' ? '查看藏品与传承。可以继续经营，也可以主动选择下一轮。' : '点击下方“进入下一份案卷”。也可以回局安排员工，试试新解锁的生产链。' };
    if (!c.found.length) return { step: '01', title: '先观察现场', text: '点击带问号的证物，阅读后关闭弹窗。切换房间，看看证物之间有哪些矛盾。' };
    if (c.found.length < 3) return { step: '02', title: '到其他房间补齐证据', text: '已记录 ' + c.found.length + ' 件证物。点击房间名称切换地点；首次发现每件证物都会增加经验。' };
    if (!state.ui.notebookOpened) return { step: '03', title: '比对调查笔记', text: '打开“调查笔记”，把不同物品上的信息连起来。主线无需等资源，也没有解谜倒计时。' };
    if (c.room !== 'counter') return { step: '04', title: '准备提交推理', text: '到“' + d.rooms.counter.name + '”填写答案。不确定时，可点“需要一点提示”，提示逐层展开。' };
    return { step: '04', title: '核对你的答案', text: '根据已记录的证据填写登记表。错误可以重试；提示的最后一级会解释完整解法。' };
  }
  function guideStrip() { if (!P.has(state, 'map') || state.ui.walkthrough) return ''; const g = currentGuide(); return '<div class="guide-strip"><span class="guide-number">' + g.step + '</span><p><strong>' + g.title + '</strong><br>' + g.text + '</p><button class="quiet-button" data-do="guide">玩法</button></div>'; }
  function showGuide(intro = false) {
    introOpen = intro;
    if (!P.has(state, 'work')) { modal('此刻怎么调查', '<p>先点击证物，读完观察记录。地图出现后，沿相邻区域移动；拿到道具后，尝试对现场机关使用它。</p><p>不必等资源，没有倒计时。遇到困难再查看提示。</p><div class="button-row">' + button('带我体验', 'guided-start') + button('回到现场', 'start-investigation', '', null, 'secondary') + '</div>'); return; }
    const steps = [['1', '拿取与操作', '沿相邻区域移动，拿取道具，给设备接电或修复机关。背包和地图会随操作改变；金色实操向导可随时开启。'], ['2', '观察与推理', '点击证物并记录，按线索操作门与街区机关。现场接通后才可填写认领表；不确定时查看分级提示。'], ['3', '结案与成长', '结案获得经验、随机藏品、材料与技术。共十五级资历，4 / 8 / 12 级额外开放侧室，主线无需刷等级。'], ['4', '经营与再出发', '回局安排岗位、生产补给；短程调查可刷不同藏品。完成本章后可主动轮回，保留等级与传承。']];
    let body = '<p class="intro-story">你接手一间收容失物的小办公室。今天的第一张登记单，似乎与你有关。</p><p>这是以诡异解谜为主的文字游戏，穿插自动经营、随机调查和主动轮回。首版有三个连贯案件；先从现场开始，不需要等待库存积累。</p>' + steps.map(([n, title, text]) => '<div class="guide-step"><span class="number">' + n + '</span><div><strong>' + title + '</strong><p>' + text + '</p></div></div>').join('');
    if (!intro) {
      const g = currentGuide(); body += '<div class="guide-section"><h3>此刻该做什么</h3><p>' + g.title + '：' + g.text + '</p></div><div class="guide-section"><h3>经营怎么帮调查</h3><p>按“招聘 → 分配岗位 → 检查库存每秒变化”的顺序建立生产链。收件员给分拣员供料；线索可以造墨、追忆，记忆与墨可以装订现实锚。研究和藏品提高效率。</p><p>经营、回访都是主线之外的选择。三个主线案件直接提供核心技术，避免卡在资源等待上。满库时对应加工会停止，缺原料也会停止；负的每秒速率说明消耗多于生产。</p></div><div class="guide-section"><h3>几个要记住的词</h3><dl class="glossary"><dt>证物</dt><dd>现场的文字线索，保存在笔记里；不消耗、不必反复拾取。</dd><dt>线索</dt><dd>局内生产用的资源，和现场证物不同。来自失物分拣，消耗于研究与加工。</dd><dt>记忆</dt><dd>追回的过去。满库比例越高，现实负担越重；可以加工成现实锚，也能主动遗忘。</dd><dt>稳定度</dt><dd>现实能否容纳这些过去。低于 35 时生产变慢；不会强制失败或重开。</dd><dt>信任</dt><dd>员工对管理局的认同，影响产量。事件处置与社会方针会改变它。</dd><dt>藏品</dt><dd>随机得到的本轮被动加成。首轮主线每案必得一件；重复回访有保底。</dd><dt>回声</dt><dd>主动轮回时带走的永久成果。每点使全链生产 +3.5%，与永久传承叠加。</dd></dl></div><div class="guide-section"><h3>运气与失败</h3><p>案件参数每轮会变，但线索与正确答案一一对应。同局刷新不会重抽。错误推理只扣少量稳定，可以重新校验；三级提示免费。短程调查会随机发生干扰，仍至少带回一片碎片，稀有藏品也有保底。</p></div><div class="guide-section"><h3>时间与存档</h3><p>观察和推理没有倒计时。“暂停”只冻结自动生产、来访与外出倒计时，你仍能观察现场、阅读笔记与解谜。离开后最多补算两小时经营。</p><p>每十秒自动保存，也在操作后保存。建议用顶部“存档”导出备份；换浏览器或游戏地址时，再导入文件。</p></div>';
    }
    body += '<p>现场需要亲自拿取与使用道具、修复机关、沿相邻区域移动。仅填写正确答案不能跳过现场。每案至少七个区域，等级 4 / 8 / 12 还会开放额外侧室。</p><div class="button-row">' + button('带我体验 · 开启实操向导', 'guided-start', '', null, 'gold') + button(intro ? '自由开始调查' : '返回当前现场', 'start-investigation', '', null, 'secondary') + (!intro ? button('查看升级奖励', 'levels', '', null, 'secondary') : '') + '</div>';
    modal(intro ? '第一天值班 · 入职指引' : '玩法与操作指引', body);
  }
  function evidenceContent(id, key) { const d = C.DATA[id].evidence[key], c = state.casebook.cases[id]; return '<p class="evidence-read">' + esc(d.read(c)) + '</p>' + (B.level(state) >= 4 ? '<p class="deep-note">辨识 / ' + esc(d.deep) + '</p>' : '') + '<p class="progress-label">已记入调查笔记。首次发现证物获得 8 经验。</p>'; }
  function puzzleForm(id, c) {
    const select = (name, label, options) => '<div><label for="' + name + '">' + label + '</label><select id="' + name + '" name="' + name + '"><option value="">请选择</option>' + options.map(([v, t]) => '<option value="' + esc(v) + '">' + esc(t) + '</option>').join('') + '</select></div>';
    const owners = [['me', '我自己'], ['woman', '提伞女人'], ['citizens', '全体市民'], ['nobody', '无人']];
    let fields = '';
    if (id === 'station') fields = '<label for="code">四位取件码</label><input id="code" name="code" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]{4}" placeholder="0000" required>' + select('owner', '被登记为失物的是', owners);
    else if (id === 'tuesday') fields = '<div class="sequence">' + [1, 2, 3].map(n => select('order' + n, '第 ' + n + ' 扇门', ['昨天', '今天', '明天'].map(k => [k, k]))).join('') + '</div>';
    else fields = '<div class="sequence">' + [1, 2, 3, 4].map(n => select('order' + n, '第 ' + n + ' 件事', [['shift', '你开始值班'], ['register', '登记城市'], ['forget', '市民遗忘'], ['bureau', '建成管理局']])).join('') + '</div>' + select('owner', '城市的失主', owners);
    if (id !== 'station') fields += select('resolution', '破解后如何处置这份过去', [['return', '归还：让失主放下等待'], ['seal', '封存：额外记忆 +8，稳定度 −3']]);
    return '<form id="puzzle-form" class="puzzle-form"><h2>提交你的推理</h2><p class="progress-label">没有倒计时。错误校验仅扣 ' + (B.level(state) >= 2 ? 1 : 2) + ' 点稳定度，可重新核对。</p>' + fields + '<div class="button-row"><button class="button gold" type="submit">' + (id === 'tuesday' ? '校验归途' : '核对登记') + '</button><button type="button" class="button secondary" data-do="hint">查看提示</button></div></form>';
  }
  function walkthrough() {
    const id = state.casebook.active, c = state.casebook.cases[id], f = C.field(c);
    if (!P.has(state, 'map')) return { title: '先观察眼前的证物', text: '点击招领须知，再观察旁边的镜子。记录两条观察后，现场地图会出现。', action: 'inspect', value: c.found.includes('notice') ? 'mirror' : 'notice' };
    if (c.solved) return { title: '体验完成', text: '你已经完成道具收集、设备修复、通路解锁与认领。可退出向导，进入下一案自由调查。' };
    if (id !== 'station') return { title: '现在由你来调查', text: '你已经学会移动、拿取、使用道具和记录证物。这一案不再高亮正确门或开关；先观察现场，必要时主动查看分级提示。' };
    if (c.room === 'bench' && !f.flags.includes('opened') && !f.items.includes('pin') && !f.items.includes('fuse')) return { title: '先选择一条进入路线', text: '取保险丝：修电后找钥匙，比较安全。取发夹：从镜后绕入，稳定度会损失 2 点，但能看到不同现场。两条路都能通关，也能稍后探索另一条。', action: 'choose-route' };
    let step = C.nextStep(state);
    let target = step && step[1], action = 'interact', value = step && step[0];
    if (!step) {
      const room = Object.entries(C.DATA[id].rooms).find(([k, r]) => !C.optional(k) && r.things.some(t => !c.found.includes(t)));
      if (room) { target = room[0]; action = 'inspect'; value = room[1].things.find(t => !c.found.includes(t)); }
      else { target = 'counter'; action = 'submit'; }
    }
    if (c.room !== target) {
      const queue = [[c.room]], seen = new Set([c.room]); let path;
      while (queue.length) { const next = queue.shift(), at = next[next.length - 1]; if (at === target) { path = next; break; } for (const k of C.LINKS[at]) if (!seen.has(k) && !C.blocked(state, k)) { seen.add(k); queue.push([...next, k]); } }
      return { title: '沿地图移动', text: '下一项是' + (step ? step[2] : action === 'inspect' ? '记录证物' : '填写认领表') + '。先进入「' + (path ? C.DATA[id].rooms[path[1]].name : '大厅') + '」；地图只能走相邻连接。', action: 'room', value: path && path[1] };
    }
    return { title: step ? step[2] : action === 'inspect' ? '观察并记录证物' : '最后一步：亲自认领', text: step ? '点击下方现场操作。拿到的道具会留在背包，修复后的门锁会立即改变地图。' : action === 'inspect' ? '点亮的证物会打开观察记录。读完后关闭记录，向导会继续下一步。' : '参考调查笔记填写登记表。向导不替你填答案；遇到困难可以逐层查看提示。', action, value };
  }
  function renderCase() {
    const id = state.casebook.active, c = state.casebook.cases[id], d = C.DATA[id], room = d.rooms[c.room];
    const photo = { station: ['lost-property-office-horror.png', '恐怖悬疑现场留影：潮湿招领处，镜中的长椅与现实错位，空房间里留着人形暗影。'], tuesday: ['tuesday-corridor-horror.png', '恐怖悬疑现场留影：重复的无人走廊，关闭的木门在积水中留下暖光。'], city: ['city-archive-horror.png', '恐怖悬疑现场留影：无人档案馆，亮着微光的城市模型在墙上投出过大的影子。'] }[id];
    let html = heading('案卷 ' + d.number + ' · ' + d.name, d.intro, 'INVESTIGATION / 独立调查现场') + caseTabs();
    const f = C.field(c), help = walkthrough();
    if (C.opening(state, id)) html += '<p class="handoff-note">' + esc(C.opening(state, id)) + '</p>';
    html += '<div class="field-objective"><strong>现场目标</strong> ' + esc(P.has(state, 'map') ? C.objective(state) : c.found.length ? '镜子就在告示旁。试着观察它。' : '先看看墙上的招领须知。') + ' ' + (P.has(state, 'map') ? button(state.ui.walkthrough ? '退出实操引导' : '带我走一遍', 'walkthrough', '', null, 'secondary') : '') + '</div>';
    if (state.ui.walkthrough) html += '<div class="walkthrough-panel" role="status"><strong>实操向导 · ' + help.title + '</strong><p>' + help.text + '</p><small>请点击带金色边框的操作。你亲自操作，向导不会自动完成或扣除资源。</small></div>';
    html += '<div class="field-layout"><div class="field-scene-column"' + (!P.has(state, 'map') ? ' hidden' : '') + '><div class="scene field-scene"><figure><img src="assets/' + photo[0] + '" alt="' + photo[1] + '" width="1536" height="1024"><span class="photograph-label">现场留影 / ' + d.number + '</span><figcaption><strong>' + d.location + '</strong><span>案卷 ' + d.number + ' / ' + room.name + '</span></figcaption></figure></div>';
    html += '<div class="room-nav field-room-nav" aria-label="现场地图">' + Object.entries(d.rooms).filter(([k]) => !C.blocked(state, k)).map(([k, r]) => { const reason = C.blocked(state, k), adjacent = C.LINKS[c.room].includes(k); return '<button data-do="room" data-value="' + k + '" class="' + (c.room === k ? 'active' : '') + ' ' + (state.ui.walkthrough && help.action === 'room' && help.value === k ? 'guided-target' : '') + '" title="' + esc(reason || (c.room === k ? '当前所在区域' : adjacent ? '可沿连接进入' : '请先走到相邻区域')) + '"' + (c.room === k || !adjacent || reason ? ' disabled' : '') + '><span>' + r.name + '</span><small>' + (reason ? '锁定' : c.room === k ? '你在这里' : adjacent ? '可进入' : f.visited.includes(k) ? '已到访' : '未到访') + '</small></button>'; }).join('') + '</div><p class="map-legend">' + esc(d.rooms.hall.name) + '连接其余区域；' + esc(d.rooms.tunnel.name) + '需经' + esc(d.rooms.workshop.name) + '进入。</p><div class="field-bottom"><span>现场观察没有倒计时</span><button class="quiet-button" data-do="goto" data-value="notebook">调查笔记</button><button class="quiet-button" data-do="goto" data-value="work">返回管理局</button></div></div>';
    html += '<aside class="field-controls" aria-label="现场观察与推理"><div class="field-control-title"><span class="tiny-label">当前地点</span><h2>' + room.name + '</h2></div><p class="scene-copy">' + esc(P.has(state, 'map') ? C.describe(state) : '雨后的大厅没有人声。墙上钉着一张招领须知，镜子里映着一排空椅子。') + '</p><div class="evidence-grid">' + room.things.filter((k, i) => P.has(state, 'map') || i === 0 || c.found.includes(room.things[0])).map(k => '<button class="evidence-card ' + (c.found.includes(k) ? 'found' : '') + '" data-do="inspect" data-value="' + k + '"><span class="evidence-icon">' + (c.found.includes(k) ? '✓' : '？') + '</span><span><strong>' + d.evidence[k].name + '</strong><small>' + (c.found.includes(k) ? '已记录 · 点击重读' : (P.has(state, 'career') ? '观察并记录 · +8 经验' : '观察')) + '</small></span></button>').join('') + '</div>';
    html += '<div class="case-help"' + (!P.has(state, 'notebook') ? ' hidden' : '') + '><span>已收集 ' + c.found.length + ' / ' + Object.keys(d.evidence).length + ' 件证物 · 已校验 ' + c.attempts + ' 次</span><button class="quiet-button" data-do="goto" data-value="notebook">打开调查笔记</button></div>';
    html += '<div class="field-inventory"' + (!P.has(state, 'inventory') ? ' hidden' : '') + '><strong>随身道具</strong><p>' + (f.items.length ? f.items.map(k => esc(C.ITEMS[k])).join(' · ') : '暂无。寻找可拿取的物件。') + '</p></div><div class="field-actions"' + (!P.has(state, 'map') ? ' hidden' : '') + '>' + C.actions(state).filter(a => a.group !== 'experiment' && (!['sense','read','compare'].includes(a.id) || P.has(state, 'career') && !a.reason)).map(a => a.done ? '<span class="tag">✓ ' + esc(a.label) + '</span>' : '<div>' + '<button class="button ' + (state.ui.walkthrough && help.action === 'interact' && help.value === a.id ? 'guided-target' : 'secondary') + '" data-do="interact" data-value="' + esc(a.id) + '"' + (a.reason ? ' disabled' : '') + '>' + esc(a.label) + '</button>' + (a.reason ? '<small class="action-requirement">' + esc(a.reason) + '</small>' : '') + '</div>').join('') + '</div>';
    html += experimentRecord(true);
    if (f.sequence.length) html += '<p class="sequence-state">已操作：' + esc(f.sequence.join(' → ')) + ' · 下一步  ' + (f.sequence.length + 1) + '/3</p>';
    if (c.solved) html += '<div class="solved-banner"><strong>结案 / ' + d.name + '</strong><p>' + (id === 'city' ? '这座城市等待你的最后决定。可以继续经营，或选择传承开始下一轮。' : '新地点已显现，管理局也获得了新的设备、材料与研究权限。') + '</p>' + button(id === 'city' ? '查看传承与结局' : '进入下一份案卷', id === 'city' ? 'goto' : 'case', id === 'city' ? 'legacy' : C.ORDER[C.ORDER.indexOf(id) + 1]) + '</div>';
    else if (c.room === 'counter' && f.flags.includes(C.CONFIG[id].done)) html += puzzleForm(id, c);
    else if (c.room === 'counter') html += '<p class="mini-guide">认领表尚未启用，请先完成上方现场操作。</p>';
    else if (P.has(state, 'map')) html += '<div class="button-row"><button class="quiet-button" data-do="hint">需要一点提示</button></div>';
    if (c.hints) html += '<div class="hint-note">' + C.hint(state).slice(0, c.hints).map(h => '<p>' + esc(h) + '</p>').join('') + '</div>';
    if (id === 'station') html += truthRecord();
    html += guideStrip() + '<div class="field-status"><span>稳定 <strong data-field-stability>' + Math.round(state.stability) + '%</strong></span><span>资历 <strong data-field-level>Lv.' + B.level(state) + '</strong></span><button class="text-button" data-do="goto" data-value="work" id="field-event-status">局内经营持续进行</button></div>';
    return html + '</aside></div>';
  }
  function truthRecord() {
    const t = C.truth(state);
    if (!t.available) return '';
    return '<section class="truth-record"><h2>附查：谁把你寄存在这里？</h2><p>' + (t.complete ? '寄存人已暂定，动机未明。交接员的关系记录会进入第二案。' : '认领可以结束，真相仍可追查。这份附查不影响结案；也可结案后回来。') + '</p><ol>' + t.steps.map(a => '<li><strong>' + esc(a.room) + ' · ' + (a.done ? '已核验' : '待核验') + '</strong><p>' + esc(a.done ? a.record : a.label) + '</p></li>').join('') + '</ol></section>';
  }
  function renderNotebook() {
    let html = heading('调查笔记', '证词可以说谎。物品有时也会。但关系会留下痕迹。', 'FIELD NOTES / 证物档案') + caseTabs();
    const id = state.casebook.active, c = state.casebook.cases[id], d = C.DATA[id];
    html += '<div class="panel"><h2>案卷 ' + d.number + ' · ' + d.name + '</h2><p>' + d.intro + '</p>';
    if (!c.found.length) html += '<div class="empty-state">还没有记录证物。进入现场，点击可观察的物品。</div>';
    else html += c.found.map(k => '<article class="notebook-item"><h3>' + d.evidence[k].name + '</h3><p>' + esc(d.evidence[k].read(c)) + '</p>' + (B.level(state) >= 4 ? '<p class="deep-note">辨识 / ' + d.evidence[k].deep + '</p>' : '') + '</article>').join('');
    html += '</div><div class="button-row">' + button('返回现场', 'goto', 'case') + button('获得下一条提示', 'hint', '', null, 'secondary') + '</div>';
    if (c.hints) html += '<div class="panel accent" style="margin-top:18px"><h2>推理提示</h2>' + C.hint(state).slice(0, c.hints).map(h => '<p>' + esc(h) + '</p>').join('') + '</div>';
    return html + experimentRecord();
  }
  function renderWork() {
    const recipes = [['sort', '分拣失物', { items: 6 }, '线索 +4'], ['ink', '调制档案墨', { clues: 6 }, '档案墨 +3'], ['memory', '追回记忆', { clues: 6, ink: 2 }, '记忆 +4'], ['anchor', '装订现实', { memory: 5, ink: 3 }, '现实锚 +4']].filter(x => x[0] !== 'memory' && x[0] !== 'anchor' || B.has(state, x[0] === 'memory' ? 'recall' : 'binding'));
    let html = heading('局内经营', '让收件桌保持运转。案件不受资源门槛限制，经营为重复调查提供补给。', 'OPERATIONS / 收容与加工');
    html += '<p class="mini-guide">先亲自拾取或加工一批失物。熟悉材料后，再登记员工、分配岗位；库存每秒速率会告诉你哪里缺料。</p>';
    html += '<div class="panel accent"><h2>街道每天都在遗失一些东西</h2><p>手动收件有约 7.5% 的稀有发现机会。普通收件也会积累材料；后期可收到异常碎片。</p>' + button('去街上拾取失物', 'search') + '</div><div class="card-grid">' + recipes.map(([id, name, cost, desc]) => '<div class="action-card"><strong>' + name + '</strong><p>' + desc + '</p><div class="cost">' + costs(cost) + '</div>' + button('加工一批', 'craft', id, cost, 'secondary') + '</div>').join('') + '</div><div class="section-heading"><h2>设施扩建</h2><span>后续造价 ×1.48</span></div><div class="card-grid">';
    html += Object.entries(B.BUILDINGS).filter(([, d]) => B.available(state, d)).map(([id, d]) => { const cost = B.cost(state, id), maxed = state.buildings[id] >= (d.max || 30); return '<div class="management-card"><h3>' + d.name + '<small>×' + state.buildings[id] + '</small></h3><p>' + d.text + '</p><div class="cost">' + costs(cost) + '</div>' + (maxed ? '<span class="tag">已完成</span>' : button('修建', 'build', id, cost)) + '</div>'; }).join('');
    return html + '</div>';
  }
  function renderStaff() {
    let html = heading('员工与方针', '每个岗位都连接一段生产链。待命员工不会自动分配。', 'PERSONNEL / 姓名登记');
    if (!B.has(state, 'catalog')) return html + '<div class="empty-state">完成第一份案件，或研究「给无主之物编号」后，员工登记开放。</div>';
    const cost = B.hireCost(state);
    html += '<div class="panel"><div class="stat-line"><span>员工<strong>' + state.workers.length + ' / ' + B.seats(state) + '</strong></span><span>待命<strong>' + (state.workers.length - B.assigned(state)) + '</strong></span></div><p>' + (state.workers.length ? state.workers.map(esc).join('、') : '还没有人知道这间办公室。') + '</p><div class="cost">入职登记：' + costs(cost) + '</div>' + button('登记一名新员工', 'hire', '', cost) + '</div><div class="panel">';
    html += Object.entries(B.JOBS).filter(([, j]) => B.has(state, j.tech)).map(([id, j]) => '<div class="job-row"><div><strong>' + j.name + '</strong><p>' + j.text + '</p></div><div class="stepper"><button data-do="job" data-value="' + id + '" data-delta="-1" aria-label="减少一名' + j.name + '">−</button><span data-job="' + id + '">' + state.jobs[id] + '</span><button data-do="job" data-value="' + id + '" data-delta="1" aria-label="增加一名' + j.name + '">+</button></div></div>').join('');
    html += '</div><div class="section-heading"><h2>社会方针</h2><span>可以随时调整</span></div>';
    if (!B.has(state, 'charter')) return html + '<div class="empty-state">破解星期二案件，或完成「管理局章程」后开放方针。</div>';
    return html + '<div class="card-grid">' + Object.entries(B.POLICIES).map(([id, p]) => '<div class="management-card policy-card ' + (state.policy === id ? 'selected' : '') + '"><h3>' + p.name + '</h3><p>' + p.text + '</p>' + button(state.policy === id ? '当前方针' : '采用', 'policy', id, null, 'secondary') + '</div>').join('') + '</div>';
  }
  function renderResearch() {
    let html = heading('档案研究', '破解案件会直接授予核心技术；额外研究让经营更从容。', 'RESEARCH / 现实的注释');
    html += '<div class="card-grid">' + Object.entries(B.TECH).filter(([id, d]) => B.has(state, id) || d.deps.every(k => B.has(state, k))).map(([id, d]) => { const done = B.has(state, id), available = d.deps.every(k => B.has(state, k)); return '<div class="management-card"><h3>' + (available || done ? d.name : '尚未理解的档案') + '</h3><p>' + (available || done ? d.text : '前置：' + d.deps.map(k => B.TECH[k].name).join('、')) + '</p>' + (done ? '<span class="tag">已掌握</span>' : available ? '<div class="cost">' + costs(d.cost) + '</div>' + button('开始研究', 'research', id, d.cost) : '<span class="progress-label">继续调查，前置技术将逐步显现。</span>') + '</div>'; }).join('');
    return html + '</div>';
  }
  function renderExplore() {
    let html = heading('短程调查', '已破解的异常也会再次出现。带回随机补给与不同藏品。', 'EXPEDITIONS / 异常回访');
    if (!B.has(state, 'mapping')) return html + '<div class="empty-state">破解星期二案件后开放回访调查。主线案件始终可以直接探索。</div>';
    if (state.expedition) html += '<div class="panel accent"><h2>' + B.SITES[state.expedition.site].name + ' · 调查中</h2><p data-expedition>正在前进…</p><div class="meter"><i id="expedition-bar"></i></div><p>队伍归来后会自动结算。调查期间调查员不参与局内生产。</p></div>';
    html += '<div class="panel"><p>至少需要一名调查员。首访必获藏品，之后连续 ' + (B.has(state, 'deep') ? 3 : 4) + ' 次必有一次稀有发现。当前保底累计：' + state.pity + ' 次。</p>' + button('安排调查员', 'goto', 'staff', null, 'secondary') + '</div><div class="card-grid">';
    html += Object.entries(B.SITES).filter(([, d]) => B.has(state, d.tech)).map(([id, d]) => '<div class="management-card"><h3>' + d.name + '</h3><p>' + d.subtitle + '</p><p>基础时间 ' + d.time + ' 秒 · 谨慎干扰率 ' + Math.max(0, Math.round((d.risk - 0.1 - Math.max(0, state.jobs.detective - 1) * 0.04) * 100)) + '% · 冒险干扰率 ' + Math.max(0, Math.round((d.risk - Math.max(0, state.jobs.detective - 1) * 0.04) * 100)) + '%</p><div class="cost">' + costs(d.cost) + '</div><div class="button-row">' + button('谨慎调查', 'explore-careful', id, d.cost, 'secondary') + button('冒险调查', 'explore-bold', id, d.cost) + '</div><p>冒险：时间较短、收益 +35%、藏品概率 +15 个百分点。干扰会使补给收益减半，稳定度 −5。</p></div>').join('');
    return html + '</div>';
  }
  function renderLegacy() {
    let html = heading('藏品与传承', '这一轮的异常改变生产方式，调查资历与传承跨轮回保留。', 'COLLECTION / 遗忘之外');
    html += '<div class="panel"><h2>本轮征兆 · ' + B.OMENS[state.omen].name + '</h2><p>' + B.OMENS[state.omen].text + '</p><div class="stat-line"><span>永久回声<strong>' + state.legacy.echoes + '</strong></span><span>全链生产加成<strong>+' + fmt(state.legacy.echoes * 3.5) + '%</strong></span></div><p>档案传承 ' + state.legacy.archive + ' 次 · 工艺传承 ' + state.legacy.industry + ' 次 · 人情传承 ' + state.legacy.humanity + ' 次</p></div><div class="section-heading"><h2>异常藏品</h2><span>' + state.artifacts.length + ' / 6 本轮已收容</span></div><div class="card-grid">';
    html += Object.entries(B.ARTIFACTS).map(([id, d]) => '<div class="management-card"><h3>' + (state.seen.includes(id) ? d.name : '尚未见过的异常') + '</h3><p>' + (state.seen.includes(id) ? d.text : '破解案件或完成短程调查后，可能发现它。') + '</p><span class="tag">' + (state.artifacts.includes(id) ? '本轮效果生效' : state.seen.includes(id) ? '曾见过 · 本轮未收容' : '未收容') + '</span></div>').join('');
    html += '</div><div class="section-heading"><h2>全城遗忘</h2><span>主动选择，永不强制重开</span></div>';
    if (!state.buildings.machine) return html + '<div class="empty-state">破解第三份案件，即可准备遗忘协议。也能通过经营研究建造遗忘机。</div>';
    const echoes = 3 + state.artifacts.length + Math.floor(state.stats.expeditions / 8) + (B.level(state) >= 9 ? 1 : 0);
    return html + '<div class="panel accent"><h2>第一章完成：城市的失主</h2><p>你可以继续保管这座城市。也可以让它再次被遗忘，携带 ' + echoes + ' 回声、一份传承与全部调查资历回到第一天。</p><p>下一轮重置库存、员工、设施、研究、案件和本轮藏品；保留等级、回声、传承与藏品见闻。案件密码、门的次序与奖励会重新随机。</p>' + button('选择永久传承', 'reset-dialog', '', null, 'gold') + '</div>';
  }
  const renderers = { case: renderCase, notebook: renderNotebook, work: renderWork, staff: renderStaff, research: renderResearch, explore: renderExplore, legacy: renderLegacy };
  function render(force = false) {
    const unlocked = P.refresh(state);
    if (!P.has(state, tab)) tab = 'case';
    document.body.classList.toggle('first-observation', !P.has(state, 'map'));
    document.body.classList.toggle('pre-career', !P.has(state, 'career'));
    document.querySelectorAll('[data-tab]').forEach(el => el.hidden = !P.has(state, el.dataset.tab));
    document.querySelector('.career').hidden = !P.has(state, 'career');
    $('case-count').hidden = !state.casebook.cases.station.solved;
    $('resource-bar').hidden = !P.has(state, 'work');
    document.querySelector('.journal-panel').hidden = !P.has(state, 'work');
    if (unlocked.length) { $('feature-discovery').textContent = '发现新功能：' + unlocked.map(k => P.NAMES[k]).join('、') + '。入口已出现，可以按自己的节奏尝试。'; $('feature-discovery').hidden = false; }
    document.body.classList.toggle('field-mode', tab === 'case');
    const structural = JSON.stringify([tab, state.casebook, state.ui, state.tech, state.buildings, state.jobs, state.workers, state.artifacts, state.policy, state.expedition && state.expedition.site, B.level(state), state.paused]);
    if (force || structural !== lastStructure) {
      const view = [tab, state.casebook.active, state.casebook.cases[state.casebook.active].room].join('|');
      const fields = view === lastView ? Array.from(document.querySelectorAll('#puzzle-form input, #puzzle-form select')).map(el => [el.id, el.value]) : [];
      const focused = document.activeElement && document.activeElement.id;
      const experimentOpen = view === lastView && document.querySelector('.experiment-record')?.open;
      $('main').innerHTML = renderers[tab](); lastStructure = structural; lastView = view;
      if (experimentOpen && document.querySelector('.experiment-record')) document.querySelector('.experiment-record').open = true;
      document.querySelectorAll('#main [data-do="goto"]').forEach(el => el.hidden = !P.has(state, el.dataset.value));
      if (tab === 'case' && state.ui.walkthrough) { const g = walkthrough(); for (const el of document.querySelectorAll('#main [data-do]')) if (el.dataset.do === g.action && el.dataset.value === g.value || g.action === 'choose-route' && el.dataset.do === 'interact' && ['take-fuse', 'take-pin'].includes(el.dataset.value)) el.classList.add('guided-target'); if (g.action === 'submit') document.querySelector('#puzzle-form button[type="submit"]')?.classList.add('guided-target'); }
      for (const [id, value] of fields) if ($(id)) $(id).value = value;
      if (focused && $(focused)) $(focused).focus({ preventScroll: true });
      document.querySelectorAll('[data-tab]').forEach(b => { b.classList.toggle('active', b.dataset.tab === tab); b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'); });
    }
    const caps = B.caps(state), rates = B.rates(state), stage = B.stage(state);
    $('resource-bar').innerHTML = Object.entries(B.RES).filter(([, d]) => d.stage <= stage).map(([k, d]) => '<div class="resource ' + (d.stage > stage ? 'locked' : '') + '" title="' + d.text + '"><div class="label"><span>' + (d.stage > stage ? '未显现' : d.name) + '</span><span>' + (d.stage > stage ? '—' : d.unit) + '</span></div><span class="amount">' + (d.stage > stage ? '？' : fmt(state.r[k]) + '<small>/ ' + caps[k] + '</small>') + '</span><span class="rate">' + (d.stage > stage ? '继续调查' : (rates[k] >= 0 ? '+' : '') + rates[k].toFixed(2) + ' / 秒') + '</span><div class="meter"><i style="width:' + (d.stage > stage ? 0 : state.r[k] / caps[k] * 100) + '%"></i></div></div>').join('');
    $('clock').textContent = '第 ' + (Math.floor(state.time / 600) + 1) + ' 日 · ' + String(Math.floor(state.time / 60) % 10).padStart(2, '0') + ':' + String(Math.floor(state.time) % 60).padStart(2, '0');
    $('era-label').textContent = '第 ' + state.era + ' 轮';
    const lv = B.level(state), titles = ['见习', '识痕', '记录', '辨识', '定心', '勘察', '留痕', '寻奇', '传承', '执印', '扩容', '阅密', '人事', '复原', '守城'];
    $('level-label').textContent = 'Lv. ' + lv + ' · ' + titles[lv - 1] + '调查员';
    $('xp-label').textContent = lv === B.LEVELS.length ? state.career.xp + ' 经验 · 最高资历' : state.career.xp + ' / ' + B.LEVELS[lv] + ' 经验';
    $('xp-bar').style.width = (lv === B.LEVELS.length ? 100 : (state.career.xp - B.LEVELS[lv - 1]) / (B.LEVELS[lv] - B.LEVELS[lv - 1]) * 100) + '%';
    $('case-count').textContent = C.ORDER.filter(k => state.casebook.cases[k].solved).length + '/3'; $('evidence-count').textContent = C.ORDER.reduce((n, k) => n + state.casebook.cases[k].found.length, 0);
    $('stability-value').textContent = Math.round(state.stability) + '%'; $('stability-bar').style.width = state.stability + '%'; $('trust-value').textContent = Math.round(state.trust) + '%'; $('trust-bar').style.width = state.trust + '%';
    $('stability-note').textContent = state.stability < 35 ? '稳定度过低，生产降至 65%。可以遗忘部分记忆。' : '记忆满库会压低稳定，现实锚能缓解。';
    document.querySelectorAll('[data-field-stability]').forEach(el => el.textContent = Math.round(state.stability) + '%');
    document.querySelectorAll('[data-field-level]').forEach(el => el.textContent = 'Lv.' + B.level(state));
    if ($('field-event-status')) $('field-event-status').textContent = state.event ? '有来访待处理 · 回局查看' : state.paused ? '局内时间已暂停' : '局内经营持续进行';
    $('pause-button').textContent = state.paused ? '继续' : '暂停';
    const journalKey = JSON.stringify(state.logs.slice(0, 12));
    if (journalKey !== lastJournal) { $('journal').innerHTML = state.logs.slice(0, 12).map(l => '<article class="log-entry ' + l.type + '"><time>第 ' + (Math.floor(l.time / 600) + 1) + ' 日 / ' + String(Math.floor(l.time / 60) % 10).padStart(2, '0') + ':' + String(l.time % 60).padStart(2, '0') + '</time><p>' + esc(l.message) + '</p></article>').join(''); lastJournal = journalKey; }
    const e = B.EVENTS[state.event];
    if (lastEvent !== state.event) { $('pending-event').innerHTML = e ? '<div class="event-card"><span class="tiny-label">待处理来访</span><h3>' + e.title + '</h3><p>' + e.body + '</p>' + e.choices.map((c, i) => '<button class="event-choice" data-do="event" data-value="' + i + '"' + (c.cost ? ' data-cost="' + esc(JSON.stringify(c.cost)) + '"' : '') + '>' + c.name + '<small>' + c.text + '</small></button>').join('') + '</div>' : ''; lastEvent = state.event; }
    document.querySelectorAll('[data-cost]').forEach(b => b.disabled = !B.affordable(state, JSON.parse(b.dataset.cost)) || state.paused || !owner);
    document.querySelectorAll('[data-material]').forEach(el => el.classList.toggle('shortage', state.r[el.dataset.material] + 1e-8 < Number(el.dataset.needed)));
    document.querySelectorAll('[data-do="search"]').forEach(b => { b.disabled = state.cooldown > 0 || state.paused || !owner; b.textContent = state.cooldown > 0 ? '签收中…' : '去街上拾取失物'; });
    document.querySelectorAll('[data-do="job"]').forEach(b => { const id = b.dataset.value; b.disabled = !owner || state.paused || (id === 'detective' && !!state.expedition) || (b.dataset.delta === '-1' ? state.jobs[id] === 0 : B.assigned(state) >= state.workers.length); });
    document.querySelectorAll('[data-do^="explore-"]').forEach(b => b.disabled = b.disabled || !!state.expedition || state.jobs.detective < 1);
    document.querySelectorAll('[data-do="hire"]').forEach(b => b.disabled = b.disabled || state.workers.length >= B.seats(state));
    if (state.expedition) { const p = document.querySelector('[data-expedition]'); if (p) p.textContent = state.expedition.party + ' 名调查员 · ' + (state.expedition.mode === 'bold' ? '冒险' : '谨慎') + '路线 · 剩余 ' + Math.ceil(state.expedition.remaining) + ' 秒'; if ($('expedition-bar')) $('expedition-bar').style.width = (1 - state.expedition.remaining / state.expedition.duration) * 100 + '%'; }
  }
  function settings() {
    modal('存档与说明', '<p>本机浏览器每 10 秒自动保存，也会在操作后与离开页面时保存。离线经营上限 2 小时；案件不会自动破解。</p><p>用同一浏览器、同一地址打开游戏才能读取同一存档。移动文件、切换到固定地址或换浏览器时，请先导出，再导入。浏览器隐私模式可能无法保留存档。</p><div class="button-row">' + button('导出存档', 'export') + button('导入存档', 'import', '', null, 'secondary') + button('恢复上次自动备份', 'restore-backup', '', null, 'secondary') + button('接管本页值班', 'takeover', '', null, 'secondary') + '</div><div class="section-heading"><h2>玩法</h2></div><ol class="list-simple"><li>进入异常案卷，切换房间，点击证物。线索会进入调查笔记。</li><li>在最后一个房间提交推理。线索不足时可以看分级提示，不会卡死。</li><li>结案获得经验、材料、核心技术和随机藏品。经营与短程调查都是可选的延伸。</li><li>记忆库存会影响稳定度；设施、现实锚与社会方针能调整生产。</li><li>第三案后可继续经营，也可主动全城遗忘。等级和永久传承留下。</li></ol><p>主线支持键盘操作。图片只用于氛围，解谜所需信息都写在文字证物里。</p><div class="button-row">' + button('查看等级奖励', 'levels', '', null, 'secondary') + button('遗忘 5 段记忆，稳定 +12', 'forget', '', { memory: 5 }, 'secondary') + '</div><hr style="border:0;border-top:1px solid var(--line);margin-top:25px"><p>清空新建会重置所有本轮与永久进度，旧存档会先导出为文件。</p>' + button('清空并新建存档', 'new-dialog', '', null, 'danger'));
  }
  function exportData(s = state) { const data = JSON.stringify(s, null, 2), url = URL.createObjectURL(new Blob([data], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = '失物管理局-第' + s.era + '轮-' + Date.now() + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function resetDialog() { modal('只留下你愿意留下的东西', '<p>这一轮的库存、员工、设施、研究、案件和藏品会归零。等级、藏品见闻和全部永久传承保留。</p><p>请选一份新的永久传承。旧案卷将先自动导出。</p><div class="card-grid">' + [['archive', '档案传承', '每轮记忆容量永久 +12'], ['industry', '工艺传承', '所有生产效率永久 +8%'], ['humanity', '人情传承', '稳定目标永久 +3']].map(([id, name, desc]) => '<div class="management-card"><h3>' + name + '</h3><p>' + desc + '</p>' + button('确认遗忘，保留此项', 'reset', id, null, 'gold') + '</div>').join('') + '</div>'); }
  document.addEventListener('click', event => {
    const el = event.target.closest('button, .brand'); if (!el) return;
    if (el.matches('.brand')) { event.preventDefault(); tab = 'case'; render(true); return; }
    if (el.dataset.tab) { if (!P.has(state, el.dataset.tab)) return; tab = el.dataset.tab; if (tab === 'notebook') { state.ui.notebookOpened = true; save(); } render(true); return; }
    const action = el.dataset.do, value = el.dataset.value; if (!action) return;
    if (action === 'close-modal') return $('modal').close();
    if (action === 'help') return showHelp();
    if (action === 'help-question') return showHelpAnswer(value);
    if (action === 'goto') { if (!P.has(state, value)) return toast('先继续当前调查，这项功能会稍后出现。'); tab = value; if (tab === 'notebook') { state.ui.notebookOpened = true; save(); } render(true); return; }
    if (action === 'guide') return showGuide();
    if (action === 'walkthrough') { state.ui.walkthrough = !state.ui.walkthrough; render(true); save(); return; }
    if (action === 'guided-start') { state.ui.walkthrough = true; state.ui.introduced = true; introOpen = false; $('modal').close(); tab = 'case'; render(true); save(); return; }
    if (action === 'start-investigation') { state.ui.introduced = true; introOpen = false; $('modal').close(); tab = 'case'; render(true); save(); return; }
    if (action === 'settings') return settings();
    if (action === 'levels') return modal('调查员资历', '<p>经验来自实际调查，不是在线时长。</p><dl class="xp-sources"><dt>首次记录一件证物</dt><dd>+8</dd><dt>完成道具或机关步骤</dt><dd>+12</dd><dt>寄存人调查三次核验</dt><dd>各 +12</dd><dt>装订寄存人调查记录</dt><dd>+60</dd><dt>完成侧室收容</dt><dd>+40</dd><dt>取得壁龛奖励</dt><dd>+20</dd><dt>第一 / 二 / 三案结案</dt><dd>+65 / 95 / 135</dd><dt>自主研究一项技术</dt><dd>+6</dd><dt>每处短程调查首次完成</dt><dd>+12</dd><dt>再次完成同处短程调查</dt><dd>+4</dd></dl><p>证物、步骤、寄存人核验与装订、侧室、壁龛、结案和研究每轮只奖励一次；三段机关序列全部正确才算一个步骤，合计 +12。结案赠送的技术不额外给研究经验。</p><p>重复阅读、走地图、感知 / 精读 / 比对、挂机、生产、建造与招募不加经验。短程调查可重复获得经验，但要消耗时间与材料。轮回保留累计经验，新一轮可以再次取得首次奖励。</p>' + B.LEVEL_REWARDS.map((r, i) => '<div class="level-row ' + (B.level(state) < i + 1 ? 'locked' : '') + '"><span>Lv.' + (i + 1) + '</span><div>' + r + '<br><small class="progress-label">累计 ' + B.LEVELS[i] + ' 经验解锁</small></div></div>').join(''));
    if (action === 'export') { state.lastSaved = Date.now(); exportData(); return toast('存档已导出，请保存下载的 JSON 文件。'); }
    if (action === 'import') { $('import-file').value = ''; $('import-file').click(); return; }
    if (action === 'takeover') { claim(true); const raw = localStorage.getItem(KEY); if (raw) state = deserialize(raw); lastTick = Date.now(); $('storage-warning').hidden = true; $('modal').close(); render(true); return toast('本页开始值班。'); }
    if (!owner) return toast('另一个页面正在值班，请在设置中接管。');
    if (action === 'restore-backup') { try { pendingImport = deserialize(localStorage.getItem(BACKUP)); modal('恢复上次备份？', '<p>将覆盖当前进度。当前存档会先自动导出。</p>' + button('确认恢复', 'confirm-import', '', null, 'gold')); } catch { toast('没有可读取的自动备份。'); } return; }
    if (action === 'confirm-import') { if (!pendingImport) return; exportData(); state = pendingImport; pendingImport = null; state.lastSaved = Date.now(); lastTick = Date.now(); $('modal').close(); save(); render(true); return toast('存档已载入。'); }
    if (action === 'reset-dialog') return resetDialog();
    if (action === 'reset') { const next = B.reset(state, value); if (!next) return toast('尚未准备好遗忘协议。'); exportData(); state = C.hydrate(next); lastTick = Date.now(); tab = 'case'; $('modal').close(); save(); render(true); return toast('城市忘记了。你的资历和传承仍在。'); }
    if (action === 'new-dialog') return modal('重新开始所有进度？', '<p>这会清空等级、回声与传承，并新建第 1 轮。当前存档会先导出；请保留下载文件。</p>' + button('确认清空并新建', 'new-confirm', '', null, 'danger'));
    if (action === 'new-confirm') { exportData(); state = C.hydrate(B.fresh()); tab = 'case'; lastTick = Date.now(); $('modal').close(); save(); render(true); return; }
    let result;
    if (['case', 'room', 'inspect', 'hint', 'interact'].includes(action)) { result = C.act(state, action, value); if (result.evidence) modal(C.DATA[state.casebook.active].evidence[value].name, evidenceContent(state.casebook.active, value)); }
    else if (action === 'job') result = B.act(state, 'job', { id: value, delta: Number(el.dataset.delta) });
    else if (action.startsWith('explore-')) result = B.act(state, 'explore', { site: value, mode: action.split('-')[1] });
    else result = B.act(state, action, action === 'event' ? Number(value) : value);
    if (result.ok && ['search', 'craft', 'build'].includes(action)) state.ui.operationsStarted = true; if (result.message) toast(result.message); render(); save();
  });
  document.addEventListener('input', event => { if (event.target.id === 'help-query') { helpResults(event.target.value); $('help-answer').innerHTML = ''; } });
  document.addEventListener('submit', event => {
    if (event.target.id !== 'puzzle-form') return; event.preventDefault(); if (!owner) return toast('请先在设置中接管值班。');
    const data = new FormData(event.target), id = state.casebook.active;
    const payload = { code: data.get('code'), owner: data.get('owner'), order: [1, 2, 3, ...(id === 'city' ? [4] : [])].map(n => data.get('order' + n)), resolution: data.get('resolution') };
    if (id !== 'station' && (payload.order.some(v => !v) || !payload.resolution) || id !== 'tuesday' && !payload.owner) return toast('请先填完登记内容与处置方式。');
    const result = C.act(state, 'solve', payload); toast(result.ok ? '案卷已结案。新的现场与奖励已经显现。' : result.message); render(); save();
  });
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast('存档文件过大，最大 2 MB。');
    try { pendingImport = deserialize(await file.text()); modal('导入这份存档？', '<p>第 ' + pendingImport.era + ' 轮 · 调查员 Lv.' + B.level(pendingImport) + ' · 已结案 ' + C.ORDER.filter(k => pendingImport.casebook.cases[k].solved).length + '/3。</p><p>将覆盖当前进度，当前存档会先导出为文件。</p>' + button('确认导入', 'confirm-import', '', null, 'gold')); }
    catch (error) { pendingImport = null; toast('存档无法读取：' + error.message); }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') $('modal').close(); });
  $('modal').addEventListener('close', () => { if (introOpen) { state.ui.introduced = true; introOpen = false; save(); } });
  window.addEventListener('pagehide', () => { save(); try { const lock = JSON.parse(localStorage.getItem(LEASE) || 'null'); if (lock && lock.session === session) localStorage.removeItem(LEASE); } catch {} });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('storage', event => { if (event.key === LEASE) { try { const lock = event.newValue && JSON.parse(event.newValue); if (lock && lock.session !== session) { owner = false; warn('另一个页面已接管值班。本页停止推进；可在设置中重新接管。'); } } catch { warn('值班标记无法读取，请在设置中接管本页；游戏存档未删除。'); } } });
  load(); render(true);
    if (!state.ui.introduced && owner) { state.ui.introduced = true; save(); }
  if (owner) save();
  setInterval(() => { const now = Date.now(), elapsed = Math.max(0, (now - lastTick) / 1000); lastTick = now; if (owner && claim()) { B.advance(state, Math.min(elapsed, 7200)); if (now - lastSave > 10000) save(); } render(); }, 500);
  // Progressive enhancement: expose a read-only state summary where the browser supports WebMCP.
  if (document.modelContext && document.modelContext.registerTool) {
    try { Promise.resolve(document.modelContext.registerTool({ name: 'read_bureau_status', title: '查看管理局状态', description: 'Read the current visible game state without advancing time or changing any decisions.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => ({ era: state.era, level: B.level(state), resources: { ...state.r }, activeCase: state.casebook.active, solvedCases: C.ORDER.filter(k => state.casebook.cases[k].solved), evidence: [...state.casebook.cases[state.casebook.active].found], paused: state.paused }) })).catch(() => {}); } catch {}
  }
})();
