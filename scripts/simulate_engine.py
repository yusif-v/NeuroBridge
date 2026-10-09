"""Fake game engine — pushes realistic runs into the platform via the SDK.

Use it to demo/develop the platform before the real engine is wired up, and as a
reference for the engine team.

    python scripts/simulate_engine.py               # 2 runs: build 1.0.0 (bugs) then 1.0.1 (fix verified)
    python scripts/simulate_engine.py --live        # slower, so you can watch the dashboard update
    python scripts/simulate_engine.py --regression  # extra run on 1.0.2 where the wall bug comes back
"""

import argparse
import base64
import random
import struct
import sys
import time
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sdk.buglens_client import BugLens  # noqa: E402

PROJECT = "Dungeon Escape"

MAP = [
    "##########",
    "#P..#...E#",
    "#.#.#.##.#",
    "#.#...#..#",
    "#K###.#.L#",
    "#....D...#",
    "##########",
]
TILE_COLORS = {"#": (46, 42, 66), ".": (18, 16, 30), "P": (34, 211, 238), "K": (250, 204, 21),
               "D": (180, 110, 60), "E": (52, 211, 153), "L": (244, 63, 94)}


def png(width: int, height: int, pixels: list[list[tuple]]) -> bytes:
    raw = b"".join(b"\x00" + bytes(c for px in row for c in px) for row in pixels)
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def frame(player: tuple[int, int], highlight: tuple[int, int] | None = None, hp: int = 3, scale: int = 32) -> bytes:
    grid = [list(r.replace("P", ".")) for r in MAP]
    px, py = player
    rows, cols = len(grid), len(grid[0])
    hud = 12
    w, h = cols * scale, rows * scale + hud
    pixels = [[(10, 9, 18)] * w for _ in range(h)]
    for i in range(hp):  # HP pips in the HUD
        for y in range(3, 9):
            for x in range(6 + i * 14, 16 + i * 14):
                pixels[y][x] = (244, 63, 94)
    for gy in range(rows):
        for gx in range(cols):
            color = TILE_COLORS["P"] if (gx, gy) == (px, py) else TILE_COLORS[grid[gy][gx]]
            if (gx, gy) == (px, py) and grid[gy][gx] == "#":
                color = (168, 85, 247)  # player rendered inside a wall
            for y in range(scale):
                for x in range(scale):
                    edge = x in (0, scale - 1) or y in (0, scale - 1)
                    on_hl = highlight == (gx, gy) and (x < 3 or y < 3 or x >= scale - 3 or y >= scale - 3)
                    pixels[hud + gy * scale + y][gx * scale + x] = (255, 60, 90) if on_hl else (
                        tuple(max(0, c - 12) for c in color) if edge else color)
    return png(w, h, pixels)


def b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode()


def pause(live: bool, lo=0.4, hi=1.2):
    if live:
        time.sleep(random.uniform(lo, hi))


