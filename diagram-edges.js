/* Rounded connector adapted from Mind Elixir's roundedVertical, transposed
 * for a left-to-right layout. Copyright (c) 2019 DjZhou, MIT.
 * Source: https://github.com/SSShooter/mind-elixir-core/blob/master/src/utils/generateBranch.ts
 * Full license: THIRD_PARTY_NOTICES.md
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BureauEdges=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function rounded(x1,y1,x2,y2,radius=12){
    if(![x1,y1,x2,y2,radius].every(Number.isFinite))return '';
    if(y1===y2)return `M ${x1} ${y1} H ${x2}`;
    const midX=(x1+x2)/2,dir=y2>y1?1:-1,dx=x2>=x1?1:-1;
    const r=Math.max(0,Math.min(radius,Math.abs(y2-y1)/2,Math.abs(midX-x1),Math.abs(x2-midX)));
    return `M ${x1} ${y1} H ${midX-dx*r} Q ${midX} ${y1} ${midX} ${y1+dir*r} V ${y2-dir*r} Q ${midX} ${y2} ${midX+dx*r} ${y2} H ${x2}`;
  }
  return {rounded};
});
