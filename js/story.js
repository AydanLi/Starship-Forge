/* story.js — 系统层：剧情队列状态机。当前卡放在 G.story，render 负责绘制。 */
window.SF = window.SF || {};
(function () {
  'use strict';
  SF.storySys = {
    queue() { for (let i = 0; i < arguments.length; i++) if (arguments[i]) SF.G.storyQueue.push(arguments[i]); },
    advance() { SF.G.story = SF.G.storyQueue.shift() || null; if (SF.G.story) SF.audio.play('card'); SF.ui.update(); },
    active() { return !!SF.G.story; },
    bossCard(lv) {
      const i = Math.min(lv, 4), S = SF.STORY;
      return { tag: 'BOSS 来袭', title: S.BOSS_NAMES[i], color: '#ff3b5c', lines: ['「' + S.BOSS_NAMES[i] + '」：' + S.BOSS_TAUNT[i]] };
    }
  };
})();