def run_build(bl: BugLens, build: str, *, wall_bug: bool, hp_bug: bool, live: bool, agent="Explorer-LLM"):
    print(f"\n=== Run on build {build} ===")
    known = {b["fingerprint"]: b for b in bl.open_bugs(PROJECT)}
    passed = failed = 0
    with bl.run(PROJECT, build, agent=agent, engine="simulator", seed=random.randint(1, 9999)) as run:
        run.log(f"Session started on build {build}", level="info", map="dungeon_01")
        run.log("Agent goal: collect key, open door, reach exit", level="debug")
        pause(live)

        # TEST-01 key pickup
        run.log("Picked up key at (1,4)", inventory=["key"])
        passed += 1
        pause(live)

        # TEST-02 locked door
        run.log("Tried door at (5,5) without key → blocked", level="info")
        passed += 1
        pause(live)

        # TEST-03 wall collision
        if wall_bug:
            failed += 1
            bug = run.bug(
                "Player can walk through wall tiles",
                fingerprint="collision-wall-clip",
                description="While exploring the corridor the agent moved east into a wall tile and the "
                            "movement was accepted. The player ended up inside the wall.",
                category="collision", severity="high", test_name="TEST-03 Wall collision",
                agent=agent, confidence=0.93,
                steps=["Start new game", "Move to (3,1)", "Press RIGHT"],
                expected="Movement into (4,1) is blocked; player stays at (3,1)",
                actual="Player position became (4,1), which is a WALL tile",
                logs=[{"message": "move RIGHT from (3,1) to (4,1)", "level": "info", "data": {"tile": "WALL"}},
                      {"message": "collision check returned passable=True for WALL", "level": "error"}],
                screenshots=[{"data": b64(frame((4, 1), (4, 1))),
                              "caption": "Player inside wall at (4,1)"}],
            )
            print(f"  reported {bug.key} (new={bug.is_new}) wall clip")
            pause(live)
            r = bug.recheck(reproduced=True, attempts=3, notes="Reproduced 3/3 from fresh state",
                            logs=["recheck 1/3: reproduced", "recheck 2/3: reproduced", "recheck 3/3: reproduced"])
            print(f"  recheck -> {r['verification']} / {r['status']}")
        else:
            passed += 1
            if fp := known.get("collision-wall-clip"):
                r = run.recheck(fp["id"], reproduced=False, attempts=3,
                                notes=f"Not reproduced on {build} (0/3)",
                                logs=["move RIGHT from (3,1) blocked by WALL"],
                                screenshots=[{"data": b64(frame((3, 1))),
                                              "caption": "Player correctly blocked at (3,1)"}])
                print(f"  recheck BUG-{fp['id']:03d} -> {r['status']}")
        pause(live)

        # TEST-04 zero HP
        if hp_bug:
            failed += 1
            bug = run.bug(
                "Game continues after HP reaches 0",
                fingerprint="state-zero-hp",
                description="Agent stepped on lava three times. HP dropped to 0 but the game kept accepting "
                            "input and no game-over screen was shown.",
                category="logic", severity="critical", test_name="TEST-04 HP zero",
                agent=agent, confidence=0.88,
                steps=["Start new game", "Walk to lava at (8,4)", "Step on lava 3 times", "Press any movement key"],
                expected="Game over state when HP = 0, input ignored",
                actual="HP = 0, state = PLAYING, player still moves",
                logs=[{"message": "hp 1 -> 0 (lava)", "level": "warning"},
                      {"message": "state=PLAYING after hp=0", "level": "error"},
                      {"message": "move DOWN accepted at hp=0", "level": "error"}],
                screenshots=[{"data": b64(frame((8, 4), (8, 4), hp=0)),
                              "caption": "HP 0, still playing"}],
            )
            print(f"  reported {bug.key} (new={bug.is_new}) zero HP")
            pause(live)
            r = bug.recheck(reproduced=True, attempts=2, notes="Reproduced 2/2")
            print(f"  recheck -> {r['verification']} / {r['status']}")
        else:
            passed += 1
        pause(live)

        # Flaky finding that the recheck does NOT confirm (shows the engine double-checks)
        if build == "1.0.0":
            bug = run.bug(
                "Exit tile briefly unreachable", fingerprint="nav-exit-unreachable",
                description="Pathfinding reported the exit as unreachable once after opening the door.",
                category="navigation", severity="medium", test_name="TEST-05 Win condition",
                agent=agent, confidence=0.41,
                steps=["Pick up key", "Open door", "Path to exit"],
                expected="Exit reachable after door opens", actual="Path query returned None once",
                logs=[{"message": "path(5,5 -> 8,1) = None", "level": "warning"}])
            r = bug.recheck(reproduced=False, attempts=5, notes="0/5 — likely timing in agent, not the game")
            print(f"  flaky {bug.key} -> {r['verification']}")
        passed += 1
        run.log("Reached exit with key → VICTORY", level="info")

        run.stats(tests_total=passed + failed, tests_passed=passed, tests_failed=failed,
                  actions=random.randint(140, 260), duration_s=round(random.uniform(20, 45), 1))
        run.summary = (f"Agent completed the dungeon on build {build}. "
                       f"{failed} failing checks, all rechecked before reporting.")
    print(f"  run #{run.id} finished: {passed} passed, {failed} failed")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8000")
    ap.add_argument("--key", default="dev-engine-key")
    ap.add_argument("--live", action="store_true", help="slow down to watch the UI update")
    ap.add_argument("--regression", action="store_true", help="add build 1.0.2 where the wall bug returns")
    args = ap.parse_args()

    bl = BugLens(args.url, args.key)
    run_build(bl, "1.0.0", wall_bug=True, hp_bug=True, live=args.live)
    run_build(bl, "1.0.1", wall_bug=False, hp_bug=True, live=args.live)
    if args.regression:
        run_build(bl, "1.0.2", wall_bug=True, hp_bug=True, live=args.live)


if __name__ == "__main__":
    main()
