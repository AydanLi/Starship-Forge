/* user.ts — 用户身份（与 js/user.js 对应）。★抖音正式版：login 换 tt.login→服务端换 openid。 */
import { platform } from './platform';

const KEY_LAST = 'starforge_last_uid';
let _uid: string | null = platform.getItem(KEY_LAST);

export const user = {
  uid(): string | null { return _uid; },
  name(): string | null { return _uid; },
  login(rawName: string): boolean {
    const n = String(rawName || '').trim();
    if (n.length < 2 || n.length > 12) return false;
    _uid = n; platform.setItem(KEY_LAST, _uid);
    return true;
  },
  guest(): string {
    _uid = '游客' + ((Math.random() * 900 + 100) | 0);
    platform.setItem(KEY_LAST, _uid);
    return _uid;
  },
  logout(): void { _uid = null; platform.removeItem(KEY_LAST); }
};
