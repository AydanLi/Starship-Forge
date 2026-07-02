/* 星舰熔炉 · 掉落合成 × 自走棋 原型
   两阶段循环：备战(熔炉掉落合成) → 部署 → 自动战斗(羁绊+布阵) → 结算 → 下一波
   纯 JS + matter.js。核心逻辑与最终 Cocos(TypeScript) 版一一对应。 */
(function () {
  'use strict';
  const { Engine, Bodies, Composite, Events, Body } = Matter;

  // ================= 配置 =================
  const W = 480, H = 760;
  const CT = { left: 30, right: 450, floor: 726, top: 150 };
  const Y_DROP = 168, Y_WARN = 214, OVER_LIMIT = 2.0;

  const TIERS = [
    { name: '纳米芯片', r: 15, c: '#5fd0ff' },
    { name: '能量电池', r: 21, c: '#35e0c0' },
    { name: '武器模块', r: 27, c: '#7cff8a' },
    { name: '激光炮台', r: 34, c: '#ffd24a' },
    { name: '攻击无人机', r: 42, c: '#ff9d3a' },
    { name: '星际战机', r: 51, c: '#ff6a3a' },
    { name: '护卫舰', r: 61, c: '#ff4d7a' },
    { name: '驱逐舰', r: 72, c: '#ff3ea0' },
    { name: '巡洋舰', r: 85, c: '#c86bff' },
    { name: '战列舰', r: 100, c: '#8391ff' },
    { name: '母舰', r: 118, c: '#ffe66a' }
  ];
  const VALUE = [1, 3, 6, 12, 25, 50, 100, 200, 400, 800, 1600];
  const DROP_POOL = [0, 0, 0, 0, 0, 1, 1, 1, 2, 3];
  const DEPLOY_MIN = 4;   // tier 索引 >=4（即5级攻击无人机起）可上阵
  const FLEET_CAP = 6;

  // 战斗基础属性（按 tier 索引，4..10 有效）
  const B_HP  = [0, 0, 0, 0, 200, 350, 600, 1000, 1700, 2900, 5000];
  const B_ATK = [0, 0, 0, 0, 30, 55, 95, 160, 270, 450, 750];
  const B_SPD = [1, 1, 1, 1, 1.2, 1.1, 1.0, 0.95, 0.9, 0.85, 0.8];

  const FAC = [ // 阵营
    { name: '帝国', c: '#ff9d00' },
    { name: '异星', c: '#ff2e5b' },
    { name: '机械', c: '#5fb0ff' },
    { name: '赛博', c: '#b06bff' }
  ];
  const CLS = [{ name: '突击' }, { name: '炮舰' }, { name: '无人机' }, { name: '辅助' }];

  const WAVES_PER_LEVEL = 3; // 2 普通 + 1 Boss

  // ================= 状态 =================
  let engine, world;
  let phase = 'PREP';       // PREP | BATTLE | RESULT | GAMEOVER
  let current = null, nextTier = 0, canDrop = false;
  let score = 0, gold = 0, level = 0, wave = 0;
  let bestTier = 0, over = false;
  let particles = [], beams = [], floats = [];
  let mergeQueue = [];
  let shake = 0;

  // 战斗态
  let pUnits = [], eUnits = [];
  let pBuffs = null, pSyn = [];
  let tacticalCd = 0, tacticalReady = false, battleTime = 0;
  let result = '';          // win | lose
  let bossName = '';

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
  const fireBtn = document.getElementById('fire');
  const resetBtn = document.getElementById('reset');
  const hintEl = document.getElementById('hint');

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pickDropTier = () => DROP_POOL[(Math.random() * DROP_POOL.length) | 0];

  // ================= 熔炉（备战） =================
  function initForge() {
    engine = Engine.create();
    engine.gravity.y = 1.0;
    engine.positionIterations = 10; engine.velocityIterations = 8;
    world = engine.world;
    const o = { isStatic: true, restitution: 0.1, friction: 0.4 }, t = 40;
    Composite.add(world, [
      Bodies.rectangle((CT.left + CT.right) / 2, CT.floor + t / 2, (CT.right - CT.left) + 40, t, o),
      Bodies.rectangle(CT.left - t / 2, (CT.top + CT.floor) / 2, t, (CT.floor - CT.top) + 200, o),
      Bodies.rectangle(CT.right + t / 2, (CT.top + CT.floor) / 2, t, (CT.floor - CT.top) + 200, o)
    ]);
    Events.on(engine, 'collisionStart', onCollide);
  }

  function spawnCurrent() {
    const tier = nextTier; nextTier = pickDropTier();
    current = { tier, x: W / 2 }; canDrop = true; updateUI();
  }
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
      if (a.gTier === undefined || b.gTier === undefined) continue;
      if (a.merging || b.merging || a.gTier !== b.gTier || a.gTier >= TIERS.length - 1) continue;
      a.merging = b.merging = true; mergeQueue.push([a, b]);
    }
  }
  function processMerges() {
    for (const [a, b] of mergeQueue) {
      const nx = (a.position.x + b.position.x) / 2, ny = (a.position.y + b.position.y) / 2, nt = a.gTier + 1;
      Composite.remove(world, a); Composite.remove(world, b);
      addBall(nt, nx, ny, -1.5);
      score += VALUE[nt]; bestTier = Math.max(bestTier, nt);
      burst(nx, ny, TIERS[nt].c, 8 + nt);
      if (nt >= 6) shake = Math.min(shake + nt * 0.6, 10);
    }
    mergeQueue.length = 0; if (mergeQueue.length === 0) updateUI();
  }
  function deployables() { return Composite.allBodies(world).filter(b => b.gTier >= DEPLOY_MIN); }
  function checkOverflow(dt) {
    for (const b of Composite.allBodies(world)) {
      if (b.gTier === undefined || performance.now() - b.born < 400) continue;
      if (b.position.y - b.circleRadius < Y_WARN && b.speed < 1.3) b.overTime += dt; else b.overTime = 0;
      if (b.overTime > OVER_LIMIT) { phase = 'GAMEOVER'; over = true; current = null; updateUI(); hintEl.textContent = '熔炉过载！点击「重新开始」'; return; }
    }
  }
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) { const a = rand(0, 7), s = rand(1, 5); particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color, r: rand(2, 4) }); }
  }

  // ================= 部署 → 组建舰队 =================
  function deploy() {
    if (phase !== 'PREP') return;
    let dep = deployables();
    if (dep.length === 0) { flashHint('还没有可上阵的战舰（需合成到5级“攻击无人机”以上）'); return; }
    dep.sort((a, b) => b.gTier - a.gTier);
    const chosen = dep.slice(0, FLEET_CAP);
    pUnits = chosen.map(b => mkUnit(b.gTier, b.fac, b.cls, 'p'));
    for (const b of chosen) Composite.remove(world, b);
    current = null; canDrop = false;

    // 羁绊
    const s = computeSynergy(pUnits); pBuffs = s.buffs; pSyn = s.active;
    applyBuffs(pUnits, pBuffs);
    // 召唤援军
    for (let i = 0; i < pBuffs.summonMech; i++) pUnits.push(mkSummon('mech'));
    for (let i = 0; i < pBuffs.summonDrone; i++) pUnits.push(mkSummon('drone'));
    if (pUnits.length > FLEET_CAP + 4) pUnits = pUnits.slice(0, FLEET_CAP + 4);

    eUnits = genEnemies(level, wave);
    layout(pUnits, false); layout(eUnits, true);
    tacticalReady = true; tacticalCd = 0; battleTime = 0;
    phase = 'BATTLE'; updateUI();
    hintEl.textContent = '自动战斗中… 羁绊已生效，必要时放「战术技」';
  }

  function mkUnit(tier, fac, cls, team) {
    return { tier, star: 1, fac, cls, team, isBoss: false, summon: false,
      maxHp: B_HP[tier], hp: B_HP[tier], atk: B_ATK[tier], spd: B_SPD[tier],
      timer: 0, front: false, x: 0, y: 0, shield: 0, revived: false, alive: true };
  }
  function mkSummon(kind) {
    const u = mkUnit(4, kind === 'mech' ? 2 : 3, 2, 'p');
    u.summon = true; u.maxHp = u.hp = kind === 'mech' ? 160 : 110; u.atk = kind === 'mech' ? 22 : 18; u.spd = 1.4;
    return u;
  }

  function computeSynergy(units) {
    const fc = [0, 0, 0, 0], cc = [0, 0, 0, 0];
    for (const u of units) { if (u.summon) continue; fc[u.fac]++; cc[u.cls]++; }
    const b = { atkMul: 1, spdMul: 1, crit: 0, dmgMul: 1, frontRed: 0, regen: 0, shieldPct: 0, revive: false, splash: false, summonMech: 0, summonDrone: 0, heal: 0, active: true };
    const active = [];
    const chip = (name, n, c) => active.push({ t: name + '×' + n, c });
    // 阵营
    if (fc[0] >= 2) { b.atkMul *= fc[0] >= 4 ? 1.35 : 1.15; chip('帝国', fc[0], FAC[0].c); }
    if (fc[1] >= 2) { b.regen += 0.02; if (fc[1] >= 4) b.revive = true; chip('异星', fc[1], FAC[1].c); }
    if (fc[2] >= 2) { b.shieldPct = fc[2] >= 4 ? 0.25 : 0.10; if (fc[2] >= 4) b.summonMech = 2; chip('机械', fc[2], FAC[2].c); }
    if (fc[3] >= 2) { b.crit = 0.2; if (fc[3] >= 4) b.spdMul *= 1.4; chip('赛博', fc[3], FAC[3].c); }
    // 舰种
    if (cc[0] >= 2) { b.frontRed = cc[0] >= 4 ? 0.4 : 0.2; chip('突击', cc[0], '#dfe8f5'); }
    if (cc[1] >= 2) { b.dmgMul *= 1.25; if (cc[1] >= 4) b.splash = true; chip('炮舰', cc[1], '#dfe8f5'); }
    if (cc[2] >= 2) { b.summonDrone = cc[2] >= 4 ? 3 : 1; chip('无人机', cc[2], '#dfe8f5'); }
    if (cc[3] >= 2) { b.heal = 0.02; chip('辅助', cc[3], '#dfe8f5'); }
    return { buffs: b, active };
  }
  function applyBuffs(units, b) {
    for (const u of units) {
      u.atk = Math.round(u.atk * b.atkMul * b.dmgMul);
      u.spd *= b.spdMul;
      u.shield = Math.round(u.maxHp * b.shieldPct);
    }
  }

  function genEnemies(lv, wv) {
    const isBoss = wv === WAVES_PER_LEVEL - 1;
    const arr = [];
    if (isBoss) {
      bossName = ['海盗母舰·秃鹫号', '机械泰坦·铁卫', '虫族女皇', '叛变AI·零号意志', '歼星舰·万王之王'][Math.min(lv, 4)];
      const boss = mkEnemy(1500 * (1 + 0.5 * lv), 60 * (1 + 0.45 * lv), 0.85);
      boss.isBoss = true; boss.name = bossName; arr.push(boss);
      const adds = lv >= 1 ? 2 : 1;
      for (let i = 0; i < adds; i++) arr.push(mkEnemy(320 * (1 + 0.4 * lv), 26 * (1 + 0.4 * lv), 1.0));
    } else {
      const n = Math.min(5, 3 + lv);
      for (let i = 0; i < n; i++) arr.push(mkEnemy(240 * (1 + 0.42 * lv) * (1 + 0.25 * wv), 24 * (1 + 0.38 * lv), 1.0));
    }
    return arr;
  }
  function mkEnemy(hp, atk, spd) {
    return { team: 'e', enemy: true, isBoss: false, summon: false, maxHp: hp, hp, atk, spd,
      timer: 0, front: false, x: 0, y: 0, shield: 0, revived: false, alive: true, tier: 6 };
  }

  function layout(units, isEnemy) {
    const alive = units.filter(u => u.alive);
    // 前排：Boss 或 血量最高的一半
    alive.sort((a, b) => b.maxHp - a.maxHp);
    const frontN = Math.max(1, Math.ceil(alive.length / 2));
    alive.forEach((u, i) => { u.front = i < frontN; });
    const rowY = isEnemy ? { front: 258, back: 176 } : { front: 470, back: 560 };
    const place = (list, y) => {
      const k = list.length; const x0 = CT.left + 42, x1 = CT.right - 42;
      list.forEach((u, i) => { u.x = k === 1 ? W / 2 : x0 + (x1 - x0) * i / (k - 1); u.y = y; });
    };
    place(alive.filter(u => u.front), rowY.front);
    place(alive.filter(u => !u.front), rowY.back);
  }

  // ================= 自动战斗 =================
  function enemyOf(u) { return u.team === 'p' ? eUnits : pUnits; }
  function pickTarget(u) {
    const foes = enemyOf(u).filter(f => f.alive);
    if (!foes.length) return null;
    const front = foes.filter(f => f.front);
    const pool = front.length ? front : foes;
    return pool[(Math.random() * pool.length) | 0];
  }
  function doAttack(u) {
    const t = pickTarget(u); if (!t) return;
    const crit = u.team === 'p' && Math.random() < pBuffs.crit;
    let dmg = u.atk * (crit ? 1.5 : 1);
    hit(t, dmg, u); beam(u, t, crit);
    if (u.team === 'p' && pBuffs.splash) {
      const others = eUnits.filter(f => f.alive && f !== t);
      if (others.length) hit(others[(Math.random() * others.length) | 0], dmg * 0.5, u);
    }
  }
  function hit(t, dmg, from) {
    if (t.front && t.team === 'p' && pBuffs) dmg *= (1 - pBuffs.frontRed);
    dmg = Math.round(dmg);
    if (t.shield > 0) { const a = Math.min(t.shield, dmg); t.shield -= a; dmg -= a; }
    t.hp -= dmg;
    floats.push({ x: t.x + rand(-6, 6), y: t.y - 14, t: '-' + Math.max(1, dmg), life: 0.9, color: t.team === 'e' ? '#ffe08a' : '#ff9db0', sz: 13 });
    if (t.hp <= 0) {
      if (t.team === 'p' && pBuffs && pBuffs.revive && !t.revived) { t.revived = true; t.hp = t.maxHp * 0.5; }
      else { t.alive = false; burst(t.x, t.y, t.team === 'e' ? '#ff6a6a' : '#8fd8ff', 12); }
    }
  }
  function beam(u, t, crit) {
    beams.push({ x1: u.x, y1: u.y, x2: t.x, y2: t.y, life: 0.9,
      c: u.team === 'p' ? (crit ? '#fff2a0' : '#7cf3ff') : '#ff6a6a' });
  }
  function tactical() {
    if (phase !== 'BATTLE' || !tacticalReady) return;
    const totalAtk = pUnits.filter(u => u.alive).reduce((s, u) => s + u.atk, 0);
    const foes = eUnits.filter(f => f.alive);
    const each = Math.round(totalAtk * 2.4 / Math.max(1, foes.length));
    for (const f of foes) { hit(f, each, null); }
    for (let i = 0; i < 10; i++) beams.push({ x1: rand(CT.left, CT.right), y1: 620, x2: rand(CT.left, CT.right), y2: 200, life: 0.7, c: '#ff2e88' });
    shake = 10; tacticalReady = false; tacticalCd = 8; updateUI();
  }

  function updateBattle(dt) {
    if (phase !== 'BATTLE') return;
    if (tacticalCd > 0) { tacticalCd -= dt; if (tacticalCd <= 0) { tacticalCd = 0; tacticalReady = true; updateUI(); } }
    const all = pUnits.concat(eUnits);
    for (const u of all) {
      if (!u.alive) continue;
      // 攻击
      u.timer += dt;
      if (u.timer >= 1 / u.spd) { u.timer = 0; doAttack(u); }
      // 玩家羁绊：再生 / 治疗
      if (u.team === 'p' && pBuffs) {
        if (pBuffs.regen) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * pBuffs.regen * dt);
      }
    }
    if (pBuffs && pBuffs.heal) {
      const alive = pUnits.filter(u => u.alive);
      if (alive.length) { alive.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp); const t = alive[0]; t.hp = Math.min(t.maxHp, t.hp + t.maxHp * pBuffs.heal * dt); }
    }
    // 结束判定
    battleTime += dt;
    if (!eUnits.some(u => u.alive)) endBattle('win');
    else if (!pUnits.some(u => u.alive)) endBattle('lose');
    else if (battleTime > 25) {   // 超时：按剩余血量比拼
      const pf = pUnits.reduce((s, u) => s + Math.max(0, u.hp), 0) / pUnits.reduce((s, u) => s + u.maxHp, 0);
      const ef = eUnits.reduce((s, u) => s + Math.max(0, u.hp), 0) / eUnits.reduce((s, u) => s + u.maxHp, 0);
      endBattle(pf >= ef ? 'win' : 'lose');
    }
  }
  function endBattle(r) {
    if (phase !== 'BATTLE') return;
    result = r; phase = 'RESULT';
    if (r === 'win') {
      const isBoss = wave === WAVES_PER_LEVEL - 1;
      gold += isBoss ? 30 + level * 5 : 10 + level * 2;
      hintEl.textContent = '胜利！点击「' + (isBoss ? '进入下一星区' : '下一波') + '」继续';
    } else {
      hintEl.textContent = '舰队覆灭，回熔炉重整旗鼓再战';
    }
    updateUI();
  }
  function nextAfterWin() {
    if (wave === WAVES_PER_LEVEL - 1) { level++; wave = 0; } else { wave++; }
    pUnits = []; eUnits = []; phase = 'PREP'; spawnCurrent();
    hintEl.textContent = '备战：合成战舰，凑齐羁绊再「部署出战」';
  }
  function retryWave() {
    pUnits = []; eUnits = []; phase = 'PREP'; spawnCurrent();
    hintEl.textContent = '备战：重整旗鼓，重新合成部署';
  }

  // ================= UI 按钮 =================
  function updateUI() {
    if (phase === 'PREP') {
      const n = deployables().length;
      fireBtn.textContent = '部署出战（' + n + '）'; fireBtn.disabled = n === 0;
      fireBtn.style.borderColor = '#00e5ff'; fireBtn.style.color = '#8fe8ff';
      resetBtn.textContent = '重新开始'; resetBtn.style.display = '';
    } else if (phase === 'BATTLE') {
      fireBtn.textContent = tacticalReady ? '⚡ 战术技·全体齐射' : '战术技冷却 ' + Math.ceil(tacticalCd) + 's';
      fireBtn.disabled = !tacticalReady;
      fireBtn.style.borderColor = '#ff2e88'; fireBtn.style.color = '#ff9dc4';
      resetBtn.style.display = '';
    } else if (phase === 'RESULT') {
      fireBtn.disabled = false;
      if (result === 'win') { fireBtn.textContent = (wave === WAVES_PER_LEVEL - 1 ? '进入下一星区 ▶' : '下一波 ▶'); fireBtn.style.borderColor = '#7cf3ff'; fireBtn.style.color = '#aef5ff'; }
      else { fireBtn.textContent = '重试本波 ↻'; fireBtn.style.borderColor = '#ffb43d'; fireBtn.style.color = '#ffd08a'; }
      resetBtn.style.display = '';
    } else if (phase === 'GAMEOVER') {
      fireBtn.disabled = true; fireBtn.textContent = '—';
    }
  }
  let hintTimer = 0;
  function flashHint(t) { hintEl.textContent = t; hintTimer = 2; }

  fireBtn.addEventListener('click', () => {
    if (phase === 'PREP') deploy();
    else if (phase === 'BATTLE') tactical();
    else if (phase === 'RESULT') { result === 'win' ? nextAfterWin() : retryWave(); }
  });
  resetBtn.addEventListener('click', startRun);
  function pointerX(e) { const r = cv.getBoundingClientRect(); const cx = e.touches ? e.touches[0].clientX : e.clientX; return (cx - r.left) / r.width * W; }
  cv.addEventListener('pointermove', e => { if (phase === 'PREP' && current) current.x = pointerX(e); });
  cv.addEventListener('pointerdown', e => { if (phase === 'PREP' && current) { current.x = pointerX(e); dropCurrent(); } });

  // ================= 渲染 =================
  function draw() {
    let sx = 0, sy = 0;
    if (shake > 0.2) { sx = rand(-shake, shake); sy = rand(-shake, shake); shake *= 0.85; } else shake = 0;
    ctx.save(); ctx.translate(sx, sy);
    ctx.fillStyle = '#070c16'; ctx.fillRect(-12, -12, W + 24, H + 24);
    drawGrid();
    if (phase === 'PREP' || phase === 'GAMEOVER') drawForge();
    else drawArena();
    drawTopHud();
    drawParticles(); drawBeams(); drawFloats();
    if (phase === 'RESULT') drawResult();
    if (phase === 'GAMEOVER') drawOver();
    ctx.restore();
  }
  function drawGrid() {
    ctx.strokeStyle = '#0e1830'; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }
  function drawTopHud() {
    ctx.textAlign = 'left'; ctx.fillStyle = '#7cf3ff'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText('星区 ' + (level + 1) + ' · 第 ' + (wave + 1) + '/' + WAVES_PER_LEVEL + ' 波', CT.left, 30);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffd08a';
    ctx.fillText('💰 ' + gold + '   分数 ' + score, CT.right, 30);
    ctx.textAlign = 'left';
    // 羁绊 chips（PREP 预览 / BATTLE 生效中）
    const syn = phase === 'BATTLE' ? pSyn : previewSyn();
    let x = CT.left, y = 44;
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#6f88a8'; ctx.fillText(phase === 'BATTLE' ? '羁绊生效：' : '当前羁绊：', x, y + 10); x += 66;
    if (!syn.length) { ctx.fillStyle = '#3f5f7a'; ctx.fillText('（凑齐同阵营/舰种×2激活）', x, y + 10); }
    for (const s of syn) {
      const w = ctx.measureText(s.t).width + 14;
      if (x + w > CT.right) break;
      ctx.fillStyle = '#101d33'; ctx.strokeStyle = s.c; ctx.lineWidth = 1;
      roundRect(x, y, w, 16, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = s.c; ctx.fillText(s.t, x + 7, y + 11); x += w + 5;
    }
  }
  function previewSyn() { const u = deployables().map(b => ({ fac: b.fac, cls: b.cls })); return computeSynergy(u).active; }

  // ---- 熔炉 ----
  function drawForge() {
    // 提示区（下一个）
    ctx.fillStyle = '#6f88a8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('下一个：' + TIERS[nextTier].name, CT.left, 76);
    ctx.textAlign = 'right'; ctx.fillStyle = '#8fb4d6';
    ctx.fillText('部署上限 ' + FLEET_CAP + ' 艘 · 5级起可上阵', CT.right, 76); ctx.textAlign = 'left';
    // 警戒线
    ctx.strokeStyle = '#ff5a5a'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.4; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(CT.left, Y_WARN); ctx.lineTo(CT.right, Y_WARN); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff7a7a'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('过载线', CT.right - 2, Y_WARN - 4); ctx.textAlign = 'left';
    // 壁
    ctx.strokeStyle = '#274063'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(CT.left, CT.top); ctx.lineTo(CT.left, CT.floor); ctx.lineTo(CT.right, CT.floor); ctx.lineTo(CT.right, CT.top); ctx.stroke();
    // 球
    for (const b of Composite.allBodies(world)) { if (b.gTier === undefined) continue; drawBall(b.position.x, b.position.y, b.gTier, b.angle, b.fac, b.cls); }
    if (current && phase === 'PREP') {
      const r = TIERS[current.tier].r, x = clamp(current.x, CT.left + r, CT.right - r);
      ctx.globalAlpha = 0.3; ctx.strokeStyle = '#8fe8ff'; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(x, Y_DROP + r); ctx.lineTo(x, CT.floor); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1; drawBall(x, Y_DROP, current.tier, 0);
    }
  }
  function drawBall(x, y, tier, ang, fac, cls) {
    const t = TIERS[tier], r = t.r, tagged = fac !== undefined && tier >= DEPLOY_MIN;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, t.c); g.addColorStop(1, shade(t.c, -0.45));
    ctx.shadowColor = t.c; ctx.shadowBlur = 12; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    // 阵营环（可上阵战舰）
    if (tagged) { ctx.strokeStyle = FAC[fac].c; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, 7); ctx.stroke(); }
    else { ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); }
    ctx.rotate(-(ang || 0));
    ctx.fillStyle = '#08131f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.max(9, Math.min(15, r * 0.4)) + 'px sans-serif';
    if (r >= 22) ctx.fillText(t.name, 0, tagged ? -5 : 0);
    else ctx.fillText((tier + 1), 0, 0);
    if (tagged && r >= 22 && cls !== undefined) { ctx.fillStyle = '#08131f'; ctx.font = 'bold 9px sans-serif'; ctx.fillText(FAC[fac].name + '·' + CLS[cls].name, 0, 10); }
    ctx.textBaseline = 'alphabetic'; ctx.restore();
  }

  // ---- 战斗场 ----
  function drawArena() {
    // 分割
    ctx.strokeStyle = '#16263f'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(0, 372); ctx.lineTo(W, 372); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#5a2130'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('▲ 敌军', CT.left, 366);
    ctx.fillStyle = '#1f5a6a'; ctx.textAlign = 'right'; ctx.fillText('我方舰队 ▼', CT.right, 366); ctx.textAlign = 'left';
    for (const u of eUnits) if (u.alive) drawUnit(u);
    for (const u of pUnits) if (u.alive) drawUnit(u);
  }
  function drawUnit(u) {
    const enemy = u.team === 'e';
    const r = u.isBoss ? 40 : (u.summon ? 14 : 16 + u.tier * 1.6);
    const col = enemy ? (u.isBoss ? '#ff3b5c' : '#ff6a6a') : FAC[u.fac].c;
    ctx.save(); ctx.translate(u.x, u.y);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, col); g.addColorStop(1, shade(col, -0.5));
    ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.fillStyle = g;
    if (enemy) { // 敌军画成朝下三角/菱形
      ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(r, -r * 0.7); ctx.lineTo(-r, -r * 0.7); ctx.closePath(); ctx.fill();
    } else { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); }
    ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffffbb'; ctx.lineWidth = 1.5;
    if (enemy) { ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(r, -r * 0.7); ctx.lineTo(-r, -r * 0.7); ctx.closePath(); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); }
    // 护盾
    if (u.shield > 0) { ctx.strokeStyle = '#7cf3ff'; ctx.globalAlpha = 0.7; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.restore();
    // 血条
    const bw = Math.max(26, r * 1.8), bx = u.x - bw / 2, by = u.y - r - 12;
    ctx.fillStyle = '#0c1424'; ctx.fillRect(bx, by, bw, 5);
    ctx.fillStyle = enemy ? '#ff4d6a' : '#49e08a'; ctx.fillRect(bx, by, bw * clamp(u.hp / u.maxHp, 0, 1), 5);
    if (u.shield > 0) { ctx.fillStyle = '#7cf3ff'; ctx.fillRect(bx, by - 3, bw * clamp(u.shield / u.maxHp, 0, 1), 2); }
    // 标签
    if (!u.summon) {
      ctx.fillStyle = enemy ? '#ffb0bb' : '#dfeaf7'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
      const lbl = u.isBoss ? u.name : (enemy ? '敌舰' : FAC[u.fac].name + CLS[u.cls].name);
      ctx.fillText(lbl, u.x, u.y + r + 12); ctx.textAlign = 'left';
    }
  }

  function drawResult() {
    ctx.fillStyle = 'rgba(4,8,16,0.72)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center';
    if (result === 'win') {
      ctx.fillStyle = '#7cf3ff'; ctx.font = 'bold 34px sans-serif'; ctx.fillText('战斗胜利', W / 2, H / 2 - 30);
      ctx.fillStyle = '#ffd08a'; ctx.font = '16px sans-serif';
      ctx.fillText(wave === WAVES_PER_LEVEL - 1 ? '★ 星区 Boss 已击破！' : '本波清剿完成', W / 2, H / 2 + 4);
      ctx.fillStyle = '#aef5ff'; ctx.fillText('金币 +' + (wave === WAVES_PER_LEVEL - 1 ? 30 + level * 5 : 10 + level * 2), W / 2, H / 2 + 30);
    } else {
      ctx.fillStyle = '#ff5a7a'; ctx.font = 'bold 34px sans-serif'; ctx.fillText('舰队覆灭', W / 2, H / 2 - 30);
      ctx.fillStyle = '#cfe0f2'; ctx.font = '15px sans-serif'; ctx.fillText('回熔炉重整旗鼓，凑更强的羁绊再战', W / 2, H / 2 + 6);
    }
    ctx.fillStyle = '#6f88a8'; ctx.font = '12px sans-serif'; ctx.fillText('点击下方按钮继续', W / 2, H / 2 + 60); ctx.textAlign = 'left';
  }
  function drawOver() {
    ctx.fillStyle = 'rgba(4,8,16,0.82)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a7a'; ctx.font = 'bold 34px sans-serif'; ctx.fillText('熔炉过载', W / 2, H / 2 - 20);
    ctx.fillStyle = '#cfe0f2'; ctx.font = '17px sans-serif'; ctx.fillText('分数 ' + score + ' · 最高合成 ' + TIERS[bestTier].name, W / 2, H / 2 + 12);
    ctx.fillStyle = '#6f88a8'; ctx.font = '13px sans-serif'; ctx.fillText('点击「重新开始」', W / 2, H / 2 + 44); ctx.textAlign = 'left';
  }

  function drawParticles() { for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
  function drawBeams() { for (const b of beams) { ctx.globalAlpha = Math.max(0, b.life) * 0.85; ctx.strokeStyle = b.c; ctx.lineWidth = b.w || 2.4; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); } ctx.globalAlpha = 1; }
  function drawFloats() { ctx.textAlign = 'center'; for (const f of floats) { ctx.globalAlpha = clamp(f.life, 0, 1); ctx.fillStyle = f.color; ctx.font = 'bold ' + f.sz + 'px sans-serif'; ctx.fillText(f.t, f.x, f.y); } ctx.globalAlpha = 1; ctx.textAlign = 'left'; }

  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function shade(hex, p) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; r = clamp(Math.round(r * (1 + p)), 0, 255); g = clamp(Math.round(g * (1 + p)), 0, 255); b = clamp(Math.round(b * (1 + p)), 0, 255); return 'rgb(' + r + ',' + g + ',' + b + ')'; }

  // ================= 主循环 =================
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (phase === 'PREP') { Engine.update(engine, 1000 / 60); processMerges(); checkOverflow(dt); }
    else if (phase === 'BATTLE') updateBattle(dt);
    // 特效
    for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= dt * 1.6; }
    particles = particles.filter(p => p.life > 0);
    for (const b of beams) b.life -= dt * 2.2; beams = beams.filter(b => b.life > 0);
    for (const f of floats) { f.y -= 14 * dt; f.life -= dt * 0.9; } floats = floats.filter(f => f.life > 0);
    if (hintTimer > 0) { hintTimer -= dt; if (hintTimer <= 0 && phase === 'PREP') hintEl.textContent = '备战：合成战舰，凑齐羁绊再「部署出战」'; }
    draw(); requestAnimationFrame(loop);
  }

  function startRun() {
    if (world) Composite.clear(world, false);
    initForge();
    score = 0; gold = 0; level = 0; wave = 0; bestTier = 0; over = false;
    particles = []; beams = []; floats = []; mergeQueue = []; pUnits = []; eUnits = [];
    phase = 'PREP'; nextTier = pickDropTier(); spawnCurrent();
    hintEl.textContent = '备战：合成战舰（5级起带阵营/舰种），凑齐羁绊再「部署出战」';
    updateUI();
  }

  startRun();
  requestAnimationFrame(loop);
})();
