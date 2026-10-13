(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./investigator.js'));
  else root.Cases=factory(root.Cases);
})(typeof globalThis!=='undefined'?globalThis:this,function(C){
  'use strict';
  // Optional causal investigations. No new currency, timer, random roll or XP.
  const INQUIRIES={
    tuesday:{name:'回声附查',room:'workshop',needs:['echo','tape'],flag:'powered',
      hypotheses:{
        playback:{label:'回声只是磁带播放',prediction:'停止播放后，扬声器和走廊里的声音都应消失。',verdict:'refute'},
        waiting:{label:'回声独立于磁带',prediction:'停止播放后，扬声器会静音，但走廊仍可能响应你的话。',verdict:'confirm'}
      },
      steps:[
        {id:'inquiry-control',key:'control',label:'保持播放 · 向走廊说“明天见”',name:'播放状态的观察',text:'你保持磁带播放，向走廊说“明天见”。扬声器播出这句话，走廊也重复这句话。两处都发出了声音。'},
        {id:'inquiry-change',key:'change',label:'暂停磁带 · 重复同一句问候',name:'暂停后的观察',text:'你保持电池连接和说话位置不变，只暂停播放，再以相同音量说“明天见”。转轴停住，扬声器没有声音；走廊仍重复了这句问候。磁带内容、电源和问候均未改变，只有播放状态不同。'},
        {id:'inquiry-reply',key:'reply',label:'恢复播放 · 留下回声核验批注',name:'回声核验批注',text:'你恢复磁带播放，不改变归途机关。值班记录多了一句：“录音保存来路，回声保存等待。不要把它们当成同一个来源。”原猜测与两次观察一同归档。'}
      ]},
    city:{name:'光影附查',room:'workshop',needs:['model','detail0'],flag:'projected',
      hypotheses:{
        reflection:{label:'模型中的人影只是投影',prediction:'遮挡投影光路后，人影应随光斑一起消失。',verdict:'refute'},
        resident:{label:'人影并不依赖投影',prediction:'遮挡后，光斑消失，人影却可能仍留下动作或回应。',verdict:'confirm'}
      },
      steps:[
        {id:'inquiry-control',key:'control',label:'保持照明 · 轻敲模型外墙',name:'明亮光路的观察',text:'你保持照明，从校准台旁观察模型，并轻敲一下外墙。投影光斑与模型窗口重叠，窗内人影举起手，里面回了两下。'},
        {id:'inquiry-change',key:'change',label:'遮挡光路 · 重复相同敲击',name:'遮光后的观察',text:'你只用不透明挡板遮住光路，不移动镜片、模型、街区机关或观察位置，然后像上次一样轻敲一下外墙。墙面光斑消失，人影仍举起手，模型里仍回了两下。两次观察的敲击相同，照明条件不同。'},
        {id:'inquiry-reply',key:'reply',label:'移开挡板 · 留下模型核验批注',name:'模型核验批注',text:'你移开挡板，镜片和街区次序都没有改变。授权台留下一条批注：“光只用于校准，不赋予居民身份。归还或封存的对象不只是一件空模型。”这条结论不替你决定城市的去向。'}
      ]}
  };
  const empty=()=>({guesses:[],observations:[],checked:[],replied:false,archiveChecked:[],lastJudgments:{}});
  const spec=s=>INQUIRIES[s.casebook.active];
  const inquiryState=s=>C.field(s.casebook.cases[s.casebook.active]).inquiry||empty();
  const ready=q=>q.observations.includes('control')&&q.observations.includes('change');
  const keyFor=key=>'inquiry-'+key;
  const confirmed=(d,keys)=>keys.some(k=>d.hypotheses[k].verdict==='confirm');
  const replyDone=q=>q.replied&&q.checked.every(k=>q.archiveChecked.includes(k));
  function judgmentReason(d,k){return d===INQUIRIES.tuesday?(k==='playback'?'预测要求两处声音都消失，但暂停后只有扬声器静音，走廊仍回应。':'暂停后扬声器静音而走廊仍回应，与“不依赖磁带”的预测一致；这不证明回声的身份或意图。'):(k==='reflection'?'预测要求人影与光斑一起消失，但遮光后光斑消失，人影仍回应。':'遮光后光斑消失，人影仍回应，与“不依赖投影”的预测一致；这不证明人影的身份或意图。');}
  function stepText(d,q,a){
    if(a.key!=='reply')return a.text;
    const keys=q.archiveChecked,labels=keys.filter(k=>d.hypotheses[k].verdict==='refute').map(k=>d.hypotheses[k].label);
    const prefix=d===INQUIRIES.tuesday?'已恢复磁带播放，归途机关不变。':'已移开挡板，镜片和街区次序不变。';
    return prefix+(confirmed(d,keys)?'核验批注：'+keys.map(k=>(d.hypotheses[k].verdict==='confirm'?'支持':'排除')+'“'+d.hypotheses[k].label+'”。'+judgmentReason(d,k)).join(' '):'阶段批注：已排除“'+labels.join('、')+'”，现象的原因仍待查，尚未确认替代解释。')+' 原猜测、预测、两次观察与判定保留；可继续提出解释并补充批注，不改变主线或结案处置。';
  }
  for(const [id,d] of Object.entries(INQUIRIES))for(const step of d.steps)C.DATA[id].evidence[keyFor(step.key)]={name:step.name,read:c=>stepText(d,C.field(c).inquiry||empty(),step),deep:'可选的因果验证记录，不提供主线密码、路线或排列答案。'};
  function restoreInquiry(s,id,raw){
    const c=s.casebook.cases[id],d=INQUIRIES[id],q=empty(),valid=d.needs.every(k=>c.found.includes(k))&&C.field(c).flags.includes(d.flag);
    if(valid&&raw&&typeof raw==='object'&&!Array.isArray(raw)){
      q.guesses=Array.isArray(raw.guesses)?Object.keys(d.hypotheses).filter(k=>raw.guesses.includes(k)):[];
      if(q.guesses.length&&Array.isArray(raw.observations)&&raw.observations.includes('control')){
        q.observations=['control'];if(raw.observations.includes('change'))q.observations.push('change');
      }
      q.checked=ready(q)&&Array.isArray(raw.checked)?q.guesses.filter(k=>raw.checked.includes(k)):[];
      q.replied=q.checked.length>0&&raw.replied===true;
      // Missing archiveChecked is a 1.0.1 completed archive, not lost progress.
      if(q.replied)q.archiveChecked=Array.isArray(raw.archiveChecked)?q.checked.filter(k=>raw.archiveChecked.includes(k)):[...q.checked];
      if(!q.archiveChecked.length)q.replied=false;
      if(ready(q))for(const k of q.guesses)if(['confirm','refute'].includes(raw.lastJudgments?.[k]))q.lastJudgments[k]=raw.lastJudgments[k];
      for(const k of q.checked)q.lastJudgments[k]=d.hypotheses[k].verdict;
    }
    C.field(c).inquiry=q;
    c.found=c.found.filter(k=>!k.startsWith('inquiry-')||(k===keyFor('reply')?q.replied:q.observations.includes(k.slice(8))));
    // Rebuild recorded observations from validated actions, without XP or rerolls.
    for(const k of q.observations.concat(q.replied?['reply']:[]))if(!c.found.includes(keyFor(k)))c.found.push(keyFor(k));
    C.field(c).seen=C.field(c).seen.filter(k=>c.found.includes(k));
  }
  function hydrate(s,raw){
    const retained=Object.fromEntries(Object.keys(INQUIRIES).map(id=>[id,raw?.cases?.[id]?.field?.inquiry??C.field(s.casebook?.cases?.[id]||{}).inquiry]));
    C.hydrate(s,raw);for(const id of Object.keys(INQUIRIES))restoreInquiry(s,id,retained[id]);return s;
  }
  function canHypothesize(s){const d=spec(s);return d?d.needs.every(k=>s.casebook.cases[s.casebook.active].found.includes(k))&&C.field(s.casebook.cases[s.casebook.active]).flags.includes(d.flag):C.canHypothesize(s);}
  function hypothesisEntries(s){
    const d=spec(s);if(!d)return C.hypothesisEntries(s);const q=inquiryState(s);
    return Object.entries(d.hypotheses).map(([id,h])=>({...h,id,adopted:q.guesses.includes(id),ready:ready(q),status:!q.guesses.includes(id)?'未提出':q.checked.includes(id)?h.verdict==='confirm'?'已确认':'已推翻':'待验证'}));
  }
  function inquiryInfo(s){
    const d=spec(s);if(!d){const q=C.field(s.casebook.cases.station).reasoning;return {name:'镜面附查',requirement:'先亲自完成静止与迈步两次对照。',records:['still','step'].filter(k=>q.observations.includes(k)).map(k=>({name:C.REASON_EVIDENCE[k+'-note'].name,text:C.REASON_EVIDENCE[k+'-note'].read()}))};}
    const q=inquiryState(s);return {name:d.name+(s.casebook.cases[s.casebook.active].solved?'（档案重演）':''),requirement:optionalGoal(s)||'对照原预测与两次观察；已有批注不会删除。',records:d.steps.filter(a=>q.observations.includes(a.key)||a.key==='reply'&&q.replied).map(a=>({name:a.name,text:stepText(d,q,a)}))};
  }
  function actions(s){
    const out=C.actions(s),d=spec(s);if(!d||!canHypothesize(s))return out;
    const c=s.casebook.cases[s.casebook.active],q=inquiryState(s);if(c.room!==d.room||!q.guesses.length)return out;
    for(const step of d.steps){
      if(step.key==='change'&&!q.observations.includes('control')||step.key==='reply'&&!q.checked.length)continue;
      const label=step.key==='reply'?(q.replied&&!replyDone(q)?'补充批注 · 归档新判定':!confirmed(d,q.checked)?(s.casebook.active==='tuesday'?'恢复播放':'移开挡板')+' · 记录阶段结论':step.label):step.label;
      out.push({id:step.id,label:label+(c.solved?'（档案重演）':''),group:'reasoning',done:step.key==='reply'?replyDone(q):q.observations.includes(step.key)});
    }return out;
  }
  function act(s,type,p){
    const d=spec(s),c=s.casebook.cases[s.casebook.active];
    if(!d)return C.act(s,type,p);
    if(['hypothesis','judge-hypothesis'].includes(type)){
      if(!canHypothesize(s))return {ok:false,message:'先记录现场证物并接通设备，附查不影响主线。'};
      const q=C.field(c).inquiry||=empty(),id=type==='hypothesis'?p:p?.id;
      if(typeof id!=='string'||!Object.hasOwn(d.hypotheses,id))return {ok:false,message:'请选择本案的一条猜测。'};
      if(type==='hypothesis'){if(!q.guesses.includes(id))q.guesses.push(id);return {ok:true,message:'暂定：'+d.hypotheses[id].label+'。'+d.hypotheses[id].prediction};}
      if(!q.guesses.includes(id)||!ready(q)||!['confirm','refute'].includes(p.verdict))return {ok:false,message:'先保留猜测，完成两种条件的对照，再判断。'};
      if(q.checked.includes(id))return {ok:true,message:'判定已经记录，原猜测和观察仍保留。'+optionalGoal(s)};
      q.lastJudgments[id]=p.verdict;const ok=p.verdict===d.hypotheses[id].verdict;if(ok)q.checked.push(id);
      return {ok,message:ok?(p.verdict==='confirm'?'已确认：':'已推翻：')+d.hypotheses[id].label+'。'+judgmentReason(d,id)+' '+(p.verdict==='refute'&&!confirmed(d,q.checked)?'已排除旧解释，原因仍待查。可先记录阶段结论，也可提出另一条解释。':'可恢复设备原条件并留下批注。'):'这个判断无法解释改变条件后的记录。请对照两次现象后重试，不会扣稳定或删除原猜测。'};
    }
    if(type==='interact'&&typeof p==='string'&&p.startsWith('inquiry-')){
      const a=actions(s).find(a=>a.id===p);if(!a||a.done)return {ok:false,message:'先提出猜测并回到验证现场，已完成观察可回看。'};
      const q=C.field(c).inquiry,step=d.steps.find(a=>a.id===p);
      if(step.key==='reply'){q.replied=true;q.archiveChecked=[...q.checked];}else q.observations.push(step.key);
      if(!c.found.includes(keyFor(step.key)))c.found.push(keyFor(step.key));
      return {ok:true,message:(c.solved?'这是结案时留存现场的档案重演，不改变已作处置。':'')+stepText(d,q,step)};
    }
    if(type==='inspect'&&typeof p==='string'&&p.startsWith('inquiry-')){
      if(c.room!==d.room||!c.found.includes(p))return {ok:false,message:'尚未完成对应的对照操作。'};
      return C.act(s,'read-evidence',p);
    }
    return C.act(s,type,p);
  }
  function visibleEvidence(s,room){const d=spec(s),c=s.casebook.cases[s.casebook.active];return [...C.visibleEvidence(s,room),...(d&&room===d.room?d.steps.filter(a=>c.found.includes(keyFor(a.key))).map(a=>keyFor(a.key)):[])];}
  function evidenceStatus(s,key){if(spec(s)&&key.startsWith('inquiry-'))return !s.casebook.cases[s.casebook.active].found.includes(key)?'新发现':inquiryState(s).checked.length?'已有结论':'待验证';return C.evidenceStatus(s,key);}
  function changes(s){const d=spec(s),c=s.casebook.cases[s.casebook.active];return d&&c.room===d.room?d.steps.filter(a=>c.found.includes(keyFor(a.key))).map(a=>({key:keyFor(a.key),name:a.name,source:d.name})):C.changes(s);}
  function actionRecord(s,key,room){const d=spec(s),a=d?.steps.find(a=>a.id===key),q=inquiryState(s);return a&&room===d.room&&(q.observations.includes(a.key)||a.key==='reply'&&q.replied)?{message:stepText(d,q,a)}:C.actionRecord(s,key,room);}
  function history(s){
    const d=spec(s);if(!d)return C.history(s);const q=inquiryState(s);
    const records=d.steps.filter(a=>q.observations.includes(a.key)||a.key==='reply'&&q.replied).map(a=>({ok:true,label:a.name,room:d.room,message:stepText(d,q,a)}));
    for(const id of q.guesses){records.push({ok:true,label:d.hypotheses[id].label+' · 原猜测',room:d.room,message:d.hypotheses[id].prediction});if(q.lastJudgments[id])records.push({ok:q.checked.includes(id),label:d.hypotheses[id].label+' · '+(q.checked.includes(id)?d.hypotheses[id].verdict==='confirm'?'已确认':'已推翻':'待核对'),room:d.room,message:'你的判断：'+(q.lastJudgments[id]==='confirm'?'确认':'推翻')+'。'+(q.checked.includes(id)?judgmentReason(d,id):'观察尚不能支持此判定，可重试。')});}
    return [...C.history(s),...records];
  }
  function optionalGoal(s){
    const d=spec(s);if(!d)return C.optionalGoal(s);const q=inquiryState(s);if(!q.guesses.length)return '';
    if(q.replied&&replyDone(q))return confirmed(d,q.archiveChecked)?q.guesses.some(k=>!q.checked.includes(k))?'批注已归档；还有猜测待验证，可继续比较观察。':'': '阶段结论已归档：旧解释已排除，原因待查。可在“暂定猜测”提出另一条解释，继续核验并补充批注。';
    if(!ready(q))return s.casebook.cases[s.casebook.active].room!==d.room?'前往'+C.DATA[s.casebook.active].rooms[d.room].name+'进行条件对照。':'先记录原条件，再改变一个条件，观察响应。';
    if(!q.checked.length)return '在“暂定猜测”中对照原预测与两次观察，选择确认或推翻。';
    const location=s.casebook.cases[s.casebook.active].room!==d.room?'回到'+C.DATA[s.casebook.active].rooms[d.room].name+'，':'';
    return location+(q.replied?'已有新判定，可补充批注。':confirmed(d,q.checked)?'已有解释得到支持；恢复设备原条件，并留下核验批注。':'旧解释已排除，原因仍待查。可恢复原条件记录阶段结论，或提出另一条解释。');
  }
  function describe(s){
    const id=s.casebook.active,c=s.casebook.cases[id],d=spec(s),q=inquiryState(s);
    let text=C.describe(s);
    if(id==='station'&&c.solved&&c.room==='counter')text='认领表已经核对，你领回了自己。窗口保留签字和印章，不需要再次提交取件码；未查清的现场仍可回访。';
    if(d&&c.room===d.room&&!c.solved&&q.observations.includes('change')&&!q.replied)text=id==='tuesday'?'磁带播放暂停，电池仍连接着。走廊仍回应同一句问候。归途机关和已记录路线不变。':'不透明挡板遮住了校准光路，镜片和街区机关没有移动。模型里仍有回应。主线校准进度不变。';
    if(id==='tuesday'&&c.solved&&c.room==='counter')text=c.resolution==='seal'?'封存柜收起了未寄出的信。日历向前走，留下的等待仍由管理局保管。':'日历翻过星期二。回信已离开走廊，门口的人不再重复“明天见”。';
    if(id==='city'&&c.solved&&c.room==='counter')text=c.resolution==='seal'?'城市的封存印已经落下，模型中的街灯逐一熄灭。管理局成为那些名字的保管地址。主线已完成；结局与决定保存在档案中。':'城市的归还签字已经确认，模型中的街灯在真实街道上亮起。城市重新拥有生活的权利。主线已完成；结局与决定保存在档案中。';
    if(id==='city'&&c.room==='bench'&&s.casebook.cases.tuesday.solved)text+=s.casebook.cases.tuesday.resolution==='seal'?' 桌上有一张封存通知，未寄出的信仍由管理局保管。':' 桌上有一封来自走廊的回信：“那一天终于结束了。”';
    return text;
  }
  function resetInvestigation(s){const next=C.resetInvestigation(s);return next?hydrate(next):null;}
  return {...C,INQUIRIES,inquiryState,inquiryInfo,hydrate,act,actions,canHypothesize,hypothesisEntries,visibleEvidence,history,actionRecord,optionalGoal,describe,resetInvestigation,evidenceStatus,changes,CHANGE_EVIDENCE:{...C.CHANGE_EVIDENCE,'inquiry-control':{},'inquiry-change':{},'inquiry-reply':{}}};
});
