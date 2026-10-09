# Moss & Ember

A complete, single-screen 2D dungeon puzzle-platformer for Windows, written in
Godot 4 and GDScript. Collect the golden key on the left and open the elevated
central exit. One level, one pushable crate, two moving platforms, no services
or external runtime dependencies. All art and short sound effects are original
and included.

## Open and play

1. Use Godot 4 (tested with **4.6.2 stable**, Compatibility renderer).
2. Import `project.godot` in the Project Manager, then open the project.
3. Press **F5**. The main scene is `scenes/main_menu.tscn`.
4. Choose **NORMAL OYUN** to play, or **LAYA İLƏ BUG TESTİ** to watch the local
   CUDA model play and demonstrate the seeded door defect. The demo runs in a
   separate window while the menu stays open. Closing it returns to the menu.

The normal game's pause/victory screen has a **MAIN MENU** button. Laya mode
requires the optional Python/CUDA/model setup in `qa/README.md`; it displays
loading status and saves launcher errors under `qa/runs/menu-*/launcher.log`.
Set `LAYA_PYTHON` to the Python executable for your CUDA environment if needed.
In a standalone export, normal play works without Python. Launch the QA demo
from the source project, or point the menu's Inspector `qa_project_directory`
to the accompanying source folder with Python tools and set `GODOT_BIN` to the
Godot editor executable (the exported game EXE cannot launch the QA bridge).

In this workspace, double-click `RunGame.cmd` to play using the Godot executable
extracted from the archive you supplied. In a copied project, the launcher also
works if `godot.exe` is on PATH. Otherwise, use the editor or run
`Godot_v4.x-stable_win64.exe --path "C:\path\to\project"`.

| Control | Action |
| --- | --- |
| A/D or Left/Right | Move; walk into the crate to push it |
| Space | Jump; hold for a full jump, release early for a short jump |
| W/S or Up/Down | Climb the ladder in either direction |
| E | Open the door while standing beside it with the key |
| R | Restart the entire puzzle, including while paused or after victory |
| Escape | Pause/resume |

Pause and victory menus include mouse and keyboard-accessible buttons. Tab or
arrow keys change focus; Enter/Space activate the focused button. Death resets
the player, key, crate, door, and both platform cycles after a short cue.
Pushing the crate into the pit also resets the puzzle, avoiding a soft lock.

## Route / spoiler

Climb the left ladder and walk left to get the key. Return down the ladder.
Jump over the small floor spikes and land before the crate. Push the crate
right until it is near the left edge of the central lower shelf, jump onto it,
then hold Space to jump to that shelf. Wait for the blue horizontal ferry at
the shelf's right edge. Board and let it carry you across the pit, then step
onto the right landing. Jump onto the gold lift when it is low and ride up.
Step onto the upper right ledge, jump left across the small stepping stone,
then to the door platform. Press E beside the door.

The base jump rises about 76 pixels (390 px/s jump, 1,000 px/s² gravity).
The crate-to-shelf rise is 64 pixels. The upper gaps are 40 and 48 pixels.
The unbridged pit is 176 pixels across and the lift rises 128 pixels, so the
moving platforms provide the intended route. The automated test completes
the route with real physics and normal input actions, without teleporting
the player during the successful run.

## Edit

`scenes/player.tscn` exposes speed, acceleration, braking, jump, gravity, climb
speed, coyote time, and jump buffer in the Inspector. Platforms expose travel
vector, cycle duration, starting phase, and appearance. Stone sections and
ladders expose dimensions and preview in the editor. The reusable player,
crate, ladder, key, exit, stone platform, moving platform, spikes, and torch
scenes are assembled in `scenes/level.tscn`. Their scripts are in `scripts/`.

The viewport is 768 × 432, with nearest-neighbor textures and integer scaling.
The default window is 1536 × 864 for a crisp 2× view. Smaller/nonmultiple windows retain
integer scaling with spare space. PNGs and WAVs in `assets/` are ready to use;
the optional Python/Pillow generators in `tools/` are only needed to rebuild
the artwork or source scenes. Editing the shipped scenes directly is fine;
running the scene generator overwrites those scene edits.

## Windows export

1. In Godot, open **Editor → Manage Export Templates** and install templates
   matching your exact Godot version.
2. Open **Project → Export**. The **Windows Desktop** x86_64 preset is included.
3. Choose **Export Project**, disable **Export With Debug**, and save to
   `builds/windows/MossAndEmber.exe`. Create the directory if necessary.
4. The preset embeds the PCK in the executable. Distribute the resulting EXE
   along with appropriate Godot third-party license notices.

CLI equivalent with matching templates installed:

```powershell
New-Item -ItemType Directory -Force builds/windows
godot --headless --path . --export-release "Windows Desktop" builds/windows/MossAndEmber.exe
```

## Verification

Tested with Godot **4.6.2** on Windows:

- Headless editor import and main-scene run: no script errors.
- Full automated physics playthrough: ladder ascent/descent, key pickup,
  spike jump, crate push/standing, shelf jump, both platform rides, upper
  jumps, E interaction, victory, restart, pause, and complete death reset.
- A real OpenGL game render was captured and visually inspected (`preview.png`).

Re-run the input-driven integration check:

```powershell
godot --headless --path . --fixed-fps 60 --script res://tests/playthrough.gd
```

An exported standalone Windows release was **not** built or tested: the
installed export templates are for a different Godot version. The in-engine
Windows game and rendered level were tested. The screenshot referenced in
the request was not available in the chat, so the included original artwork
follows the written visual description.

## Optional external Laya QA

`RunLayaQA.cmd` runs the separate local CUDA playtester. `RunLayaBugDemo.cmd`
demonstrates an intentionally seeded defect in an isolated QA session. Neither
tool is loaded by the normal game or included in its Windows export. See
`qa/README.md` for setup, actual model scope, evidence, and replay commands.
