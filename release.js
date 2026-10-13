(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BureauRelease=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='1.0.2';
  function chapter(s,id){
    const c=s.casebook.cases[id];if(!c?.solved)return null;
    if(id==='station')return {title:'你领回了自己',text:'镜子第一次映出了你的脸。女人收起伞，把一封写着“星期二”的信留在椅上。下一份案卷已经出现；大厅里尚未查清的异常仍可回访。'};
    if(id==='tuesday')return c.resolution==='seal'?{title:'等待被封存',text:'钟恢复了走动，信却没有寄出去。你把未完成的约定留在保管室。市政档案馆收到了一份封存通知：有些过去将由管理局承担。'}:{title:'等待被归还',text:'钟走过星期二，那封信终于离开了走廊。门口的人没有再说“明天见”。市政档案馆收到了一封回信：过去可以结束，而不必被抹去。'};
    if(id==='city'){
      const sealed=c.resolution==='seal',previous=s.casebook.cases.tuesday.resolution==='seal';
      return {title:sealed?'结局 · 保管最后的城市':'结局 · 把城市还给黎明',text:(sealed?'你在归还栏上盖下封存印。城市安静地留在模型里，街灯逐一熄灭。管理局成为它最后的地址，你选择留下来保管那些无人认领的名字。':'你签下自己的名字，推开档案馆的门。模型中的街灯在真实街道上亮起。城市并未忘记旧日的错误，但这一次，它拥有重新生活的权利。')+(previous?' 那封未寄出的信仍在保管室。你知道，完成城市的认领并不等于所有等待都已结束。':' 走廊寄出的回信停在你掌心。无论城市去了哪里，总有人记得那一天终于走到了明天。')};
    }
    return null;
  }
  return {VERSION,chapter};
});
