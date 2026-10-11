(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./investigator.js'), require('./progression.js'));
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
  function deferEntry(action) { return ['map-execute', 'object-toggle', 'case', 'goto'].includes(action); }
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
  function primary(a) { return !['experiment','reasoning','ability'].includes(a.group) && !a.id.startsWith('truth-') && !['sense', 'read', 'compare', 'legacy-pocket', 'niche-open'].includes(a.id); }
  function sceneState(s) {
    const id=s.casebook.active,c=s.casebook.cases[id],f=C.field(c),has=k=>f.flags.includes(k);
    if(id==='station'){
      const q=f.reasoning;
      if(c.room==='workshop'&&!objectOpen(s,OBJECTS.find(o=>o.id==='fuse-box')))return has('powered')?'箱盖已合上，照明仍然接通。':'配电箱的铁盖合着，边缘留着湿手印。';
      if(c.room==='hall'){
        if(has('test-uncover'))return '纸票已移开，倒影正从镜框上收回手。';
        if(has('test-cover'))return f.mirrorCovered?(has('test-frame')?'镜面仍被遮住，纸票一角刚鼓起。':'镜面被纸票遮住，两下敲击从背面传来。'):'纸票已取回，镜面重新露出；记录仍留着。';
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
      if(c.room==='records'){
        if(!objectOpen(s,OBJECTS.find(o=>o.id==='desk-lamp')))return '台灯已熄灭，已有观察仍留在证物笔记里。';
        return has('ticket-lit')&&has('erasure')?'灯下的纸票与登记簿擦痕都已显现。':has('erasure')?'擦去的文字已读出，台灯仍亮着。':has('ticket-lit')?'纸票柜号已显现，登记簿仍留着擦痕。':'台灯一直亮着，登记簿最后一行被擦过。';
      }
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
  const BRANCH_NAMES = {evidence:'现场证物',operations:'主线操作',reasoning:'镜面附查',experiment:'现场验证',truth:'寄存人核验',ability:'能力与支路',changes:'现场变化',travel:'前往地点'};
  // Containers expose their contents; opening a cover never completes the
  // operation inside it. These switches are deliberately separate from locks.
  const OBJECTS = [
    {caseId:'station',room:'workshop',id:'fuse-box',name:'配电箱',sound:'metal',evidence:['detail0'],actions:['power'],description:'有铰链的铁箱盖。打开后才能看到线路和保险丝槽；装入保险丝仍需亲自执行。'},
    {caseId:'station',room:'records',id:'claim-drawer',name:'待认领抽屉',sound:'wood',evidence:['ledger','handwriting'],actions:['mirror-ledger'],description:'木抽屉里放着登记簿。关上只收起内部枝叶，已经记录的文字和擦痕不会丢失。'},
    {caseId:'station',room:'records',id:'desk-lamp',name:'台灯',sound:'switch',evidence:[],actions:['lamp-ticket'],defaultOpen:true,on:'点亮',off:'关掉',description:'带机械开关的台灯。点亮后可以将纸票放在灯下透光；关掉不会抹去已经显影的记录。'},
    {caseId:'tuesday',room:'bench',id:'desk-drawer',name:'值班桌抽屉',sound:'wood',evidence:[],actions:['take-battery'],description:'桌侧的木抽屉。电池在里面，打开不等于取走；仍需执行取电池。'},
    {caseId:'tuesday',room:'workshop',id:'battery-cover',name:'磁带机电池盖',sound:'plastic',evidence:[],actions:['power'],description:'磁带机背后的塑料盖。打开可操作电池槽；合上盖子不会撤销已修好的供电。'},
    {caseId:'tuesday',room:'records',id:'time-jars',name:'时间罐盖',sound:'glass',evidence:['labels'],actions:[],description:'玻璃时间罐带着旋盖。打开查看标签，盖回后标签的调查记录仍留在笔记里。'},
    {caseId:'city',room:'bench',id:'coat-pocket',name:'外套衣袋',sound:'cloth',evidence:['coat'],actions:['take-lens'],description:'外套上的翻盖衣袋。掀开查看工作证和镜片；合上不会把已经拿到的道具放回去。',on:'掀开',off:'合上'},
    {caseId:'city',room:'workshop',id:'projector-cover',name:'投影仪检修盖',sound:'metal',evidence:['detail0'],actions:['project'],description:'投影仪的检修盖。打开可安装校准镜片；合盖只收起检修分支，不会关闭已经启动的投影。'},
    {caseId:'city',room:'records',id:'original-folder',name:'原始卷宗夹',sound:'paper',evidence:['files','manual'],actions:[],description:'夹扣固定着原始卷宗。展开阅读，合起收好；已经拼合的先后关系保留。',on:'展开',off:'合起'}
  ];
  const objectKey = (s,o) => s.casebook.active+':'+o.room+':'+o.id;
  function objects(s){return OBJECTS.filter(o=>o.caseId===s.casebook.active&&o.room===s.casebook.cases[s.casebook.active].room);}
  function objectOpen(s,o){const v=s.ui?.objectStates?.[objectKey(s,o)];return typeof v==='boolean'?v:o.defaultOpen===true||opened(s).includes('object:'+o.id);}
  function restoreObjects(s,raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return s;
    const clean={};
    for(const o of OBJECTS){const key=o.caseId+':'+o.room+':'+o.id;if(Object.hasOwn(raw,key)&&typeof raw[key]==='boolean')clean[key]=raw[key];}
    s.ui ||= {};s.ui.objectStates=clean;return s;
  }
  function toggleObject(s,token){
    const o=objects(s).find(o=>'object:'+o.id===token);
    if(!o||!P.has(s,'map')||C.blocked(s,o.room))return {ok:false,message:'此物件尚未开放。'};
    const open=!objectOpen(s,o);s.ui ||= {};s.ui.objectStates ||= {};s.ui.objectStates[objectKey(s,o)]=open;
    if(open){s.ui.investigationTrees ||= {};s.ui.investigationTrees[treeKey(s)]=[...new Set([...opened(s),token])];}
    return {ok:true,open,object:o,message:open?'内部枝叶已展开；拿取和修复仍需执行操作。':'内部枝叶已隐藏；证物、道具与调查记录保留。'};
  }
  function describe(s){
    let text=C.describe(s);
    const box=objects(s).find(o=>o.id==='fuse-box');
    if(box&&!objectOpen(s,box))return '配电箱的箱盖合着，湿手印留在边缘。打开箱盖可以检查线路与缺失部件。'+(C.field(s.casebook.cases.station).flags.includes('powered')?'照明仍然接通；合盖没有切断电力。':'');
    const lamp=objects(s).find(o=>o.id==='desk-lamp');
    if(lamp&&!objectOpen(s,lamp))text=text.replace(/台灯[^。]*。/g,'台灯已熄灭。').replace('把纸票放到灯下观察；','点亮台灯后才能透光观察；')+' 你关掉了台灯；已有观察仍可在证物笔记中回看。';
    return text;
  }
  const category = a => ['annex','niche-reward'].includes(a.id)?'ability':primary(a)?'operations':a.group==='reasoning'?'reasoning':a.group==='experiment'?'experiment':a.id.startsWith('truth-')?'truth':'ability';
  function catalog(s) {
    const id=s.casebook.active,c=s.casebook.cases[id],d=C.DATA[id];
    const evidence=C.visibleEvidence(s,c.room).filter(k=>!Object.hasOwn(C.CHANGE_EVIDENCE,k)).filter((k,i)=>P.has(s,'map')||i===0||c.found.includes(d.rooms[c.room].things[0])).map(k=>({id:'evidence:'+k,label:C.evidenceTitle(s,k).replace('女人留下的','').replace('提伞女人的证词','提伞女人'),type:'evidence',action:'inspect',value:k,done:c.found.includes(k),hint:C.evidenceStatus(s,k)}));
    const available=P.has(s,'map')?C.actions(s).filter(a=>!['sense','read','compare'].includes(a.id)||a.done||!a.reason):[];
    const groups=[{token:'evidence',children:evidence,scope:'main'}];
    for(const token of ['operations','reasoning','experiment','truth','ability']){
      const children=available.filter(a=>category(a)===token).map(a=>({id:'action:'+a.id,label:shortLabel(a,id),type:'action',action:a.done?'map-result':'map-action',value:a.id,done:a.done,reason:a.done?'':a.reason||'',hint:a.done?'已完成':a.reason?'缺少条件':'待操作'}));
      if(children.length)groups.push({token,children,scope:token==='operations'?'main':'side'});
    }
    const changes=C.changes(s).map(e=>({id:'evidence:'+e.key,label:e.name,type:'evidence',action:'inspect',value:e.key,done:c.found.includes(e.key),hint:c.found.includes(e.key)?'已记录':e.source+'后出现',changed:true}));
    if(changes.length)groups.push({token:'changes',children:changes,scope:'side'});
    const rooms=visibleRooms(s).filter(k=>k!==c.room).map(k=>({id:'room:'+k,label:d.rooms[k].name,type:'room',action:'map-room',value:k,visited:C.field(c).visited.includes(k),hint:'前往'}));
    if(rooms.length)groups.push({token:'travel',children:rooms,scope:'travel'});
    if(P.has(s,'map'))for(const object of objects(s)){
      const matches=n=>n.type==='evidence'?object.evidence.includes(n.value):n.type==='action'&&object.actions.includes(n.value);
      const children=groups.flatMap(g=>g.children.filter(matches));
      if(!children.length)continue;
      for(const g of groups)g.children=g.children.filter(n=>!matches(n));
      const travel=groups.findIndex(g=>g.token==='travel');
      groups.splice(travel<0?groups.length:travel,0,{token:'object:'+object.id,children,scope:'main',object});
    }
    return groups.filter(g=>g.children.length);
  }
  const treeKey = s => s.casebook.active+':'+s.casebook.cases[s.casebook.active].room;
  function opened(s){const saved=s.ui?.investigationTrees?.[treeKey(s)];return Array.isArray(saved)?saved:['evidence'];}
  function grow(s,token) {
    const groups=catalog(s),parent=groups.find(g=>g.token===token||g.children.some(n=>n.id===token&&n.type!=='room'));
    if(!parent)return false;
    s.ui ||= {};s.ui.investigationTrees ||= {};
    s.ui.investigationTrees[treeKey(s)]=[...new Set([...opened(s),parent.token,token])];
    if(parent.object){s.ui.objectStates ||= {};s.ui.objectStates[objectKey(s,parent.object)]=true;}
    return true;
  }
  function restoreTrees(s,raw,rawObjects) {
    restoreObjects(s,rawObjects);
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return s;
    const clean={};
    for(const id of C.ORDER)for(const room of Object.keys(C.DATA[id].rooms)){
      const key=id+':'+room;if(!Object.hasOwn(raw,key)||!Array.isArray(raw[key]))continue;
      const copy={...s,casebook:{...s.casebook,active:id,cases:{...s.casebook.cases,[id]:{...s.casebook.cases[id],room}}}};
      const groups=catalog(copy),valid=new Set(groups.flatMap(g=>[g.token,...g.children.filter(n=>n.type!=='room').map(n=>n.id)]));
      // Only presentation state is restored. A saved branch never unlocks a room,
      // grants an item, or completes an investigation action.
      const values=raw[key].slice(0,80).filter(v=>typeof v==='string'&&valid.has(v));
      for(const g of groups)if(g.children.some(n=>values.includes(n.id)))values.push(g.token);
      clean[key]=[...new Set(['evidence',...values])];
    }
    if(Object.keys(clean).length)s.ui.investigationTrees=clean;
    return s;
  }
  function tree(s) {
    const id=s.casebook.active,c=s.casebook.cases[id],d=C.DATA[id],expanded=opened(s),f=C.field(c);
    const trace=id==='station'?(c.room==='hall'&&f.reasoning.marked?'powder':c.room==='bench'&&f.reasoning.answered?'water':''):'';
    const root='room:'+c.room,nodes=[{id:root,label:d.rooms[c.room].name,type:'root',action:'map-room',value:c.room,active:true,x:82,y:100,depth:0,scope:'main',hint:'你在这里',sceneState:sceneState(s),sceneMark:trace}],edges=[];
    let row=100;
    for(const g of catalog(s)){
      const parent='branch:'+g.token,isOpen=g.object?objectOpen(s,g.object):g.token==='changes'||expanded.includes(g.token),label=g.object?(isOpen?(g.object.off||'关上'):(g.object.on||'打开'))+g.object.name:BRANCH_NAMES[g.token];
      const completed=g.children.filter(n=>n.done&&n.hint!=='待验证').length,done=g.children.length>0&&completed===g.children.length;
      nodes.push({id:parent,label,type:g.object?'object':'branch',action:g.object?'object-toggle':'tree-expand',value:g.token,x:285,y:row,depth:1,scope:g.scope,expanded:isOpen,done:g.object?false:done,hint:g.object?(g.object.id==='desk-lamp'?(isOpen?'灯已亮':'灯已灭'):(isOpen?'已打开':'已合上'))+' · '+(isOpen?'内部 '+completed+'/'+g.children.length+' 已查':'内部枝叶隐藏'):g.token==='changes'?'操作留下的变化':g.token==='travel'?'选择目的地':`${completed}/${g.children.length} ${g.token==='evidence'?'已记录':'已完成'} · ${isOpen?'已展开':'展开'}`});
      edges.push({from:root,to:parent,active:g.scope==='main',scope:g.scope});
      if(isOpen)for(const n of g.children){
        nodes.push({...n,x:500,y:row,depth:2,scope:g.scope,expanded:n.type!=='room'?expanded.includes(n.id):undefined});
        edges.push({from:parent,to:n.id,active:g.scope==='main',scope:g.scope,done:n.done&&n.hint!=='待验证'});
        if(expanded.includes(n.id)&&n.type!=='room'){
          const leaf=n.type==='evidence'?{label:n.done?'回看文字':'观察并记录',action:'tree-read',value:n.id,hint:'阅读证物'}:n.done?{label:'回看结果',action:'tree-read',value:n.id,hint:'已完成 · 记录保留'}:n.reason?{label:'查看所需条件',action:'tree-read',value:n.id,hint:'不会执行操作'}:{label:'执行操作',action:'map-execute',value:n.value,hint:'亲自操作才推进'};
          nodes.push({...leaf,id:'leaf:'+n.id,type:'leaf',x:715,y:row,depth:3,scope:g.scope,done:n.done&&n.hint!=='待验证'});
          edges.push({from:n.id,to:'leaf:'+n.id,active:g.scope==='main',scope:g.scope,done:n.done&&n.hint!=='待验证'});
        }
        row+=104;
      }
      else row+=104;
      row+=24;
    }
    if(c.room==='counter'&&!c.solved&&f.flags.includes(C.CONFIG[id].done)||c.solved){
      const n=c.solved?{id:'next',label:id==='city'?'决定城市去向':'下一份案卷',action:id==='city'?'goto':'case',value:id==='city'?'legacy':C.ORDER[C.ORDER.indexOf(id)+1]}:{id:'solve',label:'提交推理',action:'map-solve',value:''};
      nodes.push({...n,type:'solve',x:285,y:row,depth:1,scope:'main',hint:c.solved?'继续':'核对主线'});edges.push({from:root,to:n.id,active:true});row+=104;
    }
    return {nodes,edges,width:820,height:Math.max(300,row-24),tree:true};
  }
  function guideBranch(s,g){
    if(g.action==='room')return 'travel';
    if(g.action==='choose-route')return 'operations';
    return catalog(s).find(b=>b.children.some(n=>n.value===g.value&&n.action===(g.action==='interact'?'map-action':g.action)))?.token;
  }
  function journey(s){
    const id=s.casebook.active,c=s.casebook.cases[id],f=C.field(c),has=k=>f.flags.includes(k);
    const labels=id==='station'?['发现异常','打开通路','补齐信息','完成认领']:id==='tuesday'?['发现异常','恢复设备','找回归途','结束等待']:['发现异常','启动投影','校准城市','完成归还'];
    let index;
    if(c.solved)index=4;
    else if(id==='station')index=has('ticket-lit')&&has('erasure')?3:has('opened')?2:c.found.length>=2||f.items.length?1:0;
    else if(id==='tuesday')index=has('doors')?3:has('powered')?2:c.found.length>=2||f.items.length?1:0;
    else index=has('authorized')?3:has('projected')?2:c.found.length>=2||f.items.length?1:0;
    return labels.map((label,i)=>({label,status:i<index?'done':i===index?'current':'future'}));
  }
  return { scene, sceneState, describe, notes, tree, grow, restoreTrees, restoreObjects, objects, objectOpen, toggleObject, OBJECTS, guideBranch, journey, visibleRooms, path, move, actions, primary, secondClick, deferEntry, ROW, DOUBLE_CLICK_MS };
});
