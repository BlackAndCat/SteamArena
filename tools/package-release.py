"""从当前正式源码与作者保存稿生成静态发行目录和 ZIP。"""

import argparse
from datetime import datetime
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from zipfile import ZipFile, ZIP_DEFLATED


ROOT = Path(__file__).resolve().parents[1]
RELEASE_REMOTE = "https://github.com/BlackAndCat/steam-arena-release.git"


class EntryParser(HTMLParser):
    """只收集首页实际加载的本地脚本与样式。"""

    def __init__(self):
        super().__init__()
        self.scripts = []
        self.styles = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and "src" in attrs:
            self.scripts.append(attrs["src"])
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.styles.append(attrs.get("href"))


def linked(path):
    """Windows 目录 junction 也是重解析链接，不能交给递归清理。"""
    return path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction())


def within(parent, child):
    """Windows 上执行目录替换或递归清理前，确认真实路径仍在输出根内。"""
    parent = parent.resolve()
    raw = child.absolute()
    if raw == parent or parent not in raw.parents:
        raise ValueError(f"路径不在发行输出目录内：{raw}")
    for part in (raw, *raw.parents):
        if part == parent:
            break
        if linked(part):
            raise ValueError(f"发行输出不能使用符号链接或 junction：{part}")
    resolved = raw.resolve()
    if parent not in resolved.parents:
        raise ValueError(f"发行输出路径解析后越界：{resolved}")
    return resolved


def source_file(root, relative):
    """所有运行源码只能来自同一个 sourceRoot，拒绝链接和路径逃逸。"""
    if not re.fullmatch(r"[A-Za-z0-9_./-]+", relative) or relative.startswith("/") or ".." in Path(relative).parts:
        raise ValueError(f"首页引用非法路径：{relative}")
    path = root / relative
    if any(linked(part) for part in (path, *path.parents) if part != root.parent):
        raise ValueError(f"发行来源不能使用符号链接：{path}")
    if root.resolve() not in path.resolve().parents or not path.is_file():
        raise ValueError(f"发行来源文件不存在或越界：{path}")
    return path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_info(root):
    """记录实际打包工作树的提交与修改状态，不改变 Git。"""
    base = ["git", "-c", f"safe.directory={root.as_posix()}", "-C", str(root)]
    commit = subprocess.check_output(base + ["rev-parse", "HEAD"], text=True).strip()
    dirty = bool(subprocess.check_output(base + ["status", "--porcelain", "--untracked-files=all"], text=True).strip())
    return {"commit": commit, "dirty": dirty}


def remove_output(out, path):
    path = within(out, path)
    if path.is_dir():
        # 发行目录可能是用户手工维护的 Git 仓库；任何递归清理都不能删除仓库身份。
        if (path / ".git").exists() or (path / "old-release/.git").exists():
            raise ValueError(f"拒绝递归清理含 Git 元数据的目录：{path}")
        shutil.rmtree(path)
    elif path.exists():
        path.unlink()


def release_git(directory, *args, capture=False):
    """所有发行 Git 操作都锚定到独立发行目录，绝不落到主仓。"""
    command = ["git", "-c", f"safe.directory={directory.as_posix()}", "-C", str(directory), *args]
    if capture:
        return subprocess.check_output(command, text=True).strip()
    subprocess.run(command, check=True)


def verify_release_repo(directory):
    """校验仓库身份、分支与远端，防止嵌套目录误用父仓库。"""
    if linked(directory / ".git") or not (directory / ".git").is_dir():
        raise ValueError(f"发行目录没有独立 Git 仓库：{directory}")
    if Path(release_git(directory, "rev-parse", "--show-toplevel", capture=True)).resolve() != directory.resolve():
        raise ValueError(f"发行 Git 根目录不符：{directory}")
    if release_git(directory, "branch", "--show-current", capture=True) != "main":
        raise ValueError("发行仓必须位于 main 分支")
    if release_git(directory, "remote", "get-url", "origin", capture=True) != RELEASE_REMOTE:
        raise ValueError("发行仓 origin 与固定发行地址不符")


