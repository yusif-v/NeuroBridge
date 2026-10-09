# Native Linux upload → Docker sandbox → CUDA Laya

The prototype accepts a Linux **x86_64 ELF build ZIP** and runs it directly in
an offline Docker container. There is no Wine process in the default image.
A local trusted worker outside the container uses CUDA Laya to choose keyboard
inputs. `/playtest` shows actual captured frames, OCR, action probabilities and
events. Job URLs preserve the selected test when refreshing the page.

## Run locally

1. Start Docker Desktop with its **Linux / WSL2** engine.
2. Build: `docker build -t buglens-sandbox:local sandbox`.
3. Install platform dependencies: `python -m pip install -r requirements.txt`.
4. Install CUDA PyTorch, transformers and `laya==0.3.21` in the worker environment.
   An existing CUDA installation can use a venv with `--system-site-packages`;
   installing Laya with `--no-deps` preserves those dependencies.
5. Cache `convaiinnovations/laya` **multilingual** weights. Set
   `BUGLENS_LAYA_MODEL` to the folder containing `rl_agent_config.json` and
   `model.safetensors`, or use the default Hugging Face cache. No model weights
   are downloaded at runtime. `BUGLENS_LAYA_SDK` optionally points to a local SDK.
6. Build the UI: `cd frontend`, `npm install`, `npm run build`.
7. From the repo root, start the API:
   `python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000`.
8. In a separate terminal: `python -m backend.app.worker`.
9. Visit `http://localhost:8000/playtest`, upload a build and describe its controls.

Both API and worker load the repository's ignored `.env` without overriding shell
variables. Uploading before the worker starts leaves the job queued.
Stop cancels exploration; the worker removes its container at the next checkpoint.

## Build the dungeon for Linux

Open `game/project.godot` in Godot 4. Install export templates matching the editor
version. Export using the included **Linux Desktop** x86_64 preset. ZIP the
executable and any PCK, shared libraries and assets produced by the export.
Windows EXEs are not converted into Linux executables: export from project source.

The local smoke-test ZIP uses the official Godot 4.6.2 Linux engine as its runtime
alongside the game's PCK, packed with the matching Windows editor. That also runs
the real project; it has a debug title and is larger than a release-template export.
The normal game starts with Enter; A/D moves, Space jumps, W/S climbs and E interacts.

## What Laya observes and what a result means

Laya 0.3.21 here is a **text/action model**, not a visual reasoning model.
Screenshots are shown to humans. Tesseract OCR and frame differences supply model
observations, together with the user's objective and recent inputs. The worker
provides no hidden game coordinates, scene state or game-specific waypoint route.
Inputs are A/D, W/S, Space+A/D, E, Enter, R and wait. Restart is offered only for a
visible failure/retry prompt, and repeated Enter is restricted to menu prompts.
Mouse and gamepad controls need another adapter.
When the key/exit assertion is selected and OCR shows a locked-door interaction
prompt with E, the action set focuses on E and wait. Laya chooses between them;
the log records the action scope. This is a rule-driven test affordance, not a
hidden route or an inference that Laya understands arbitrary game geometry.

An exploration budget can end without winning or finding a failure. That result
is **inconclusive**, not bug-free. Current detectors check application
`SCRIPT ERROR` / `NullReferenceException` output and an optional key/exit assertion.
The latter requires a build visibly displaying both `KEY MISSING` and
`DUNGEON CLEARED` while the key is absent. Arbitrary gameplay bugs require suitable
observations and assertions; this prototype does not guarantee full game coverage.

A candidate's input sequence is replayed in a **fresh container**. Only the same
second observation confirms it. Both screenshots and the reproduction result are
stored in Bugs/Reports. Action probabilities are model scores, not proof of a bug.
The **Download runtime output** link exposes captured application output. The
report-explanation analyzer is separate from CUDA Laya gameplay. Set the server-side
`AI_API_BASE_URL`, `AI_API_KEY` and `AI_MODEL` in `.env` to enable multimodal API
analysis after fresh replay confirmation. The trusted host sends screenshots,
logs and replay evidence to that configured service; the game container remains
offline. See [AI integration](AI_INTEGRATION.md). Analysis failure does not change
the independently verified bug, and the bug panel provides Retry.

## Gameplay logic demo: exit opens without the key

