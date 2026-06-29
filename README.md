# 🥜 PEANUT RUN

### *BUNGULATE TO THE BURGER!*

A fast, greasy, cartoon first/third-person runner-shooter built in vanilla
**Three.js** — sprint the counters, blast the veggies, and chase the burger.

![BUNGULATE TO THE BURGER!](embed-banner.png)

---

## 🎮 Controls

| Action | Keyboard / Mouse | Controller |
| --- | --- | --- |
| Move / strafe | `W` `A` `S` `D` **or** `↑` `↓` `←` `→` | Left stick |
| Aim / look | Mouse | Right stick |
| Sprint (drinks grease) | `Shift` (hold) | LB / L1 (hold), or **L3 to toggle** |
| Jump (sips grease) | `Space` | A / ✕ |
| Slide → crouch (hold) | `C` / `Ctrl` | R3 |
| Blast peanuts | `LMB` | RT / R2 |
| Pause | `Tab` / click timer | Start |
| Camera view | `Q` | View / Share |

In the **pause menu**, `WASD` and the arrow keys navigate the highlighted
options just like a controller d-pad — `↕` moves between rows, `↔` adjusts the
focused setting, and `Enter` / `Space` confirms.

## 🛠️ Run it locally

It's a static site — no build step.

```sh
serve.bat        # serves on http://localhost:8137
```

Append `?test` to the URL for test mode.

## ☁️ Deploy

Hosted on **Cloudflare Pages** at https://peanut-run.pages.dev — no build
command, output directory `/` (root). Pages deploys straight from `main`.

## 📦 Layout

```
index.html              # game shell, HUD, menus, rich link-embed meta
src/main.js             # all game logic (Three.js)
libs/three.module.js    # Three.js
assets/                 # sprites & animation frames
favicon-*, embed-banner.png
tools/make_pr_icons.py  # icon generation helper
```

---

© 2026 **AK & Co.** (akilluminati47). All Rights Reserved. See [LICENSE](LICENSE).

*PEANUT RUN is an unofficial, non-commercial fan project. All third-party
characters and trademarks belong to their respective owners.*
