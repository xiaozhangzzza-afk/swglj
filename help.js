(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BureauHelp = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const entries = [
    { id: 'next', question: '这张导图怎么操作？', keys: '开始 下一步 目标 卡住 指引 新手 节点 导图 单击 双击 阅读 动画', answer: '单击地点立即前往，单击物品或操作立即展开分支；双击节点显示文字。也可以用分支上方的“阅读文字”和“执行操作”按钮：阅读不会使用道具，执行才推进机关。首次阅读证物会记录并奖励经验。键盘可用 Enter 进入、Shift+Enter 阅读。道具、等级奖励和局内经营解锁后会出现在顶部；点击“返回现场”收起分支。不必经营或挂机才能结案。' },
    { id: 'blocked', question: '为什么操作不成功、房间进不去？', keys: '锁定 地图 道具 灰色 禁用 路线', answer: '导图只显示已开放的地点，单击后会沿合法通路前往。缺少条件的操作用虚线显示，双击可查缺少的道具或前置步骤。新功能会随调查出现，等级能力不是主线门槛。另一个页面正在值班时，在“存档”里接管本页。' },
    { id: 'xp', question: '经验怎么获取？', keys: '经验 升级 等级 资历 奖励 xp', answer: '首次记录证物 +8；完成道具或机关步骤 +12；三案结案分别 +65、+95、+135。寄存人核验各 +12，装订 +60；侧室收容 +40，壁龛奖励 +20；自主研究 +6。短程调查每处本轮首次 +12，再次 +4。重复阅读、走路、挂机、生产和现场验证不加经验。具体奖励见“查看升级奖励”。' },
    { id: 'experiment', question: '现场验证怎么玩？试错会怎样？', keys: '实验 验证 粉末 遮挡 镜子 失败', answer: '第一案打开通路后，大厅会出现可展开的“现场验证”。把粉末铺在地上，比较脚印与倒影，再尝试遮住镜面；这些操作会留下实验记录。追逐可疑脚步可能失败，但会给出新的观察信息，只扣一次少量稳定度。实验是可选调查，不影响结案，也不能反复刷经验。' },
    { id: 'puzzle', question: '推理卡住了，会不会无法通关？', keys: '答案 密码 提示 解谜 错误 重试', answer: '先确认现场道具与机关已实际操作，再比对笔记。认领窗口的提示分三级展开，最后一级会解释解法。错误可以重试，道具不会因此丢失；仅输入正确答案不能跳过现场步骤。这里不会自动展示谜底。' },
    { id: 'save', question: '存档在哪里？换电脑怎么继续？', keys: '保存 自动 本地 导出 导入 丢失 浏览器 备份 电脑 换机', answer: '进度保存在当前浏览器、当前网站地址下；每 10 秒及操作后自动保存。换电脑、浏览器或地址前，在“存档”里导出 JSON 文件，再到新页面导入。旧的网站与 GitHub 地址不会自动共享存档；隐私模式、清理网站数据可能导致丢失。建议定期导出备份。' },
    { id: 'staff', question: '员工与局内经营有什么用？', keys: '招聘 岗位 生产 资源 线索 墨 记忆 现实锚', answer: '经营提供补给与长期成长，不替你解谜。收件员生产失物，分拣员加工成线索，后续岗位制造墨、记忆和现实锚。先招人，再分配岗位；缺原料或满库时相应加工停止。主线会赠送核心技术，不需要先挂机攒资源才能结案。' },
    { id: 'luck', question: '运气不好会卡主线吗？', keys: '随机 保底 藏品 掉落 概率', answer: '案件参数每轮不同，但证物始终给出对应解法，不靠随机掉落才能完成。运气影响支路补给、藏品与短程调查的结果。同局刷新不会重抽；短程调查失败仍有碎片，稀有藏品有保底。' },
    { id: 'time', question: '暂停和离线会影响解谜吗？', keys: '倒计时 离开 挂机 时间 暂停', answer: '现场调查没有倒计时。暂停只冻结自动经营、来访与外出倒计时，仍可阅读、移动和解谜。离开后最多补算两小时经营，案件不会自动破解，待处理事件仍等你决定。' },
    { id: 'truth', question: '寄存人调查是必须完成的吗？', keys: '附查 真相 底联 交接员 支线', answer: '不是。第一案完成窗口实操后，可沿不同地点核验寄存痕迹，装订调查记录；也能结案后回访。它补充人物关系，并在第二案留下交接文字，不阻止主线推进。' },
    { id: 'reset', question: '轮回会失去什么、保留什么？', keys: '重置 遗忘 传承 回声 永久', answer: '第三案完成后才可主动轮回，不会被迫重开。本轮库存、员工、设施、研究、案件和藏品归零；累计等级、藏品见闻和永久传承保留。确认前会导出旧案卷，界面会列出可选择的传承。' }
  ];
  const common = ['next', 'blocked', 'xp'];
  function normalize(value) { return String(value || '').toLowerCase().replace(/[\s？?，,。.!！]/g, ''); }
  function search(query) {
    const q = normalize(String(query || '').slice(0, 80));
    if (!q) return common.map(id => entries.find(e => e.id === id));
    const tokens = q.split(/[、/;；]+/).filter(Boolean);
    return entries.map(e => {
      const title = normalize(e.question), keys = normalize(e.keys), body = normalize(e.answer);
      const score = tokens.reduce((n, t) => n + (title.includes(t) ? 6 : keys.includes(t) ? 4 : body.includes(t) ? 1 : 0), 0) + e.keys.split(' ').filter(k => k.length >= 2 && q.includes(k.toLowerCase())).length * 4;
      return { entry: e, score };
    }).filter(e => e.score > 0).sort((a, b) => b.score - a.score).slice(0, 6).map(e => e.entry);
  }
  return { entries, common, search };
});
