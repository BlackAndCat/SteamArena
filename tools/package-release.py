"""将发行分支打包成只含游戏运行文件的静态目录和 ZIP。"""

from pathlib import Path
import re
import shutil
from zipfile import ZipFile, ZIP_DEFLATED


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tools" / "out"
DEST = OUT / "release"
ARCHIVE = OUT / "release.zip"

# 显式列出可进入发行包的脚本；新增脚本时必须检查其运行用途。
SCRIPTS = (
    "release.js", "text-manager.js", "yard-chat.js", "palette.js", "coal.js",
    "modules.js", "module-art.js", "dynamics.js", "sprites.js", "ui-px.js",
    "legs.js", "vehicle.js", "content.js", "stage-cars.js", "state.js",
    "ui.js", "camp.js", "camp-ui.js", "story.js", "story-dev.js",
    "editor.js", "blueprints.js", "street.js", "arena.js", "home-scene.js",
    "home.js", "terrain-art.js", "scenes.js", "battle-view.js", "battle.js",
    "build-sys.js", "build-vis.js", "main.js",
)
FILES = ("index.html", "css/style.css", "text/steam-arena/zh-CN.json") + tuple(
    f"js/{name}" for name in SCRIPTS
)


def main():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    loaded = re.findall(r'<script\s+src="([^"]+)"', html)
    expected = [f"js/{name}" for name in SCRIPTS if name != "stage-cars.js"]
    if loaded != expected:
        raise SystemExit("index.html 的脚本列表或顺序与发行白名单不一致")
    if not re.search(r'<link\s+rel="stylesheet"\s+href="css/style.css"', html):
        raise SystemExit("index.html 未引用发行白名单中的样式")

    # 清理前核对所有输出路径的最终位置，避免目录链接把递归删除引到工作树外。
    fixed_out = ROOT.resolve() / "tools" / "out"
    if (OUT.is_symlink() or OUT.resolve() != fixed_out
            or DEST.is_symlink() or DEST.resolve() != fixed_out / "release"
            or ARCHIVE.is_symlink() or ARCHIVE.resolve() != fixed_out / "release.zip"):
        raise SystemExit("发行输出路径不在工作树固定目录内")
    for relative in FILES:
        source = ROOT / relative
        if not source.is_file() or source.resolve() != ROOT.resolve() / relative:
            raise SystemExit(f"发行白名单文件缺失或指向工作树外：{relative}")
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir(parents=True)
    for relative in FILES:
        source = ROOT / relative
        target = DEST / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)

    with ZipFile(ARCHIVE, "w", ZIP_DEFLATED) as bundle:
        for relative in FILES:
            bundle.write(DEST / relative, relative)
    # 回读 ZIP 中央目录，确认压缩包与静态目录使用同一份严格白名单。
    with ZipFile(ARCHIVE) as bundle:
        if bundle.namelist() != list(FILES) or any(item.is_dir() for item in bundle.infolist()):
            raise SystemExit("发行 ZIP 文件清单与白名单不一致")
    print(f"发行目录：{DEST}\n发行 ZIP：{ARCHIVE}\n文件数：{len(FILES)}")


if __name__ == "__main__":
    main()
