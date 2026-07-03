/* save.js — 服务层：本地存档 + 防篡改校验 + 云同步接口预留。
   ── 防篡改说明（务必阅读）──────────────────────────────
   本地校验和（盐值在客户端）只能防“直接手改存档”的普通玩家，
   防不了逆向拿到盐值的人。真正的防线是未来的服务器：
   服务器用私钥对存档做 HMAC 签名并保存权威副本，客户端只验签、不持钥。
   本模块的存档结构（版本号 v / 数据 d / 校验和 sum / 时间戳 ts）
   即按该方案设计，接服务器时结构不变、只补 remote 实现。 */
window.SF = window.SF || {};
(function () {
  'use strict';
  const SALT = 'SF-proto-2026';   // 原型盐值；正式版删除，改由服务器端 HMAC 私钥签名
  let mem = null;                 // localStorage 不可用时的内存兜底（本次会话内有效）
  let lastWrite = 0;
  // 存档按用户 ID 分 key（多账号隔离）；未登录时落在 guest（LOGIN 阶段禁写，见 write）
  function KEY() { return 'starforge_save_v1:' + ((SF.user && SF.user.uid()) || 'guest'); }

  // djb2 哈希 → 十六进制校验和（轻量，防手改；非加密安全）
  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }
  function store() { try { return window.localStorage; } catch (e) { return null; } }
  function payload() {
    const G = SF.G;
    return { v: 1, level: G.level, wave: G.wave, gold: G.gold, score: G.score, bestTier: G.bestTier, maxLevel: G.maxLevel, ts: Date.now() };
  }

  SF.save = {
    /** 写档。默认 1 秒节流；force=true 立即写（关键进度点用）。LOGIN 阶段禁写，防止覆盖他人档。 */
    write(force) {
      if (SF.G && (SF.G.phase === 'LOGIN')) return;
      const now = Date.now();
      if (!force && now - lastWrite < 1000) return;
      lastWrite = now;
      const p = payload();
      const rec = JSON.stringify({ d: p, sum: hash(JSON.stringify(p) + SALT) });
      const s = store();
      if (s) { try { s.setItem(KEY(), rec); return; } catch (e) { /* 配额/隐私模式 */ } }
      mem = rec;
    },
    /** 读档。返回 {data} | {tampered:true} | null（无档/版本不符/解析失败）。 */
    load() {
      const s = store();
      let raw = null;
      if (s) { try { raw = s.getItem(KEY()); } catch (e) { raw = mem; } }
      if (!raw) raw = mem;
      if (!raw) return null;
      try {
        const rec = JSON.parse(raw);
        if (hash(JSON.stringify(rec.d) + SALT) !== rec.sum) return { tampered: true };  // 校验失败 → 疑似篡改
        if (!rec.d || rec.d.v !== 1) return null;   // 版本不符 → 未来在此做迁移
        if (rec.d.maxLevel === undefined) rec.d.maxLevel = rec.d.level;   // 旧档兼容
        return { data: rec.d };
      } catch (e) { return null; }
    },
    clear() { const s = store(); if (s) { try { s.removeItem(KEY()); } catch (e) {} } mem = null; },
    hasProgress(d) { return !!d && (d.level > 0 || d.wave > 0 || d.gold > 0 || d.score > 0); },

    /* ── 云同步接口预留（正式版实现）─────────────────────────
       登录流程约定：
         1. 登录成功后 remote.pull() 拉取服务器权威存档（服务器验签自己的 HMAC）；
         2. 本地 load()：若 tampered → 直接采用服务器档（本地视为作弊/损坏）；
         3. 双方均有效 → 比进度（level, wave, ts 依次比较），取高者；
            本地更新 → remote.push(rec) 上行，服务器重新签名落库；
         4. 无网络 → 本地档先用，标记 dirty，下次联网补推。
       抖音端替换点：localStorage → tt.setStorageSync / tt.getStorageSync；
                     网络 → tt.request 调自建服务或抖音云。
       占位（保持 null，接入时赋值实现）： */
    remote: null   // { pull(): Promise<rec|null>, push(rec): Promise<ok>, verify(rec): Promise<ok> }
  };

  window.addEventListener('beforeunload', () => SF.save.write(true));
})();
