# Third-party notices

The [MIT License](LICENSE) covers NeuroBridge/BugLens's original project code and
documentation. Original Moss & Ember scenes, art and synthesized sounds also
retain their existing [game license](game/LICENSE.txt). Third-party software,
fonts, pretrained models and external services retain their own licenses and
terms; the project MIT license does not replace them.

## Local model and model SDK

- **Laya 0.3.21 SDK**, developed by Convai Innovations: Apache-2.0. The package
  license is preserved in [licenses/Laya-Apache-2.0.txt](licenses/Laya-Apache-2.0.txt).
  [Versioned upstream package](https://pypi.org/project/laya/0.3.21/).
- **convaiinnovations/laya model**, including the multilingual checkpoint used
  here: the upstream model card declares Apache-2.0. The tested cached revision
  is `55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851`.
  [Revision model card](https://huggingface.co/convaiinnovations/laya/blob/55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851/README.md).
  Model weights are downloaded separately and are not included in this Git
  repository. Preserve upstream license and attribution files if distributing
  weights or a model-containing bundle; separately bundled backbone/tokenizer
  components retain any applicable upstream notices.

## Platform dependencies

The following direct-dependency licenses were checked against installed package
metadata on 9 October 2026. This is a dependency snapshot, not a declaration that
all transitive dependencies or future releases share the same license.

| Component | Upstream license |
| --- | --- |
| FastAPI, Pydantic, pytest | MIT |
| Uvicorn, httpx, python-dotenv | BSD-3-Clause |
| python-multipart | Apache-2.0 |
| Pillow | MIT-CMU |
| PyTorch | BSD-3-Clause, with additional bundled third-party notices |
| Transformers, huggingface-hub | Apache-2.0 |
| React, React DOM, React Router, TanStack Query, Recharts | MIT |
| Tailwind CSS, Vite, Vite React plugin, oxlint, TypeScript type packages | MIT |
| TypeScript | Apache-2.0 |
| Lucide React icons | ISC |

The frontend includes an installed-package license-text snapshot at
[frontend/public/third-party-licenses.txt](frontend/public/third-party-licenses.txt).
Vite copies it into the build so it can be served at `/third-party-licenses.txt`.
It includes installed runtime and build dependencies, bundled vendor notices
and font licenses. After dependency updates, run
`python scripts/update_frontend_licenses.py` following the package installation.
Package-manager installations also retain their own
upstream license files. Keep those files and copyright/NOTICE statements when
redistributing Python environments or dependencies.

## Fonts

The frontend loads **Inter** and **JetBrains Mono** through Google Fonts.
Both use the SIL Open Font License 1.1; they are not relicensed under MIT.

- Inter: Copyright 2020 The Inter Project Authors.
  [Preserved license](licenses/Inter-OFL-1.1.txt),
  [upstream source](https://github.com/google/fonts/tree/main/ofl/inter).
- JetBrains Mono: Copyright 2020 The JetBrains Mono Project Authors.
  [Preserved license](licenses/JetBrains-Mono-OFL-1.1.txt),
  [upstream source](https://github.com/google/fonts/tree/main/ofl/jetbrainsmono).

## Godot game exports

Godot Engine uses MIT and includes components with additional licenses.
For the tested Godot **4.6.2** version, upstream texts are preserved in
[game/GODOT_LICENSE.txt](game/GODOT_LICENSE.txt) and
[game/GODOT_COPYRIGHT.txt](game/GODOT_COPYRIGHT.txt). Ship these together with
`game/LICENSE.txt` when distributing the desktop game. If the engine version
changes, replace the Godot notices with the ones for that version.

[Godot's license compliance guide](https://docs.godotengine.org/en/stable/about/complying_with_licenses.html)
also documents ways to obtain notices from the engine itself.

## Sandbox images and external services

Ubuntu images and their packages, including Xvfb, xdotool, Openbox, ImageMagick,
Tesseract, Mesa, DejaVu fonts and optional Wine, keep their distribution-specific
licenses. Preserve `/usr/share/doc/*/copyright`, other packaged license files
and any corresponding source obligations when distributing built container
images. This repository distributes Dockerfiles, not a relicense of those
packages. It does not bundle NVIDIA drivers or CUDA runtimes into the game
sandbox; these components have their own distribution terms.

The configured report gateway and its model are accessed as external services.
Their provider terms govern that access; neither their models nor a right to
redistribute model weights is supplied by this project's MIT license.
User-uploaded games likewise remain subject to their owners' licenses.
