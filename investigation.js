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
      const records=Array.isArray(x?.records)?x.records:f.records||[];
      f.records=[];
      for(const r of records.slice(-80)){
        if(!r||typeof r!=='object'||!Object.hasOwn(C.DATA[id].rooms,r.room)||typeof r.message!=='string'||typeof r.label!=='string')continue;
        if(r.kind==='operation'&&typeof r.action==='string'&&allowedAction(id,r.room,r.action)){
          const key='op:'+r.room+':'+r.action;
          f.records=f.records.filter(v=>v.key!==key);
          f.records.push({kind:r.kind,key,action:r.action,room:r.room,ok:r.ok===true,label:r.label.slice(0,80),message:r.message.slice(0,1200),time:Number.isFinite(r.time)?Math.max(0,Math.min(1e10,r.time)):0});
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
    const id=s.casebook.active,c=s.casebook.cases[id],room=c.room,a=type==='interact'?C.actions(s).find(a=>a.id===p&&!a.done):null;
    const result=C.act(s,type,p);
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
  return {...C,hydrate,act,METHODS,RELATIONS,deductionEntries,history,actionRecord,goal};
});
