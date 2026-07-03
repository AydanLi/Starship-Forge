/* user.js — 服务层：用户身份（指挥官代号 = 用户ID）。
   原型：本地多账号，代号即 ID，记住上次登录；每个 ID 独立存档（见 save.js 按 uid 分 key）。
   ★ 抖音正式版替换点：login() 换成 tt.login() → 服务端换取 openid 作为 uid，
     代号改为抖音昵称或自定义昵称；本模块接口不变。 */
window.SF = window.SF || {};
(function () {
  'use strict';
  const KEY_LAST = 'starforge_last_uid';
  let uid = null;
  try { uid = localStorage.getItem(KEY_LAST) || null; } catch (e) {}

  SF.user = {
    uid() { return uid; },
    name() { return uid; },   // 原型：代号即 ID；接抖音后 uid=openid、name=昵称
    /** 登录。代号 2~12 字符；返回 true 成功。 */
    login(rawName) {
      const n = String(rawName || '').trim();
      if (n.length < 2 || n.length > 12) return false;
      uid = n;
      try { localStorage.setItem(KEY_LAST, uid); } catch (e) {}
      return true;
    },
    guest() {
      uid = '游客' + ((Math.random() * 900 + 100) | 0);
      try { localStorage.setItem(KEY_LAST, uid); } catch (e) {}
      return uid;
    },
    logout() { uid = null; try { localStorage.removeItem(KEY_LAST); } catch (e) {} }
  };
})();
