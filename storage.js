(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BureauStorage=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const LEASE_MS=12000;
  function mutationGate({check,commit,denied,failed}){
    let active=false,pending=false;
    function run(operation){
      if(active)return operation();
      if(!check()){denied();return;}
      active=true;pending=false;
      try{return operation();}finally{
        active=false;
        if(pending&&!commit())failed();
        pending=false;
      }
    }
    return {run,active:()=>active,requestSave:()=>{if(!active)return false;pending=true;return true;}};
  }
  function tabSession({storage,key,navigationType,random}){
    let session;
    try{if(navigationType==='reload')session=storage.getItem(key);}catch{}
    if(typeof session!=='string'||!session||session.length>100)session=random();
    try{storage.setItem(key,session);}catch{}
    return session;
  }
  function activeLease(raw,now){
    try{
      const lock=JSON.parse(raw||'null');
      return lock&&typeof lock.session==='string'&&lock.session.length<=100&&Number.isFinite(lock.time)&&lock.time>=0&&lock.time<=now+1000&&now-lock.time<LEASE_MS?lock:null;
    }catch{return null;}
  }
  function create({storage,key,session,decode,now=Date.now}){
    const backup=key+'-backup',lease=key+'-lease';
    let observed, observedSet=false;
    const content=raw=>{try{const value=JSON.parse(raw);delete value.lastSaved;return JSON.stringify(value);}catch{return raw;}};
    function changed(){return observedSet&&storage.getItem(key)!==observed;}
    function claim(force=false){
      try{
        // A suspended page must reload the latest save even after the lease expires.
        if(!force&&changed())return {ok:false,foreign:true,stale:true};
        const time=now(),lock=activeLease(storage.getItem(lease),time);
        if(!force&&lock&&lock.session!==session)return {ok:false,foreign:true};
        // Still check main text and foreign lease on every entry, but renew our
        // own 12-second lease only when needed, not on every harmless UI click.
        if(force||!lock||lock.session!==session||time-lock.time>=4000)storage.setItem(lease,JSON.stringify({session,time}));return {ok:true};
      }catch{return {ok:true,unavailable:true};}
    }
    function write(state){
      const ownership=claim();if(!ownership.ok)return ownership;
      if(ownership.unavailable)return {ok:false,unavailable:true};
      try{
        const old=storage.getItem(key);
        if(old&&content(old)!==content(JSON.stringify(state))){
          let valid=false;try{decode(old);valid=true;}catch{/* Keep the last valid backup for a corrupt main save. */}
          if(valid){try{storage.setItem(backup,old);}catch{
            // Do not replace recoverable progress when its backup cannot be written.
            return {ok:false,unavailable:true,backupUnavailable:true};
          }}
        }
        const time=now(),raw=JSON.stringify({...state,lastSaved:time});
        storage.setItem(key,raw);state.lastSaved=time;observed=raw;observedSet=true;return {ok:true};
      }catch{return {ok:false,unavailable:true};}
    }
    function read(){
      const unreadable=[];
      try{
        observed=storage.getItem(key);observedSet=true;
        for(const [source,target] of [['main',key],['backup',backup]]){
          const raw=storage.getItem(target);if(!raw)continue;
          try{return {state:decode(raw),source,unreadable};}
          catch{
            unreadable.push({source,raw});
            // Never replace an earlier recovery copy with another broken save.
            try{if(!storage.getItem(key+'-unreadable-'+source))storage.setItem(key+'-unreadable-'+source,raw);}catch{}
          }
        }
        return {state:null,source:'fresh',unreadable};
      }catch{return {state:null,source:'fresh',unreadable,unavailable:true};}
    }
    function recoveryCopies(){
      try{return ['main','backup'].map(source=>({source,raw:storage.getItem(key+'-unreadable-'+source)})).filter(v=>v.raw);}catch{return [];}
    }
    function release(){try{const lock=JSON.parse(storage.getItem(lease)||'null');if(lock?.session===session)storage.removeItem(lease);}catch{}}
    return {claim,write,read,recoveryCopies,release};
  }
  return {create,activeLease,tabSession,LEASE_MS,mutationGate};
});
