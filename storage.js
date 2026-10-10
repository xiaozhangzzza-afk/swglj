(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BureauStorage=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const LEASE_MS=12000;
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
    function claim(force=false){
      try{
        const time=now(),lock=activeLease(storage.getItem(lease),time);
        if(!force&&lock&&lock.session!==session)return {ok:false,foreign:true};
        storage.setItem(lease,JSON.stringify({session,time}));return {ok:true};
      }catch{return {ok:true,unavailable:true};}
    }
    function write(state){
      const ownership=claim();if(!ownership.ok)return ownership;
      if(ownership.unavailable)return {ok:false,unavailable:true};
      try{
        const old=storage.getItem(key);
        if(old){try{decode(old);storage.setItem(backup,old);}catch{/* Keep the last valid backup. */}}
        state.lastSaved=now();storage.setItem(key,JSON.stringify(state));return {ok:true};
      }catch{return {ok:false,unavailable:true};}
    }
    function read(){
      const unreadable=[];
      try{
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
  return {create,activeLease,tabSession,LEASE_MS};
});
