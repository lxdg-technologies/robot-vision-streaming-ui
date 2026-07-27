"""Regression tests for the release workflow version guard."""

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
RELEASE_YML = REPO_ROOT / ".github" / "workflows" / "release.yml"
GUARD_STEP_NAME = "Verify version is not already released"
BUILD_STEP_NAME = "Build and publish once"
TAG_STEP_NAME = "Create immutable Git tag"


def _release_steps():
    with RELEASE_YML.open(encoding="utf-8") as f:
        workflow = yaml.safe_load(f)
    return workflow["jobs"]["release"]["steps"]


def _step_index(steps, name_prefix):
    for index, step in enumerate(steps):
        if (step.get("name") or "").startswith(name_prefix):
            return index
    return None


def _guard_script():
    steps = _release_steps()
    index = _step_index(steps, GUARD_STEP_NAME)
    assert index is not None, f"missing {GUARD_STEP_NAME!r} step"
    return steps[index]["run"]


class ReleaseWorkflowGuardTest(unittest.TestCase):
    def test_guard_precedes_build_and_tag(self):
        steps = _release_steps()
        guard = _step_index(steps, GUARD_STEP_NAME)
        build = _step_index(steps, BUILD_STEP_NAME)
        tag = _step_index(steps, TAG_STEP_NAME)
        self.assertIsNotNone(guard)
        self.assertIsNotNone(build)
        self.assertIsNotNone(tag)
        self.assertLess(guard, build)
        self.assertLess(guard, tag)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.origin = root / "origin.git"
        self.work = root / "work"
        self._git(["init", "-q", "--bare", str(self.origin)], root)
        self._git(["clone", "-q", str(self.origin), str(self.work)], root)
        self._git(["config", "user.email", "test@example.com"])
        self._git(["config", "user.name", "test"])
        self.branch = self._git(["symbolic-ref", "--short", "HEAD"]).stdout.strip()

    def tearDown(self):
        self.tmp.cleanup()

    def _git(self, args, cwd=None):
        return subprocess.run(["git", *args], cwd=cwd or self.work, check=True, capture_output=True, text=True)

    def _commit_push(self, content, tag=None):
        (self.work / "fixture.txt").write_text(content, encoding="utf-8")
        self._git(["add", "fixture.txt"])
        self._git(["commit", "-q", "-m", content])
        if tag:
            self._git(["tag", tag])
        self._git(["push", "-q", "origin", self.branch, "--tags"])

    def _run_guard(self, version):
        env = dict(os.environ, VERSION=version)
        return subprocess.run(["bash", "-c", _guard_script()], cwd=self.work, env=env, capture_output=True, text=True)

    def test_rejects_tag_from_another_commit(self):
        self._commit_push("first", "v0.1.0")
        self._commit_push("second")
        result = self._run_guard("0.1.0")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("already released", result.stdout + result.stderr)

    def test_allows_free_version(self):
        self._commit_push("first", "v0.1.0")
        self._commit_push("second")
        self.assertEqual(self._run_guard("0.1.1").returncode, 0)

    def test_allows_same_commit_rerun(self):
        self._commit_push("first", "v0.1.0")
        self.assertEqual(self._run_guard("0.1.0").returncode, 0)
