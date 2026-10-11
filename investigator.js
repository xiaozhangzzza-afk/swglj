(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('./investigation.js'));
  else root.Cases = root.Investigator = factory(root.Bureau, root.Cases);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (B, C) {
  'use strict';
  // Keep the legacy economy schema for importing old saves, but never run it.
  const TITLES = ['见习', '识痕', '记录', '辨识', '定心', '勘察', '留痕', '寻奇', '传承', '执卷', '阅密', '访幽', '复核', '复原', '守城'];
  const REWARDS = [
    '见习：进入异常现场，亲手操作道具与机关',
    '识痕：听取现场残响；错误推理的稳定损失由 2 降至 1',
    '记录：可给已记录证物加关注标记，集中到关注清单',
    '辨识：阅读深层证物；主动辨读痕迹；镜后夹层开放',
    '定心：每案可主动定心一次，恢复 8 点稳定',
    '勘察：主动比对已记录证物，整理它们的关系',
    '留痕：解锁手写调查札记，每案独立保存',
    '寻奇：开放第二案的侧室「第零分钟」',
    '传承：每轮可取出旧镜片工具，不代替机关操作',
    '执卷：主动轮回时保留关注标记（不保留旧谜底）',
    '阅密：结案后在认领窗口查阅人物的旧案批注',
    '访幽：开放第三案的侧室「无名市民档案」',
    '复核：开放现场清单，汇总各房间尚未记录的证物',
    '复原：每案定心次数由一次增加到两次',
    '守城：结案后在认领窗口阅读城市的余声'
  ];
  B.LEVEL_REWARDS.splice(0, B.LEVEL_REWARDS.length, ...REWARDS);
  const ANNOTATIONS = {
    station: '旧案批注：女人不是这件失物的主人。她的职责是交接。每当有人认领自己，她都会在下一份表上划掉一个称呼，像是在替某个人偿还遗漏的登记。',
    tuesday: '旧案批注：等待不是钟的一部分。那封信一直没有寄出，寄件人却每天检查回执。走廊留住的不是星期二，而是一个始终没有说出“已经结束”的人。',
    city: '旧案批注：建局提案上有两种笔迹，签名却只有你的名字。一种要求保管被遗忘的过去；另一种要求不要把过去重新交给任何人。两种笔迹来自同一只手。'
  };
  const CODA = {
    station: '城市的余声：镜里终于有了你的倒影。它没有跟你离开，只伸手把印章推回窗口。你听见一句迟到的问候：“下一位。”',
    tuesday: '城市的余声：所有钟都向前走了一分钟。停在门口的人没有回头。她把空信封留在椅上，信封里传出很轻的呼吸声，然后也安静下来。',
    city: '城市的余声：你没有立刻按下遗忘协议。窗外第一盏街灯熄灭，第二盏随后亮起。没有人确认那是黎明，但这一回，城市允许你等待自己的决定。'
  };
  function validMarks(id, list) {
    return Array.isArray(list) ? [...new Set(list.filter(k => typeof k === 'string' && Object.hasOwn(C.DATA[id].evidence, k)))].slice(0, 40) : [];
  }
  function restoreInvestigator(s, raw, zoom) {
    const data = raw && typeof raw === 'object' ? raw : {};
    s.investigator = { version: 1, bookmarks: {}, notes: {}, focusUses: {}, abilityRecords: {} };
    for (const id of C.ORDER) {
      s.investigator.bookmarks[id] = validMarks(id, data.bookmarks?.[id]);
      s.investigator.notes[id] = typeof data.notes?.[id] === 'string' ? data.notes[id].slice(0, 1200) : '';
      const uses = data.focusUses?.[id];
      s.investigator.focusUses[id] = Number.isInteger(uses) ? Math.max(0, Math.min(2, uses)) : 0;
      s.investigator.abilityRecords[id] = {};
      for(const key of ['focus1','focus2','annotation','coda']){
        const r=data.abilityRecords?.[id]?.[key],rank=B.level(s);
        if(!r||!Object.hasOwn(C.DATA[id].rooms,r.room))continue;
        if(key.startsWith('focus')){if(rank<5||Number(key.slice(-1))>s.investigator.focusUses[id]||key==='focus2'&&rank<14)continue;}
        else if(!s.casebook.cases[id].solved||r.room!=='counter'||rank<(key==='annotation'?11:15))continue;
        s.investigator.abilityRecords[id][key]={room:r.room,gain:key.startsWith('focus')?(typeof r.gain==='number'&&Number.isFinite(r.gain)&&r.gain>0?Math.min(8,r.gain):8):0};
      }
    }
    s.ui.mapZoom = typeof zoom === 'number' && Number.isFinite(zoom) ? Math.max(.3, Math.min(1.25, zoom)) : 1;
    return s;
  }
  function hydrate(s, saved) {
    const raw = s.investigator, zoom = s.ui?.mapZoom;
    C.hydrate(s, saved); return restoreInvestigator(s, raw, zoom);
  }
  function advanceInvestigation(s, seconds) {
    // No production, event rolls, idle XP, stability drift or expedition timers.
    if (!s.paused) s.time += Math.max(0, Math.min(60, Number(seconds) || 0));
    return s;
  }
  function bookmark(s, key) {
    const id = s.casebook.active, c = s.casebook.cases[id];
    if (B.level(s) < 3 || !c.found.includes(key)) return { ok: false, message: 'Lv.3 后可标记已记录的证物。' };
    const list = s.investigator.bookmarks[id], at = list.indexOf(key);
    if (at < 0) list.push(key); else list.splice(at, 1);
    return { ok: true, message: at < 0 ? '已加入关注清单。' : '已取消关注，原证物仍保留。' };
  }
  function note(s, text) {
    if (B.level(s) < 7 || typeof text !== 'string') return false;
    s.investigator.notes[s.casebook.active] = text.slice(0, 1200); return true;
  }
  function checklist(s) {
    const id = s.casebook.active, c = s.casebook.cases[id];
    return Object.entries(C.DATA[id].rooms).map(([key, room]) => ({ key, name: room.name,
      blocked: C.blocked(s, key), missing: C.visibleEvidence(s, key).filter(k => !c.found.includes(k)).map(k => C.DATA[id].evidence[k].name) }));
  }
  function actions(s) {
    const out = C.actions(s), id = s.casebook.active, c = s.casebook.cases[id], lv = B.level(s), limit = lv >= 14 ? 2 : 1;
    if (lv >= 5) out.push({ id: 'focus', label: '定心 · 恢复稳定（' + s.investigator.focusUses[id] + '/' + limit + '）', group: 'ability',
      done: s.investigator.focusUses[id] >= limit, reason: s.stability >= 100 ? '稳定已满，不会消耗次数' : '' });
    if (lv >= 11 && c.solved && c.room === 'counter') out.push({ id: 'annotation', label: '查阅旧案批注', group: 'ability', done: false });
    if (lv >= 15 && c.solved && c.room === 'counter') out.push({ id: 'coda', label: '听取城市的余声', group: 'ability', done: false });
    return out;
  }
  function act(s, type, value) {
    if (type !== 'interact' || !['focus', 'annotation', 'coda'].includes(value)) return C.act(s, type, value);
    const a = actions(s).find(a => a.id === value), id = s.casebook.active;
    if (!a || a.done || a.reason) return { ok: false, message: a?.reason || '此能力尚未开放，或本案次数已用完。' };
    let message;
    if (value === 'focus') { const gain=Math.min(8,100-s.stability);s.investigator.focusUses[id]++; s.stability += gain;s.investigator.abilityRecords[id]['focus'+s.investigator.focusUses[id]]={room:s.casebook.cases[id].room,gain:Math.round(gain*100)/100};message = '你把目光从异常上移开，确认自己的呼吸。稳定 +'+gain+'；本案剩余 ' + ((B.level(s) >= 14 ? 2 : 1) - s.investigator.focusUses[id]) + ' 次。'; }
    else {message = value === 'annotation' ? ANNOTATIONS[id] : CODA[id];s.investigator.abilityRecords[id][value]={room:'counter',gain:0};}
    B.log(s, message, 'story'); return { ok: true, message };
  }
  function resetInvestigation(s) {
    if (!s.casebook.cases.city.solved) return null;
    const legacy = { ...s.legacy, era: s.era, xp: s.career.xp, seen: [...s.seen] };
    const next = hydrate(B.fresh(s.rng, legacy));
    if (B.level(s) >= 10) for (const id of C.ORDER) next.investigator.bookmarks[id] = [...s.investigator.bookmarks[id]];
    next.ui.mapZoom = s.ui.mapZoom;
    return next;
  }
  function actionRecord(s, key, room) {
    const id=s.casebook.active;
    if(key==='focus'&&s.investigator.focusUses[id])return {message:'本案已经定心 '+s.investigator.focusUses[id]+' 次。每次恢复 8 点稳定；次数按案卷独立计算，轮回时重置。'};
    if(['annotation','coda'].includes(key)&&s.casebook.cases[id].solved&&room==='counter'&&B.level(s)>=(key==='annotation'?11:15))return {message:key==='annotation'?ANNOTATIONS[id]:CODA[id]};
    return C.actionRecord(s,key,room);
  }
  function history(s){
    const id=s.casebook.active,records=s.investigator.abilityRecords[id];
    return [...C.history(s),...Object.entries(records).map(([key,r])=>({ok:true,label:key.startsWith('focus')?'定心 · 第 '+key.slice(-1)+' 次':key==='annotation'?'旧案批注':'城市的余声',room:r.room,message:key.startsWith('focus')?'你确认了自己的呼吸。稳定 +'+r.gain+'；定心次数已记录。':key==='annotation'?ANNOTATIONS[id]:CODA[id]}))];
  }
  return { ...C, hydrate, actions, act, actionRecord, history, TITLES, REWARDS, ANNOTATIONS, CODA, restoreInvestigator, advanceInvestigation, resetInvestigation, bookmark, note, checklist };
});
