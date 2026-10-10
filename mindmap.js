(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./depth.js'), require('./progression.js'));
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
  function primary(a) { return a.group !== 'experiment' && !a.id.startsWith('truth-') && !['sense', 'read', 'compare', 'legacy-pocket', 'niche-open'].includes(a.id); }
  function scene(s) {
    const id = s.casebook.active, c = s.casebook.cases[id], d = C.DATA[id], f = C.field(c), rooms = visibleRooms(s);
    const leaves = d.rooms[c.room].things.filter((k, i) => P.has(s, 'map') || i === 0 || c.found.includes(d.rooms[c.room].things[0])).map(k => ({ id: 'evidence:' + k, label: d.evidence[k].name.replace('女人留下的', '').replace('提伞女人的证词', '提伞女人'), type: 'evidence', action: 'inspect', value: k, done: c.found.includes(k) }));
    const available = actions(s);
    for (const a of available.filter(primary)) leaves.push({ id: 'action:' + a.id, label: shortLabel(a, id), type: 'action', action: 'map-action', value: a.id, reason: a.reason || '' });
    if (available.some(a => !primary(a))) leaves.push({ id: 'optional', label: '验证与支路', type: 'optional', action: 'map-optional', value: '' });
    if (c.room === 'counter' && !c.solved && f.flags.includes(C.CONFIG[id].done)) leaves.push({ id: 'solve', label: '提交推理', type: 'solve', action: 'map-solve', value: '' });
    if (c.solved) leaves.push({ id: 'next', label: id === 'city' ? '决定城市去向' : '下一份案卷', type: 'solve', action: id === 'city' ? 'goto' : 'case', value: id === 'city' ? 'legacy' : C.ORDER[C.ORDER.indexOf(id) + 1] });
    const height = Math.max(340, rooms.length * ROW + 60, leaves.length * ROW + 60);
    const nodes = [{ id: 'case', label: d.name, type: 'root', action: 'map-intro', value: '', x: 128, y: height / 2 }];
    const edges = [];
    rooms.forEach((k, i) => {
      nodes.push({ id: 'room:' + k, label: d.rooms[k].name, type: 'room', action: 'map-room', value: k, active: k === c.room, visited: f.visited.includes(k), x: 380, y: (height - (rooms.length - 1) * ROW) / 2 + i * ROW });
      edges.push({ from: 'case', to: 'room:' + k, active: k === c.room });
    });
    leaves.forEach((n, i) => { nodes.push({ ...n, x: 676, y: (height - (leaves.length - 1) * ROW) / 2 + i * ROW }); edges.push({ from: 'room:' + c.room, to: n.id, active: true }); });
    return { nodes, edges, height, width: 820, activeRoom: c.room };
  }
  const RELATIONS = {
    station: [['notice', 'ticket', '柜号在前'], ['ticket', 'ledger', '拼合取件信息'], ['mirror', 'ledger', '比对失物描述'], ['woman', 'handwriting', '核对认领者']],
    tuesday: [['sign', 'memo', '离开方向'], ['tape', 'memo', '进路与归路'], ['labels', 'lever', '门只经过一次']],
    city: [['label', 'files', '登记先后'], ['files', 'manual', '历史顺序'], ['coat', 'letter', '身份线索']]
  };
  function notes(s) {
    const id = s.casebook.active, c = s.casebook.cases[id], d = C.DATA[id], groups = Object.entries(d.rooms).map(([k, r]) => ({ room: k, label: r.name, evidence: r.things.filter(k => c.found.includes(k)) })).filter(g => g.evidence.length);
    const rows = groups.reduce((n, g) => n + Math.max(1, g.evidence.length), 0), height = Math.max(340, rows * ROW + 60), nodes = [{ id: 'case', label: '已记录证物', type: 'root', action: 'map-intro', value: '', x: 128, y: height / 2 }], edges = [];
    let row = (height - (rows - 1) * ROW) / 2;
    for (const g of groups) {
      const roomId = 'room:' + g.room;
      nodes.push({ id: roomId, label: g.label, type: 'room', action: 'map-room', value: g.room, x: 380, y: row + (g.evidence.length - 1) * ROW / 2 });
      edges.push({ from: 'case', to: roomId });
      for (const k of g.evidence) { nodes.push({ id: 'evidence:' + k, label: d.evidence[k].name, type: 'evidence', action: 'map-read', value: k, done: true, x: 676, y: row }); edges.push({ from: roomId, to: 'evidence:' + k }); row += ROW; }
    }
    return { nodes, edges, height, width: 820, relations: RELATIONS[id].filter(([a, b]) => c.found.includes(a) && c.found.includes(b)) };
  }
  return { scene, notes, visibleRooms, path, move, actions, primary, secondClick, deferEntry, ROW, DOUBLE_CLICK_MS };
});
