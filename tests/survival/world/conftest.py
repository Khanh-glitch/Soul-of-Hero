import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools" / "survival" / "worldgen"))

import pytest
from validate_world import load, reconstruct, flood


@pytest.fixture(scope="session")
def plan():
    return load()


@pytest.fixture(scope="session")
def reach(plan):
    w, h = plan["frame"]["w"], plan["frame"]["h"]
    walk = reconstruct(plan, "walk")
    return flood(walk, w, h, (56, 218)), w, h