`tests/fixtures/door_rule` contains a deliberately faulty door subclass and a
controlled test start beside the exit with no key. The normal game sources and
door's key check remain unchanged. Assemble a separate native Linux ZIP with a
matching Godot editor and Linux x86_64 engine/export-template binary:

```powershell
python scripts/build_door_demo.py --godot C:\Tools\Godot_console.exe --runtime C:\Tools\Godot_linux.x86_64
```

The script runs five Godot assertions: correct door locked without key, correct
door opens with key, seeded door opens without key, start precondition and visible
HUD evidence. It emits `data/door-demo/DoorRuleBugDemo-Linux.zip`. `--control`
exports the same starting setup with the correctly locked production door.

Upload the ZIP in **Upload & Playtest**, choose **Key required for exit**, and use
the goal: “Test the locked exit without collecting the golden key. E interacts
with the door. Victory must require the key. A/D move, Space jumps, W/S climb.”
A ten-decision budget is sufficient for the tested run. The failing frame shows
`KEY MISSING` and `DUNGEON CLEARED` together. The website links directly to the
logic finding, first screenshot and independent replay screenshot.

This is an explicitly seeded gameplay fault and targeted assertion demonstration.
It does not demonstrate autonomous discovery of unknown rules or completion of
the entire dungeon puzzle. The earlier unrestrained run repeated jumps and ended
inconclusive; that result is retained alongside the successful run.

## Separate runtime exception fixture

`tests/fixtures/runtime_error` is a separate Godot project with a seeded null-node
exception on keyboard input. Export it with **Linux Desktop**, ZIP its executable
and PCK, upload it with a five-decision budget and ask the tester to press Enter.
Laya chooses the input. The runner does not inject a fault or use a fixture route.
The expected evidence is `Cannot call method 'get_node' on a null value`, two
screenshots and a reproduced recheck. The normal dungeon game is separate.

## Isolation

Only the uploaded build is mounted, read-only. The container has no network,
Docker socket, model/GPU access or host credentials. It runs as UID 1000 with no
Linux capabilities, a read-only root and CPU/memory/process limits. The native
build is copied to a disposable tmpfs and its entrypoint receives execute permission.
ZIP paths, duplicates, links, special files, architecture and expanded sizes are
validated. Limits: 200 MB upload, 1 GB expanded / 5,000 files; container memory 2 GB,
2 CPU cores, 160 processes, 1 GB home tmpfs and 256 MB temporary storage.
Large builds or missing Linux libraries may fail as environment issues.
This local hackathon API has no accounts; public multi-tenant use needs auth/quotas.

## Optional Windows worker

Windows x86_64 EXE/ZIP validation remains supported. Use a worker with
`BUGLENS_SANDBOX_IMAGE=buglens-wine:local` and build:
`docker build -f sandbox/Dockerfile.windows -t buglens-wine:local sandbox`.
Wine compatibility is not guaranteed. Ubuntu Wine 9 failed with Godot 4.6 in the
smoke test ([upstream issue](https://github.com/godotengine/godot/issues/119140)).
The optional image pins official Wine Staging 11.19 with SHA-256 verification.
For cached downloads, place the exact pinned packages as `sandbox/wine-runtime.deb`
and `sandbox/wine-amd64.deb`, then add
`--build-arg WINE_RUNTIME_SOURCE=wine-runtime.deb --build-arg WINE_AMD64_SOURCE=wine-amd64.deb`.
The same hashes apply. Native Windows was smoke-tested; Wine coverage was incomplete
and included first-prefix installer dialogs. The working prototype uses Linux.

## Verified locally

Godot 4.6.2 native Linux ran the dungeon in Docker; CUDA Laya selected 30 inputs.
It did not complete the puzzle and the result was inconclusive. The separate Linux
fixture produced a runtime error on Laya's Enter decision, independently reproduced
in a new container and stored as a confirmed finding with both screenshots.
The door-rule dungeon demo then ran on RTX 3070 Ti Laptop GPU: Laya selected E
from the full exploration action set (19.46% score, 391.7 ms inference), opened the
exit without a key and reproduced that same action in a fresh offline container.
The report is category `logic`, confirmed, with two actual captured screenshots.
The normal door's positive and negative key checks passed Godot assertions.
