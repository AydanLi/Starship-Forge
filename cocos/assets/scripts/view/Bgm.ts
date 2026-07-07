/* Bgm.ts — 背景音乐播放器（Cocos AudioSource）。
   加载 resources/audio/ 下的 bgm_*.mp3，每帧与 core/bgm.pickBgm() 对账：
   切曲时先淡出旧曲再切入新曲；静音跟随 core/audio（🔊 按钮）；
   某首音频缺失时静默跳过，不影响玩法（与 Tex 缺图回退矢量的策略一致）。 */
import { Node, AudioSource, AudioClip, resources } from 'cc';
import { audio } from '../core/audio';
import { pickBgm, BGM_KEYS } from '../core/bgm';

const VOL = 0.4;      // BGM 主音量（音效走 WebAudio 合成，互不影响）
const FADE_IN = 0.8;  // 淡入速率（音量/秒）
const FADE_OUT = 2.4; // 淡出速率（切曲更利落）

const CLIPS: Record<string, AudioClip> = {};
let src: AudioSource | null = null;
let curKey = '';           // 当前曲目（淡出完成前保持旧曲）
let curLoop = true;
let vol = 0;               // 实际音量（用于淡变）
let pausedByMute = false;

export function loadBgm(host: Node): void {
  const n = new Node('Bgm');
  host.addChild(n);
  src = n.addComponent(AudioSource);
  src.playOnAwake = false;
  let done = 0;
  for (const k of BGM_KEYS) {
    resources.load('audio/' + k, AudioClip, (err: any, clip: any) => {
      if (!err && clip) CLIPS[k] = clip;
      else console.warn('[Bgm] load fail:', k, err);
      if (++done === BGM_KEYS.length) console.log('[Bgm] loaded', Object.keys(CLIPS).length, '/', BGM_KEYS.length);
    });
  }
}

export function updateBgm(dt: number): void {
  if (!src) return;
  // 静音：暂停并压零；取消静音后同曲续播
  if (audio.muted) {
    if (src.playing) { src.pause(); pausedByMute = true; }
    vol = 0; src.volume = 0;
    return;
  }
  if (pausedByMute) { pausedByMute = false; if (src.clip) { try { src.play(); } catch (e) {} } }

  const want = pickBgm();
  const wantKey = (want && CLIPS[want.key]) ? want.key : '';
  if (wantKey !== curKey) {
    if (vol > 0.02 && src.playing) {           // 先淡出旧曲
      vol = Math.max(0, vol - FADE_OUT * dt);
      src.volume = vol;
      return;
    }
    src.stop(); curKey = wantKey; vol = 0;
    if (!curKey) return;
    curLoop = want!.loop;
    src.clip = CLIPS[curKey];
    src.loop = curLoop;
    try { src.play(); } catch (e) {}
  }
  if (!curKey) return;
  // 循环曲被浏览器手势策略拦下时持续补播；单次曲自然播完则不重播
  if (!src.playing && src.clip && curLoop) { try { src.play(); } catch (e) {} }
  vol = Math.min(VOL, vol + FADE_IN * dt);
  src.volume = vol;
}
