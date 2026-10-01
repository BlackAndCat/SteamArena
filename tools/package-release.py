"""从发行分支和作者保存的数据生成可部署静态包。"""

import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tools" / "out"
DEST = OUT / "release"
SETTINGS = OUT / "publish-settings.json"
TEXT = "text/steam-arena/zh-CN.json"
# 显式列出运行脚本，开发工具和本机设置不能混入发行包。
SCRIPTS = (
    "release.js", "text-manager.js", "yard-chat.js", "palette.js", "coal.js",
    "modules.js", "module-art.js", "dynamics.js", "sprites.js", "ui-px.js",
    "legs.js", "vehicle.js", "content.js", "stage-cars.js", "state.js",
    "ui.js", "camp.js", "camp-ui.js", "story.js", "story-dev.js",
    "editor.js", "blueprints.js", "street.js", "arena.js", "home-scene.js",
    "home.js", "terrain-art.js", "scenes.js", "battle-view.js", "battle.js",
    "build-sys.js", "build-vis.js", "main.js",
)
FILES = ("index.html", "css/style.css", TEXT) + tuple(f"js/{name}" for name in SCRIPTS)
AUTHOR_FILES = {"js/modules.js", "js/stage-cars.js"}


def fixed_output(path):
    """检查解析后的输出位置，避免链接导致清理越界。"""
    fixed = ROOT.resolve() / "tools" / "out"
    if OUT.is_symlink() or OUT.resolve() != fixed or path.is_symlink() or path.resolve() != fixed / path.name:
        raise ValueError(f"发行输出路径不在工作树固定目录内：{path}")


def real_file(path):
    """只读取明确的真实文件。"""
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"发行来源文件不存在或是链接：{path}")
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", help="发行版本名，默认当前时间")
    parser.add_argument("--chapters", type=int, help="开放章节数，包含序章；默认 2")
    parser.add_argument("--source-root", type=Path, help="作者模块和关卡车的开发目录")
    parser.add_argument("--text-source", type=Path, help="作者保存的权威 zh-CN.json")
    args = parser.parse_args()
    fixed_output(DEST)
    settings = json.loads(SETTINGS.read_text(encoding="utf-8-sig")) if SETTINGS.exists() else {}
    if not isinstance(settings, dict):
        raise ValueError("本机发行设置须为 JSON 对象")
    source_root = (args.source_root or Path(settings.get("sourceRoot") or ROOT)).resolve()
    text_source = args.text_source or Path(settings.get("textSource") or ROOT / TEXT)
    chapters = args.chapters if args.chapters is not None else settings.get("chapters", 2)
    if not isinstance(chapters, int) or isinstance(chapters, bool):
        raise ValueError("chapters 必须是整数")
    max_chapters = int(subprocess.check_output(
        ["node", str(ROOT / "tools" / "release-check.js"), "--campaign-length"],
        cwd=ROOT, text=True).strip())
    if not 1 <= chapters <= max_chapters:
        raise ValueError(f"chapters 必须在 1..{max_chapters} 之间")
    version = args.version or datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}", version):
        raise ValueError("版本名仅支持英文字母、数字、点、下划线与连字符")
    archive = OUT / f"release-{version}.zip"
    latest = OUT / "release.zip"
    fixed_output(archive)
    fixed_output(latest)
    if archive.exists():
        raise ValueError(f"版本已存在，请另取版本名：{archive}")

    html = real_file(ROOT / "index.html").read_text(encoding="utf-8")
    loaded = re.findall(r'<script\s+src="([^"]+)"', html)
    expected = [f"js/{name}" for name in SCRIPTS if name != "stage-cars.js"]
    if loaded != expected or not re.search(r'<link\s+rel="stylesheet"\s+href="css/style.css"', html):
        raise ValueError("index.html 的发行脚本白名单、顺序或样式引用不一致")
    sources = {relative: real_file((source_root if relative in AUTHOR_FILES else ROOT) / relative)
               for relative in FILES if relative != TEXT}
    sources[TEXT] = real_file(text_source)
    document = json.loads(sources[TEXT].read_text(encoding="utf-8-sig"))
    values, removed = document.get("values"), document.get("removedElements")
    if not isinstance(values, dict) or not isinstance(removed, list):
        raise ValueError("权威文本 JSON 缺少 values 对象或 removedElements 数组")
    if not values and not removed:
        raise ValueError("权威文本没有文字或隐藏元素记录，拒绝生成空内容发行包")

    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir(parents=True)
    for relative in FILES:
        target = DEST / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(sources[relative], target)
    (DEST / "js" / "release.js").write_text(
        "// 发行配置必须先于其他游戏脚本加载。\n"
        "window.SA = window.SA || {};\n"
        "SA.RELEASE = true;\n"
        f"SA.RELEASE_CHAPTERS = {chapters};\n"
        f"SA.RELEASE_VERSION = {json.dumps(version)};\n", encoding="utf-8")

    with ZipFile(archive, "w", ZIP_DEFLATED) as bundle:
        for relative in FILES:
            bundle.write(DEST / relative, relative)
    # 回读哈希，确认 ZIP 与静态目录逐字节一致。
    with ZipFile(archive) as bundle:
        if bundle.namelist() != list(FILES) or any(item.is_dir() for item in bundle.infolist()):
            raise ValueError("发行 ZIP 文件清单与白名单不一致")
        for relative in FILES:
            if hashlib.sha256(bundle.read(relative)).digest() != hashlib.sha256((DEST / relative).read_bytes()).digest():
                raise ValueError(f"发行 ZIP 与静态目录内容不一致：{relative}")
    for relative in AUTHOR_FILES | {TEXT}:
        if (DEST / relative).read_bytes() != sources[relative].read_bytes():
            raise ValueError(f"作者数据未原样进入发行包：{relative}")
    try:
        subprocess.run(["node", str(ROOT / "tools" / "release-check.js")], cwd=ROOT, check=True)
        subprocess.run(["node", str(ROOT / "tools" / "author-content-check.js"),
                        str(DEST), str(sources[TEXT]), str(source_root)], cwd=ROOT, check=True)
    except subprocess.CalledProcessError:
        archive.unlink()
        raise
    shutil.copyfile(archive, latest)
    print(f"发行版本：{version}\n开放章节：{chapters}/{max_chapters}"
          f"\n文字覆盖：{len(values)}，隐藏元素：{len(removed)}"
          f"\n发行目录：{DEST}\n发行 ZIP：{archive}\n兼容 ZIP：{latest}\n文件数：{len(FILES)}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        raise SystemExit(f"发行失败：{error}") from error
