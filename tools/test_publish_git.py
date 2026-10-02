"""用临时本地仓库验证发行提交、推送失败和再次发布。"""

import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


TOOL = Path(__file__).with_name("package-release.py")
spec = importlib.util.spec_from_file_location("package_release", TOOL)
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


def git(*args):
    return subprocess.check_output(["git", *map(str, args)], text=True).strip()


class PublishGitTest(unittest.TestCase):
    def test_first_publish_and_retry_after_push_failure(self):
        """首次保留旧目录；远端暂不可用时保留提交，下次新版本能推送。"""
        identity = {
            "GIT_AUTHOR_NAME": "Release Test", "GIT_AUTHOR_EMAIL": "release-test@example.invalid",
            "GIT_COMMITTER_NAME": "Release Test", "GIT_COMMITTER_EMAIL": "release-test@example.invalid",
        }
        with tempfile.TemporaryDirectory() as temp, patch.dict(os.environ, identity):
            root = Path(temp)
            remote = root / "remote.git"
            seed = root / "seed"
            out = root / "out"
            out.mkdir()
            git("init", "--bare", "--initial-branch=main", remote)
            git("clone", remote, seed)
            (seed / "version.txt").write_text("seed", encoding="utf-8")
            git("-C", seed, "add", "version.txt")
            git("-C", seed, "commit", "-m", "seed")
            git("-C", seed, "push", "origin", "main")

            old = out / "release"
            old.mkdir()
            (old / "old.txt").write_text("保留", encoding="utf-8")
            with patch.object(publisher, "RELEASE_REMOTE", remote.as_posix()):
                release = publisher.prepare_release_repo(out)
                backups = list(out.glob("release-before-publish-*"))
                self.assertEqual(len(backups), 1)
                self.assertEqual((backups[0] / "old.txt").read_text(encoding="utf-8"), "保留")

                (release / "version.txt").write_text("first", encoding="utf-8")
                publisher.publish_release_repo(release, "first")
                self.assertEqual(git("-C", release, "rev-parse", "HEAD"), git("--git-dir", remote, "rev-parse", "main"))

                # 模拟网络中断：提交留在本地，远端恢复后照常发布新的版本。
                offline = root / "remote-offline.git"
                remote.rename(offline)
                (release / "version.txt").write_text("pending", encoding="utf-8")
                with self.assertRaises(subprocess.CalledProcessError):
                    publisher.publish_release_repo(release, "pending")
                self.assertEqual(git("-C", release, "status", "--porcelain"), "")
                offline.rename(remote)
                publisher.prepare_release_repo(out)
                (release / "version.txt").write_text("retry", encoding="utf-8")
                publisher.publish_release_repo(release, "retry")
                self.assertEqual(git("-C", release, "rev-parse", "HEAD"), git("--git-dir", remote, "rev-parse", "main"))


if __name__ == "__main__":
    unittest.main()
