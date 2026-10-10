(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./investigation.js'), require('./progression.js'));
  else root.InvestigationMap = factory(root.Cases, root.Progression);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C, P) {
  'use strict';
  const ROW = 92, DOUBLE_CLICK_MS = 420;
  // A redraw can replace the clicked button. Pair pointer clicks by location,
  // not DOM identity, so navigation can be immediate without losing reading.
  function secondClick(previous, current) {
    return !!previous && !current.keyboard && current.time >= previous.time && current.time - previous.time <= DOUBLE_CLICK_MS &&
      previous.caseId === current.caseId && previous.era === current.era &&
      Math.hypot(current.x - previous.x, current.y - previous.y) <= 10;
  }
  function deferEntry(action) { return ['map-execute', 'case', 'goto'].includes(action); }
  const SHORT = {
    'take-fuse': '取保险丝', 'take-pin': '取发夹', 'take-receipt': '取纸票', 'take-glass': '取旧镜片',
    'mirror-route': '撬开镜框', 'unlock': '打开登记室', 'lamp-ticket': '纸票透光', 'mirror-ledger': '映照擦痕',
    'take-key': '捞取钥匙', 'stamp': '压下认领印章', 'take-battery': '取电池', 'take-lens': '取校准镜片',
    'rewind': '倒转时间', 'project': '接通投影', 'authorize': '确认授权', 'annex': '收容侧室异常',
    'niche-open': '寻找冷风来源', 'niche-reward': '收容未寄出的信'
  };
  function shortLabel(a, id) {
    if (a.id === 'power') return id === 'station' ? '接通照明' : '接入电池';
    return SHORT[a.id] || a.label.split(' · ')[0];
  }
  function visibleRooms(s) {
    const c = s.casebook.cases[s.casebook.active];
    return Object.keys(C.DATA[s.casebook.active].rooms).filter(k => k === c.room || P.has(s, 'map') && !C.blocked(s, k));
  }
  function path(s, target) {
    if (!visibleRooms(s).includes(target)) return null;
    const start = s.casebook.cases[s.casebook.active].room, queue = [[start]], seen = new Set([start]);
    while (queue.length) {
      const route = queue.shift(), at = route[route.length - 1];
      if (at === target) return route.slice(1);
      for (const next of C.LINKS[at] || []) if (!seen.has(next) && !C.blocked(s, next)) { seen.add(next); queue.push([...route, next]); }
    }
    return null;
  }
  function move(s, target) {
    const route = path(s, target);
    if (!route) return { ok: false, message: '通路尚未开放，请先调查当前节点。' };
    for (const step of route) { const result = C.act(s, 'room', step); if (!result.ok) return result; }
    return { ok: true };
  }
  function actions(s) {
    return P.has(s, 'map') ? C.actions(s).filter(a => !a.done && (a.reason === undefined || !['sense', 'read', 'compare'].includes(a.id) || !a.reason)) : [];
  }
  function primary(a) { return !['experiment','reasoning'].includes(a.group) && !a.id.startsWith('truth-') && !['sense', 'read', 'compare', 'legacy-pocket', 'niche-open'].includes(a.id); }
  function sceneState(s) {
    const id=s.casebook.active,c=s.casebook.cases[id],f=C.field(c),has=k=>f.flags.includes(k);
    if(id==='station'){
      const q=f.reasoning;
      if(c.room==='hall'){
        if(q.observations.includes('step'))return '粉末线留下脚印，倒影又多走了一步。';
        if(q.observations.includes('still'))return '女人站着不动，镜中的鞋却跨过了线。';
        if(q.marked)return '浅粉末线留在地面，女人站在线后。';
        if(has('mirror-route'))return '镜框已经敞开，身后的脚步晚了一拍。';
        if(has('opened'))return '登记室的门开了，镜中仍没有你。';
        if(has('powered'))return '走廊灯亮了，湿脚印通向登记室。';
        return c.found.includes('mirror')?'镜中有女人，却没有你的倒影。':'灯闪了两次，镜子映着空椅子。';
      }
      if(c.room==='bench'){
        if(q.answered)return '女人合上伞，长椅露出两道逆向水痕。';
        if(q.asked)return '女人停下催促，等你去核对镜中脚步。';
        if(f.items.includes('receipt'))return '潮湿纸票已收好，女人仍握着雨伞。';
        if(f.items.includes('pin'))return '椅底发夹已收好，女人仍在等。';
        if(f.items.includes('fuse'))return '椅底保险丝已收好，女人仍在等。';
        return '女人起身，一张湿纸票落在椅上。';
      }
      if(c.room==='records')return has('ticket-lit')&&has('erasure')?'灯下的纸票与登记簿擦痕都已显现。':has('erasure')?'擦去的文字已读出，台灯仍亮着。':has('ticket-lit')?'纸票柜号已显现，登记簿仍留着擦痕。':'台灯一直亮着，登记簿最后一行被擦过。';
      if(c.room==='counter')return c.solved?'认领已经完成，窗口仍亮着灯。':has('stamped')?'印章已经落下，认领栏等你填写。':'印章悬在表上，认领栏还是空的。';
    }
    if(id==='tuesday'){
      if(c.room==='hall'&&has('doors'))return '三道门已接通，走廊尽头响起钟声。';
      if(c.room==='hall'&&has('rewound'))return '楼梯倒着伸展，走廊仍停在星期二。';
      if(c.room==='bench'&&f.items.includes('battery'))return '电池已经取出，磁带仍留在桌上。';
      if(c.room==='records'&&has('rewound'))return '倒带键已压下，远处传来逆行的脚步。';
      if(c.room==='counter'&&c.solved)return '等待已经结束，这一天重新接回日历。';
    }
    if(id==='city'){
      if(c.room==='hall'&&has('aligned'))return '模型已经校准，地下街的入口显现了。';
      if(c.room==='hall'&&has('projected'))return '投影落在前厅，三枚街区机关亮起。';
      if(c.room==='bench'&&f.items.includes('lens'))return '校准镜片已收好，外套仍留在这里。';
      if(c.room==='counter'&&c.solved)return '城市已经接回现实，归还台安静下来。';
    }
    // Use only the visible scene description, never randomized answers or hints.
    return C.describe(s).split(/[。！？]/)[0]+'。';
  }
  function branchPriority(n, s) {
    if(n.type==='solve')return 0;
    // Keep all sequence choices together, without ranking the correct answer.
    if(n.type==='action'&&!n.done&&n.value.startsWith('sequence:'))return 1;
    if(n.id==='reasoning'&&C.field(s.casebook.cases.station).reasoning.guesses.length&&C.actions(s).some(a=>a.group==='reasoning'&&!a.done))return 1;
    if(n.type==='evidence'&&n.hint==='新发现')return 2;
    if(n.id==='supplies'||n.type==='action'&&!n.done&&!n.reason)return 3;
    if(n.type==='evidence'&&n.hint==='待验证')return 4;
    if(n.done)return 8;
    if(n.type==='action'&&!n.done)return 5;
    if(n.type==='optional')return 6;
    return 7;
  }
  function scene(s) {
    const id = s.casebook.active, c = s.casebook.cases[id], d = C.DATA[id], f = C.field(c), rooms = visibleRooms(s);
    const leaves = d.rooms[c.room].things.filter((k, i) => P.has(s, 'map') || i === 0 || c.found.includes(d.rooms[c.room].things[0])).map(k => ({ id: 'evidence:' + k, label: d.evidence[k].name.replace('女人留下的', '').replace('提伞女人的证词', '提伞女人'), type: 'evidence', action: 'inspect', value: k, done: c.found.includes(k),hint:C.evidenceStatus(s,k) }));
    const available = actions(s);
    const operations=P.has(s,'map')?C.actions(s).filter(primary):[];
    for (const a of operations) leaves.push({ id: 'action:' + a.id, label: shortLabel(a, id), type: 'action', action: a.done?'map-result':'map-action', value: a.id, done:a.done, hint:a.done?(a.id.startsWith('take-')?'已取得':a.id==='power'?'已接通':a.id==='unlock'||a.id==='mirror-route'?'通路已打开':'已完成'):'', reason: a.done?'':a.reason || '' });
    const reasoningActions=C.actions(s).filter(a=>a.group==='reasoning');
    if(reasoningActions.length){const done=reasoningActions.every(a=>a.done);leaves.push({id:'reasoning',label:'镜面附查',type:'optional',action:'map-group',value:'reasoning',done,hint:done?'此处已完成 · 回看记录':'追问 · 对照 · 回看记录'});}
    if (available.some(a => !primary(a)&&a.group!=='reasoning')) leaves.push({ id: 'optional', label: '验证与支路', type: 'optional', action: 'map-optional', value: '' });
    if (c.room === 'counter' && !c.solved && f.flags.includes(C.CONFIG[id].done)) leaves.push({ id: 'solve', label: '提交推理', type: 'solve', action: 'map-solve', value: '' });
    if (c.solved) leaves.push({ id: 'next', label: id === 'city' ? '决定城市去向' : '下一份案卷', type: 'solve', action: id === 'city' ? 'goto' : 'case', value: id === 'city' ? 'legacy' : C.ORDER[C.ORDER.indexOf(id) + 1] });
    const supplies=leaves.filter(n=>n.type==='action'&&!n.done&&n.value.startsWith('take-'));
    const groups={supplies:supplies.length>1?supplies:[]};
    let choices=groups.supplies.length?leaves.filter(n=>!groups.supplies.includes(n)):leaves;
    if(groups.supplies.length)choices.push({id:'supplies',label:'取用道具',type:'optional',action:'map-supplies',value:'',hint:groups.supplies.length+' 件 · 单击选择'});
    if(P.has(s,'map'))choices=choices.map((n,i)=>({n,i})).sort((a,b)=>branchPriority(a.n,s)-branchPriority(b.n,s)||a.i-b.i).map(x=>x.n);
    const secondary=choices.slice(3),shown=choices.slice(0,3);
    if(secondary.length)shown.push({id:'more',label:'其他调查',type:'optional',action:'map-more',value:'',hint:secondary.length+' 项 · 单击展开'});
    const elsewhere=rooms.filter(k=>k!==c.room),height = Math.max(340, elsewhere.length * ROW + 60, shown.length * ROW + 60);
    const trace=id==='station'?(c.room==='hall'&&f.reasoning.marked?'powder':c.room==='bench'&&f.reasoning.answered?'water':''):'';
    const nodes = [{ id:'room:'+c.room,label:d.rooms[c.room].name,type:'root',action:'map-room',value:c.room,active:true,x:128,y:height/2,sceneMark:trace,hint:'你在这里',sceneState:sceneState(s) }];
    const edges = [];
    elsewhere.forEach((k, i) => {
      nodes.push({ id: 'room:' + k, label: d.rooms[k].name, type: 'room', action: 'map-room', value: k, visited: f.visited.includes(k), x:676,y:(height-(elsewhere.length-1)*ROW)/2+i*ROW });
      edges.push({from:'room:'+c.room,to:'room:'+k,navigation:true,active:false});
    });
    shown.forEach((n, i) => { nodes.push({ ...n, x:380, y: (height - (shown.length - 1) * ROW) / 2 + i * ROW }); edges.push({ from: 'room:' + c.room, to: n.id, active: true }); });
    return { nodes, edges, height, width: 820, activeRoom: c.room, secondary, groups, navigationLabel:elsewhere.length?'可前往':'' };
  }
  function notes(s) {
    const id = s.casebook.active, c = s.casebook.cases[id], d = C.DATA[id], groups = Object.entries(d.rooms).map(([k, r]) => ({ room: k, label: r.name, evidence: C.visibleEvidence(s,k).filter(k => c.found.includes(k)) })).filter(g => g.evidence.length);
    const rows = groups.reduce((n, g) => n + Math.max(1, g.evidence.length), 0), height = Math.max(340, rows * ROW + 60), nodes = [{ id: 'case', label: '已记录证物', type: 'root', action: 'map-intro', value: '', x: 128, y: height / 2 }], edges = [];
    let row = (height - (rows - 1) * ROW) / 2;
    for (const g of groups) {
      const roomId = 'room:' + g.room;
      nodes.push({ id: roomId, label: g.label, type: 'room', action: 'map-room', value: g.room, x: 380, y: row + (g.evidence.length - 1) * ROW / 2 });
      edges.push({ from: 'case', to: roomId });
      for (const k of g.evidence) { nodes.push({ id: 'evidence:' + k, label: d.evidence[k].name, type: 'evidence', action: 'map-read', value: k, done: true,hint:C.evidenceStatus(s,k), x: 676, y: row }); edges.push({ from: roomId, to: 'evidence:' + k }); row += ROW; }
    }
    const confirmed=C.deductionEntries(s);
    confirmed.forEach(r=>edges.push({from:'evidence:'+r.a,to:'evidence:'+r.b,relation:true,active:true}));
    return { nodes, edges, height, width: 820, relations:confirmed.map(r=>[r.a,r.b,r.label]) };
  }
  return { scene, sceneState, notes, visibleRooms, path, move, actions, primary, secondClick, deferEntry, ROW, DOUBLE_CLICK_MS };
});
