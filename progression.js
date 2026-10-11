(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Progression = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FEATURES = ['notebook', 'map', 'career', 'inventory', 'legacy'];
  const NAMES = { notebook: '证物笔记', map: '现场地图', career: '调查员资历', inventory: '随身道具', legacy: '档案室' };
  function refresh(s) {
    s.ui ||= {};
    // Preserve old investigation navigation, not retired management screens.
    if (s.ui.progressiveVersion !== 1) { s.ui.progressiveVersion = 1; s.ui.revealed = [...FEATURES]; return []; }
    s.ui.revealed = [...new Set((s.ui.revealed || []).filter(k => FEATURES.includes(k)))];
    const cases = s.casebook.cases, first = cases.station, fields = Object.values(cases).map(c => c.field || { items: [], flags: [], visited: [] });
    const count = Object.values(cases).reduce((n, c) => n + c.found.length, 0);
    const established = s.era > 1;
    const ready = {
      notebook: count >= 1, map: count >= 2 || fields.some(f => f.visited.length > 1),
      career: s.career.xp >= 24, inventory: fields.some(f => f.items.length > 0),
      legacy: first.solved || established
    };
    const added = FEATURES.filter(k => ready[k] && !s.ui.revealed.includes(k));
    s.ui.revealed.push(...added); return added;
  }
  function has(s, key) { return key === 'case' || FEATURES.includes(key) && s.ui.revealed.includes(key); }
  return { FEATURES, NAMES, refresh, has };
});
