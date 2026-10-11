(function () {
  'use strict';
  const B = window.Bureau, C = window.Cases, P = window.Progression, H = window.BureauHelp, M = window.InvestigationMap, FX = window.NodeEffects;
  const params = new URLSearchParams(location.search), testSlot = (params.get('slot') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
  const KEY = 'lost-property-bureau-v1' + (params.get('test') === '1' ? '-test' + (testSlot ? '-' + testSlot : '') : ''), BACKUP = KEY + '-backup', LEASE = KEY + '-lease';
  const session = window.BureauStorage.tabSession({key:KEY+'-session',navigationType:performance.getEntriesByType('navigation')[0]?.type,random:()=>typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),storage:{getItem:k=>sessionStorage.getItem(k),setItem:(k,v)=>sessionStorage.setItem(k,v)}});
  const store=window.BureauStorage.create({key:KEY,session,decode:deserialize,storage:{getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v),removeItem:k=>localStorage.removeItem(k)}});
  const $ = id => document.getElementById(id);
  const audio=window.BureauAudio.create({AudioContext:window.AudioContext||window.webkitAudioContext,key:KEY+'-audio',storage:{getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)},onChange:updateAudioUI});
  const esc = x => String(x).replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]);
  const fmt = n => n >= 10000 ? (n / 1000).toFixed(1) + 'k' : n >= 100 ? Math.floor(n).toString() : Math.floor(n * 10) / 10 + '';
  let state, tab = 'case', boardMode = 'site', mapFocus = null, lastMapResult = null, linkDraft = null, linkFeedback = '', nodeClickTimer, lastNodeGesture = null, lastStructure = '', lastView = '', lastJournal = '', lastEvent = '', introOpen = false, toastTimer, saveAvailable = true, owner = true, lastTick = Date.now(), lastSave = 0, pendingImport = null, unreadableCopies=[];
  function warn(message) { $('storage-warning').hidden = false; $('storage-warning').textContent = message; }
  function deserialize(raw) { const data = typeof raw === 'string' ? JSON.parse(raw) : raw; const s = B.restore(data); const rng = s.rng; C.hydrate(s, data.casebook); C.restoreInvestigator(s,data.investigator,data.ui?.mapZoom); M.restoreTrees(s,data.ui?.investigationTrees,data.ui?.objectStates); s.rng = rng; return s; }
  function updateAudioUI(){
    const a=audio.status(),el=$('audio-button');if(!el)return;
    el.textContent=a.playing?'声音 ♪':'声音';el.setAttribute('aria-label','声音设置，'+(a.playing?'音乐正在播放':a.ready?'音乐已关':'点击后启用'));
    el.dataset.playing=String(a.playing);el.dataset.position=a.position.toFixed(2);
    const message=$('audio-state');if(message)message.textContent=a.error||(a.ready?(a.playing?'环境乐正在连续播放，切换游戏页面不会中断。':'音乐已关闭，开合音效独立控制。'):'首次操作后启用声音；刷新网页后需要再次点击。');
  }
  function showAudio(){
    const a=audio.status();modal('声音设置','<p id="audio-state" role="status"></p><div class="audio-controls"><button class="mind-tool-button" data-do="audio-music" aria-pressed="'+a.music+'">背景音乐：'+(a.music?'开启':'关闭')+'</button><button class="mind-tool-button" data-do="audio-effects" aria-pressed="'+a.effects+'">开合音效：'+(a.effects?'开启':'关闭')+'</button><label for="audio-volume">总音量 <output id="audio-volume-label">'+Math.round(a.volume*100)+'%</output></label><input id="audio-volume" type="range" min="0" max="100" step="1" value="'+Math.round(a.volume*100)+'" aria-label="总音量"></div><p>原创悬疑环境乐；不同材质的实物有不同开合声。音乐与音效可分别关闭，设置保存在本机。</p><p>现场、证物笔记与档案室在同一网页内切换，音乐继续播放。刷新或离开网站会停止声音，回来后点击即可启用。</p>'+button('启用声音／重试','audio-start','',null,'secondary'));updateAudioUI();
  }
  function claim(force = false) {
    const result=store.claim(force);owner=result.ok;if(result.unavailable)saveAvailable=false;
    if(!owner){$('save-status').textContent='仅供查看';warn(result.stale?'其他页面已保存更新的进度。本页停止操作，请在存档中接管并载入最新进度。':'另一个页面正在值班。本页仅供查看，可在存档中接管。');}
    return owner;
  }
  function save() {
    if (!owner) return false;
    const result=store.write(state);
    if(result.foreign){owner=false;$('save-status').textContent='仅供查看';warn('另一个页面已保存更新的进度。本页停止保存与推进；请在存档中接管并载入最新进度。');return false;}
    if(result.ok){
      saveAvailable = true; lastSave = Date.now();
      $('save-status').textContent = '已保存 · ' + new Date(lastSave).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); return true;
    }
    saveAvailable = false; $('save-status').textContent = '未能自动保存'; warn('浏览器未允许本地存档。请在「存档与说明」中导出存档，避免关闭后丢失进度。'); return false;
  }
  function load() {
    const loaded=store.read();unreadableCopies=loaded.unreadable;
    if(loaded.unavailable)saveAvailable=false;
    state=loaded.state||C.hydrate(B.fresh());
    if(loaded.source==='backup')warn('主存档无法读取，已恢复上一次自动备份；异常原文可在存档中导出。');
    else if(unreadableCopies.length)warn('存档与备份均无法读取，暂时建立新局。可在存档中导出异常原文，请先保留文件。');
    if (!claim()) { warn('另一个页面正在值班。本页仅供查看；关闭另一个页面后，可在设置中接管值班。'); return; }
    if (!saveAvailable) warn('本地存储不可用。仍可游玩，请定期导出存档。');
  }
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4300); }
  function clearCaseView(){cancelNodeEntry();lastNodeGesture=null;boardMode='site';mapFocus=null;lastMapResult=null;linkDraft=null;linkFeedback='';pendingImport=null;}
  function revealCurrentRoom(){if(tab==='case')document.querySelector('.mind-location')?.scrollIntoView({block:'start',behavior:'instant'});}
  function renderAnchored(id){
    const before=$('mind-'+id)?.getBoundingClientRect().top;
    render(true);
    const after=$('mind-'+id)?.getBoundingClientRect().top;
    if(Number.isFinite(before)&&Number.isFinite(after)&&before>=0&&before<window.innerHeight&&Math.abs(after-before)>1)window.scrollBy({top:after-before,behavior:'instant'});
  }
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
    if (c.solved) return { step: '已结案', title: id === 'city' ? '决定这座城市的去向' : '下一处异常已经显现', text: id === 'city' ? '在档案室封存旧卷，或继续回访未查清的现场。是否开启下一轮由你决定。' : '进入下一份案卷，也可以回访这一案尚未查清的支路。' };
    if (!c.found.length) return { step: '01', title: '先观察现场', text: '双击证物节点阅读。单击地点切换现场，看看证物之间有哪些矛盾。' };
    if (c.found.length < 3) return { step: '02', title: '到其他房间补齐证据', text: '已记录 ' + c.found.length + ' 件证物。点击房间名称切换地点；首次发现每件证物都会增加经验。' };
    if (!state.ui.notebookOpened) return { step: '03', title: '比对调查笔记', text: '打开“调查笔记”，把不同物品上的信息连起来。主线无需等资源，也没有解谜倒计时。' };
    if (c.room !== 'counter') return { step: '04', title: '准备提交推理', text: '到“' + d.rooms.counter.name + '”填写答案。不确定时，可点“需要一点提示”，提示逐层展开。' };
    return { step: '04', title: '核对你的答案', text: '根据已记录的证据填写登记表。错误可以重试；提示的最后一级会解释完整解法。' };
  }
  function guideStrip() { if (!P.has(state, 'map') || state.ui.walkthrough) return ''; const g = currentGuide(); return '<div class="guide-strip"><span class="guide-number">' + g.step + '</span><p><strong>' + g.title + '</strong><br>' + g.text + '</p><button class="quiet-button" data-do="guide">玩法</button></div>'; }
  function showGuide(intro = false) {
    introOpen = intro;
    const g=currentGuide();
    modal('此刻怎么调查','<p>'+esc(g.title+'：'+g.text)+'</p><ol class="list-simple"><li>单击长出枝叶，双击证物阅读；已展开的普通分支一直留下。</li><li>单击操作节点，再点“执行操作”。实物可开合；关上不丢进度。</li><li>记录两件证物后可亲手连线。机关与推理都要你来完成。</li></ol><p>横向拖动画布、触屏滑动，或用缩放按钮查看更远的枝叶。没有生产等待和解谜倒计时。经验只来自首次调查与结案，等级能力和附查不是主线门槛。</p><div class="button-row">'+button('带我体验','guided-start')+button('回到现场','start-investigation','',null,'secondary')+button('经验与升级奖励','levels','',null,'secondary')+'</div>');
  }
  function evidenceContent(id, key) { const d = C.DATA[id].evidence[key]; return '<p class="evidence-read">' + esc(C.readEvidence(state,key)) + '</p>' + (B.level(state) >= 4 ? '<p class="deep-note">辨识 / ' + esc(d.deep) + '</p>' : '') + '<p class="progress-label">'+(id==='station'&&(Object.hasOwn(C.REASON_EVIDENCE,key)||Object.hasOwn(C.CHANGE_EVIDENCE,key))?'现场验证记录已保存；阅读与附查不额外奖励经验。':'已记入调查笔记。每件证物仅首次记录获得 8 经验；重复阅读不加经验。')+'</p>'+(B.level(state)>=3?button(state.investigator.bookmarks[id].includes(key)?'★ 已关注 · 点击取消':'☆ 关注这件证物','bookmark',key,null,'secondary'):''); }
  function puzzleForm(id, c) {
    const select = (name, label, options) => '<div><label for="' + name + '">' + label + '</label><select id="' + name + '" name="' + name + '"><option value="">请选择</option>' + options.map(([v, t]) => '<option value="' + esc(v) + '">' + esc(t) + '</option>').join('') + '</select></div>';
    const owners = [['me', '我自己'], ['woman', '提伞女人'], ['citizens', '全体市民'], ['nobody', '无人']];
    let fields = '';
    if (id === 'station') fields = '<label for="code">四位取件码</label><input id="code" name="code" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]{4}" placeholder="0000" required>' + select('owner', '被登记为失物的是', owners);
    else if (id === 'tuesday') fields = '<div class="sequence">' + [1, 2, 3].map(n => select('order' + n, '第 ' + n + ' 扇门', ['昨天', '今天', '明天'].map(k => [k, k]))).join('') + '</div>';
    else fields = '<div class="sequence">' + [1, 2, 3, 4].map(n => select('order' + n, '第 ' + n + ' 件事', [['shift', '你开始值班'], ['register', '登记城市'], ['forget', '市民遗忘'], ['bureau', '建成管理局']])).join('') + '</div>' + select('owner', '城市的失主', owners);
    if (id !== 'station') fields += select('resolution', '破解后如何处置这份过去', [['return', id==='city'?'归还：让城市重新生活':'归还：让失主放下等待'], ['seal', id==='city'?'封存：由管理局保管城市，稳定度 −3':'封存：将过去留下，稳定度 −3']]);
    return '<form id="puzzle-form" class="puzzle-form"><h2>提交你的推理</h2><p class="progress-label">没有倒计时。错误校验仅扣 ' + (B.level(state) >= 2 ? 1 : 2) + ' 点稳定度，可重新核对。</p>' + fields + '<div class="button-row"><button class="button gold" type="submit">' + (id === 'tuesday' ? '校验归途' : '核对登记') + '</button><button type="button" class="button secondary" data-do="hint">查看提示</button></div></form>';
  }
  function walkthrough() {
    const id = state.casebook.active, c = state.casebook.cases[id], f = C.field(c);
    if (!P.has(state, 'map')) return { title: '先观察眼前的证物', text: '双击招领须知，再双击旁边的镜子。单击只进入分支；阅读并记录后，新的地点会出现。', action: 'inspect', value: c.found.includes('notice') ? 'mirror' : 'notice' };
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
  function mapNode(n) {
    const selected=linkDraft&&n.type==='evidence'&&(linkDraft.a===n.value||linkDraft.b===n.value);
    const hint=n.hint||(n.active?'你在这里':n.type==='root'?(n.id==='focus'?'双击阅读':'案卷'):n.type==='room'?(n.visited?'已到访':'前往'):n.done?'已记录':n.reason?'缺少条件 · 点开查看':n.type==='evidence'?'观察':n.type==='optional'?'可选':'操作');
    const statusClass=n.type==='evidence'?({'新发现':' evidence-new','待验证':' evidence-pending','已有结论':' evidence-concluded'}[hint]||''):'';
    const archived=n.done&&hint!=='待验证',mark=n.active?'':archived?'✓':n.expanded!==undefined?(n.expanded?'−':'+'):n.type==='room'?'→':'';
    return '<button id="mind-' + esc(n.id) + '" class="mind-node mind-' + n.type + statusClass + (n.active ? ' is-current' : '') + (n.done ? ' is-recorded' : '') + (archived?' is-archived':'') + (n.changed&&!n.done?' is-new-change':'') + (selected?' is-link-selected':'') + (n.reason ? ' needs-tool' : '') + (n.depth!==undefined?' tree-depth-'+n.depth+' scope-'+n.scope:'') + (mapFocus&&mapFocus.value===n.value&&mapFocus.action===n.action?' is-selected':'') + '" data-do="' + esc(n.action) + '" data-value="' + esc(n.value) + '" style="--node-x:' + (n.x / 820 * 100) + '%;--node-y:' + n.y + 'px;--depth:'+(n.depth||0)+'" aria-label="' + esc(n.label + (n.active ? '，当前地点' : selected?'，连线已选中':n.type==='evidence'||n.done?'，'+hint:n.reason ? '，需要前置条件' : '')) + '"' + (n.active ? ' aria-current="location"' : '') + (n.expanded!==undefined?' aria-expanded="'+n.expanded+'"':'') + '><i class="mind-port port-in" aria-hidden="true"></i><i class="mind-port port-out" aria-hidden="true"></i><i class="mind-node-mark" aria-hidden="true">'+mark+'</i><span>' + esc(n.label) + '</span><small>' + esc(selected?'已选中 · '+(linkDraft.a===n.value?'起点':'终点'):hint) + '</small>'+(n.sceneState?'<span class="mind-scene-state">'+esc(n.sceneState)+'</span>':'')+(n.sceneMark?'<i class="scene-trace trace-'+esc(n.sceneMark)+'" aria-hidden="true"></i>':'')+'</button>';
  }
  function renderMap(model) {
    const byId = Object.fromEntries(model.nodes.map(n => [n.id, n]));
    const trail=new Set();let cursor=model.nodes.find(n=>mapFocus&&n.value===mapFocus.value&&n.action===mapFocus.action)?.id;
    while(cursor&&!trail.has(cursor)){trail.add(cursor);cursor=model.edges.find(e=>e.to===cursor&&!e.relation)?.from;}
    const lines = model.edges.map(e => {
      const a = byId[e.from], b = byId[e.to], start = a.x + (a.type === 'root' ? 95 : 78), end = b.x - (b.type === 'room' ? 78 : 96), mid = (start + end) / 2;
      return '<path data-from="' + esc(e.from) + '" data-to="' + esc(e.to) + '"' + (e.relation?' data-relation="true"':'') + (e.navigation?' data-navigation="true"':'') + ' class="' + (e.active ? 'active-link ' : '') + (e.scope?'scope-'+e.scope+' ':'') + (e.done?'completed-link ':'') + (trail.has(e.from)&&trail.has(e.to)?'focus-link ':'') + (e.relation?'relation-link ':'') + (e.navigation?'navigation-link ':'') + (e.pending?'pending-link':'') + '" d="'+window.BureauEdges.rounded(start,a.y,end,b.y)+'"/>';
    }).join('');
    const destinations=model.nodes.filter(n=>n.type==='room'&&n.x===676),first=destinations[0];
    const label=model.navigationLabel&&first?'<span class="mind-column-label" style="left:'+(first.x/820*100)+'%;top:'+(Math.min(...destinations.map(n=>n.y))-56)+'px">'+esc(model.navigationLabel)+'</span>':'';
    const z=state.ui.mapZoom||1;
    return '<div class="mind-canvas-tools" aria-label="导图缩放"><span>拖动空白处或横向滑动</span><button data-do="map-zoom" data-value="out" aria-label="缩小导图">−</button><output>'+Math.round(z*100)+'%</output><button data-do="map-zoom" data-value="in" aria-label="放大导图">＋</button><button data-do="map-zoom" data-value="fit">查看全图</button><button data-do="map-zoom" data-value="reset">原大小</button><button data-do="map-home">回到左侧</button></div><div class="mind-viewport" tabindex="0" aria-label="调查导图画布，可左右滚动"><div class="mind-canvas-frame" style="width:'+(1040*z)+'px;height:'+(model.height*z)+'px"><div class="mind-board'+(model.tree?' mind-tree':'')+'" style="--board-height:'+model.height+'px;transform:scale('+z+')" role="group" aria-label="可交互调查思维导图"><svg class="mind-lines" viewBox="0 0 820 ' + model.height + '" preserveAspectRatio="none" aria-hidden="true">' + lines + '</svg>' + label + model.nodes.map(mapNode).join('') + '</div></div></div>';
  }
  function renderCase() {
    const id = state.casebook.active, c = state.casebook.cases[id], d = C.DATA[id], model = boardMode==='site'?M.tree(state):mapFocus?focusedMap():M.notes(state);
    if(linkDraft?.a&&linkDraft.b&&!mapFocus&&boardMode==='notes'&&!model.edges.some(e=>e.relation&&(e.from==='evidence:'+linkDraft.a&&e.to==='evidence:'+linkDraft.b||e.from==='evidence:'+linkDraft.b&&e.to==='evidence:'+linkDraft.a)))model.edges.push({from:'evidence:'+linkDraft.a,to:'evidence:'+linkDraft.b,relation:true,pending:true});
    const g = state.ui.walkthrough ? walkthrough() : null;
    let html = '<section class="mind-game"><header class="mind-heading"><div><span class="tiny-label">失物管理局 / 案卷 ' + d.number + '</span><h1>' + esc(d.name) + '</h1></div><button class="quiet-button" data-do="map-menu">案卷与更多</button></header>';
    html += '<nav class="mind-tools" aria-label="调查与成长"><button data-do="map-view" data-value="site" aria-pressed="' + (boardMode === 'site') + '">现场调查</button>' + (P.has(state, 'notebook') ? '<button data-do="map-view" data-value="notes" aria-pressed="' + (boardMode === 'notes') + '">证物笔记</button>' : '') + (P.has(state, 'inventory') ? '<button data-do="map-bag">随身道具 · ' + C.field(c).items.length + '</button>' : '') + (P.has(state, 'career') ? '<button data-do="levels">资历 <span data-field-level>Lv.' + B.level(state) + '</span></button>' : '') + '</nav>';
    html+='<div class="mind-location" aria-label="当前位置"><span>案卷 '+d.number+'</span><i>›</i><strong>'+esc(d.rooms[c.room].name)+'</strong>'+(mapFocus?'<i>›</i><span>'+esc(mapFocus.label)+'</span>':'')+'</div>';
    html+='<ol class="mind-journey" aria-label="主线调查阶段">'+M.journey(state).map((step,i)=>'<li class="stage-'+step.status+'"'+(step.status==='current'?' aria-current="step"':'')+'><span>'+(step.status==='done'?'✓':i+1)+'</span>'+esc(step.label)+'</li>').join('')+'</ol>';
    html += '<div class="mind-toolbar"><div class="mind-context-actions">';
    if (mapFocus) {
      html += '<button class="mind-tool-button" data-do="map-back">返回'+esc(d.rooms[c.room].name)+'</button><button class="mind-tool-button" data-do="map-focus-read">阅读文字</button>';
      const a = mapFocus.action === 'map-action' && M.actions(state).find(a => a.id === mapFocus.value);
      if (a && !a.reason) html += '<button class="mind-tool-button primary" data-do="map-confirm" data-value="' + esc(a.id) + '">执行操作</button>';
    }
    if(c.found.length>=2&&!linkDraft)html+='<button class="mind-tool-button" data-do="map-link-start">证物连线</button>';
    if(C.canHypothesize(state))html+='<button class="mind-tool-button" data-do="map-hypotheses">暂定猜测'+(C.hypothesisEntries(state).some(h=>h.status==='待验证')?' · 待验证':C.hypothesisEntries(state).some(h=>h.status==='已确认')?' · 已确认':'')+'</button>';
    if(C.history(state).length)html+='<button class="mind-tool-button" data-do="map-history">现场记录 · '+C.history(state).length+'</button>';
    html += '<button class="mind-tool-button" data-do="map-hint">调查提示</button></div><p class="mind-gesture-tip">点击展开，选中后点“阅读文字” · 双击快捷阅读 · 键盘 Shift＋Enter 阅读</p></div>';
    html+='<p class="mind-objective"><span>主线目标</span>'+esc(C.goal(state))+'</p>';
    if(linkDraft)html+=renderLinkDraft();
    if (g) html += '<p class="mind-guide" role="status">' + esc(g.title) + ' <button data-do="walkthrough-step" class="text-button">这一步怎么做</button><button data-do="walkthrough" class="text-button">收起引导</button></p>';
    html += renderMap(model);
    if(C.changes(state).length)html+='<p class="mind-change-shortcut"><button class="text-button" data-do="map-changes">现场变化 · '+C.changes(state).filter(e=>!c.found.includes(e.key)).length+' 处待观察</button></p>';
    const optional=C.optionalGoal(state);if(optional)html+='<p class="mind-side-goal"><span>自由附查 · 可选</span>'+esc(optional)+'</p>';
    if (boardMode === 'notes' && !c.found.length) html += '<p class="mind-empty">还没有证物，先回到现场观察。</p>';
    if (boardMode === 'notes' && model.relations?.length) html += '<button class="mind-tool-button" data-do="map-relations">已验证连线 · ' + model.relations.length + '</button>';
    html += '<div class="mind-foot"><span>' + (boardMode === 'site' ? esc(d.rooms[c.room].name) : c.found.length + ' 件记录') + '</span><span>'+(!owner?'本页仅供查看':saveAvailable?'操作后自动保存':'存档不可用，请导出')+'</span></div></section>';
    return html;
  }
  function drawMapLinks() {
    const board = document.querySelector('.mind-board'), svg = document.querySelector('.mind-lines'); if (!board || !svg) return;
    const bounds = board.getBoundingClientRect(); if (!bounds.width) return;
    svg.setAttribute('viewBox', '0 0 ' + bounds.width + ' ' + bounds.height);
    for (const path of svg.querySelectorAll('path[data-from]')) {
      const from = $('mind-' + path.dataset.from), to = $('mind-' + path.dataset.to); if (!from || !to) continue;
      const a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), x1 = a.right - bounds.left, x2 = b.left - bounds.left, y1 = a.top + a.height / 2 - bounds.top, y2 = b.top + b.height / 2 - bounds.top, mid = (x1 + x2) / 2;
      // Place navigation beside its destination instead of wrapping the whole board.
      if(path.dataset.navigation)path.setAttribute('d','M '+(x2-24)+' '+y2+' H '+x2);
      else if(path.dataset.relation){const end=b.right-bounds.left,side=Math.min(bounds.width-5,Math.max(x1,end)+38);path.setAttribute('d','M '+x1+' '+y1+' C '+side+' '+y1+', '+side+' '+y2+', '+end+' '+y2);}
      else path.setAttribute('d',window.BureauEdges.rounded(x1,y1,x2,y2));
    }
  }
  function renderLinkDraft(){
    const d=C.DATA[state.casebook.active],name=k=>k?d.evidence[k].name:'选择一件证物';
    return '<section class="mind-link-draft" aria-label="证物连线操作"><div class="link-pair"><strong>'+esc(name(linkDraft.a))+'</strong><span>↔</span><strong>'+esc(name(linkDraft.b))+'</strong></div><p>依次单击两件已记录证物，选择比较方式。双击仍可回看文字；错误不扣资源，也不影响结案。</p><div class="link-controls"><label for="link-method">比较方式</label><select id="link-method">'+Object.entries(C.METHODS).map(([key,label])=>'<option value="'+key+'"'+(linkDraft.method===key?' selected':'')+'>'+esc(label)+'</option>').join('')+'</select><button class="mind-tool-button primary" data-do="map-link-confirm"'+(!linkDraft.a||!linkDraft.b?' disabled':'')+'>验证连线</button><button class="mind-tool-button" data-do="map-link-cancel">结束连线</button></div>'+(linkFeedback?'<p class="link-feedback" role="status">'+esc(linkFeedback)+'</p>':'')+'</section>';
  }
  function showMapHistory(){
    const d=C.DATA[state.casebook.active],entries=C.history(state);
    modal('现场记录',entries.length?entries.map(r=>'<details class="map-record"><summary>'+esc((r.ok?'✓ ':'待核对 · ')+r.label)+'<small>'+esc(d.rooms[r.room].name)+'</small></summary><p class="evidence-read">'+esc(r.message)+'</p></details>').join(''):'<p>亲自操作现场后，发现和结果会保存在这里，刷新后仍可回看。</p>');
  }
  function showHypotheses(feedback=''){
    if(!C.canHypothesize(state))return toast('先记录镜子与女人的证词。');
    const q=C.field(state.casebook.cases.station).reasoning;
    const cards=C.hypothesisEntries(state).map(h=>'<article class="hypothesis-card"><h3>'+esc(h.label)+' <small>'+esc(h.status)+'</small></h3><p>'+esc(h.prediction)+'</p>'+(h.adopted?h.status==='待验证'?'<div class="button-row"><button class="mind-tool-button" data-do="hypothesis-judge" data-value="'+h.id+':confirm"'+(!h.ready?' disabled':'')+'>确认这个解释</button><button class="mind-tool-button" data-do="hypothesis-judge" data-value="'+h.id+':refute"'+(!h.ready?' disabled':'')+'>推翻这个解释</button></div>'+(!h.ready?'<small>先亲自完成静止与迈步两次对照。</small>':''):'<small>原猜测与验证结果都保留，不会因改判丢失记录。</small>':button('保留这个猜测','hypothesis-adopt',h.id,null,'secondary'))+'</article>').join('');
    const observations=['still','step'].filter(k=>q.observations.includes(k)).map(k=>'<details class="map-record"><summary>'+esc(C.REASON_EVIDENCE[k+'-note'].name)+'</summary><p>'+esc(C.REASON_EVIDENCE[k+'-note'].read())+'</p></details>').join('');
    modal('暂定猜测 · 镜面附查','<p>猜测可以并存，但不是结论。用现场的两种条件检验，再决定保留还是推翻；不扣资源、不影响结案。</p>'+(feedback?'<p class="hypothesis-feedback" role="status">'+esc(feedback)+'</p>':'')+cards+observations+button('返回现场继续验证','hypothesis-return','',null,'secondary'));
  }
  function focusedMap() {
    const id=state.casebook.active,c=state.casebook.cases[id],d=C.DATA[id],f=mapFocus,available=M.actions(state),names={reasoning:'镜面附查',experiment:'现场验证',truth:'寄存人核验',ability:'能力与支路'};
    const category=a=>a.group==='reasoning'?'reasoning':a.group==='experiment'?'experiment':a.id.startsWith('truth-')?'truth':'ability';
    let children=[];
    if(f.action==='map-more')children=M.scene(state).secondary;
    else if(f.action==='map-supplies')children=M.scene(state).groups.supplies;
    else if(f.action==='map-optional') children=Object.keys(names).filter(k=>available.some(a=>!M.primary(a)&&category(a)===k)).map(k=>({label:names[k],type:'optional',action:'map-group',value:k}));
    else if(f.action==='map-group'){
      children=(f.value==='reasoning'?C.actions(state):available).filter(a=>!M.primary(a)&&category(a)===f.value).map(a=>({label:a.label.split(' · ')[0],type:'action',action:a.done?'map-result':'map-action',value:a.id,reason:a.done?'':a.reason,done:a.done,hint:a.done?'已完成':''}));
      if(f.value==='reasoning')for(const k of C.visibleEvidence(state,c.room).filter(k=>Object.hasOwn(C.REASON_EVIDENCE,k)&&c.found.includes(k)))children.push({label:d.evidence[k].name,type:'evidence',action:'map-read',value:k,done:true,hint:C.evidenceStatus(state,k)});
    }
    else if(f.action==='map-action'){
      const a=C.actions(state).find(a=>a.id===f.value);
      children.push(a&&!a.done?{label:'执行操作',type:'action',action:'map-execute',value:f.value,reason:a.reason}:{label:'继续调查',type:'room',action:'map-back',value:''});
    } else if(['inspect','map-read'].includes(f.action)) {
      for(const [a,b] of M.notes(state).relations){const other=a===f.value?b:b===f.value?a:null;if(other)children.push({label:d.evidence[other].name,type:'evidence',action:'map-read',value:other,done:true,hint:C.evidenceStatus(state,other)});}
    }
    if(!children.length)children.push({label:'继续调查',type:'room',action:'map-back',value:''});
    const record=f.action==='map-result'&&C.actionRecord(state,f.value,c.room),completed=C.actions(state).find(a=>a.id===f.value&&a.done);
    const height=Math.max(340,children.length*M.ROW+60),nodes=[{id:'focus',label:f.label,type:'root',action:f.action,value:f.value,hint:record||completed?'已完成 · 双击回看':'',x:128,y:height/2},{id:'parent',label:'返回现场',type:'room',action:'map-back',value:'',x:676,y:height/2}],edges=[{from:'focus',to:'parent',navigation:true}];
    children.forEach((n,i)=>{nodes.push({...n,id:'child:'+i,x:380,y:(height-(children.length-1)*M.ROW)/2+i*M.ROW});edges.push({from:'focus',to:'child:'+i,active:true});});
    return {nodes,edges,width:820,height};
  }
  function enterMapNode(action,value,label) {
    if(owner)claim();
    if(action==='map-solve')return readMapNode(action,value,label);
    if(action==='tree-read')return readMapNode(action,value,label);
    if(action==='object-toggle'){
      if(!owner)return toast('请先在存档中接管本页值班。');
      const r=M.toggleObject(state,value);if(!r.ok)return toast(r.message);
      mapFocus={action,value,label:r.object.name,caseId:state.casebook.active,era:state.era};renderAnchored('branch:'+value);save();audio.play(r.object.sound,r.open);return toast(r.message);
    }
    if(action==='tree-expand'){
      if(!owner)return toast('请先在存档中接管本页值班。');
      if(!M.grow(state,value))return;
      mapFocus={action,value,label,caseId:state.casebook.active,era:state.era};renderAnchored('branch:'+value);save();return;
    }
    if(action==='map-read'&&linkDraft&&boardMode==='notes'){
      const c=state.casebook.cases[state.casebook.active];if(!c.found.includes(value))return;
      if(linkDraft.a===value){linkDraft.a=linkDraft.b;linkDraft.b=null;}
      else if(linkDraft.b===value)linkDraft.b=null;
      else if(!linkDraft.a)linkDraft.a=value;
      else linkDraft.b=value;
      linkFeedback='';render(true);return;
    }
    if(action==='map-room'){
      if(!owner)return toast('请先在存档中接管本页值班。');
      const previous=state.casebook.cases[state.casebook.active].room,r=M.move(state,value);if(!r.ok)return toast(r.message);
      mapFocus=null;linkDraft=null;boardMode='site';render(true);if(previous!==value)revealCurrentRoom();FX.enter(document.querySelector('.mind-board'));save();return;
    }
    if(action==='map-back'||action==='map-intro'){mapFocus=null;render(true);return;}
    if(action==='map-execute'){
      const a=M.actions(state).find(a=>a.id===value);
      if(!a)return toast('操作已完成，或不在当前地点。');
      if(a.reason)return toast('缺少条件：双击操作节点查看说明。');
      if(!owner)return toast('请先接管本页值班。');
      const beforeChanges=C.changes(state).length,r=C.act(state,'interact',value),newChanges=C.changes(state).slice(beforeChanges);
      lastMapResult={caseId:state.casebook.active,value,message:r.message||'操作已完成。'};
      mapFocus={action:r.ok?'map-result':'map-action',value,label:a.label.split(' · ')[0],caseId:state.casebook.active,era:state.era};
      renderAnchored('action:'+value);save();return toast(r.ok?(newChanges.length?'现场已改变 · '+newChanges.map(e=>e.name).join('、')+'出现在「现场变化」':'已完成 · 结果已保存在现场记录'):'未成功 · 可回看现场记录后重试');
    }
    if(action==='case'||action==='goto'){
      if(action==='goto'){if(!P.has(state,value))return;tab=value;mapFocus=null;render(true);return;}
      if(!owner)return toast('请先接管本页值班。');
      const r=C.act(state,'case',value);if(!r.ok)return toast(r.message);
      clearCaseView();render(true);revealCurrentRoom();save();return;
    }
    if(boardMode==='site'&&owner&&['inspect','map-read','map-action','map-result'].includes(action))M.grow(state,(action==='inspect'||action==='map-read'?'evidence:':'action:')+value);
    mapFocus={action,value,label,caseId:state.casebook.active,era:state.era};renderAnchored((action==='inspect'||action==='map-read'?'evidence:':'action:')+value);FX.enter(document.querySelector('.mind-board'));if(owner)save();
  }
  function readMapNode(action,value,label) {
    const id=state.casebook.active,c=state.casebook.cases[id],d=C.DATA[id];
    if(action==='object-toggle'){
      const o=M.objects(state).find(o=>'object:'+o.id===value);if(!o)return;
      return modal(o.name,'<p>'+esc(o.description)+'</p><p>单击物件按钮开合，双击只读说明。其他分支不受影响，开合本身不加经验、不消耗道具，也不会解开原本上锁的通路。</p>');
    }
    if(action==='tree-expand')return modal(label,'<p>单击会在原来的图上长出下一层。这一枝与其他分支可以同时保留，刷新后也不会收起。双击具体证物查看文字；只有明确执行操作才推进机关。</p>');
    if(action==='tree-read'){
      const n=M.tree(state).nodes.find(n=>n.id===value);
      if(n)return readMapNode(n.action,n.value,n.label);
      return;
    }
    if(action==='map-room'){
      if(!M.visibleRooms(state).includes(value))return;
      const copy={...state,casebook:{...state.casebook,cases:{...state.casebook.cases,[id]:{...c,room:value}}}};
      return modal(d.rooms[value].name,'<p class="evidence-read">'+esc(P.has(state,'map')?M.describe(copy):'雨后的大厅没有人声。墙上钉着招领须知，镜子映着空椅子。')+'</p>');
    }
    if(['inspect','map-read'].includes(action)){
      if(!c.found.includes(value)){if(!owner)return toast('请先接管本页值班。');const r=C.act(state,'inspect',value);if(!r.ok)return toast(r.message);render();save();}
      if(c.found.includes(value)){if(owner){C.act(state,'read-evidence',value);render();save();}modal(C.evidenceTitle(state,value),evidenceContent(id,value));}
      return;
    }
    if(action==='map-action'||action==='map-execute'||action==='map-result'){
      const a=C.actions(state).find(a=>a.id===value),record=C.actionRecord(state,value,c.room)?.message||(lastMapResult?.caseId===id&&lastMapResult.value===value?lastMapResult.message:null)||(a?.done?'此步骤已完成。旧存档保留了完成状态，但没有当时的详细文字记录。':null);
      return modal(label,'<p class="evidence-read">'+esc(record||a?.reason||'单击进入此分支，再点击“执行操作”。阅读本身不会使用道具或推进机关。')+'</p>');
    }
    if(action==='map-solve'){if(c.room==='counter'&&C.field(c).flags.includes(C.CONFIG[id].done)&&!c.solved)modal('提交推理',puzzleForm(id,c));return;}
    if(action==='map-intro')return modal(d.name,'<p>'+esc(d.intro)+'</p>'+(C.opening(state,id)?'<p>'+esc(C.opening(state,id))+'</p>':''));
    if(action==='map-more')return modal(label,'<p>这里保留当前现场其余证物、操作与支路，包括已完成的记录。单击展开，不会使用道具；双击具体节点才阅读文字。收起只改变显示，不会删除进度。</p>');
    if(action==='map-supplies')return modal(label,'<p>可拿取的道具收在一起。单击选择一件，再点“执行操作”；双击只查看说明。你可以自由选择调查路线，不必把所有道具都拿齐。</p>');
    if(action==='map-optional'||action==='map-group')return modal(label,'<p>可选调查不影响结案。单击进入分支选择验证或能力，双击具体节点查看说明。</p>');
    if(action==='case'||action==='goto')return modal(label,'<p>单击这个节点继续，不会清空当前进度。</p>');
    if(action==='map-back')return toast('单击返回上一层。');
  }
  function showMapRoom() {
    const id = state.casebook.active, c = state.casebook.cases[id];
    modal(C.DATA[id].rooms[c.room].name, '<p class="evidence-read">' + esc(P.has(state, 'map') ? M.describe(state) : '雨后的大厅没有人声。墙上钉着招领须知，镜子映着空椅子。') + '</p>' + button('查看这个地点的节点', 'close-modal', '', null, 'secondary'));
  }
  function showMapMenu() {
    modal('调查工具', '<div class="map-menu">' + button('当前案卷', 'map-intro', '', null, 'secondary') + button('切换案卷', 'map-cases', '', null, 'secondary') + (B.level(state)>=3?button('关注清单','bookmarks','',null,'secondary'):'')+(B.level(state)>=7?button('手写札记','field-notes','',null,'secondary'):'')+(B.level(state)>=13?button('现场复核清单','checklist','',null,'secondary'):'')+(P.has(state,'legacy')?button('档案室','goto','legacy',null,'secondary'):'')+button('带我体验', 'guided-start', '', null, 'secondary') + button('玩法指引', 'guide', '', null, 'secondary') + button('查阅玩法', 'help', '', null, 'secondary') + button('现场留影', 'map-photo', '', null, 'secondary') + button('存档与说明', 'settings', '', null, 'secondary') + '</div>');
  }
  function showBookmarks(){
    const id=state.casebook.active,c=state.casebook.cases[id],list=state.investigator.bookmarks[id];
    modal('关注清单','<p>只收藏你标记的证物；不会替你推理。Lv.10 后轮回可保留关注对象，但旧谜底不带入新局。</p>'+(list.length?'<div class="map-menu">'+list.map(k=>c.found.includes(k)?button('★ '+esc(C.evidenceTitle(state,k)),'map-read',k,null,'secondary'):'<p>☆ '+esc(C.DATA[id].evidence[k].name)+' · 前轮关注，本轮尚未记录</p>').join('')+'</div>':'<p>双击已记录证物，点击“关注这件证物”即可加入。</p>'));
  }
  function showFieldNotes(){modal('手写札记 · '+C.DATA[state.casebook.active].name,'<label for="field-notes">写下自己的猜测，或给下次调查留个提醒（最多 1200 字）。本案独立保存，轮回时清空。</label><textarea id="field-notes" maxlength="1200" rows="8"'+(!owner?' disabled':'')+'>'+esc(state.investigator.notes[state.casebook.active])+'</textarea><p id="note-save-state" role="status">输入后自动保存</p>');}
  function showChecklist(){modal('现场复核清单','<p>只整理已开放现场的观察对象，不显示密码或机关次序。</p>'+C.checklist(state).map(r=>'<article class="map-record"><h3>'+esc(r.name)+'</h3><p>'+esc(r.blocked?'通路尚未开放；先完成对应机关。':r.missing.length?'尚未记录：'+r.missing.join('、'):'目前可见证物已记录。')+'</p></article>').join(''));}
  function showMapOptional(group) {
    if(group==='reasoning'){$('modal').close();return enterMapNode('map-group','reasoning','镜面附查');}
    const available = M.actions(state).filter(a => !M.primary(a)), category = a => a.group==='reasoning'?'reasoning':a.group === 'experiment' ? 'experiment' : a.id.startsWith('truth-') ? 'truth' : 'ability';
    const names = { reasoning:'镜面附查',experiment: '现场验证', truth: '寄存人核验', ability: '能力与支路' };
    if (!group) return modal('可选调查', '<div class="map-menu">' + Object.keys(names).filter(k => available.some(a => category(a) === k)).map(k => button(names[k], 'map-group', k, null, 'secondary')).join('') + '</div>');
    const entries = available.filter(a => category(a) === group);
    modal(names[group] || '可选调查', '<div class="map-menu">' + entries.map(a => button(esc(a.label), 'map-action', a.id, null, 'secondary')).join('') + '</div>' + (group === 'experiment' ? '<small>试错也会留下信息，不影响结案。</small>' : '') + (state.casebook.active === 'station' && group === 'experiment' ? '<details class="experiment-record"><summary>已完成的验证记录</summary>' + C.experiments(state).map(r => '<p>' + esc(r.record) + '</p>').join('') + '</details>' : ''));
  }
  function showMapHint() {
    const c = state.casebook.cases[state.casebook.active], hints = C.hint(state);
    modal('推理提示', '<p>' + esc(c.hints ? hints[c.hints - 1] : '先记录证物，再尝试操作现场。需要时逐级查看提示，最后一级才会给出完整解法。') + '</p>' + (c.hints < 3 ? button(c.hints ? '展开下一层提示' : '给我一点提示', 'hint', '', null, 'secondary') : '<small>三层提示已经展开。</small>'));
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
  function renderLegacy() {
    let html='<section class="archive-page"><header class="mind-heading"><div><span class="tiny-label">失物管理局 / 第 '+state.era+' 轮</span><h1>档案室</h1></div>'+button('回到调查导图','goto','case',null,'secondary')+'</header><p>这里保管结案记录与异常见闻，不需要安排员工或生产补给。</p>';
    html+='<div class="archive-cases">'+C.ORDER.filter(id=>C.unlocked(state,id)).map(id=>'<article class="map-record"><h3>'+esc(C.DATA[id].name)+'</h3><p>'+(state.casebook.cases[id].solved?'已结案 · '+(state.casebook.cases[id].resolution==='seal'?'封存过去':'归还过去'):'待调查')+'</p>'+button('回访案卷','case',id,null,'secondary')+'</article>').join('')+'</div><details class="archive-collection"><summary>异常藏品 · 本轮 '+state.artifacts.length+' / 6</summary><p>结案必得一件随机藏品。它们是故事收藏，不再提供生产加成，也不决定能否通关。</p><div class="card-grid">';
    html+=Object.entries(B.ARTIFACTS).map(([id,d])=>'<article class="management-card"><h3>'+esc(state.seen.includes(id)?d.name:'尚未见过的异常')+'</h3><p>'+esc(state.seen.includes(id)?d.text.split('。').slice(1).join('。'):'结案时可能收容。')+'</p><span class="tag">'+(state.artifacts.includes(id)?'本轮已收容':state.seen.includes(id)?'曾见过':'未收容')+'</span></article>').join('')+'</div></details>';
    if(!state.casebook.cases.city.solved)return html+'<p class="archive-next">完成第三案后，可以封存本轮案卷并主动开启新的调查。</p></section>';
    const ending=window.BureauRelease.chapter(state,'city');
    return html+'<section class="archive-next"><h2>'+esc(ending.title)+'</h2><p>'+esc(ending.text)+'</p><p>三案主线已完成。可以继续回访、完成附查，或开启新一轮。新一轮保留累计经验、等级和藏品见闻，重新随机案件参数；Lv.10 后保留关注对象，不保留旧谜底。</p>'+button('封存旧卷，开启新一轮','reset-dialog','',null,'gold')+'</section></section>';
  }
  const renderers = { case: renderCase, notebook: renderNotebook, legacy: renderLegacy };
  function render(force = false) {
    const unlocked = P.refresh(state);
    if(mapFocus&&(mapFocus.caseId!==state.casebook.active||mapFocus.era!==state.era))mapFocus=null;
    if(linkDraft&&(linkDraft.caseId!==state.casebook.active||linkDraft.era!==state.era)){linkDraft=null;linkFeedback='';}
    if (!P.has(state, tab)) tab = 'case';
    document.body.classList.toggle('first-observation', !P.has(state, 'map'));
    document.body.classList.toggle('pre-career', !P.has(state, 'career'));
    document.querySelectorAll('[data-tab]').forEach(el => el.hidden = !P.has(state, el.dataset.tab));
    document.querySelector('.career').hidden = !P.has(state, 'career');
    $('case-count').hidden = !state.casebook.cases.station.solved;
    $('resource-bar').hidden = true;
    document.querySelector('.journal-panel').hidden = true;
    $('feature-discovery').hidden = true;
    if (unlocked.length) toast('新分支已出现：' + unlocked.map(k => P.NAMES[k]).join('、'));
    document.body.classList.toggle('field-mode', tab === 'case');
    document.body.classList.add('mind-mode');
    const structural = JSON.stringify([tab, boardMode, mapFocus, linkDraft, linkFeedback, state.casebook, state.ui, state.tech, state.buildings, state.jobs, state.workers, state.artifacts, state.policy, state.expedition && state.expedition.site, B.level(state), state.paused]);
    if (force || structural !== lastStructure) {
      const view = [tab, state.casebook.active, state.casebook.cases[state.casebook.active].room].join('|');
      const fields = view === lastView ? Array.from(document.querySelectorAll('#puzzle-form input, #puzzle-form select')).map(el => [el.id, el.value]) : [];
      const focused = document.activeElement && document.activeElement.id;
      const experimentOpen = view === lastView && document.querySelector('.experiment-record')?.open;
      const canvas=document.querySelector('.mind-viewport'),pan=view===lastView&&canvas?{x:canvas.scrollLeft,y:canvas.scrollTop}:null;
      $('main').innerHTML = renderers[tab](); lastStructure = structural; lastView = view;
      if(pan){const nextCanvas=document.querySelector('.mind-viewport');if(nextCanvas){nextCanvas.scrollLeft=pan.x;nextCanvas.scrollTop=pan.y;}}
      drawMapLinks();
      if (experimentOpen && document.querySelector('.experiment-record')) document.querySelector('.experiment-record').open = true;
      document.querySelectorAll('#main [data-do="goto"]').forEach(el => el.hidden = !P.has(state, el.dataset.value));
      if (tab === 'case' && state.ui.walkthrough) {
        const g = walkthrough();
        for (const el of document.querySelectorAll('#main [data-do]')) if ((el.dataset.do === g.action || el.dataset.do === 'map-' + (g.action === 'interact' ? 'action' : g.action)) && el.dataset.value === g.value || g.action === 'choose-route' && (el.dataset.do === 'interact' || el.dataset.do === 'map-action') && ['take-fuse', 'take-pin'].includes(el.dataset.value)) el.classList.add('guided-target');
        if(boardMode==='site'){
          const branch=M.guideBranch(state,g),entry=branch&&$('mind-branch:'+branch);
          if(entry?.getAttribute('aria-expanded')==='false')entry.classList.add('guided-target');
        }
        if (g.action === 'submit') document.querySelector('[data-do="map-solve"]')?.classList.add('guided-target');
      }
      for (const [id, value] of fields) if ($(id)) $(id).value = value;
      if (focused && $(focused)) $(focused).focus({ preventScroll: true });
      document.querySelectorAll('[data-tab]').forEach(b => { b.classList.toggle('active', b.dataset.tab === tab); b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'); });
    }
    $('clock').textContent = '第 ' + (Math.floor(state.time / 600) + 1) + ' 日 · ' + String(Math.floor(state.time / 60) % 10).padStart(2, '0') + ':' + String(Math.floor(state.time) % 60).padStart(2, '0');
    $('era-label').textContent = '第 ' + state.era + ' 轮';
    const lv = B.level(state), titles = C.TITLES;
    $('level-label').textContent = 'Lv. ' + lv + ' · ' + titles[lv - 1] + '调查员';
    $('xp-label').textContent = lv === B.LEVELS.length ? state.career.xp + ' 经验 · 最高资历' : state.career.xp + ' / ' + B.LEVELS[lv] + ' 经验';
    $('xp-bar').style.width = (lv === B.LEVELS.length ? 100 : (state.career.xp - B.LEVELS[lv - 1]) / (B.LEVELS[lv] - B.LEVELS[lv - 1]) * 100) + '%';
    $('case-count').textContent = C.ORDER.filter(k => state.casebook.cases[k].solved).length + '/3'; $('evidence-count').textContent = C.ORDER.reduce((n, k) => n + state.casebook.cases[k].found.length, 0);
    $('stability-value').textContent = Math.round(state.stability) + '%'; $('stability-bar').style.width = state.stability + '%'; $('trust-value').textContent = Math.round(state.trust) + '%'; $('trust-bar').style.width = state.trust + '%';
    $('stability-note').textContent = state.stability < 35 ? '稳定度过低，生产降至 65%。可以遗忘部分记忆。' : '记忆满库会压低稳定，现实锚能缓解。';
    document.querySelectorAll('[data-field-stability]').forEach(el => el.textContent = Math.round(state.stability) + '%');
    document.querySelectorAll('[data-field-level]').forEach(el => el.textContent = 'Lv.' + B.level(state));
    $('pause-button').textContent = state.paused ? '继续' : '暂停';
    const journalKey = JSON.stringify(state.logs.slice(0, 12));
    if (journalKey !== lastJournal) { $('journal').innerHTML = state.logs.slice(0, 12).map(l => '<article class="log-entry ' + l.type + '"><time>第 ' + (Math.floor(l.time / 600) + 1) + ' 日 / ' + String(Math.floor(l.time / 60) % 10).padStart(2, '0') + ':' + String(l.time % 60).padStart(2, '0') + '</time><p>' + esc(l.message) + '</p></article>').join(''); lastJournal = journalKey; }
  }
  function settings() {
    modal('存档与说明','<p>操作后与每 10 秒自动保存。现在没有挂机生产或离线补算：关闭游戏后，案件停在你离开的地方。</p><p>同一浏览器、同一网站地址使用同一存档。换电脑、浏览器或地址前先导出，再到新页面导入。隐私模式或清理网站数据可能丢失进度。</p><div class="button-row">'+button('导出存档','export')+button('导入存档','import','',null,'secondary')+button('恢复上次自动备份','restore-backup','',null,'secondary')+button('接管本页值班','takeover','',null,'secondary')+'</div><p>旧版案件、证物、道具、等级和枝叶继续保留。旧经营数据留在存档中兼容备份，但不再运转或作为调查条件。主动轮回仍须完成第三案并确认。</p><div class="button-row">'+button('玩法与操作','guide','',null,'secondary')+button('经验与升级奖励','levels','',null,'secondary')+'</div><hr><p>清空新建会重置全部进度，旧存档会先导出为文件。</p>'+button('清空并新建存档','new-dialog','',null,'danger'));
    if(recoveryCopies().length)$('modal-body').insertAdjacentHTML('afterbegin','<p class="hint-note">曾发现无法读取的存档。异常原文单独保留，导出不会覆盖当前进度。</p>'+button('导出异常原始存档','export-unreadable','',null,'secondary'));
  }
  function recoveryCopies(){const all=[...unreadableCopies,...store.recoveryCopies()];return all.filter((v,i)=>all.findIndex(x=>x.raw===v.raw)===i);}
  function downloadText(data,name){const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function exportData(s = state) { downloadText(JSON.stringify(s,null,2),'失物管理局-第'+s.era+'轮-'+Date.now()+'.json'); }
  function resetDialog() { if(!state.casebook.cases.city.solved)return toast('先完成第三案，才能封存本轮。');modal('封存旧卷，重新开始调查？','<p>旧存档将先导出为文件。保留累计经验、等级与藏品见闻，Lv.10 后还保留关注对象。</p><p>本轮案件、道具、现场记录、展开枝叶、札记和藏品清空；旧版经营库存等本轮数据也会重置。密码、次序与藏品会重新随机，不继承旧谜底。</p>'+button('确认封存，开始下一轮','reset','',null,'gold')); }
  function cancelNodeEntry() {
    clearTimeout(nodeClickTimer);
    document.querySelectorAll('.mind-node.is-confirming').forEach(el => {
      el.classList.remove('is-confirming');
      if (el.dataset.originalHint) { el.querySelector('small').textContent = el.dataset.originalHint; delete el.dataset.originalHint; }
    });
  }
  document.addEventListener('click', event => {
    if(owner)claim();
    if(event.isTrusted)audio.unlock();
    const point = { x: event.clientX, y: event.clientY, time: event.timeStamp, keyboard: event.detail === 0, caseId: state.casebook.active, era: state.era };
    if (tab === 'case' && !$('modal').open && M.secondClick(lastNodeGesture, point)) {
      const first = lastNodeGesture; lastNodeGesture = null; cancelNodeEntry();
      event.preventDefault(); readMapNode(first.action, first.value, first.label); return;
    }
    const el = event.target.closest('button, .brand'); if (!el) return;
    if (!el.matches('.mind-node')) { cancelNodeEntry(); lastNodeGesture = null; }
    if (el.matches('.brand')) { event.preventDefault(); tab = 'case'; render(true); return; }
    if (el.dataset.tab) { if (!P.has(state, el.dataset.tab)) return; tab = el.dataset.tab; if (tab === 'notebook') { state.ui.notebookOpened = true; save(); } render(true); return; }
    const action = el.dataset.do, value = el.dataset.value; if (!action) return;
    if(el.matches('.mind-node')){
      cancelNodeEntry();FX.play(el,state.casebook.active,action,value);
      const label=el.querySelector('span').textContent;
      lastNodeGesture = point.keyboard ? null : { ...point, action, value, label };
      if (!point.keyboard && M.deferEntry(action)) {
        el.dataset.originalHint = el.querySelector('small').textContent;
        el.classList.add('is-confirming'); el.querySelector('small').textContent = '已选中 · 双击阅读说明';
        nodeClickTimer = setTimeout(() => { lastNodeGesture = null; enterMapNode(action,value,label); }, M.DOUBLE_CLICK_MS);
      } else enterMapNode(action,value,label);
      return;
    }
    cancelNodeEntry(); lastNodeGesture = null;
    if (action === 'close-modal') return $('modal').close();
    if(action==='map-zoom'){
      const viewport=document.querySelector('.mind-viewport'),z=state.ui.mapZoom||1;
      state.ui.mapZoom=value==='fit'?Math.max(.3,Math.min(1,viewport.clientWidth/1040)):value==='reset'?1:Math.max(.3,Math.min(1.25,z+(value==='in'?.1:-.1)));
      render(true);if(owner)save();return;
    }
    if(action==='map-home'){const viewport=document.querySelector('.mind-viewport');if(viewport)viewport.scrollTo({left:0,top:0,behavior:'instant'});return;}
    if(action==='bookmark'){if(!owner)return toast('请先接管本页值班。');const r=C.bookmark(state,value);if(r.ok){save();render(true);modal(C.evidenceTitle(state,value),evidenceContent(state.casebook.active,value));}return toast(r.message);}
    if(action==='bookmarks'&&B.level(state)>=3)return showBookmarks();
    if(action==='field-notes'&&B.level(state)>=7)return showFieldNotes();
    if(action==='checklist'&&B.level(state)>=13)return showChecklist();
    if(action==='audio-settings')return showAudio();
    if(action==='audio-music'||action==='audio-effects'){const key=action==='audio-music'?'music':'effects';audio.configure({[key]:!audio.status()[key]});showAudio();return;}
    if(action==='audio-start'){audio.unlock();return;}
    if (action === 'map-view') { if (!['site', 'notes'].includes(value) || value === 'notes' && !P.has(state, 'notebook')) return; clearTimeout(nodeClickTimer);mapFocus=null;linkDraft=null;linkFeedback='';boardMode=value;if(value==='notes'){state.ui.notebookOpened=true;save();}render(true);return; }
    if(action==='map-back'){mapFocus=null;render(true);return;}
    if(action==='map-focus-read'){if(mapFocus)readMapNode(mapFocus.action,mapFocus.value,mapFocus.label);return;}
    if(action==='map-confirm'){if(mapFocus?.action==='map-action'&&mapFocus.value===value)enterMapNode('map-execute',value,mapFocus.label);return;}
    if(action==='map-changes'){enterMapNode('tree-expand','changes','现场变化');$('mind-branch:changes')?.scrollIntoView({block:'center',behavior:'instant'});return;}
    if(action==='map-history')return showMapHistory();
    if(action==='map-hypotheses')return showHypotheses();
    if(action==='hypothesis-adopt'){
      if(!owner)return toast('请先接管本页值班。');const r=C.act(state,'hypothesis',value);save();render(true);return showHypotheses(r.message);
    }
    if(action==='hypothesis-judge'){
      if(!owner)return toast('请先接管本页值班。');const [id,verdict]=value.split(':');const r=C.act(state,'judge-hypothesis',{id,verdict});save();render(true);return showHypotheses(r.message);
    }
    if(action==='hypothesis-return'){$('modal').close();tab='case';mapFocus=null;linkDraft=null;boardMode='site';render(true);return;}
    if(action==='map-link-start'){
      if(!P.has(state,'notebook')||state.casebook.cases[state.casebook.active].found.length<2)return toast('先记录两件不同证物，再尝试连线。');
      const first=mapFocus&&['inspect','map-read'].includes(mapFocus.action)&&state.casebook.cases[state.casebook.active].found.includes(mapFocus.value)?mapFocus.value:null;
      linkDraft={a:first,b:null,method:'rule',caseId:state.casebook.active,era:state.era};linkFeedback='';mapFocus=null;boardMode='notes';state.ui.notebookOpened=true;render(true);save();return;
    }
    if(action==='map-link-cancel'){linkDraft=null;linkFeedback='';render(true);return;}
    if(action==='map-link-confirm'){
      if(!linkDraft||!owner)return toast('请先接管本页值班，再验证连线。');
      linkDraft.method=$('link-method').value;
      const r=C.act(state,'deduce',linkDraft);linkFeedback=(r.ok?'已确认：':'尚未确认：')+r.message;render(true);save();return;
    }
    if (action === 'map-menu') return showMapMenu();
    if (action === 'map-intro') { const id = state.casebook.active; return modal(C.DATA[id].name, '<p>' + esc(C.DATA[id].intro) + '</p>' + (C.opening(state, id) ? '<p>' + esc(C.opening(state, id)) + '</p>' : '') + '<small>线条表示调查分支；点击地点会沿已开放的通路前往。</small>'); }
    if (action === 'map-cases') return modal('已开放的案卷', '<div class="map-menu">' + C.ORDER.filter(id => C.unlocked(state, id)).map(id => button(esc(C.DATA[id].name), 'case', id, null, 'secondary')).join('') + '</div>');
    if (action === 'map-bag') { const f = C.field(state.casebook.cases[state.casebook.active]); return modal('随身道具', '<p>' + (f.items.length ? f.items.map(k => esc(C.ITEMS[k])).join(' · ') : '还没有道具。') + '</p>'); }
    if (action === 'map-photo') { const photo = { station: 'lost-property-office-horror.png', tuesday: 'tuesday-corridor-horror.png', city: 'city-archive-horror.png' }[state.casebook.active]; return modal('现场留影', '<img class="map-photo" src="assets/' + photo + '" alt="当前案件的恐怖悬疑现场留影"><p>留影只提供氛围，不包含必要解谜信息。</p>'); }
    if (action === 'map-read') { const c = state.casebook.cases[state.casebook.active]; if (c.found.includes(value)) modal(C.DATA[state.casebook.active].evidence[value].name, evidenceContent(state.casebook.active, value)); return; }
    if (action === 'map-relations') { const id = state.casebook.active; return modal('已验证的证物连线', C.deductionEntries(state).map(r => '<article class="map-record"><h3>'+esc(r.label)+'</h3><small>'+esc(C.DATA[id].evidence[r.a].name)+' ↔ '+esc(C.DATA[id].evidence[r.b].name)+'</small><p>'+esc(r.message)+'</p></article>').join('')); }
    if (action === 'map-hint') return showMapHint();
    if (action === 'map-optional') return showMapOptional();
    if (action === 'map-group') { if(boardMode==='site'){$('modal').close();return enterMapNode('tree-expand',value,{reasoning:'镜面附查',experiment:'现场验证',truth:'寄存人核验',ability:'能力与支路'}[value]||'可选调查');} return showMapOptional(value); }
    if (action === 'map-solve') { const id = state.casebook.active, c = state.casebook.cases[id]; if (c.room === 'counter' && C.field(c).flags.includes(C.CONFIG[id].done) && !c.solved) modal('提交推理', puzzleForm(id, c)); return; }
    if (action === 'map-room') { if (!owner) return toast('请先在存档中接管本页值班。'); const result = M.move(state, value); if (!result.ok) return toast(result.message); boardMode = 'site'; render(true); save(); showMapRoom(); return; }
    if (action === 'map-action') {
      const entry = M.actions(state).find(a => a.id === value); if (!entry) return toast('这项操作已完成，或不在当前地点。');
      if (entry.reason) return modal(entry.label, '<p>' + esc(entry.reason) + '</p>');
      if (!owner) return toast('请先在存档中接管本页值班。');
      const result = C.act(state, 'interact', value); render(); save();
      return modal(result.ok ? '现场有了变化' : '这次没有成功', '<p class="evidence-read">' + esc(result.message || '已完成操作。') + '</p>' + button('返回导图', 'close-modal', '', null, 'secondary'));
    }
    if (action === 'help') return showHelp();
    if (action === 'help-question') return showHelpAnswer(value);
    if (action === 'goto') { if (!P.has(state, value)) return toast('先继续当前调查，这项功能会稍后出现。'); $('modal').close(); tab = value; if (tab === 'notebook') { state.ui.notebookOpened = true; save(); } render(true); return; }
    if (action === 'guide') return showGuide();
    if(action==='walkthrough-step'){const g=walkthrough();return modal(g.title,'<p>'+esc(g.text)+'</p>'+button('回到导图继续','close-modal','',null,'secondary'));}
    if (action === 'walkthrough') { state.ui.walkthrough = !state.ui.walkthrough; render(true); save(); return; }
    if (action === 'guided-start') { state.ui.walkthrough = true; state.ui.introduced = true; introOpen = false; $('modal').close(); tab = 'case'; boardMode = 'site'; render(true); save(); return; }
    if (action === 'start-investigation') { state.ui.introduced = true; introOpen = false; $('modal').close(); tab = 'case'; render(true); save(); return; }
    if (action === 'settings') return settings();
    if (action === 'levels') return modal('调查员资历','<p>当前 Lv.'+B.level(state)+' · 累计 '+state.career.xp+' 经验 · 现实稳定 '+Math.round(state.stability)+'%。等级奖励服务于调查，不再增加产量或员工席位。</p><details class="xp-details"><summary>经验怎么获取？</summary><dl class="xp-sources"><dt>首次记录普通证物</dt><dd>+8</dd><dt>完成道具或机关步骤</dt><dd>+12</dd><dt>寄存人核验 / 装订</dt><dd>各 +12 / +60</dd><dt>侧室收容 / 壁龛奖励</dt><dd>+40 / +20</dd><dt>第一 / 二 / 三案结案</dt><dd>+65 / +95 / +135</dd></dl><p>上述首次奖励每轮只结算一次。三段机关全部正确才算一个步骤。重复阅读、行走、实物开合、感知、比对、连线、附查实验和在线等待不加经验。轮回保留累计经验；主线无需刷等级。</p></details>'+C.REWARDS.map((r,i)=>'<div class="level-row '+(B.level(state)<i+1?'locked':'')+'"><span>Lv.'+(i+1)+'</span><div>'+esc(r)+'<br><small class="progress-label">累计 '+B.LEVELS[i]+' 经验</small></div></div>').join(''));
    if (action === 'export') { state.lastSaved = Date.now(); exportData(); return toast('存档已导出，请保存下载的 JSON 文件。'); }
    if(action==='export-unreadable'){const copies=recoveryCopies();if(!copies.length)return toast('没有异常原文。');copies.forEach((v,i)=>downloadText(v.raw,'失物管理局-异常原文-'+v.source+'-'+i+'-'+Date.now()+'.json'));return toast('异常原文已导出；请保留文件，当前进度未改变。');}
    if (action === 'import') { $('import-file').value = ''; $('import-file').click(); return; }
    if (action === 'takeover') { if(!claim(true))return toast('暂时不能接管。');const loaded=store.read();if(loaded.state)state=loaded.state;unreadableCopies=loaded.unreadable;clearCaseView();lastTick = Date.now();$('storage-warning').hidden = true;if(loaded.unavailable)warn('浏览器不允许存档，请及时导出当前进度。');$('modal').close();render(true);save();return toast('本页开始值班。'); }
    if (!owner) return toast('另一个页面正在值班，请在设置中接管。');
    if (action === 'restore-backup') { try { pendingImport = deserialize(localStorage.getItem(BACKUP)); modal('恢复上次备份？', '<p>将覆盖当前进度。当前存档会先自动导出。</p>' + button('确认恢复', 'confirm-import', '', null, 'gold')); } catch { toast('没有可读取的自动备份。'); } return; }
    if (action === 'confirm-import') { if (!pendingImport) return; exportData(); state = pendingImport;clearCaseView();tab='case';state.lastSaved = Date.now(); lastTick = Date.now(); $('modal').close(); save(); render(true);revealCurrentRoom();return toast('存档已载入。'); }
    if (action === 'reset-dialog') return resetDialog();
    if (action === 'reset') { const next = C.resetInvestigation(state); if (!next) return toast('先完成第三案，才能开启下一轮。'); exportData(); state = next;clearCaseView();lastTick = Date.now(); tab = 'case'; $('modal').close(); save(); render(true);revealCurrentRoom();return toast('旧卷已封存。你的调查资历与见闻仍在。'); }
    if (action === 'new-dialog') return modal('重新开始所有进度？', '<p>这会清空等级、回声与传承，并新建第 1 轮。当前存档会先导出；请保留下载文件。</p>' + button('确认清空并新建', 'new-confirm', '', null, 'danger'));
    if (action === 'new-confirm') { exportData(); state = C.hydrate(B.fresh());clearCaseView();tab = 'case';lastTick = Date.now(); $('modal').close(); save(); render(true);revealCurrentRoom();return; }
    let result;
    if (['case', 'room', 'inspect', 'hint', 'interact'].includes(action)) { result = C.act(state, action, value); if (result.evidence) modal(C.DATA[state.casebook.active].evidence[value].name, evidenceContent(state.casebook.active, value)); }
    else if(action==='pause')result=B.act(state,'pause');
    else return; // Retired economy actions are not available even from old UI controls.
    if (result.ok && ['search', 'craft', 'build'].includes(action)) state.ui.operationsStarted = true; if (result.message) toast(result.message);
    if (result.ok && action === 'case') { clearCaseView();tab='case';$('modal').close(); }
    render(); save();if(result.ok&&action==='case')revealCurrentRoom();if (action === 'hint' && tab === 'case') showMapHint();
  });
  document.addEventListener('dblclick',event=>{if(event.target.closest('.mind-board'))event.preventDefault();});
  document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.shiftKey&&event.target.matches('.mind-node')){event.preventDefault();cancelNodeEntry();lastNodeGesture=null;const el=event.target;readMapNode(el.dataset.do,el.dataset.value,el.querySelector('span').textContent);}});
  document.addEventListener('input', event => { if(event.target.id==='audio-volume'){audio.configure({volume:Number(event.target.value)/100});$('audio-volume-label').textContent=event.target.value+'%';} if (event.target.id === 'help-query') { helpResults(event.target.value); $('help-answer').innerHTML = ''; } if(event.target.id==='link-method'&&linkDraft&&Object.hasOwn(C.METHODS,event.target.value))linkDraft.method=event.target.value; });
  document.addEventListener('input',event=>{if(event.target.id==='field-notes'&&owner&&claim()&&C.note(state,event.target.value))$('note-save-state').textContent=save()?'札记已保存':'未能保存，请导出存档';});
  let canvasDrag=null;
  document.addEventListener('pointerdown',event=>{const v=event.target.closest('.mind-viewport');if(!v||event.pointerType!=='mouse'||event.button!==0||event.target.closest('button'))return;canvasDrag={v,x:event.clientX,y:event.clientY,left:v.scrollLeft,top:v.scrollTop};v.setPointerCapture(event.pointerId);v.classList.add('is-dragging');});
  document.addEventListener('pointermove',event=>{if(!canvasDrag)return;const d=canvasDrag;d.v.scrollLeft=d.left+d.x-event.clientX;d.v.scrollTop=d.top+d.y-event.clientY;});
  function endCanvasDrag(){if(canvasDrag)canvasDrag.v.classList.remove('is-dragging');canvasDrag=null;}
  document.addEventListener('pointerup',endCanvasDrag);document.addEventListener('pointercancel',endCanvasDrag);
  document.addEventListener('submit', event => {
    if (event.target.id !== 'puzzle-form') return; event.preventDefault(); if (!owner||!claim()) return toast('请先在存档中接管并载入最新进度。');
    const data = new FormData(event.target), id = state.casebook.active;
    const payload = { code: data.get('code'), owner: data.get('owner'), order: [1, 2, 3, ...(id === 'city' ? [4] : [])].map(n => data.get('order' + n)), resolution: data.get('resolution') };
    if (id !== 'station' && (payload.order.some(v => !v) || !payload.resolution) || id !== 'tuesday' && !payload.owner) return toast('请先填完登记内容与处置方式。');
    const result = C.act(state, 'solve', payload); render(); save();
    if(result.ok){mapFocus=null;render(true);const ending=window.BureauRelease.chapter(state,id),next=C.ORDER[C.ORDER.indexOf(id)+1];modal(ending.title,'<p class="evidence-read">'+esc(ending.text)+'</p>'+(next?button('进入下一案','case',next):button('查看结局档案','goto','legacy'))+button('回访当前现场','close-modal','',null,'secondary'));}
    else { let feedback = $('puzzle-feedback'); if (!feedback) { feedback = document.createElement('p'); feedback.id = 'puzzle-feedback'; feedback.setAttribute('role', 'alert'); event.target.append(feedback); } feedback.textContent = result.message; }
  });
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast('存档文件过大，最大 2 MB。');
    try { pendingImport = deserialize(await file.text()); modal('导入这份存档？', '<p>第 ' + pendingImport.era + ' 轮 · 调查员 Lv.' + B.level(pendingImport) + ' · 已结案 ' + C.ORDER.filter(k => pendingImport.casebook.cases[k].solved).length + '/3。</p><p>将覆盖当前进度，当前存档会先导出为文件。</p>' + button('确认导入', 'confirm-import', '', null, 'gold')); }
    catch (error) { pendingImport = null; toast('存档无法读取：' + error.message); }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { cancelNodeEntry(); lastNodeGesture = null; $('modal').close(); } });
  $('modal').addEventListener('close', () => { if (introOpen) { state.ui.introduced = true; introOpen = false; save(); } });
  window.addEventListener('pagehide', () => { save();store.release(); });
  window.addEventListener('pageshow', event => { if(event.persisted){clearCaseView();lastTick=Date.now();load();render(true);} });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('storage', event => { if (event.key === LEASE) { try { const lock = event.newValue && JSON.parse(event.newValue); if (lock && lock.session !== session) { owner = false; $('save-status').textContent='仅供查看'; warn('另一个页面已接管值班。本页停止推进；可在设置中重新接管。');if(!document.hidden)render(true); } } catch { warn('值班标记无法读取，请在设置中接管本页；游戏存档未删除。'); } } });
  window.addEventListener('resize', drawMapLinks);
  load(); render(true);
    if (!state.ui.introduced && owner) { state.ui.introduced = true; save(); }
  if (owner) save();
  updateAudioUI();
  setInterval(() => { const now = Date.now(), elapsed = Math.max(0, (now - lastTick) / 1000); lastTick = now; if (owner && claim()) { if(!document.hidden)C.advanceInvestigation(state,Math.min(elapsed,2));if (now - lastSave > 10000) save(); } if(!document.hidden){render();updateAudioUI();} }, 1000);
  // Progressive enhancement: expose a read-only state summary where the browser supports WebMCP.
  if (document.modelContext && document.modelContext.registerTool) {
    try { Promise.resolve(document.modelContext.registerTool({ name: 'read_bureau_status', title: '查看管理局状态', description: 'Read the current visible game state without advancing time or changing any decisions.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => ({ era: state.era, level: B.level(state), resources: { ...state.r }, activeCase: state.casebook.active, solvedCases: C.ORDER.filter(k => state.casebook.cases[k].solved), evidence: [...state.casebook.cases[state.casebook.active].found], paused: state.paused }) })).catch(() => {}); } catch {}
  }
})();
