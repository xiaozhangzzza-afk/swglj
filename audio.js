(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BureauAudio=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Original procedural foley and ambience, no remote audio or copyrighted song.
  const PROFILES={
    wood:{duration:.48,filter:'bandpass',frequency:650,q:.8,slide:.24,click:155},
    metal:{duration:.36,filter:'highpass',frequency:800,q:.7,slide:.09,click:1150},
    plastic:{duration:.22,filter:'bandpass',frequency:2100,q:1.2,slide:.07,click:1750},
    glass:{duration:.38,filter:'bandpass',frequency:1400,q:2,slide:.06,click:2700},
    cloth:{duration:.42,filter:'lowpass',frequency:1800,q:.7,slide:.28,click:0},
    paper:{duration:.34,filter:'highpass',frequency:1000,q:.7,slide:.18,click:460},
    switch:{duration:.10,filter:'highpass',frequency:1800,q:.7,slide:.015,click:1400}
  };
  function preferences(raw){
    return {music:raw?.music!==false,effects:raw?.effects!==false,
      volume:typeof raw?.volume==='number'&&Number.isFinite(raw.volume)?Math.max(0,Math.min(1,raw.volume)):.35};
  }
  function create(env={}){
    let prefs=preferences(),context=null,musicGain=null,effectGain=null,startedAt=0,error='',unlocked=false,starting=null;
    const storage=env.storage,key=env.key||'lost-property-audio',Ctor=env.AudioContext;
    try{prefs=preferences(JSON.parse(storage?.getItem(key)||'null'));}catch{}
    function notify(){env.onChange?.(status());}
    function status(){return {...prefs,ready:unlocked&&context?.state==='running',supported:!!Ctor,error,
      playing:unlocked&&context?.state==='running'&&prefs.music&&prefs.volume>0,
      position:context?Math.max(0,context.currentTime-startedAt):0};}
    function gain(node,value,time=.08){if(!node)return;node.gain.cancelScheduledValues(context.currentTime);node.gain.setTargetAtTime(value,context.currentTime,time);}
    function levels(){gain(musicGain,prefs.music?prefs.volume*.30:0,.3);gain(effectGain,prefs.effects?prefs.volume*.65:0);}
    function buffer(seconds){return context.createBuffer(1,Math.ceil(context.sampleRate*seconds),context.sampleRate);}
    function noise(seconds){const b=buffer(seconds),data=b.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;return b;}
    function music(){
      // One graph per document. Page rendering never creates/stops these sources.
      const pad=context.createBiquadFilter();pad.type='lowpass';pad.frequency.value=480;pad.Q.value=.5;pad.connect(musicGain);
      [73.416,110,146.832,174.614].forEach((frequency,i)=>{
        const tone=context.createOscillator(),level=context.createGain(),breath=context.createOscillator(),depth=context.createGain();
        tone.type=i===0?'triangle':'sine';tone.frequency.value=frequency;level.gain.value=.08;
        breath.frequency.value=1/[16,23,31,37][i];depth.gain.value=.035;
        tone.connect(level);level.connect(pad);breath.connect(depth);depth.connect(level.gain);tone.start();breath.start();
      });
      const bell=buffer(32),data=bell.getChannelData(0),rate=context.sampleRate;
      [[2,220],[11,293.665],[20,311.127],[27,196]].forEach(([at,f])=>{
        for(let i=0;i<Math.min(5*rate,data.length-at*rate);i++){
          const t=i/rate,envelope=Math.min(1,t/.04)*Math.exp(-t*1.2);
          data[Math.floor(at*rate)+i]+=.075*envelope*(Math.sin(2*Math.PI*f*t)+.25*Math.sin(2*Math.PI*f*2.01*t));
        }
      });
      const source=context.createBufferSource(),delay=context.createDelay(2),feedback=context.createGain();
      source.buffer=bell;source.loop=true;delay.delayTime.value=.72;feedback.gain.value=.23;
      source.connect(musicGain);source.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(musicGain);source.start();
    }
    async function unlock(){
      if(!Ctor){error='当前浏览器不支持音频，游戏仍可正常游玩。';notify();return false;}
      if(starting)return starting;
      starting=(async()=>{
        try{
          if(!context){context=new Ctor();musicGain=context.createGain();effectGain=context.createGain();musicGain.gain.value=0;effectGain.gain.value=0;
            const limiter=context.createDynamicsCompressor();limiter.threshold.value=-18;limiter.ratio.value=4;
            musicGain.connect(limiter);effectGain.connect(limiter);limiter.connect(context.destination);startedAt=context.currentTime;music();}
          if(context.state!=='running')await context.resume();
          unlocked=context.state==='running';error=unlocked?'':'声音尚未启用，请点击“启用声音”重试。';levels();notify();return unlocked;
        }catch{error='浏览器未能启用声音；可重试，或静音继续游玩。';notify();return false;}
      })();
      try{return await starting;}finally{starting=null;}
    }
    function configure(patch){
      prefs=preferences({...prefs,...patch});try{storage?.setItem(key,JSON.stringify(prefs));}catch{}
      levels();notify();return status();
    }
    async function play(kind,open){
      if(!Object.hasOwn(PROFILES,kind)||!prefs.effects||prefs.volume===0)return false;
      if(!await unlock())return false;
      const p=PROFILES[kind],time=context.currentTime,duration=p.duration*(open?1:.82),source=context.createBufferSource(),filter=context.createBiquadFilter(),level=context.createGain();
      source.buffer=noise(duration);filter.type=p.filter;filter.frequency.value=p.frequency;filter.Q.value=p.q;
      level.gain.setValueAtTime(0,time);level.gain.linearRampToValueAtTime(p.slide,time+.015);level.gain.exponentialRampToValueAtTime(.001,time+duration);
      source.connect(filter);filter.connect(level);level.connect(effectGain);
      source.onended=()=>{source.disconnect();filter.disconnect();level.disconnect();};source.start(time);source.stop(time+duration);
      if(p.click){
        const click=context.createOscillator(),hit=context.createGain(),at=time+(open ? .012 : Math.max(.01,duration-.065));
        click.type=kind==='metal'||kind==='plastic'?'triangle':'sine';click.frequency.setValueAtTime(p.click*(open?1:.78),at);click.frequency.exponentialRampToValueAtTime(Math.max(80,p.click*.35),at+.065);
        hit.gain.setValueAtTime(.16,at);hit.gain.exponentialRampToValueAtTime(.001,at+.085);
        click.connect(hit);hit.connect(effectGain);click.onended=()=>{click.disconnect();hit.disconnect();};click.start(at);click.stop(at+.09);
      }
      return true;
    }
    return {status,configure,unlock,play};
  }
  return {PROFILES,preferences,create};
});
