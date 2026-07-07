# 《星舰熔炉》战舰美术 · AI 绘图提示词手册

> 用途：直接拿去 Midjourney / Stable Diffusion / 即梦 / 通义万相等工具生成游戏美术素材。每项含中文形态描述 + 可复制的英文提示词。英文提示词效果通常优于中文，建议优先用英文；国产工具可用文末的中文版。

> **本文档为帝国（金橙）整套合成链的原始提示词。** 异星 / 机械 / 赛博三阵营**并非**帝国整套的换色皮肤，而是各自单独出图、每阵营只做 **8 艘可部署舰（5～11 级 + 歼星旗舰彩蛋，共 8 张图）**。这三阵营的专属提示词、以及星区背景 / Boss / 杂兵，见配套文档 **《美术提示词_补充.md》**（位于 docs/）。

## 如何保证 11 级战舰（+彩蛋旗舰）风格统一（重要）

生成一整套素材最怕风格不一致。做法：**把下面这段「通用风格后缀」附加到每一个提示词的末尾**，锁定统一的画风、视角、光效和背景，只改前面的主体描述。

**通用风格后缀（英文，复制备用）：**

```
sci-fi game icon asset, front 3/4 isometric view, centered single object, clean hard-surface design, glossy metal with glowing neon energy lines, cyan and magenta rim light, dark deep-space background, subtle holographic details, cohesive art style, high detail, soft studio lighting, 2D game asset, no text, no watermark  --ar 1:1
```

**通用负面提示词（Stable Diffusion 用）：**

```
blurry, low-res, text, watermark, signature, extra objects, cluttered background, photorealistic human, messy, deformed, jpeg artifacts
```

生成建议：① 统一用 1:1 比例出图，方便当图标；② 需要透明背景可加 "isolated on solid black background" 再抠图，或用去背工具；③ 同一级多出几张挑最一致的；④ 想要成套感，可在 Midjourney 里对第一张满意图用 `--sref`（风格参考）串起后续所有级别。

---

## 一、11 级 + 终极战舰合成链

配色思路：低级偏冷灰工业感，随等级升高逐渐加入能量光效、体量和华丽度，母舰与旗舰要「一出现就想截图」。

### 1 级 · 纳米芯片
中文形态：一小块发光的方形电路芯片，青色电路纹路，微型科技感。
```
a tiny glowing square nano microchip, cyan circuit traces, small tech component, minimalist, [通用风格后缀]
```

### 2 级 · 能量电池
中文形态：青色六边形能量晶体电池，内部流动的能量。
```
a hexagonal energy cell battery, glowing cyan crystal core with flowing energy inside, sleek casing, [通用风格后缀]
```

### 3 级 · 武器模块
中文形态：带短枪管的核心组件，金属外壳 + 能量接口。
```
a compact sci-fi weapon module with a short barrel, metallic housing, energy port, industrial, [通用风格后缀]
```

### 4 级 · 激光炮台
中文形态：小型悬浮激光炮台，双联能量炮管，底部悬浮环。
```
a small hovering laser turret, twin energy cannons, floating anti-grav ring at base, glowing muzzle, [通用风格后缀]
```

### 5 级 · 攻击无人机（可上阵起点）
中文形态：三角形小型无人战机，锐利机翼，尾部推进蓝焰。
```
a small triangular combat drone, sharp swept wings, glowing blue thruster trail, agile unmanned fighter, [通用风格后缀]
```

### 6 级 · 星际战机
中文形态：流线型单座战机，尖锐机首，机翼挂载武器，驾驶舱透光。
```
a sleek single-seat starfighter, sharp pointed nose, wing-mounted weapons, glowing cockpit canopy, dynamic, [通用风格后缀]
```

### 7 级 · 护卫舰
中文形态：小型舰船，修长舰体，侧舷炮位，引擎双蓝焰。
```
a small sci-fi frigate warship, elongated hull, side gun batteries, twin glowing blue engines, [通用风格后缀]
```

### 8 级 · 驱逐舰
中文形态：中型战舰，更厚重的装甲，多组炮塔，舰桥结构清晰。
```
a mid-size sci-fi destroyer warship, heavier armor plating, multiple gun turrets, detailed bridge tower, imposing, [通用风格后缀]
```

