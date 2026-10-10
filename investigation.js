(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./depth.js'));
  else root.Cases = factory(root.Cases);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';
  const METHODS = { rule: '规则核对', combine: '信息拼合', identity: '身份比对', reverse: '逆向路线', order: '先后排列' };
  const RELATIONS = {
    station: [
      {id:'ticket-rule',a:'notice',b:'ticket',method:'rule',label:'取件信息的格式',needs:['ticket-lit'],result:()=> '须知要求柜号在前、日号在后；纸票保存的是柜号，另一半仍需从现场找回。'},
      {id:'ticket-ledger',a:'ticket',b:'ledger',method:'combine',label:'两半取件信息',needs:['ticket-lit','erasure'],result:c=>'纸票保留柜号 '+String(c.box).padStart(2,'0')+'；登记簿保留遗失日 '+c.day+'。它们是同一份取件信息的两半，不是两个不同的失物。'},
      {id:'mirror-woman',a:'mirror',b:'woman',method:'identity',label:'倒影与证词的矛盾',result:()=> '镜中能看见女人，女人说自己的失物已经领回；缺少倒影的却是站在镜前的你。不能把她的认领和你眼前的异常混作一件事。'},
      {id:'mirror-ledger',a:'mirror',b:'ledger',method:'identity',label:'倒影对应的登记描述',result:()=> '登记簿描述的是“会阅读这行字，却无法出现在镜子里的人”。现场缺少的倒影与这份描述对应，而不是指向镜中的女人。'},
      {id:'woman-signature',a:'woman',b:'handwriting',method:'identity',label:'已经完成的认领',result:()=> '女人说她已领回自己的雨；备注也要求不要替她填表。两份记录相互印证：当前空白认领栏属于另一份登记。'}
    ],
    tuesday: [
      {id:'exit-rule',a:'sign',b:'memo',method:'rule',label:'进路与归路不是同一方向',result:()=> '门上的规则与便笺都强调回家方向。录音描述的是进入时的行走顺序，不能直接照抄成离开顺序。'},
      {id:'reverse-route',a:'tape',b:'memo',method:'reverse',label:'反向重建归途',result:c=>'便笺要求从来路末端返回。将录音反向排列后，归途是 '+[...c.route].reverse().join(' → ')+'。仍需亲自通过现场的三道门。'},
      {id:'door-rule',a:'labels',b:'lever',method:'rule',label:'每道门只经过一次',result:()=> '标签限定每道门只能经过一次；开门杆允许反复校验。可以重试路线，但重复同一道门不能代替完整归途。'}
    ],
    city: [
      {id:'city-register',a:'label',b:'files',method:'order',label:'遗忘发生在登记之前',result:()=> '保管标签与记录甲一致：市民先遗忘城市，城市随后才被登记。登记不是这段历史的起点。'},
      {id:'city-history',a:'files',b:'manual',method:'order',label:'接回城市的四段过去',result:()=> '卷宗说明登记之后才建局；手册说明建局之后才值班。连起来是：市民遗忘 → 登记城市 → 建成管理局 → 开始值班。'},
      {id:'city-owner',a:'coat',b:'letter',method:'identity',label:'外套与信件指向同一人',result:()=> '外套里的工作证与信件都把局长身份指向你。寻找这座城市的你，与留下归还决定的那个人，属于同一条身份线索。'}
    ]
  };
  const foundPair = (c,r) => c.found.includes(r.a) && c.found.includes(r.b);
  const HYPOTHESES = {
    sync:{label:'倒影跟随现场的人',prediction:'如果这是真的：人停住，倒影也应停住；人迈步，倒影应同时迈步。'},
    independent:{label:'倒影有自己的动作',prediction:'如果这是真的：人在地面上的动作与镜中动作，可能对不上。'}
  };
  const REASON_STEPS = [
    ['reason-ask','bench','追问镜中脚步','asked'],
    ['reason-mark','hall','在地面留下粉末线','marked'],
    ['reason-still','hall','让女人停住 · 同看地面与镜面','still'],
    ['reason-step','hall','让女人迈步 · 比较两边的时刻','step'],
    ['reason-return','bench','拿验证记录追问女人','answered']
  ];
  const REASON_EVIDENCE = {
    boundary:{room:'hall',name:'地面的粉末线',read:()=> '粉末线穿过女人的鞋尖前方。地面的线不会出现在镜子里；它只用于记录实体是否跨过边界。'},
    'still-note':{room:'hall',name:'静止时的对照记录',read:()=> '女人在粉末线后站定。地上的鞋没有移动，粉末没有被踩散；镜中那只鞋却先跨过了不存在的线。两边的动作并非总是同时发生。'},
    'step-note':{room:'hall',name:'迈步时的对照记录',read:()=> '女人按你的要求迈过粉末线。地面立即留下真实脚印；镜中的鞋迟了一拍，随后又独自多走了一步。一次观察可能看错，两次不同条件下的对照却留下同样的不同步。'},
    'woman-reply':{room:'bench',name:'验证后的追问',read:()=> '你把两次对照记录摆在长椅上。女人合上伞：“这次你没有只听我的话。地上的脚步属于我，镜里的脚步不归我管。它在那边等你靠近，我在这边等你认领。”她把伞移开，长椅上露出两组方向相反的水痕。'}
  };
  for(const [key,e] of Object.entries(REASON_EVIDENCE))C.DATA.station.evidence[key]={name:e.name,read:e.read,deep:'这是一份现场验证记录，不是额外的认领密码。'};
  const reasoning = c => C.field(c).reasoning;
  const allObserved = q => ['still','step'].every(k=>q.observations.includes(k));
  function reasonVisible(c,k){const q=reasoning(c);return k==='boundary'?q.marked:k==='still-note'?q.observations.includes('still'):k==='step-note'?q.observations.includes('step'):k==='woman-reply'?q.answered:false;}
  function visibleEvidence(s,room){const id=s.casebook.active,c=s.casebook.cases[id];return [...C.DATA[id].rooms[room].things,...(id==='station'?Object.entries(REASON_EVIDENCE).filter(([k,e])=>e.room===room&&reasonVisible(c,k)).map(([k])=>k):[])];}
  function hypothesisEntries(s){if(s.casebook.active!=='station')return [];const q=reasoning(s.casebook.cases.station);return Object.entries(HYPOTHESES).map(([id,h])=>({...h,id,adopted:q.guesses.includes(id),ready:allObserved(q),status:!q.guesses.includes(id)?'未提出':q.checked.includes(id)?id==='sync'?'已推翻':'已确认':'待验证'}));}
  function canHypothesize(s){const c=s.casebook.cases.station;return s.casebook.active==='station'&&['mirror','woman'].every(k=>c.found.includes(k));}
  function evidenceStatus(s,k){
    const c=s.casebook.cases[s.casebook.active],f=C.field(c);
    if(!c.found.includes(k)||!f.seen.includes(k))return '新发现';
    if(s.casebook.active==='station'&&['mirror','woman',...Object.keys(REASON_EVIDENCE)].includes(k)&&reasoning(c).guesses.length){
      if(reasoning(c).checked.includes('independent'))return '已有结论';
      return '待验证';
    }
    return deductionEntries(s).some(r=>r.a===k||r.b===k)?'已有结论':'已记录';
  }
  function readEvidence(s,k){const c=s.casebook.cases[s.casebook.active];let text=C.DATA[s.casebook.active].evidence[k].read(c);if(s.casebook.active==='station'&&k==='woman'&&reasoning(c).asked)text+=' 她听完追问，补了一句：“先别相信镜子。让我停住，再让我迈步，地面和镜子一起看。”';return text;}
  function actions(s){
    const out=C.actions(s);if(s.casebook.active!=='station')return out;
    const c=s.casebook.cases.station,q=reasoning(c),started=q.guesses.length||C.field(c).deductions.includes('mirror-woman');
    for(const [id,room,label,flag] of REASON_STEPS){
      if(room!==c.room||!canHypothesize(s)||!started)continue;
      if(id==='reason-mark'&&!q.asked||['reason-still','reason-step'].includes(id)&&!q.marked||id==='reason-return'&&!q.checked.includes('independent'))continue;
      const done=['still','step'].includes(flag)?q.observations.includes(flag):q[flag];
      out.push({id,label,done,group:'reasoning',reason:['reason-still','reason-step'].includes(id)&&!q.guesses.length?'先在“暂定猜测”中保留一种解释，再进行对照。':''});
    }
    return out;
  }
  function reasonAct(s,action){
    const c=s.casebook.cases.station,q=reasoning(c),entry=actions(s).find(a=>a.id===action);
    if(!entry||entry.done||entry.reason)return {ok:false,message:entry?.reason||'请先完成追问与准备，并回到对应的现场。'};
    let message;
    if(action==='reason-ask'){q.asked=true;message='你指出镜子与证词之间的疑点。女人没有解释，反而说：“让我停住，再让我迈步。地面和镜子一起看，别只听我的话。”大厅现在可以安排对照。';}
    if(action==='reason-mark'){q.marked=true;message='你用墙边粉末留下浅线，女人站在线后。地面是实体位置的记录，镜面是另一个观察窗口。两边现在可以在同一时刻比较。';}
    if(action==='reason-still'){q.observations.push('still');message=REASON_EVIDENCE['still-note'].read();}
    if(action==='reason-step'){q.observations.push('step');message=REASON_EVIDENCE['step-note'].read();}
    if(action==='reason-return'){q.answered=true;message=REASON_EVIDENCE['woman-reply'].read();}
    for(const k of Object.keys(REASON_EVIDENCE))if(reasonVisible(c,k)&&!c.found.includes(k))c.found.push(k);
    remember(s,{kind:'operation',key:'op:'+c.room+':'+action,action,room:c.room,ok:true,label:entry.label,message});
    return {ok:true,message};
  }
  function guess(s,id){
    if(!canHypothesize(s)||typeof id!=='string'||!Object.hasOwn(HYPOTHESES,id))return {ok:false,message:'先记录镜子与女人的证词，再提出猜测。'};
    const c=s.casebook.cases.station,q=reasoning(c);if(q.guesses.includes(id))return {ok:true,message:'这条猜测已保留，不会重复奖励。'};
    q.guesses.push(id);const message='暂定猜测：'+HYPOTHESES[id].label+'。'+HYPOTHESES[id].prediction+' 猜测不是结论，需要亲自验证。';
    remember(s,{kind:'reasoning',key:'guess:'+id,action:'guess:'+id,room:c.room,ok:true,label:HYPOTHESES[id].label+' · 暂定',message});return {ok:true,message};
  }
  function judge(s,p){
    if(!canHypothesize(s)||!p||typeof p.id!=='string'||!Object.hasOwn(HYPOTHESES,p.id)||!['confirm','refute'].includes(p.verdict))return {ok:false,message:'请选择已保留的猜测，并决定确认或推翻。'};
    const c=s.casebook.cases.station,q=reasoning(c);
    if(!q.guesses.includes(p.id)||!allObserved(q))return {ok:false,message:'先完成静止与迈步两种条件的现场对照，再判断猜测。'};
    if(q.checked.includes(p.id))return {ok:true,message:'这条猜测已有结论，记录仍可回看。'};
    const ok=p.verdict===(p.id==='independent'?'confirm':'refute'),message=ok?(p.id==='independent'?'已确认：倒影有自己的动作。静止与迈步两次对照都表明，地面与镜面不同步。可以带着记录回长椅追问女人。':'已推翻：倒影并不总是跟随现场的人。保留原猜测及两次观察，下一种解释仍由你决定。'):'这个判断还不能解释两次观察：人停住时镜中仍动，人迈步时镜中又迟了一拍。请比较记录后重新判断。';
    if(ok)q.checked.push(p.id);
    remember(s,{kind:'reasoning',key:'judge:'+p.id,action:'judge:'+p.id,room:c.room,ok,label:HYPOTHESES[p.id].label+' · '+(ok?p.id==='independent'?'已确认':'已推翻':'待核对'),message});return {ok,message};
  }
  function describe(s){let text=C.describe(s);if(s.casebook.active==='station'){const c=s.casebook.cases.station,q=reasoning(c);if(c.room==='hall'&&q.marked)text+=' 地面留着一条浅粉末线。'+(q.observations.length?'鞋印与镜中鞋尖已经不在同一位置。':'女人站在线后，等你安排对照。');if(c.room==='bench'&&q.answered)text+=' 女人合上了伞，长椅上露出两组方向相反的水痕。她不再催你填表。';}return text;}
  const ready = (c,r) => foundPair(c,r) && (r.needs || []).every(k=>C.field(c).flags.includes(k));
  function deductionEntries(s) {
    const id=s.casebook.active,c=s.casebook.cases[id],ids=C.field(c).deductions || [];
    return RELATIONS[id].filter(r=>ids.includes(r.id)&&ready(c,r)).map(r=>({...r,message:r.result(c)}));
  }
  function history(s,room) {
    const c=s.casebook.cases[s.casebook.active];
    return (C.field(c).records || []).filter(r=>!room||r.room===room).slice().reverse();
  }
  function remember(s,entry) {
    const f=C.field(s.casebook.cases[s.casebook.active]); f.records ||= [];
    const key=entry.key;
    f.records=f.records.filter(r=>r.key!==key);
    f.records.push({...entry,time:Math.max(0,Math.min(1e10,s.time))});
    f.records=f.records.slice(-80);
  }
  function actionRecord(s,action,room) { return history(s,room).find(r=>r.action===action&&r.kind==='operation') || null; }
  function deduce(s,p) {
    const id=s.casebook.active,c=s.casebook.cases[id],f=C.field(c);
    if(!p||typeof p!=='object'||p.a===p.b||!c.found.includes(p.a)||!c.found.includes(p.b)||!Object.hasOwn(METHODS,p.method))return {ok:false,message:'先选择两件不同的已记录证物，再选择比较方式。'};
    const r=RELATIONS[id].find(r=>(r.a===p.a&&r.b===p.b||r.a===p.b&&r.b===p.a)&&r.method===p.method);
    const message=r&&!ready(c,r)?'两份记录仍有无法读出的部分。先在现场让残缺信息显现，再验证这条连线。':r?r.result(c):'目前的证物不能用这种方式确认对应关系。可以换一种比较方式，或继续补充现场线索。';
    const ok=!!r&&ready(c,r);
    if(ok){f.deductions ||= [];if(!f.deductions.includes(r.id))f.deductions.push(r.id);}
    const pair=[p.a,p.b].sort().join('|'),key='link:'+pair+':'+p.method;
    remember(s,{kind:'deduction',key,action:p.method,room:c.room,a:p.a,b:p.b,ok,label:ok?r.label:METHODS[p.method]+' · 未确认',message});
    return {ok,message,relation:ok?r.id:null};
  }
  function allowedAction(id,room,action) {
    if(id==='station'&&REASON_STEPS.some(a=>a[0]===action&&a[1]===room))return true;
    const base=C.CONFIG[id].steps.some(a=>a[0]===action&&a[1]===room);
    if(base)return true;
    if(['sense','read','compare','legacy-pocket'].includes(action))return true;
    if(action==='annex')return room==='annex';
    if(action.startsWith('sequence:'))return id==='tuesday'&&room==='tunnel'&&['昨天','今天','明天'].includes(action.slice(9))||id==='city'&&room==='hall'&&['钟楼','河岸','车站'].includes(action.slice(9));
    return id==='station'&&(C.EXTRA.some(a=>a[0]===action&&a[1]===room)||C.TRUTH.some(a=>a[0]===action&&a[1]===room)||room==='hall'&&C.EXPERIMENTS.some(a=>a[0]===action)||action==='niche-open'&&room==='hall'||action==='niche-reward'&&room==='niche');
  }
  function hydrate(s,raw) {
    C.hydrate(s,raw);
    for(const id of C.ORDER){
      const c=s.casebook.cases[id],f=C.field(c),x=raw?.cases?.[id]?.field;
      const savedLinks=Array.isArray(x?.deductions)?x.deductions:f.deductions||[];
      f.deductions=RELATIONS[id].filter(r=>savedLinks.includes(r.id)&&ready(c,r)).map(r=>r.id);
      f.seen=[...new Set((Array.isArray(x?.seen)?x.seen:Array.isArray(f.seen)?f.seen:c.found).filter(k=>c.found.includes(k)))];
      if(id==='station'){
        const v=x?.reasoning??f.reasoning??{},pair=['mirror','woman'].every(k=>c.found.includes(k));
        const guesses=pair&&Array.isArray(v.guesses)?[...new Set(v.guesses.filter(k=>typeof k==='string'&&Object.hasOwn(HYPOTHESES,k)))]:[];
        const asked=pair&&v.asked===true&&(guesses.length>0||f.deductions.includes('mirror-woman')),marked=asked&&v.marked===true;
        const observations=marked&&Array.isArray(v.observations)?[...new Set(v.observations.filter(k=>['still','step'].includes(k)))]:[];
        const checked=observations.length===2&&Array.isArray(v.checked)?[...new Set(v.checked.filter(k=>guesses.includes(k)))]:[];
        f.reasoning={guesses,asked,marked,observations,checked,answered:checked.includes('independent')&&v.answered===true};
        c.found=c.found.filter(k=>!Object.hasOwn(REASON_EVIDENCE,k)||reasonVisible(c,k));f.seen=f.seen.filter(k=>c.found.includes(k));
      }
      const records=Array.isArray(x?.records)?x.records:f.records||[];
      f.records=[];
      for(const r of records.slice(-80)){
        if(!r||typeof r!=='object'||!Object.hasOwn(C.DATA[id].rooms,r.room)||typeof r.message!=='string'||typeof r.label!=='string')continue;
        if(r.kind==='operation'&&typeof r.action==='string'&&allowedAction(id,r.room,r.action)){
          const key='op:'+r.room+':'+r.action;
          f.records=f.records.filter(v=>v.key!==key);
          f.records.push({kind:r.kind,key,action:r.action,room:r.room,ok:r.ok===true,label:r.label.slice(0,80),message:r.message.slice(0,1200),time:Number.isFinite(r.time)?Math.max(0,Math.min(1e10,r.time)):0});
        } else if(r.kind==='reasoning'&&id==='station'&&['guess:sync','guess:independent','judge:sync','judge:independent'].includes(r.action)&&f.reasoning.guesses.includes(r.action.split(':')[1])){
          const key=r.action;f.records=f.records.filter(v=>v.key!==key);f.records.push({kind:r.kind,key,action:r.action,room:r.room,ok:r.ok===true,label:r.label.slice(0,80),message:r.message.slice(0,1200),time:Number.isFinite(r.time)?Math.max(0,Math.min(1e10,r.time)):0});
        } else if(r.kind==='deduction'&&c.found.includes(r.a)&&c.found.includes(r.b)&&r.a!==r.b&&Object.hasOwn(METHODS,r.action)){
          const relation=RELATIONS[id].find(v=>(v.a===r.a&&v.b===r.b||v.a===r.b&&v.b===r.a)&&v.method===r.action);
          const ok=!!relation&&f.deductions.includes(relation.id),key='link:'+[r.a,r.b].sort().join('|')+':'+r.action;
          f.records=f.records.filter(v=>v.key!==key);
          f.records.push({kind:r.kind,key,action:r.action,room:r.room,a:r.a,b:r.b,ok,label:ok?relation.label:METHODS[r.action]+' · 未确认',message:ok?relation.result(c):'这条连线尚未确认，可以重新选择比较方式。',time:Number.isFinite(r.time)?Math.max(0,Math.min(1e10,r.time)):0});
        }
      }
    }
    return s;
  }
  function act(s,type,p) {
    if(type==='deduce')return deduce(s,p);
    if(type==='hypothesis')return guess(s,p);
    if(type==='judge-hypothesis')return judge(s,p);
    const active=s.casebook.cases[s.casebook.active];
    if(type==='read-evidence'){if(!active.found.includes(p))return {ok:false};const f=C.field(active);if(!f.seen.includes(p))f.seen.push(p);return {ok:true};}
    if(type==='inspect'&&s.casebook.active==='station'&&typeof p==='string'&&Object.hasOwn(REASON_EVIDENCE,p)){
      if(!active.found.includes(p)||!reasonVisible(active,p)||REASON_EVIDENCE[p].room!==active.room)return {ok:false,message:'请先在对应现场完成验证。'};
      return act(s,'read-evidence',p);
    }
    if(type==='interact'&&typeof p==='string'&&p.startsWith('reason-'))return s.casebook.active==='station'?reasonAct(s,p):{ok:false,message:'这项附查只属于第一案。'};
    const id=s.casebook.active,c=s.casebook.cases[id],room=c.room,a=type==='interact'?C.actions(s).find(a=>a.id===p&&!a.done):null;
    const result=C.act(s,type,p);
    if(type==='inspect'&&result.ok&&!C.field(c).seen.includes(p))C.field(c).seen.push(p);
    if(a&&result.message&&allowedAction(id,room,p))remember(s,{kind:'operation',key:'op:'+room+':'+p,action:p,room,ok:result.ok,label:a.label.split(' · ')[0],message:result.message});
    return result;
  }
  function goal(s) {
    const id=s.casebook.active,c=s.casebook.cases[id],f=C.field(c),has=k=>f.flags.includes(k);
    if(c.solved)return id==='city'?'这座城市已接回现实。接下来由你决定保留什么。':'本案已结案。可以继续下一案，或回访未查清的支路。';
    if(!c.found.length&&id==='station')return '观察大厅留下的异常，弄清这里正在等待谁。';
    if(id==='station')return !has('opened')?'找到进入登记室的方法。':!has('ticket-lit')||!has('erasure')?'让残缺的取件信息重新显现。':!has('stamped')?'接通认领流程。':'核对取件信息，确认谁被登记为失物。';
    if(id==='tuesday')return !has('powered')?'让停摆的设备重新运转。':!has('rewound')?'找到改变走廊方向的方法。':!has('doors')?'亲自找回离开这一天的路线。':'核对归途，并决定如何结束这份等待。';
    return !has('projected')?'让城市模型显出完整的街区。':!has('aligned')?'校准模型与现场的对应关系。':!has('authorized')?'找回原始档案的查阅权限。':'整理城市的过去，确认应当由谁认领。';
  }
  function optionalGoal(s){
    if(s.casebook.active!=='station')return '';
    const q=reasoning(s.casebook.cases.station);if(!q.guesses.length||q.answered)return '';
    return !q.asked?'到候车长椅追问镜中脚步。':!q.marked?'在大厅准备地面与镜面的对照。':!allObserved(q)?'分别观察静止与迈步两种条件。':!q.checked.includes('independent')?'回到“暂定猜测”，用两次记录判断解释。':'带着验证记录回长椅追问。';
  }
  return {...C,hydrate,act,actions,describe,METHODS,RELATIONS,HYPOTHESES,REASON_STEPS,REASON_EVIDENCE,hypothesisEntries,canHypothesize,evidenceStatus,visibleEvidence,readEvidence,deductionEntries,history,actionRecord,goal,optionalGoal};
});
