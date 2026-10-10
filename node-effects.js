(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.NodeEffects=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function kind(caseId,action,value){
    if(['mirror','glass','take-glass','mirror-route','mirror-ledger','truth-reflection','test-cover','test-watch'].includes(value))return 'mirror';
    if(['power','take-fuse','fuse','take-battery','battery','project','take-lens','lens'].includes(value))return 'electric';
    if(['ticket','receipt','take-receipt','ledger','handwriting','notice','lamp-ticket','truth-paper','files','manual','letter'].includes(value))return 'paper';
    if(value==='tunnel'||value==='take-key'||value==='test-dust')return 'ripple';
    if(caseId==='tuesday'&&(value.startsWith('sequence:')||['tape','rewind','echo','sign','memo'].includes(value)))return 'echo';
    if(caseId==='city'&&(['model','label','registry','authorize','projected'].includes(value)||value.startsWith('sequence:')))return 'city';
    if(action==='map-room')return value==='records'?'paper':caseId==='station'?'rain':caseId==='tuesday'?'echo':'city';
    return caseId==='station'?'rain':caseId==='tuesday'?'echo':'city';
  }
  function play(node,caseId,action,value){
    if(typeof document==='undefined'||!node||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    document.querySelectorAll('.node-click-fx').forEach(e=>e.remove());
    const r=node.getBoundingClientRect(),fx=document.createElement('div');
    fx.className='node-click-fx fx-'+kind(caseId,action,String(value||''));
    fx.setAttribute('aria-hidden','true');
    Object.assign(fx.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
    document.body.append(fx);setTimeout(()=>fx.remove(),650);
  }
  function enter(board){
    // Kept as a compatibility hook. Never translate or fade unrelated nodes.
    if(board)board.classList.remove('mind-entering');
  }
  return {kind,play,enter};
});
