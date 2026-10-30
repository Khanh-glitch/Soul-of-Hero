#!/usr/bin/env python3
"""Run the A7 balance test suite with the standard library only.

    python3 tools/survival/balance/run_tests.py            # all tests
    python3 tools/survival/balance/run_tests.py -v         # verbose
    python3 tools/survival/balance/run_tests.py test_loot_math

Equivalent: python3 -m unittest discover -s tests/survival/balance -p "test_*.py"
(pytest also collects these files; no third-party dependency is required.)
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TEST_DIR = ROOT / "tests" / "survival" / "balance"

if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
if str(TEST_DIR) not in sys.path:
    sys.path.insert(0, str(TEST_DIR))


def main(argv=None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    verbosity = 2 if ("-v" in argv or "--verbose" in argv) else 1
    argv = [arg for arg in argv if arg not in ("-v", "--verbose")]
    loader = unittest.TestLoader()
    if argv:
        suite = unittest.TestSuite()
        for name in argv:
            suite.addTests(loader.loadTestsFromName(name))
    else:
        suite = loader.discover(str(TEST_DIR), pattern="test_*.py", top_level_dir=str(TEST_DIR))
    result = unittest.TextTestRunner(verbosity=verbosity).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
