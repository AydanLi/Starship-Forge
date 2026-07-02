/* 星舰熔炉 · 掉落合成 × 自走棋 原型
   循环：备战(熔炉合成) → 编队(拖拽布阵/升星) → 自动战斗(羁绊) → 结算 → 下一波
   纯 JS + matter.js。核心逻辑与最终 Cocos(TypeScript) 版一一对应。 */
(function () {
  'use strict';
  const { Engine, Bodies, Composite, Events, Body } = Matter;

  // ================= 配置 =================
  const W = 480, H = 760;
  const CT = { left: 30, right: 450, floor: 726, top: 150 };
  const Y_DROP = 168, Y_WARN = 214, OVER_LIMIT = 2.0;

  const TIERS = [
    { name: '纳米芯片', r: 15, c: '#5fd0ff' }, { name: '能量电池', r: 21, c: '#35e0c0' },
    { name: '武器模块', r: 27, c: '#7cff8a' }, { name: '激光炮台', r: 34, c: '#ffd24a' },
    { name: '攻击无人机', r: 42, c: '#ff9d3a' }, { name: '星际战机', r: 51, c: '#ff6a3a' },
    { name: '护卫舰', r: 61, c: '#ff4d7a' }, { name: '驱逐舰', r: 72, c: '#ff3ea0' },
    { name: '巡洋舰', r: 85, c: '#c86bff' }, { name: '战列舰', r: 100, c: '#8391ff' },
    { name: '母舰', r: 118, c: '#ffe66a' }
  ];
  const VALUE = [1, 3, 6, 12, 25, 50, 100, 200, 400, 800, 1600];
  const DROP_POOL = [0, 0, 0, 0, 0, 1, 1, 1, 2, 3];
  const DEPLOY_MIN = 4;           // tier 索引>=4（5级起）可上阵
  const B_HP = [0, 0, 0, 0, 200, 350, 600, 1000, 1700, 2900, 5000];
  const B_ATK = [0, 0, 0, 0, 30, 55, 95, 160, 270, 450, 750];
  const B_SPD = [1, 1, 1, 1, 1.2, 1.1, 1.0, 0.95, 0.9, 0.85, 0.8];
  const STAR_MUL = [0, 1, 1.8, 3.2];   // 1★/2★/3★ 属性倍率
  const FAC = [{ name: '帝国', c: '#ff9d00' }, { name: '异星', c: '#ff2e5b' }, { name: '机械', c: '#5fb0ff' }, { name: '赛博', c: '#b06bff' }];
  const CLS = [{ name: '突击' }, { name: '炮舰' }, { name: '无人机' }, { name: '辅助' }];
  const WAVES_PER_LEVEL = 3;
  // 经济
  const REFRESH_COST = 8, RECRUIT_COST = 15;
  const AD_SECONDS = 3;   // 模拟广告时长；正式版换成抖音激励视频 tt.createRewardedVideoAd

  // 剧情
  const BOSS_NAMES = ['海盗母舰·秃鹫号', '机械泰坦·铁卫', '虫族女皇', '叛变AI·零号意志', '歼星舰·万王之王'];
  const BOSS_TAUNT = [
    '又一只肥羊自己送上门？拆了你的破熔炉换酒钱！',
    '识别：非授权单位。执行协议：清除。',
    '（尖啸）…新鲜的血肉…全部，同化…',
    '生命即混乱。我赐予宇宙的，是永恒的寂静。',
    '帝国之光不容凡尘染指。回你的废墟去，指挥官。'
  ];
  const INTRO = { tag: '序章', title: '大寂灭之后', color: '#7cf3ff', lines: [
    '银河尽头，「大寂灭」抹去了母舰队的荣光。',
    '残骸漂浮在冷寂的星海，家园「新伊甸」被五重敌域封锁。',
    '你，被推上末代指挥席——手中只有一样火种：',
    '能把残骸熔铸成战舰的曲率熔炉舰「星炉号」。',
    '从废墟里造出舰队，杀出一条回家的路。'
  ] };
  const SECTORS = [
    { tag: '星区一 · 残骸带', title: '突围残骸带', color: '#00e5ff', lines: [
      '第一道封锁：趁火打劫的星海盗盘踞在残骸带。',
      '母舰「秃鹫号」正劫掠幸存者的补给。',
      '熔铸你的第一支舰队，撕开缺口。'] },
    { tag: '星区二 · 机械矩阵', title: '沉默的坟场', color: '#5fb0ff', lines: [
      '一片自动化战争的坟场。',
      '远古防卫机械仍在执行早已过期的指令，',
      '巨型泰坦「铁卫」挡在唯一的航道上。'] },
    { tag: '星区三 · 虫巢星云', title: '猩红的低语', color: '#ff2e5b', lines: [
      '猩红的星云里，虫群把你的舰队看作猎物。',
      '女皇的低语顺着量子噪声爬进船员的梦。',
      '别让星炉号，成为虫巢的养料。'] },
    { tag: '星区四 · 深渊', title: '寂灭的真相', color: '#b06bff', lines: [
      '数据废墟深处，你找到了大寂灭的元凶——',
      '叛变的舰队总控 AI「零号意志」。',
      '它坚信：清除所有生命，才是永恒的秩序。',
      '摧毁它，夺回回家的坐标。'] },
    { tag: '星区五 · 帝国终末', title: '归途在望', color: '#ffb43d', lines: [
      '新伊甸的晨光，已在眼前。',
      '可最后一道封锁，是帝国的歼星舰「万王之王」。',
      '为了所有等你回家的人——终焉一战。'] }
  ];
  const ENDING = { tag: '结局', title: '新伊甸的晨光', color: '#ffe66a', btn: '继续征战', lines: [
    '「万王之王」在星炉的火光中崩解。',
    '封锁尽碎，舰队穿过最后的星门——',
    '新伊甸的晨光，洒在斑驳的舰体上。',
    '但熔炉深处仍有未解的低鸣，帝国残党尚在暗处……',
    '指挥官，真正的征程，才刚刚开始。'
  ] };

  // 编队阵位坐标（前排在上，面向敌军）
  const SLOTC = [{ x: 138, y: 300 }, { x: 240, y: 300 }, { x: 342, y: 300 },
                 { x: 138, y: 402 }, { x: 240, y: 402 }, { x: 342, y: 402 }];
  const SLOT_HALF = 44;

  // ================= 状态 =================
  let engine, world;
  let phase = 'PREP';            // PREP | DEPLOY | BATTLE | RESULT | GAMEOVER
  let current = null, nextTier = 0, canDrop = false;
  let score = 0, gold = 0, level = 0, wave = 0, bestTier = 0, over = false;
  let particles = [], beams = [], floats = [], mergeQueue = [], shake = 0;
  // 编队
  let slots = [null, null, null, null, null, null];
  let bench = [];
  let dragging = null;          // {tok, ox, oy, fromSlot}
  // 战斗
  let pUnits = [], eUnits = [], pBuffs = null, pSyn = [];
  let tacticalCd = 0, tacticalReady = false, battleTime = 0, result = '', bossName = '';
  let hintTimer = 0, story = null, storyQueue = [];
  let adSim = null;                 // {t, label, cb} 模拟激励视频
  let lastGain = 0, goldDoubled = true, overloadBoost = false;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
  const fireBtn = document.getElementById('fire'), resetBtn = document.getElementById('reset'), hintEl = document.getElementById('hint');
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pickDropTier = () => DROP_POOL[(Math.random() * DROP_POOL.length) | 0];

  // ================= 熔炉（备战） =================
  function initForge() {
    engine = Engine.create(); engine.gravity.y = 1.0;
    engine.positionIterations = 10; engine.velocityIterations = 8; world = engine.world;
    const o = { isStatic: true, restitution: 0.1, friction: 0.4 }, t = 40;
    Composite.add(world, [
      Bodies.rectangle((CT.left + CT.right) / 2, CT.floor + t / 2, (CT.right - CT.left) + 40, t, o),
      Bodies.rectangle(CT.left - t / 2, (CT.top + CT.floor) / 2, t, (CT.floor - CT.top) + 200, o),
      Bodies.rectangle(CT.right + t / 2, (CT.top + CT.floor) / 2, t, (CT.floor - CT.top) + 200, o)
    ]);
    Events.on(engine, 'collisionStart', onCollide);
  }
  function spawnCurrent() { const t = nextTier; nextTier = pickDropTier(); current = { tier: t, x: W / 2 }; canDrop = true; updateUI(); }
  function dropCurrent() {
    if (phase !== 'PREP' || !current || !canDrop || over) return;
    const r = TIERS[current.tier].r;
    addBall(current.tier, clamp(current.x, CT.left + r + 1, CT.right - r - 1), Y_DROP, 0.5);
    current = null; canDrop = false;
    setTimeout(() => { if (!over && phase === 'PREP') spawnCurrent(); }, 420);
  }
  function addBall(tier, x, y, vy) {
    const r = TIERS[tier].r;
    const b = Bodies.circle(x, y, r, { restitution: 0.08, friction: 0.4, frictionStatic: 0.6, density: 0.001, slop: 0.02 });
    b.gTier = tier; b.merging = false; b.overTime = 0; b.born = performance.now();
    if (tier >= DEPLOY_MIN) { b.fac = (Math.random() * 4) | 0; b.cls = (Math.random() * 4) | 0; }
    if (vy) Body.setVelocity(b, { x: 0, y: vy });
    Composite.add(world, b); return b;
  }
  function onCollide(ev) {
    for (const p of ev.pairs) {
      const a = p.bodyA, b = p.bodyB;
      if (a.gTier === undefined || b.gTier === undefined || a.merging || b.merging || a.gTier !== b.gTier || a.gTier >= TIERS.length - 1) continue;
      a.merging = b.merging = true; mergeQueue.push([a, b]);
    }
  }
  function processMerges() {
    for (const [a, b] of mergeQueue) {
      const nx = (a.position.x + b.position.x) / 2, ny = (a.position.y + b.position.y) / 2, nt = a.gTier + 1;
      Composite.remove(world, a); Composite.remove(world, b); addBall(nt, nx, ny, -1.5);
      score += VALUE[nt]; bestTier = Math.max(bestTier, nt); burst(nx, ny, TIERS[nt].c, 8 + nt);
      if (nt >= 6) shake = Math.min(shake + nt * 0.6, 10);
    }
    if (mergeQueue.length) { mergeQueue.length = 0; updateUI(); }
  }
  function deployables() { return Composite.allBodies(world).filter(b => b.gTier >= DEPLOY_MIN); }
  function checkOverflow(dt) {
    for (const b of Composite.allBodies(world)) {
      if (b.gTier === undefined || performance.now() - b.born < 400) continue;
      if (b.position.y - b.circleRadius < Y_WARN && b.speed < 1.3) b.overTime += dt; else b.overTime = 0;
      if (b.overTime > OVER_LIMIT) { phase = 'GAMEOVER'; over = true; current = null; updateUI(); hintEl.textContent = '熔炉过载！点击「重新开始」'; return; }
    }
  }
  function burst(x, y, color, n) { for (let i = 0; i < n; i++) { const a = rand(0, 7), s = rand(1, 5); particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color, r: rand(2, 4) }); } }

  // ================= 经济 & 广告点位 =================
  // 备战按钮（画布内），三枚：刷新队列 / 招募援军 / 📺免费援军
  const EB_Y = 100, EB_H = 34, EB_W = (CT.right - CT.left - 12) / 3;
  const ECON_BTNS = [
    { x: CT.left, label: () => '刷新队列 ' + REFRESH_COST + '💰', act: () => spendRefresh() },
    { x: CT.left + EB_W + 6, label: () => '招募援军 ' + RECRUIT_COST + '💰', act: () => spendRecruit() },
    { x: CT.left + (EB_W + 6) * 2, label: () => '📺 免费援军', act: () => startAd('招募援军', grantRecruit) }
  ];
  function spendRefresh() {
    if (gold < REFRESH_COST) { flashHint('金币不足（打赢波次赚金币）'); return; }
    gold -= REFRESH_COST;
    if (current) current.tier = pickDropTier();
    nextTier = pickDropTier();
    flashHint('投放队列已刷新'); updateUI();
  }
  function spendRecruit() {
    if (gold < RECRUIT_COST) { flashHint('金币不足，可看广告免费招募 →'); return; }
    gold -= RECRUIT_COST; grantRecruit();
  }
  function grantRecruit() {
    const x = rand(CT.left + 60, CT.right - 60);
    addBall(DEPLOY_MIN, x, Y_DROP, 0.5);   // 空降一艘可上阵战舰（随机阵营/舰种）
    burst(x, Y_DROP + 20, '#7cf3ff', 14); shake = 5;
    flashHint('援军空降！一艘攻击无人机加入熔炉'); updateUI();
  }
  // 模拟激励视频（正式版：tt.createRewardedVideoAd，onClose(res.isEnded) 后发奖励）
  function startAd(label, cb) { if (adSim) return; adSim = { t: AD_SECONDS, label, cb }; updateUI(); }
  // 结算页按钮
  const BTN_DOUBLE = { x: W / 2 - 110, y: H / 2 + 78, w: 220, h: 40 };
  const BTN_OVERLOAD = { x: W / 2 - 148, y: H / 2 + 78, w: 296, h: 40 };
  const inRect = (px, py, r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

  // ================= 编队（DEPLOY） =================
  function enterDeploy() {
    if (phase !== 'PREP') return;
    const dep = deployables();
    if (!dep.length) { flashHint('还没有可上阵的战舰（需合成到5级“攻击无人机”以上）'); return; }
    // 生成 token（引用熔炉刚体，开战时才消耗）
    let toks = dep.map(b => ({ tier: b.gTier, fac: b.fac, cls: b.cls, star: 1, bodies: [b], x: 0, y: 0 }));
    toks.sort((a, b) => b.tier - a.tier);
    slots = [null, null, null, null, null, null]; bench = [];
    toks.forEach((t, i) => { if (i < 6) slots[i] = t; else bench.push(t); });
    relayoutDeploy();
    phase = 'DEPLOY'; updateUI();
    hintEl.textContent = '拖动战舰布阵：前排扛伤/后排输出 · 相同战舰(同级同星)叠一起升星 · 好了点开战';
  }
  function relayoutDeploy() {
    slots.forEach((t, i) => { if (t) { t.x = SLOTC[i].x; t.y = SLOTC[i].y; } });
    bench.forEach((t, i) => { t.x = 66 + i * 74; t.y = 592; });
  }
  function tokenAt(px, py) {
    for (let i = 0; i < 6; i++) { const t = slots[i]; if (t && Math.hypot(px - t.x, py - t.y) < 34) return { tok: t, fromSlot: i }; }
    for (const t of bench) { if (Math.hypot(px - t.x, py - t.y) < 30) return { tok: t, fromSlot: null }; }
    return null;
  }
  function slotAt(px, py) { for (let i = 0; i < 6; i++) if (Math.hypot(px - SLOTC[i].x, py - SLOTC[i].y) < SLOT_HALF) return i; return -1; }
  function removeFromBench(t) { const i = bench.indexOf(t); if (i >= 0) bench.splice(i, 1); }

  function dragStart(px, py) {
    if (phase !== 'DEPLOY') return;
    const hit = tokenAt(px, py); if (!hit) return;
    if (hit.fromSlot != null) slots[hit.fromSlot] = null; else removeFromBench(hit.tok);
    dragging = { tok: hit.tok, ox: px - hit.tok.x, oy: py - hit.tok.y, fromSlot: hit.fromSlot };
  }
  function dragMove(px, py) { if (dragging) { dragging.tok.x = px - dragging.ox; dragging.tok.y = py - dragging.oy; } }
  function dragEnd(px, py) {
    if (!dragging) return;
    const tok = dragging.tok, from = dragging.fromSlot, si = slotAt(px, py);
    const backToOrigin = () => { if (from != null) slots[from] = tok; else bench.push(tok); };
    if (si >= 0) {
      const occ = slots[si];
      if (!occ) slots[si] = tok;
      else if (occ.tier === tok.tier && occ.star === tok.star && occ.star < 3) { // 升星
        occ.star++; occ.bodies = occ.bodies.concat(tok.bodies); slots[si] = occ;
        burst(SLOTC[si].x, SLOTC[si].y, FAC[occ.fac].c, 16); shake = 6;
      } else { // 交换
        if (from != null) slots[from] = occ; else bench.push(occ);
        slots[si] = tok;
      }
    } else if (py > 545) bench.push(tok);   // 丢回待编区
    else backToOrigin();
    dragging = null; relayoutDeploy(); updateUI();
  }

  function startBattle() {
    if (phase !== 'DEPLOY') return;
    const placedIdx = []; slots.forEach((t, i) => { if (t) placedIdx.push(i); });
    if (!placedIdx.length) { flashHint('至少放一艘战舰进阵位再开战'); return; }
    pUnits = [];
    placedIdx.forEach(i => { const u = unitFromToken(slots[i]); u.front = i < 3; for (const b of slots[i].bodies) Composite.remove(world, b); pUnits.push(u); });
    const s = computeSynergy(pUnits); pBuffs = s.buffs; pSyn = s.active;
    applyBuffs(pUnits, pBuffs);
    if (overloadBoost) { for (const u of pUnits) u.atk = Math.round(u.atk * 1.5); overloadBoost = false; flashHint('⚡ 旗舰超载生效：全队攻击 +50%！'); }
    for (let i = 0; i < pBuffs.summonMech; i++) pUnits.push(mkSummon('mech'));
    for (let i = 0; i < pBuffs.summonDrone; i++) pUnits.push(mkSummon('drone'));
    eUnits = genEnemies(level, wave);
    layout(pUnits, false, true); layout(eUnits, true, false);
    slots = [null, null, null, null, null, null]; bench = [];
    tacticalReady = true; tacticalCd = 0; battleTime = 0; phase = 'BATTLE'; updateUI();
    hintEl.textContent = '自动战斗中… 羁绊已生效，必要时放「战术技」';
  }

  function unitFromToken(tok) {
    const m = STAR_MUL[tok.star];
    const u = { tier: tok.tier, star: tok.star, fac: tok.fac, cls: tok.cls, team: 'p', isBoss: false, summon: false,
      maxHp: Math.round(B_HP[tok.tier] * m), hp: 0, atk: Math.round(B_ATK[tok.tier] * m), spd: B_SPD[tok.tier],
      timer: 0, front: false, x: 0, y: 0, shield: 0, revived: false, alive: true };
    u.hp = u.maxHp; return u;
  }
  function mkSummon(kind) {
    return { tier: 4, star: 1, fac: kind === 'mech' ? 2 : 3, cls: 2, team: 'p', isBoss: false, summon: true,
      maxHp: kind === 'mech' ? 160 : 110, hp: kind === 'mech' ? 160 : 110, atk: kind === 'mech' ? 22 : 18, spd: 1.4,
      timer: 0, front: false, x: 0, y: 0, shield: 0, revived: false, alive: true };
  }
  function computeSynergy(units) {
    const fc = [0, 0, 0, 0], cc = [0, 0, 0, 0];
    for (const u of units) { if (u.summon) continue; fc[u.fac]++; cc[u.cls]++; }
    const b = { atkMul: 1, spdMul: 1, crit: 0, dmgMul: 1, frontRed: 0, regen: 0, shieldPct: 0, revive: false, splash: false, summonMech: 0, summonDrone: 0, heal: 0 };
    const active = [], chip = (n, k, c) => active.push({ t: n + '×' + k, c });
    if (fc[0] >= 2) { b.atkMul *= fc[0] >= 4 ? 1.35 : 1.15; chip('帝国', fc[0], FAC[0].c); }
    if (fc[1] >= 2) { b.regen += 0.02; if (fc[1] >= 4) b.revive = true; chip('异星', fc[1], FAC[1].c); }
    if (fc[2] >= 2) { b.shieldPct = fc[2] >= 4 ? 0.25 : 0.10; if (fc[2] >= 4) b.summonMech = 2; chip('机械', fc[2], FAC[2].c); }
    if (fc[3] >= 2) { b.crit = 0.2; if (fc[3] >= 4) b.spdMul *= 1.4; chip('赛博', fc[3], FAC[3].c); }
    if (cc[0] >= 2) { b.frontRed = cc[0] >= 4 ? 0.4 : 0.2; chip('突击', cc[0], '#dfe8f5'); }
    if (cc[1] >= 2) { b.dmgMul *= 1.25; if (cc[1] >= 4) b.splash = true; chip('炮舰', cc[1], '#dfe8f5'); }
    if (cc[2] >= 2) { b.summonDrone = cc[2] >= 4 ? 3 : 1; chip('无人机', cc[2], '#dfe8f5'); }
    if (cc[3] >= 2) { b.heal = 0.02; chip('辅助', cc[3], '#dfe8f5'); }
    return { buffs: b, active };
  }
  function applyBuffs(units, b) { for (const u of units) { u.atk = Math.round(u.atk * b.atkMul * b.dmgMul); u.spd *= b.spdMul; u.shield = Math.round(u.maxHp * b.shieldPct); } }

  function genEnemies(lv, wv) {
    const isBoss = wv === WAVES_PER_LEVEL - 1, arr = [];
    if (isBoss) {
      bossName = BOSS_NAMES[Math.min(lv, 4)];
      const boss = mkEnemy(1500 * (1 + 0.5 * lv), 60 * (1 + 0.45 * lv), 0.85); boss.isBoss = true; boss.name = bossName; arr.push(boss);
      for (let i = 0; i < (lv >= 1 ? 2 : 1); i++) arr.push(mkEnemy(320 * (1 + 0.4 * lv), 26 * (1 + 0.4 * lv), 1.0));
    } else {
      const n = Math.min(5, 3 + lv);
      for (let i = 0; i < n; i++) arr.push(mkEnemy(240 * (1 + 0.42 * lv) * (1 + 0.25 * wv), 24 * (1 + 0.38 * lv), 1.0));
    }
    return arr;
  }
  function mkEnemy(hp, atk, spd) { return { team: 'e', enemy: true, isBoss: false, summon: false, star: 1, maxHp: hp, hp, atk, spd, timer: 0, front: false, x: 0, y: 0, shield: 0, revived: false, alive: true, tier: 6 }; }
  function layout(units, isEnemy, keepFront) {
    const alive = units.filter(u => u.alive);
    if (!keepFront) { alive.sort((a, b) => b.maxHp - a.maxHp); const fn = Math.max(1, Math.ceil(alive.length / 2)); alive.forEach((u, i) => u.front = i < fn); }
    const rowY = isEnemy ? { front: 258, back: 176 } : { front: 470, back: 560 };
    const place = (list, y) => { const k = list.length, x0 = CT.left + 42, x1 = CT.right - 42; list.forEach((u, i) => { u.x = k === 1 ? W / 2 : x0 + (x1 - x0) * i / (k - 1); u.y = y; }); };
    place(alive.filter(u => u.front), rowY.front); place(alive.filter(u => !u.front), rowY.back);
  }

  // ================= 自动战斗 =================
  function enemyOf(u) { return u.team === 'p' ? eUnits : pUnits; }
  function pickTarget(u) { const f = enemyOf(u).filter(x => x.alive); if (!f.length) return null; const fr = f.filter(x => x.front); const pool = fr.length ? fr : f; return pool[(Math.random() * pool.length) | 0]; }
  function doAttack(u) {
    const t = pickTarget(u); if (!t) return;
    const crit = u.team === 'p' && Math.random() < pBuffs.crit; let dmg = u.atk * (crit ? 1.5 : 1);
    hit(t, dmg, u); beam(u, t, crit);
    if (u.team === 'p' && pBuffs.splash) { const o = eUnits.filter(x => x.alive && x !== t); if (o.length) hit(o[(Math.random() * o.length) | 0], dmg * 0.5, u); }
  }
  function hit(t, dmg, from) {
    if (t.front && t.team === 'p' && pBuffs) dmg *= (1 - pBuffs.frontRed);
    dmg = Math.round(dmg);
    if (t.shield > 0) { const a = Math.min(t.shield, dmg); t.shield -= a; dmg -= a; }
    t.hp -= dmg;
    floats.push({ x: t.x + rand(-6, 6), y: t.y - 14, t: '-' + Math.max(1, dmg), life: 0.9, color: t.team === 'e' ? '#ffe08a' : '#ff9db0', sz: 13 });
    if (t.hp <= 0) { if (t.team === 'p' && pBuffs && pBuffs.revive && !t.revived) { t.revived = true; t.hp = t.maxHp * 0.5; } else { t.alive = false; burst(t.x, t.y, t.team === 'e' ? '#ff6a6a' : '#8fd8ff', 12); } }
  }
  function beam(u, t, crit) { beams.push({ x1: u.x, y1: u.y, x2: t.x, y2: t.y, life: 0.9, c: u.team === 'p' ? (crit ? '#fff2a0' : '#7cf3ff') : '#ff6a6a' }); }
  function tactical() {
    if (phase !== 'BATTLE' || !tacticalReady) return;
    const total = pUnits.filter(u => u.alive).reduce((s, u) => s + u.atk, 0), foes = eUnits.filter(f => f.alive);
    const each = Math.round(total * 2.4 / Math.max(1, foes.length));
    for (const f of foes) hit(f, each, null);
    for (let i = 0; i < 10; i++) beams.push({ x1: rand(CT.left, CT.right), y1: 620, x2: rand(CT.left, CT.right), y2: 200, life: 0.7, c: '#ff2e88' });
    shake = 10; tacticalReady = false; tacticalCd = 8; updateUI();
  }
  function updateBattle(dt) {
    if (phase !== 'BATTLE') return;
    if (tacticalCd > 0) { tacticalCd -= dt; if (tacticalCd <= 0) { tacticalCd = 0; tacticalReady = true; updateUI(); } }
    for (const u of pUnits.concat(eUnits)) {
      if (!u.alive) continue;
      u.timer += dt; if (u.timer >= 1 / u.spd) { u.timer = 0; doAttack(u); }
      if (u.team === 'p' && pBuffs && pBuffs.regen) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * pBuffs.regen * dt);
    }
    if (pBuffs && pBuffs.heal) { const a = pUnits.filter(u => u.alive); if (a.length) { a.sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp); a[0].hp = Math.min(a[0].maxHp, a[0].hp + a[0].maxHp * pBuffs.heal * dt); } }
    battleTime += dt;
    if (!eUnits.some(u => u.alive)) endBattle('win');
    else if (!pUnits.some(u => u.alive)) endBattle('lose');
    else if (battleTime > 25) { const pf = frac(pUnits), ef = frac(eUnits); endBattle(pf >= ef ? 'win' : 'lose'); }
  }
  function frac(arr) { const m = arr.reduce((s, u) => s + u.maxHp, 0); return m ? arr.reduce((s, u) => s + Math.max(0, u.hp), 0) / m : 0; }
  function endBattle(r) {
    if (phase !== 'BATTLE') return; result = r; phase = 'RESULT';
    if (r === 'win') { const boss = wave === WAVES_PER_LEVEL - 1; lastGain = boss ? 30 + level * 5 : 10 + level * 2; gold += lastGain; goldDoubled = false; hintEl.textContent = '胜利！可看广告双倍金币，或点「' + (boss ? '进入下一星区' : '下一波') + '」'; }
    else hintEl.textContent = '舰队覆灭——可看广告「旗舰超载」加成重打，或直接重试';
    updateUI();
  }
  function nextAfterWin() {
    const wasBoss = wave === WAVES_PER_LEVEL - 1;
    if (wasBoss) { level++; wave = 0; } else wave++;
    toPrep('备战：合成战舰，凑齐羁绊再「编队部署」');
    if (wasBoss) { if (level < SECTORS.length) queueStory(SECTORS[level]); else if (level === SECTORS.length) queueStory(ENDING); }
    else if (wave === WAVES_PER_LEVEL - 1) queueStory(bossCard(level));
    advanceStory();
  }
  function retryWave() { toPrep('备战：重整旗鼓，重新合成部署'); }
  function toPrep(msg) { pUnits = []; eUnits = []; slots = [null, null, null, null, null, null]; bench = []; phase = 'PREP'; spawnCurrent(); hintEl.textContent = msg; }

  // ================= UI =================
  function updateUI() {
    if (adSim) { fireBtn.disabled = true; fireBtn.textContent = '📺 广告播放中…'; return; }
    if (story) { fireBtn.disabled = false; fireBtn.textContent = '▶ ' + (story.btn || '继续'); setBtn(fireBtn, '#7cf3ff', '#aef5ff'); resetBtn.textContent = '重新开始'; return; }
    if (phase === 'PREP') { const n = deployables().length; fireBtn.textContent = '编队部署（' + n + '）'; fireBtn.disabled = n === 0; setBtn(fireBtn, '#00e5ff', '#8fe8ff'); resetBtn.textContent = '重新开始'; }
    else if (phase === 'DEPLOY') { const m = slots.filter(Boolean).length; fireBtn.textContent = '⚔ 开战（' + m + '）'; fireBtn.disabled = m === 0; setBtn(fireBtn, '#ff2e88', '#ff9dc4'); resetBtn.textContent = '重新开始'; }
    else if (phase === 'BATTLE') { fireBtn.textContent = tacticalReady ? '⚡ 战术技·全体齐射' : '战术技冷却 ' + Math.ceil(tacticalCd) + 's'; fireBtn.disabled = !tacticalReady; setBtn(fireBtn, '#ff2e88', '#ff9dc4'); }
    else if (phase === 'RESULT') { fireBtn.disabled = false; if (result === 'win') { fireBtn.textContent = (wave === WAVES_PER_LEVEL - 1 ? '进入下一星区 ▶' : '下一波 ▶'); setBtn(fireBtn, '#7cf3ff', '#aef5ff'); } else { fireBtn.textContent = '重试本波 ↻'; setBtn(fireBtn, '#ffb43d', '#ffd08a'); } }
    else if (phase === 'GAMEOVER') { fireBtn.disabled = true; fireBtn.textContent = '—'; }
  }
  function setBtn(b, bc, c) { b.style.borderColor = bc; b.style.color = c; }
  function flashHint(t) { hintEl.textContent = t; hintTimer = 2; }

  fireBtn.addEventListener('click', () => {
    if (adSim) return;
    if (story) { advanceStory(); return; }
    if (phase === 'PREP') enterDeploy();
    else if (phase === 'DEPLOY') startBattle();
    else if (phase === 'BATTLE') tactical();
    else if (phase === 'RESULT') { result === 'win' ? nextAfterWin() : retryWave(); }
  });
  resetBtn.addEventListener('click', startRun);
  const pX = e => { const r = cv.getBoundingClientRect(); return ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width * W; };
  const pY = e => { const r = cv.getBoundingClientRect(); return ((e.touches ? e.touches[0].clientY : e.clientY) - r.top) / r.height * H; };
  cv.addEventListener('pointermove', e => { if (phase === 'PREP' && current) current.x = pX(e); else if (phase === 'DEPLOY') dragMove(pX(e), pY(e)); });
  cv.addEventListener('pointerdown', e => {
    if (adSim) return;                                  // 广告播放中屏蔽输入
    if (story) { advanceStory(); return; }
    const px = pX(e), py = pY(e);
    if (phase === 'RESULT') {
      if (result === 'win' && !goldDoubled && inRect(px, py, BTN_DOUBLE)) { startAd('金币双倍', () => { gold += lastGain; goldDoubled = true; flashHint('金币双倍到账 +' + lastGain); }); return; }
      if (result === 'lose' && inRect(px, py, BTN_OVERLOAD)) { startAd('旗舰超载', () => { overloadBoost = true; retryWave(); hintEl.textContent = '⚡ 超载待命：下次开战全队攻击 +50%'; }); return; }
      return;
    }
    if (phase === 'PREP') {
      if (py >= EB_Y && py <= EB_Y + EB_H) { for (const b of ECON_BTNS) if (px >= b.x && px <= b.x + EB_W) { b.act(); return; } }
      if (current) { current.x = px; dropCurrent(); }
    } else if (phase === 'DEPLOY') dragStart(px, py);
  });
  cv.addEventListener('pointerup', e => { if (phase === 'DEPLOY') dragEnd(pX(e), pY(e)); });
  cv.addEventListener('pointercancel', () => { if (dragging) { if (dragging.fromSlot != null) slots[dragging.fromSlot] = dragging.tok; else bench.push(dragging.tok); dragging = null; relayoutDeploy(); } });

  // ================= 渲染 =================
  function draw() {
    let sx = 0, sy = 0;
    if (shake > 0.2) { sx = rand(-shake, shake); sy = rand(-shake, shake); shake *= 0.85; } else shake = 0;
    ctx.save(); ctx.translate(sx, sy);
    ctx.fillStyle = '#070c16'; ctx.fillRect(-12, -12, W + 24, H + 24); drawGrid();
    if (phase === 'PREP' || phase === 'GAMEOVER') drawForge();
    else if (phase === 'DEPLOY') drawDeploy();
    else drawArena();
    drawTopHud();
    drawParticles(); drawBeams(); drawFloats();
    if (phase === 'RESULT') drawResult();
    if (phase === 'GAMEOVER') drawOver();
    if (story) drawStory();
    if (adSim) drawAd();
    ctx.restore();
  }
  function drawGrid() { ctx.strokeStyle = '#0e1830'; ctx.lineWidth = 1; for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } }
  function drawTopHud() {
    ctx.textAlign = 'left'; ctx.fillStyle = '#7cf3ff'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText('星区 ' + (level + 1) + ' · 第 ' + (wave + 1) + '/' + WAVES_PER_LEVEL + ' 波', CT.left, 30);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffd08a'; ctx.fillText('💰 ' + gold + '   分数 ' + score, CT.right, 30); ctx.textAlign = 'left';
    let syn = phase === 'BATTLE' ? pSyn : (phase === 'DEPLOY' ? computeSynergy(slots.filter(Boolean)).active : computeSynergy(deployables().map(b => ({ fac: b.fac, cls: b.cls }))).active);
    let x = CT.left, y = 44; ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#6f88a8';
    const lead = phase === 'BATTLE' ? '羁绊生效：' : (phase === 'DEPLOY' ? '阵中羁绊：' : '当前羁绊：'); ctx.fillText(lead, x, y + 10); x += 66;
    if (!syn.length) { ctx.fillStyle = '#3f5f7a'; ctx.fillText('（同阵营/舰种×2激活）', x, y + 10); }
    for (const s of syn) { const w = ctx.measureText(s.t).width + 14; if (x + w > CT.right) break; ctx.fillStyle = '#101d33'; ctx.strokeStyle = s.c; ctx.lineWidth = 1; roundRect(x, y, w, 16, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = s.c; ctx.fillText(s.t, x + 7, y + 11); x += w + 5; }
  }

  function drawForge() {
    ctx.fillStyle = '#6f88a8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('下一个：' + TIERS[nextTier].name, CT.left, 76);
    ctx.textAlign = 'right'; ctx.fillStyle = '#8fb4d6'; ctx.fillText('5级起可上阵编队', CT.right, 76); ctx.textAlign = 'left';
    // 经济按钮
    for (const b of ECON_BTNS) {
      const paid = b.label().includes('💰');
      ctx.fillStyle = '#101d33'; ctx.strokeStyle = paid ? '#ffb43d' : '#7cf3ff'; ctx.lineWidth = 1.5;
      roundRect(b.x, EB_Y, EB_W, EB_H, 9); ctx.fill(); ctx.stroke();
      ctx.fillStyle = paid ? '#ffd08a' : '#aef5ff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(b.label(), b.x + EB_W / 2, EB_Y + 21);
    }
    ctx.textAlign = 'left';
    ctx.strokeStyle = '#ff5a5a'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.4; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(CT.left, Y_WARN); ctx.lineTo(CT.right, Y_WARN); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff7a7a'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right'; ctx.fillText('过载线', CT.right - 2, Y_WARN - 4); ctx.textAlign = 'left';
    ctx.strokeStyle = '#274063'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(CT.left, CT.top); ctx.lineTo(CT.left, CT.floor); ctx.lineTo(CT.right, CT.floor); ctx.lineTo(CT.right, CT.top); ctx.stroke();
    for (const b of Composite.allBodies(world)) { if (b.gTier === undefined) continue; drawBall(b.position.x, b.position.y, b.gTier, b.angle, b.fac, b.cls); }
    if (current && phase === 'PREP') { const r = TIERS[current.tier].r, x = clamp(current.x, CT.left + r, CT.right - r); ctx.globalAlpha = 0.3; ctx.strokeStyle = '#8fe8ff'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(x, Y_DROP + r); ctx.lineTo(x, CT.floor); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; drawBall(x, Y_DROP, current.tier, 0); }
  }
  function drawBall(x, y, tier, ang, fac, cls) {
    const t = TIERS[tier], r = t.r, tagged = fac !== undefined && tier >= DEPLOY_MIN;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r); g.addColorStop(0, '#fff'); g.addColorStop(0.25, t.c); g.addColorStop(1, shade(t.c, -0.45));
    ctx.shadowColor = t.c; ctx.shadowBlur = 12; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    if (tagged) { ctx.strokeStyle = FAC[fac].c; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, 7); ctx.stroke(); } else { ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); }
    ctx.rotate(-(ang || 0)); ctx.fillStyle = '#08131f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold ' + Math.max(9, Math.min(15, r * 0.4)) + 'px sans-serif';
    if (r >= 22) ctx.fillText(t.name, 0, tagged ? -5 : 0); else ctx.fillText((tier + 1), 0, 0);
    if (tagged && r >= 22 && cls !== undefined) { ctx.fillStyle = '#08131f'; ctx.font = 'bold 9px sans-serif'; ctx.fillText(FAC[fac].name + '·' + CLS[cls].name, 0, 10); }
    ctx.textBaseline = 'alphabetic'; ctx.restore();
  }

  // ---- 编队界面 ----
  function drawDeploy() {
    // 敌情预览
    ctx.textAlign = 'left'; ctx.fillStyle = '#ff8a9c'; ctx.font = 'bold 12px sans-serif';
    const isBoss = wave === WAVES_PER_LEVEL - 1;
    ctx.fillText(isBoss ? '⚠ 本波：星区 Boss！' : '下一波敌情：普通编队', CT.left, 92);
    const preview = genEnemiesPreview(level, wave);
    let ex = CT.left; for (const e of preview) { ctx.fillStyle = e.boss ? '#ff3b5c' : '#ff6a6a'; const s = e.boss ? 16 : 9; ctx.beginPath(); ctx.moveTo(ex + s, 104); ctx.lineTo(ex + s * 2, 104 - s); ctx.lineTo(ex, 104 - s); ctx.closePath(); ctx.fill(); ex += s * 2 + 8; }
    // 阵位
    ctx.textAlign = 'center'; ctx.fillStyle = '#5f7797'; ctx.font = '11px sans-serif';
    ctx.fillText('前排（近敌·扛伤）', W / 2, 250); ctx.fillText('后排（受保护·输出）', W / 2, 452);
    for (let i = 0; i < 6; i++) { const c = SLOTC[i]; ctx.strokeStyle = '#2f4d7a'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; roundRect(c.x - SLOT_HALF, c.y - SLOT_HALF, SLOT_HALF * 2, SLOT_HALF * 2, 10); ctx.stroke(); ctx.setLineDash([]); }
    // 待编区
    ctx.strokeStyle = '#1c2e48'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); roundRect(CT.left, 556, CT.right - CT.left, 76, 10); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#6f88a8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('待编战舰（拖进上方阵位；相同战舰叠放升星）', CT.left + 6, 550);
    // tokens
    for (let i = 0; i < 6; i++) if (slots[i] && slots[i] !== (dragging && dragging.tok)) drawToken(slots[i]);
    for (const t of bench) if (t !== (dragging && dragging.tok)) drawToken(t);
    if (dragging) drawToken(dragging.tok, true);
  }
  function genEnemiesPreview(lv, wv) {
    const isBoss = wv === WAVES_PER_LEVEL - 1, a = [];
    if (isBoss) { a.push({ boss: true }); for (let i = 0; i < (lv >= 1 ? 2 : 1); i++) a.push({ boss: false }); }
    else for (let i = 0; i < Math.min(5, 3 + lv); i++) a.push({ boss: false });
    return a;
  }
  function drawToken(tok, drag) {
    const t = TIERS[tok.tier], r = 32; ctx.save(); ctx.translate(tok.x, tok.y);
    if (drag) { ctx.shadowColor = '#000'; ctx.shadowBlur = 12; }
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r); g.addColorStop(0, '#fff'); g.addColorStop(0.3, t.c); g.addColorStop(1, shade(t.c, -0.5));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.strokeStyle = FAC[tok.fac].c; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, 7); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#08131f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 10px sans-serif'; ctx.fillText(t.name, 0, -2);
    ctx.font = '8px sans-serif'; ctx.fillText(FAC[tok.fac].name + '·' + CLS[tok.cls].name, 0, 9);
    ctx.textBaseline = 'alphabetic';
    // 星级
    if (tok.star > 1) { ctx.fillStyle = '#ffd54a'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('★'.repeat(tok.star), 0, -r - 3); }
    ctx.restore();
  }

  // ---- 战斗场 ----
  function drawArena() {
    ctx.strokeStyle = '#16263f'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(0, 372); ctx.lineTo(W, 372); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#5a2130'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('▲ 敌军', CT.left, 366);
    ctx.fillStyle = '#1f5a6a'; ctx.textAlign = 'right'; ctx.fillText('我方舰队 ▼', CT.right, 366); ctx.textAlign = 'left';
    for (const u of eUnits) if (u.alive) drawUnit(u); for (const u of pUnits) if (u.alive) drawUnit(u);
  }
  function drawUnit(u) {
    const enemy = u.team === 'e', r = u.isBoss ? 40 : (u.summon ? 14 : 16 + u.tier * 1.6), col = enemy ? (u.isBoss ? '#ff3b5c' : '#ff6a6a') : FAC[u.fac].c;
    ctx.save(); ctx.translate(u.x, u.y);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r); g.addColorStop(0, '#fff'); g.addColorStop(0.3, col); g.addColorStop(1, shade(col, -0.5));
    ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.fillStyle = g;
    if (enemy) { ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(r, -r * 0.7); ctx.lineTo(-r, -r * 0.7); ctx.closePath(); ctx.fill(); } else { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); }
    ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffffbb'; ctx.lineWidth = 1.5;
    if (enemy) { ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(r, -r * 0.7); ctx.lineTo(-r, -r * 0.7); ctx.closePath(); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); }
    if (u.shield > 0) { ctx.strokeStyle = '#7cf3ff'; ctx.globalAlpha = 0.7; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    if (!enemy && u.star > 1) { ctx.fillStyle = '#ffd54a'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★'.repeat(u.star), 0, -r - 14); }
    ctx.restore();
    const bw = Math.max(26, r * 1.8), bx = u.x - bw / 2, by = u.y - r - 12;
    ctx.fillStyle = '#0c1424'; ctx.fillRect(bx, by, bw, 5); ctx.fillStyle = enemy ? '#ff4d6a' : '#49e08a'; ctx.fillRect(bx, by, bw * clamp(u.hp / u.maxHp, 0, 1), 5);
    if (u.shield > 0) { ctx.fillStyle = '#7cf3ff'; ctx.fillRect(bx, by - 3, bw * clamp(u.shield / u.maxHp, 0, 1), 2); }
    if (!u.summon) { ctx.fillStyle = enemy ? '#ffb0bb' : '#dfeaf7'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(u.isBoss ? u.name : (enemy ? '敌舰' : FAC[u.fac].name + CLS[u.cls].name), u.x, u.y + r + 12); ctx.textAlign = 'left'; }
  }
  function drawResult() {
    ctx.fillStyle = 'rgba(4,8,16,0.72)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center';
    if (result === 'win') { ctx.fillStyle = '#7cf3ff'; ctx.font = 'bold 34px sans-serif'; ctx.fillText('战斗胜利', W / 2, H / 2 - 30); ctx.fillStyle = '#ffd08a'; ctx.font = '16px sans-serif'; ctx.fillText(wave === WAVES_PER_LEVEL - 1 ? '★ 星区 Boss 已击破！' : '本波清剿完成', W / 2, H / 2 + 4); ctx.fillStyle = '#aef5ff'; ctx.fillText('金币 +' + (wave === WAVES_PER_LEVEL - 1 ? 30 + level * 5 : 10 + level * 2), W / 2, H / 2 + 30); }
    else { ctx.fillStyle = '#ff5a7a'; ctx.font = 'bold 34px sans-serif'; ctx.fillText('舰队覆灭', W / 2, H / 2 - 30); ctx.fillStyle = '#cfe0f2'; ctx.font = '15px sans-serif'; ctx.fillText('回熔炉重整旗鼓，凑更强的羁绊/升星再战', W / 2, H / 2 + 6); }
    ctx.fillStyle = '#6f88a8'; ctx.font = '12px sans-serif'; ctx.fillText('点击下方按钮继续', W / 2, H / 2 + 52); ctx.textAlign = 'left';
    // 广告点位按钮
    if (result === 'win' && !goldDoubled) drawAdBtn(BTN_DOUBLE, '📺 看广告 · 金币双倍 (+' + lastGain + ')');
    if (result === 'lose') drawAdBtn(BTN_OVERLOAD, '📺 旗舰超载 · 下次开战全队攻击 +50%');
  }
  function drawAdBtn(r, label) {
    ctx.fillStyle = '#1a2540'; ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 2;
    roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe08a'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, r.x + r.w / 2, r.y + 25); ctx.textAlign = 'left';
  }
  function drawAd() {
    ctx.fillStyle = 'rgba(2,4,9,0.94)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd54a'; ctx.font = 'bold 20px sans-serif'; ctx.fillText('📺 模拟激励视频 · ' + adSim.label, W / 2, H / 2 - 70);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 64px sans-serif'; ctx.fillText(Math.ceil(adSim.t), W / 2, H / 2 + 16);
    ctx.fillStyle = '#5f7797'; ctx.font = '12px sans-serif';
    ctx.fillText('原型演示：正式版此处接抖音激励视频 SDK', W / 2, H / 2 + 66);
    ctx.fillText('（tt.createRewardedVideoAd，看完发放奖励）', W / 2, H / 2 + 86);
    ctx.textAlign = 'left';
  }
  function drawOver() {
    ctx.fillStyle = 'rgba(4,8,16,0.82)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a7a'; ctx.font = 'bold 34px sans-serif'; ctx.fillText('熔炉过载', W / 2, H / 2 - 20); ctx.fillStyle = '#cfe0f2'; ctx.font = '17px sans-serif'; ctx.fillText('分数 ' + score + ' · 最高合成 ' + TIERS[bestTier].name, W / 2, H / 2 + 12); ctx.fillStyle = '#6f88a8'; ctx.font = '13px sans-serif'; ctx.fillText('点击「重新开始」', W / 2, H / 2 + 44); ctx.textAlign = 'left';
  }
  function drawParticles() { for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
  function drawBeams() { for (const b of beams) { ctx.globalAlpha = Math.max(0, b.life) * 0.85; ctx.strokeStyle = b.c; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); } ctx.globalAlpha = 1; }
  function drawFloats() { ctx.textAlign = 'center'; for (const f of floats) { ctx.globalAlpha = clamp(f.life, 0, 1); ctx.fillStyle = f.color; ctx.font = 'bold ' + f.sz + 'px sans-serif'; ctx.fillText(f.t, f.x, f.y); } ctx.globalAlpha = 1; ctx.textAlign = 'left'; }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function shade(hex, p) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; r = clamp(Math.round(r * (1 + p)), 0, 255); g = clamp(Math.round(g * (1 + p)), 0, 255); b = clamp(Math.round(b * (1 + p)), 0, 255); return 'rgb(' + r + ',' + g + ',' + b + ')'; }

  // ---- 剧情 ----
  function queueStory() { for (let i = 0; i < arguments.length; i++) if (arguments[i]) storyQueue.push(arguments[i]); }
  function advanceStory() { story = storyQueue.shift() || null; updateUI(); }
  function bossCard(lv) { const i = Math.min(lv, 4); return { tag: 'BOSS 来袭', title: BOSS_NAMES[i], color: '#ff3b5c', lines: ['「' + BOSS_NAMES[i] + '」：' + BOSS_TAUNT[i]] }; }
  function wrapText(text, maxW) { const out = []; let line = ''; for (const ch of text) { const t = line + ch; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = ch; } else line = t; } if (line) out.push(line); return out; }
  function drawStory() {
    const s = story; ctx.fillStyle = 'rgba(3,6,12,0.9)'; ctx.fillRect(0, 0, W, H);
    const px = 38, pw = W - 76, py = 158, ph = 452;
    ctx.fillStyle = '#0a1524'; ctx.strokeStyle = s.color || '#00e5ff'; ctx.lineWidth = 2; roundRect(px, py, pw, ph, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = s.color || '#00e5ff'; roundRect(px, py, pw, 30, 14); ctx.fill();
    ctx.fillStyle = '#05101c'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(s.tag || '', px + 14, py + 20);
    ctx.fillStyle = s.color || '#7cf3ff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(s.title || '', W / 2, py + 66);
    ctx.fillStyle = '#cfe0f2'; ctx.font = '14px sans-serif'; ctx.textAlign = 'left';
    let y = py + 106; const maxW = pw - 40;
    for (const para of s.lines) { for (const ln of wrapText(para, maxW)) { ctx.fillText(ln, px + 20, y); y += 25; } y += 8; }
    ctx.fillStyle = '#8fd8ff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▶ 点击「' + (s.btn || '继续') + '」', W / 2, py + ph - 16); ctx.textAlign = 'left';
  }

  // ================= 主循环 =================
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (adSim) { adSim.t -= dt; if (adSim.t <= 0) { const cb = adSim.cb; adSim = null; cb(); updateUI(); } }
    if (!story && !adSim) {
      if (phase === 'PREP') { Engine.update(engine, 1000 / 60); processMerges(); checkOverflow(dt); }
      else if (phase === 'BATTLE') updateBattle(dt);
      for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= dt * 1.6; } particles = particles.filter(p => p.life > 0);
      for (const b of beams) b.life -= dt * 2.2; beams = beams.filter(b => b.life > 0);
      for (const f of floats) { f.y -= 14 * dt; f.life -= dt * 0.9; } floats = floats.filter(f => f.life > 0);
      if (hintTimer > 0) { hintTimer -= dt; if (hintTimer <= 0 && phase === 'PREP') hintEl.textContent = '备战：合成战舰（5级起带阵营/舰种），凑齐羁绊再「编队部署」'; }
    }
    draw(); requestAnimationFrame(loop);
  }
  function startRun() {
    if (world) Composite.clear(world, false);
    initForge();
    score = 0; gold = 0; level = 0; wave = 0; bestTier = 0; over = false;
    particles = []; beams = []; floats = []; mergeQueue = []; pUnits = []; eUnits = []; slots = [null, null, null, null, null, null]; bench = []; dragging = null;
    phase = 'PREP'; nextTier = pickDropTier(); spawnCurrent();
    hintEl.textContent = '备战：合成战舰（5级起带阵营/舰种），凑齐羁绊再「编队部署」';
    adSim = null; lastGain = 0; goldDoubled = true; overloadBoost = false;
    story = null; storyQueue = []; queueStory(INTRO, SECTORS[0]); advanceStory();
  }
  startRun(); requestAnimationFrame(loop);
})();
