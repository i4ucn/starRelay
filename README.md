# 星光接力 · Star Relay

一束光从火卫二（直径 12 km）出发，**按直径从小到大**依次接力，经过 64 个天体、跳 63 次，最后到达史蒂文森 2-18（半径约 1,840 R☉），一轮约 61 秒。顺序是：卫星、小行星、矮行星、行星，然后是太阳，再飞出太阳系，经过银河系里的巨星，最后到达超巨星。

需求文档见 [prd.md](prd.md)。

## 打开

双击 `index.html` 即可，断网也能用。

| 参数 | 作用 |
|---|---|
| `?t=25` | 跳到第 25 秒并暂停（`?t=end` 跳到结尾）；加 `&play=1` 则从该时刻继续播放 |
| `?q=low` / `?q=high` | 强制低画质或高画质。默认自动：检测到软件渲染（没有 GPU）时切换到低画质 |
| `?speed=2` | 以 2 倍速播放 |

快捷键：空格暂停或继续，`R` 重播。鼠标拖动旋转视角，滚轮缩放。

## 开发

```powershell
npm install
npm run build        # 打包 src → dist/app.js（dist/app.js 已提交，双击即可运行）
npm run dev          # 监听源码改动，自动重新打包
npm run check        # 数据校验：64 个天体直径严格递增、分段连续、位置齐全，并打印接力顺序
npm run fetch-data   # 重新从 JPL Horizons 抓取太阳系位置（只在开发时用，会访问网络）
node scripts/serve.mjs   # 本地预览 http://localhost:5178
```

### 验收脚本

验收脚本用本机 Chrome 以无头模式、通过 `file://` 打开页面，截图保存到 `shots/`：

```powershell
node scripts/verify.mjs full              # 完整播放一轮，检查以下各项：
                                          #   - 控制台错误和外部请求
                                          #   - 接力顺序
                                          #   - 标签、列表、计数是否同帧更新
                                          #   - 光束亮度、总时长、终态
                                          #   - 帧率
node scripts/verify.mjs shots 5,25,36,end # 在固定时刻截图，并检查布局（1920×1080 和 1280×720 两种尺寸）
node scripts/verify.mjs fps               # 测量各画质下的帧率
```

页面在 `window.__relay` 上暴露接力顺序、时间轴、到达事件日志，以及 `seek`、`play`、`pause`、`replay`、`measureFps` 等方法，供自动化使用。

## 数据

| 内容 | 来源 |
|---|---|
| 太阳系天体位置 | JPL Horizons，2026-11-23 00:00 TDB 的日心坐标，存放在 `src/data/solar.json` |
| 行星直径 | NASA Planetary Fact Sheet（赤道直径） |
| 卫星直径 | JPL SSD 卫星物理参数表（平均半径 × 2） |
| 矮行星、小行星直径 | 逐个注明论文，见 `src/data/bodies.js` |
| 恒星半径、距离、坐标 | 英文 Wikipedia 信息框及其所引文献，2026-11-23 抓取，见 `src/data/stars.js`。超巨星半径的不确定性大，界面上标“约” |

显示时，距离按 √r 压缩（方向保持真实），天体半径按直径的 0.4 次方缩放。标签和列表里显示的都是真实数值。

## 结构

```
index.html / styles.css    页面骨架与样式
src/main.js                装配各模块、主循环，以及 window.__relay
src/data/                  天体数据、接力顺序、Horizons 位置
src/scene/                 渲染器与星空（world）、太阳系、银河、程序贴图
src/beam.js                光束、头部亮点、冲击环、当前目标的金圈
src/camera.js              镜头（对数距离平滑、上方向在黄道和银道之间过渡）
src/timeline.js            确定性时间轴（节奏先慢、加速、再放慢）
src/ui/                    顶部统计、左侧列表、3D 标签
scripts/                   数据抓取、校验、预览服务器、验收脚本
```