def prepare_release_repo(out):
    """首次发布保留旧产物并克隆发行仓；已有仓先同步远端。"""
    directory = within(out, out / "release")
    if directory.exists() and not (directory / ".git").exists():
        # 旧的纯构包目录是用户产物，迁移时只改名保留，不删除。
        backup = within(out, out / f"release-before-publish-{datetime.now():%Y%m%d-%H%M%S-%f}")
        directory.rename(backup)
        print(f"旧发行目录已保留：{backup}")
    if not directory.exists():
        subprocess.run(["git", "clone", "--branch", "main", RELEASE_REMOTE, str(directory)], check=True)
    verify_release_repo(directory)
    if release_git(directory, "status", "--porcelain", capture=True):
        raise ValueError("发行仓有未提交修改，请先处理后重试")
    release_git(directory, "pull", "--ff-only", "origin", "main")
    verify_release_repo(directory)
    return directory


def publish_release_repo(directory, version):
    """只提交本次构包产生的发行文件，并立即推送 main。"""
    verify_release_repo(directory)
    release_git(directory, "add", "--all")
    release_git(directory, "commit", "-m", f"publish: {version}")
    release_git(directory, "push", "origin", "main")
    print(f"发行仓已推送：{release_git(directory, 'rev-parse', '--short', 'HEAD', capture=True)}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--publish", action="store_true", help="从当前主仓工作区构包并推送固定发行仓")
    parser.add_argument("--settings", type=Path, help="本机发行设置 JSON")
    parser.add_argument("--output-root", type=Path, help="发行输出根目录")
    parser.add_argument("--source-root", type=Path, help="统一运行源码根目录")
    parser.add_argument("--text-source", type=Path, help="旧参数；正式文本已并入 config/text.json")
    parser.add_argument("--version", help="发行版本号")
    parser.add_argument("--chapters", type=int, help="开放章节数，包含序章")
    args = parser.parse_args()
    if args.text_source:
        raise ValueError("--text-source 不再使用，请直接保存到 sourceRoot/config/text.json")

    if args.publish and any((args.settings, args.output_root, args.source_root, args.chapters is not None)):
        raise ValueError("--publish 固定使用当前主仓、tools/out 和开放 3 章，仅可指定 --version")

    settings_path = args.settings or ROOT / "tools/out/publish-settings.json"
    settings = json.loads(settings_path.read_text(encoding="utf-8-sig")) if settings_path.exists() and not args.publish else {}
    if not isinstance(settings, dict):
        raise ValueError("发行设置必须是 JSON 对象")
    source_path = (ROOT if args.publish else args.source_root or Path(settings.get("sourceRoot") or ROOT)).absolute()
    if any(linked(part) for part in (source_path, *source_path.parents)):
        raise ValueError("sourceRoot 及其上级不能是符号链接或 junction")
    source_root = source_path.resolve()
    out = (ROOT / "tools/out" if args.publish else args.output_root or ROOT / "tools/out").absolute()
    if any(linked(part) for part in (out, *out.parents)):
        raise ValueError("发行输出根目录及其上级不能是符号链接或 junction")
    out.mkdir(parents=True, exist_ok=True)
    out = out.resolve()
    # 开放序章、第一章及第二章；当前第二章正式关卡止于第五关。
    chapters = 3 if args.publish else args.chapters if args.chapters is not None else settings.get("chapters", 3)
    if type(chapters) is not int or not 1 <= chapters <= 6:
        raise ValueError("开放章节数必须是 1～6 的整数")
    version = args.version or datetime.now().strftime("%Y%m%d-%H%M%S")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}", version):
        raise ValueError("版本号仅支持英文、数字、点、下划线和连字符")

    html = source_file(source_root, "index.html").read_text(encoding="utf-8")
    entry = EntryParser()
    entry.feed(html)
    if not entry.scripts or entry.scripts[0] != "js/release.js":
        raise ValueError("index.html 必须最先加载 js/release.js")
    if "js/config.js" not in entry.scripts:
        raise ValueError("index.html 必须加载 js/config.js")
    if not entry.styles:
        raise ValueError("index.html 缺少样式入口")
    if len(entry.scripts) != len(set(entry.scripts)) or len(entry.styles) != len(set(entry.styles)):
        raise ValueError("首页存在重复运行脚本或样式")
    if any(not x.startswith("js/") or not x.endswith(".js") for x in entry.scripts):
        raise ValueError("首页包含不属于 js/ 的运行脚本")
    if any(not x.startswith("css/") or not x.endswith(".css") for x in entry.styles):
        raise ValueError("首页包含不属于 css/ 的样式")
    # 把全部正式配置原样复制到发行包，新增配置文件无需手动维护清单。
    config_files = sorted(f"config/{p.name}" for p in (source_root / "config").glob("*.json"))
    if not config_files or "config/text.json" not in config_files:
        raise ValueError("正式配置缺少 config/text.json")
    # 后台预热由 route.js 动态创建，不会成为首页 script 标签，须显式纳入同一发行包。
    files = list(dict.fromkeys(["index.html", *entry.styles, *entry.scripts, "js/stage-cars.js", "js/route-worker.js", *config_files]))
    sources = {name: source_file(source_root, name) for name in files}
    document = json.loads(sources["config/text.json"].read_text(encoding="utf-8-sig"))
    if not isinstance(document.get("values"), dict) or not isinstance(document.get("removedElements"), list):
        raise ValueError("正式文本必须包含 values 对象和 removedElements 数组")
    if not document["values"] and not document["removedElements"]:
        raise ValueError("正式文本仍为空，请先在工作台保存作者内容")

    source_hashes = {name: digest(path) for name, path in sources.items()}

    release_dir = within(out, out / "release")
    latest_zip = within(out, out / "release.zip")
    version_zip = within(out, out / f"release-{version}.zip")
    if version_zip.exists():
        raise ValueError(f"发行版本已存在：{version_zip}")
    if args.publish:
        prepare_release_repo(out)
    stage = Path(tempfile.mkdtemp(prefix=".release-build-", dir=out))
    within(out, stage)
    staged_dir = stage / "release"
    staged_zip = stage / "release.zip"
    preserve_backup = False
    published = False
    try:
        staged_dir.mkdir()
        for name, source in sources.items():
            target = staged_dir / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            if digest(target) != source_hashes[name]:
                raise ValueError(f"复制期间来源发生变化，请重新归档：{name}")
        (staged_dir / "js/release.js").write_text(
            "// 发行配置先于其他游戏脚本加载。\nwindow.SA = window.SA || {};\n"
            f"SA.RELEASE = true;\nSA.RELEASE_CHAPTERS = {chapters};\n"
            f"SA.RELEASE_VERSION = {json.dumps(version)};\n", encoding="utf-8")
        # 链接哈希取自本次 staged 内容，浏览器缓存不会混用两次发行的脚本或样式。
        linked_files = [*entry.styles, *entry.scripts]
        release_html = html
        for name in linked_files:
            attr = "href" if name in entry.styles else "src"
            original = f'{attr}="{name}"'
            if release_html.count(original) != 1:
                raise ValueError(f"首页引用格式不符：{name}")
            release_html = release_html.replace(original,
                f'{attr}="{name}?v={digest(staged_dir / name)}"')
        (staged_dir / "index.html").write_text(release_html, encoding="utf-8")
        # 发行仓可能启用 core.autocrlf；禁用文本转换以保留哈希对应的原始字节。
        (staged_dir / ".gitattributes").write_text(
            "# 发行文件保留打包时的原始字节，避免 Git 自动转换换行。\n* -text\n", encoding="utf-8")
        manifest = {"version": 1, "releaseVersion": version, "chapters": chapters,
                    "sourceRoot": str(source_root), "git": git_info(source_root),
                    "sourceHashes": source_hashes,
                    "gitAttributesSha256": digest(staged_dir / ".gitattributes")}
        (staged_dir / "release-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        subprocess.run(["node", str(ROOT / "tools/release-check.js"), str(staged_dir)], cwd=ROOT, check=True)
        subprocess.run(["node", str(ROOT / "tools/author-content-check.js"), str(staged_dir), str(source_root)], cwd=ROOT, check=True)
        with ZipFile(staged_zip, "w", ZIP_DEFLATED) as bundle:
            for name in [*files, ".gitattributes", "release-manifest.json"]:
                bundle.write(staged_dir / name, name)
        with ZipFile(staged_zip) as bundle:
            if set(bundle.namelist()) != {*files, ".gitattributes", "release-manifest.json"}:
                raise ValueError("发行 ZIP 文件清单与运行文件不一致")
            for name in bundle.namelist():
                if hashlib.sha256(bundle.read(name)).hexdigest() != digest(staged_dir / name):
                    raise ValueError(f"发行 ZIP 内容不一致：{name}")
        # 所有生成和检查成功后才替换上次成功的发行目录与兼容 ZIP。
        old_dir, old_zip = stage / "old-release", stage / "old-release.zip"
        old_git, release_git = old_dir / ".git", release_dir / ".git"
        moved_dir = moved_zip = moved_git = installed_dir = installed_zip = False
        try:
            if release_dir.exists():
                release_dir.rename(old_dir)
                moved_dir = True
            if latest_zip.exists():
                latest_zip.rename(old_zip)
                moved_zip = True
            staged_dir.rename(release_dir)
            installed_dir = True
            # ZIP 已生成并回读；仅在目录安装事务中搬移旧仓库身份，绝不写入 ZIP。
            if old_git.exists():
                if linked(old_git) or release_git.exists():
                    raise ValueError("发行仓库 .git 是链接或新目录已存在 .git，拒绝替换")
                old_git.rename(release_git)
                moved_git = True
            shutil.copyfile(staged_zip, version_zip)
            staged_zip.rename(latest_zip)
            installed_zip = True
        except Exception as publish_error:
            try:
                # 必须先恢复 Git 元数据；恢复失败时两个目录都原样保留，不递归删除。
                if moved_git:
                    release_git.rename(old_git)
                    moved_git = False
                if installed_dir and release_dir.exists():
                    remove_output(out, release_dir)
                if installed_zip and latest_zip.exists():
                    remove_output(out, latest_zip)
                if moved_dir:
                    old_dir.rename(release_dir)
                if moved_zip:
                    old_zip.rename(latest_zip)
                if version_zip.exists():
                    remove_output(out, version_zip)
            except Exception as rollback_error:
                # Windows 文件锁可能阻止回滚；保留临时目录中的旧包备份供人工恢复。
                preserve_backup = True
                raise RuntimeError(f"发行替换失败：{publish_error}；回滚失败：{rollback_error}；旧包备份保留在 {stage}") from rollback_error
            raise
        published = True
        # 旧包可能本身是 Git 工作树；版本记录作为备份保留，不递归清理只读对象。
        if old_dir.exists() and any((old_dir / name).exists() for name in (".git", ".hg", ".svn")):
            preserve_backup = True
        print(f"发行版本：{version}；开放章节：{chapters}；文件数：{len(files) + 2}")
        print(f"发行目录：{release_dir}\n发行 ZIP：{version_zip}\n兼容 ZIP：{latest_zip}")
        if preserve_backup:
            print(f"旧发行目录含版本记录，备份保留在：{stage}")
        if args.publish:
            publish_release_repo(release_dir, version)
    finally:
        if not preserve_backup:
            try:
                remove_output(out, stage)
            except OSError as error:
                state = "发行产物已成功写入" if published else "发行未完成"
                print(f"{state}；临时目录清理失败，保留位置：{stage}；原因：{error}", file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, RuntimeError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        raise SystemExit(f"发行失败：{error}") from error