### 9 级 · 巡洋舰
中文形态：大型战舰，宽厚舰体，密集炮阵，侧翼能量护盾发生器。
```
a large sci-fi cruiser warship, broad heavy hull, dense weapon arrays, glowing shield generators on flanks, powerful, [通用风格后缀]
```

### 10 级 · 战列舰
中文形态：巨型主力舰，超重装甲，主炮巨大，舰体流光能量线。
```
a massive sci-fi battleship, ultra-heavy armor, enormous main cannons, glowing energy lines across the hull, dominating capital ship, [通用风格后缀]
```

### 11 级 · 母舰（合成顶点）
中文形态：华丽的旗舰级母舰，巨型舰体带机库开口，无数细节，环绕能量光环，壮观。
```
a magnificent flagship carrier mothership, colossal hull with hangar bays, intricate details, surrounding energy halo, glowing engines, awe-inspiring capital ship, epic, [通用风格后缀]
```

### ★ 终极 · 歼星旗舰（彩蛋）
中文形态：超巨型歼星舰，末日级体量，全舰流光，主炮蓄能发白光，压迫感拉满。
```
a gigantic star destroyer flagship, apocalyptic scale, glowing energy flowing across entire hull, charging white-hot main cannon, overwhelming presence, ultimate warship, cinematic, [通用风格后缀]
```

---

## 二、四大阵营涂装风格（皮肤 / 变体）

同一艘战舰换阵营配色即可产出皮肤变体，也让玩家一眼识别羁绊。把阵营关键词加到战舰提示词里。

### 帝国舰队（攻击 · 金橙）
```
Empire faction paint scheme, gold and orange armor, imperial emblems, aggressive angular design, warm glowing accents
```

### 异星生体（再生 · 猩红）
```
Xeno bio-organic faction, crimson red, organic ribbed carapace armor, pulsating bio-luminescence, alien living-ship look
```

### 机械军团（护盾 · 银蓝）
```
Mech Legion faction, silver-blue metallic plating, geometric hard-surface panels, glowing blue shield emitters, cold mechanical
```

### 赛博幽影（暴击 · 霓紫）
```
Cyber Wraith faction, dark chrome with neon purple, sleek stealth angles, glitchy holographic accents, cyberpunk
```

---

## 三、场景与 UI 素材（附赠）

### 熔炉容器（曲率反应舱）
```
a vertical sci-fi containment chamber, holographic hexagonal frame, glowing energy borders, transparent core, futuristic forge machine, UI game container, dark background  --ar 3:4
```

### 星区一 · 残骸带（关卡背景）
```
deep space debris field background, floating broken spaceship wrecks, distant nebula, asteroids, dark blue cosmic atmosphere, sci-fi game background, wide  --ar 9:16
```

### 星区 Boss「秃鹫号」（海盗母舰）
```
a menacing space pirate carrier boss ship named Vulture, asymmetric scavenged armor, hooks and claws, red glowing eyes/sensors, intimidating, sci-fi game boss, dark background, epic  --ar 1:1
```

### 通关战报卡（分享用模板底图）
```
a sci-fi holographic report card UI frame, neon cyan and magenta border, dark background with grid, empty central area for fleet showcase, social share card, clean HUD style  --ar 3:4
```

---

## 四、中文工具版（即梦 / 通义万相 / 文心一格等）

国产模型用中文即可。**通用中文后缀**（附加到每条末尾）：

```
科幻游戏图标素材，3/4 等距视角，居中单个物体，硬表面工业设计，金属质感搭配霓虹能量线，青色与品红边缘光，深空黑背景，全息细节，统一画风，高细节，2D 游戏素材，无文字无水印，1:1 比例
```

示例（母舰）：`华丽的旗舰级母舰，巨型舰体带机库开口，环绕能量光环，发光引擎，壮观史诗，[通用中文后缀]`

其余各级把"母舰"替换为对应中文形态描述即可（见第一节每级的「中文形态」）。

---

## 五、落地建议

先只生成 1 级、5 级、11 级三张「关键锚点图」，确认整体画风你满意后，再用它作风格参考（Midjourney `--sref` 或 SD 的 IP-Adapter/参考图）批量补齐中间级别，成套感最好。图标类素材建议统一 512×512 或 1024×1024 输出、透明背景，方便直接进 Cocos。若预算允许，锚点图可请美术在 AI 稿基础上精修，保证商用授权与最终一致性。
