# 音效来源与授权

这里的 WAV 都是从下面这些素材处理出来的（第一批全是 **CC0**；第二批加了 **Mixkit**，授权见下）：解码、混成单声道、切掉首尾静音、截短、重采样到 22.05 kHz、统一响度（`tools/audio-prep.js`，`node tools/audio-export.mjs` 生成）。CC0 不要求署名，这里照样记下来源，方便以后查。

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

### 第二批：做游戏用的音效（2026-10-09 经用户同意下载）

用户觉得第一批不够好，要游戏化的枪炮、履带、发动机声。原始文件放在 `tools/out/audio-src/game2/`（Mixkit 和 Freesound 公开的试听版 mp3）。

- **Mixkit**（mixkit.co）：Mixkit Sound Effects Free License——可以用在商业游戏里，**不用署名**；不能把音效原样转卖或单独分发（放进游戏里用没问题）。
- **Freesound**：下面列出的都是 **CC0**。

| 来源 | 编号 / 作者 | 地址 | → 本目录 |
|---|---|---|---|
| Mixkit | 2809 Explosion in battle、2800 Bomb explosion in battle、1694 Short explosion、1687 Dramatic metal explosion impact | https://mixkit.co/free-sound-effects/explosion/ | `boom-0～3` |
| Mixkit | 2777 Massive explosion in battle、2782 Epic impact afar explosion | 同上 | `boom-big-0～1` |
| Freesound（CC0） | 127845 Tank fire Mixed（GaryQ）、162455 Cannonball（Kastenfrosch） | https://freesound.org/s/127845/、https://freesound.org/s/162455/ | `cannon-fire-0～1` |
| Mixkit | 1700 Gun explosion with long echo、2773 War explosions | https://mixkit.co/free-sound-effects/war/ | `cannon-fire-2～3` |
| Mixkit + Freesound（CC0） | Mixkit 1662 Game gun shot、Freesound 165390 Classic Gunshot（ShawnyBoy）、Mixkit 2186 Blast hit with echo | https://mixkit.co/free-sound-effects/gun/、https://freesound.org/s/165390/ | `cannon-small-0～2` |
| Mixkit | 2758 Explosive impact from afar、2801 Dense bomb impact、2186 Blast hit with echo | https://mixkit.co/free-sound-effects/explosion/ | `cannon-hit-0～2` |
| Freesound（CC0） | 165394 Heavy Machine Gun（ShawnyBoy）、380349 Machine Gun（fennelliott），各切两发单发 | https://freesound.org/s/165394/、https://freesound.org/s/380349/ | `gun-shot-0～3` |
| Freesound（CC0） | 396324 HeavyMachineGun（SuperPhat），切三发单发 | https://freesound.org/s/396324/ | `gun-heavy-0～2` |
| Mixkit | 2753 Tank engine working（0.6 s 起 4 s 做成循环） | https://mixkit.co/free-sound-effects/engine/ | `engine-idle-0` |
| Mixkit | 1628 Old train departure（37.55 s 起 1.9 s，10 下蒸汽喷吐做成循环） | https://mixkit.co/free-sound-effects/train/ | `engine-run-0` |
| Mixkit | 2858 Gear metallic lock sound、2857 Gear fast lock tap、2757 Metal tank gear shift（切短） | https://mixkit.co/free-sound-effects/metal/、/engine/ | `track-clank-0～3` |
| Mixkit + Kenney | Mixkit 2980 Factory metal hard hit、833 Metal hammer hit、783 Submarine metal impact；Kenney impactMetal_heavy_000 | https://mixkit.co/free-sound-effects/metal/ | `hit-metal-heavy-0～3` |

第一批里被第二批替换掉的（`boom`、`cannon-fire`、`cannon-hit`、`gun-shot`、`hit-metal-heavy` 的旧素材）不再使用，上表第一批对应的行只作历史记录。

名字和文件的对应以 `tools/audio-prep.js` 的 `MAP` 为准；游戏里按名字播放（`js/audio.js` 的 `BANK`）。
