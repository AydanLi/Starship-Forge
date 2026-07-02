# -*- coding: utf-8 -*-
"""构建单文件版：把 lib + js/ 模块按依赖顺序内联进 index.html。
用法：python build.py  → 生成 星舰熔炉_单文件可玩.html
新增模块时：更新下面的 MODULES 列表（顺序须与 index.html 一致）。"""
import re, io

MODULES = [
    'js/config.js', 'js/story-data.js', 'js/state.js', 'js/save.js',
    'js/fx.js', 'js/synergy.js', 'js/fleet.js',
    'js/forge.js', 'js/board.js', 'js/battle.js',
    'js/economy.js', 'js/ads.js', 'js/story.js',
    'js/render.js', 'js/ui.js', 'js/input.js', 'js/main.js',
]

def read(p):
    with io.open(p, encoding='utf-8') as f:
        return f.read()

html = read('index.html')
matter = read('lib/matter.min.js')
bundle = '\n'.join(read(m) for m in MODULES)

html = html.replace('<script src="lib/matter.min.js"></script>',
                    '<script>\n' + matter + '\n</script>')
# 去掉所有 js/ 模块标签（含注释行），替换为一个内联 bundle
html = re.sub(r'<!-- 模块加载顺序[^\n]*-->\n', '', html)
html = re.sub(r'(<script src="js/[^"]+"></script>\n?)+',
              '<script>\n' + bundle.replace('\\', '\\\\') + '\n</script>\n', html, count=1)

with io.open('星舰熔炉_单文件可玩.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('built 星舰熔炉_单文件可玩.html:', len(html), 'bytes')
