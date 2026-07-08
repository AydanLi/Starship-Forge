/* save.ts — 本地存档 + 防篡改校验 + 云同步接口预留（与 js/save.js 对应，存储走 platform）。 */
import { platform } from './platform';
import { G } from './state';
import { user } from './user';

const SALT = 'SF-proto-2026';   // 原型盐值；正式版删除，改由服务器端 HMAC 私钥签名
let lastWrite = 0;

function hash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
function KEY(): string { return 'starforge_save_v1:' + (user.uid() || 'guest'); }
function payload() {
  return { v: 1, level: G.level, wave: G.wave, gold: G.gold, score: G.score, bestTier: G.bestTier, maxLevel: G.maxLevel, seed: G.seed || 0, ts: platform.now() };
}

export const save = {
  write(force?: boolean): void {
    if (G.phase === 'LOGIN') return;                    // 登录页禁写，防覆盖他人档
    const now = platform.now();
    if (!force && now - lastWrite < 1000) return;
    lastWrite = now;
    const p = payload();
    platform.setItem(KEY(), JSON.stringify({ d: p, sum: hash(JSON.stringify(p) + SALT) }));
  },
  load(): { data?: any, tampered?: boolean } | null {
    const raw = platform.getItem(KEY());
    if (!raw) return null;
    try {
      const rec = JSON.parse(raw);
      if (hash(JSON.stringify(rec.d) + SALT) !== rec.sum) return { tampered: true };
      if (!rec.d || rec.d.v !== 1) return null;
      if (rec.d.maxLevel === undefined) rec.d.maxLevel = rec.d.level;
      return { data: rec.d };
    } catch (e) { return null; }
  },
  clear(): void { platform.removeItem(KEY()); },
  hasProgress(d: any): boolean { return !!d && (d.level > 0 || d.wave > 0 || d.gold > 0 || d.score > 0); }
  /* 云同步接口约定与 js/save.js 一致：remote.pull/push/verify，服务器 HMAC 权威档，
     登录后比对（本地 tampered→强制服务器档；双方有效→进度高者合并