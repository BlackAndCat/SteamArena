# 音效来源与授权

这里的 WAV 都是从下面这些 **CC0（公有领域）** 素材处理出来的：解码、混成单声道、切掉首尾静音、截短、重采样到 22.05 kHz、统一响度（`tools/audio-prep.js`，`node tools/audio-export.mjs` 生成）。CC0 不要求署名，这里照样记下来源，方便以后查。

2026-10-06 经用户同意下载（`docs/feel-audio-plan.md` §3.1）。原始素材放在 `tools/out/audio-src/`，不进仓库；要重新生成，按下表重新下载、解压到同一目录即可。

| 来源 | 作者 | 下载 | 用到的文件 → 本目录 |
|---|---|---|---|
| Impact Sounds 1.0 | Kenney（kenney.nl） | https://kenney.nl/assets/impact-sounds | `impactWood_heavy`、`impactPlank_medium`、`impactTin_medium`、`impactMining`、`impactPlate_heavy`、`impactMetal_light / medium / heavy`、`impactPunch_heavy` → `crush-*`、`hit-*`、`ram-thud-*` |
| Sci-fi Sounds | Kenney | https://kenney.nl/assets/sci-fi-sounds | `explosionCrunch`、`lowFrequency_explosion` → `boom-*`、`boom-big-*` |
| RPG Audio | Kenney | https://kenney.nl/assets/rpg-audio | `handleCoins`、`handleCoins2`、`metalLatch`、`metalClick` → `scrap-pickup-*`、`chain-*` |
| UI Audio | Kenney | https://kenney.nl/assets/ui-audio | `click1～3`、`switch2 / 3 / 7` → `ui-click-*`、`ui-switch-*` |
| Interface Sounds | Kenney | https://kenney.nl/assets/interface-sounds | `confirmation_001`、`error_001` → `ui-confirm-0`、`ui-error-0` |
| Cannon fire | Thimras（OpenGameArt） | https://opengameart.org/content/cannon-fire | `cannon_fire_0.ogg` → `cannon-fire-0` |
| Battle at sea | Thimras（OpenGameArt） | https://opengameart.org/node/136787 | `cannon_hit_1`、`cannon_hit_cannon_1`、`cannon_hit_ship_short` → `cannon-hit-*` |
| 25 CC0 bang / firework SFX | rubberduck（OpenGameArt） | https://opengameart.org/node/92774 | `cannon_01～03` → `cannon-fire-1～3`；`shot_01～03`、`bang_01` → `gun-shot-*` |
| Steam release sounds | bart（OpenGameArt） | https://opengameart.org/content/steam-release-sounds | `steam hisses - Marker #1～3` → `steam-hiss-*` |

名字和文件的对应以 `tools/audio-prep.js` 的 `MAP` 为准；游戏里按名字播放（`js/audio.js` 的 `BANK`）。
