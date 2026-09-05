# Loadbook — app source

Source of record for the **Loadbook** artifact: a training ledger that pays a daily
stipend you spend on a catalogued collection of 618 dinosaur specimens.

**Live:** https://claude.ai/code/artifact/1f1065cd-7bc3-4fa0-ade9-c80d3326dee8

`src/loadbook.html` is the whole application — markup, CSS, JS and every specimen
image, in one file. There is no build step.

## Publishing

The page declares the `db` capability, so it is organisation-internal and cannot be
shared publicly.

**Every republish must pass that URL**, or you create a *new* artifact and orphan the
database holding the user's real training history:

```
Artifact(file_path: "src/loadbook.html",
         url: "https://claude.ai/code/artifact/1f1065cd-7bc3-4fa0-ade9-c80d3326dee8")
```

Omit `capabilities` and `favicon` on a republish — both carry forward. Read the live
page first (`action: "read"`); a publish to an artifact the conversation has not read
is refused.

## Where the data lives

| In the page | In the artifact db |
|---|---|
| species catalogue, biographies, cast images | `settings/goals`, `settings/rewards` |
| | `sessions/*`, `exercises/*`, `routines/*` |
| | `profiles/*`, `invites/*`, `friends/*/list/*` |

Collector cards (`lb-me`) and the theme choice are browser-local, not in the db.

## Three volumes

- **I — The Ledger.** Set logging, goal dials, daily stipend, streak freezes, and five
  eras that unlock at 1 / 3 / 5 / 8 / 12 completed five-day streaks. Plus **Routines**:
  workouts you compose yourself — a title and an ordered list of movements, each with
  sets, reps, a target weight (or minutes, for cardio) and a rest interval. The four
  built-in standards (Push / Pull / Leg / Cardio & Core) are read-only starters you
  *adopt* into a routine of your own. Saved routines also join the quick-pick pills
  above the log form.

  **The runner.** "Begin" opens a runner overlay: a countdown dial, the ordered
  movements with one filled pip per completed set, and per-set weight/rep fields
  prefilled from the target. Logging a set writes straight into the ledger (PR
  detection and all) and starts that movement's rest clock, which chimes through
  WebAudio at zero — so there is no audio asset to ship. Space toggles the clock,
  esc closes, and ±30 sec adjusts it mid-rest. The clock reads Date.now() deltas
  rather than accumulating ticks, so a throttled background tab does not drift.
- **II — The Cabinet.** 618 specimens, each with a biography. Grades: Standard /
  Select / Reserve / Archival.
- **III — The Society.** Collector cards, one-time friend codes (`LB-XXXX-XXXX`),
  fellows list.

## Specimen figures — the constraint that shapes everything

Only **90 of 618** specimens have a figure: 13 bronze casts and 77 vinyl study models.
The other **528 render a procedural catalogue plate** — a letterpress card drawn at
render time by `specPlate()` from the biography data: mass, diet glyph, a √-scaled
length bar against a 1.8 m human rule, and a geologic period band. It is deliberate
design, not a placeholder, and it needs no bytes.

Why the other 528 have no figure, and what it would take:

- **Nothing on this machine can draw them.** MacBook Neo, A18 Pro, 8 GB, 6 cores, no
  Homebrew, system Python 3.9, no torch/MLX. Hand-authored SVG dinosaurs were tried
  three times and rejected.
- **There is no asset store.** This account's artifact capabilities are `artifact`,
  `db`, `downloads`, `mcp`, `room`, `sample`, `self` — no `assets`. So every figure
  must be inlined as a data URI, against a **16 MB page cap**.
- **It would still fit.** Existing casts are 320×320 JPEG, ~26 KB each as base64. This
  Mac cannot encode WebP but *can* encode AVIF (`tools/image-format-probe.swift`).
  Measured with `tools/avif-reencode-probe.swift`: 512 px AVIF q0.70 ≈ 14.8 KB base64.
  618 figures ≈ **9.2 MB** — comfortable, and sharper than the 320 px casts today.
- **So the only missing piece is a generator**: an API key for a hosted image model
  (Google AI Studio, OpenAI, Replicate/fal), roughly $2–21 for 528. GitHub is not an
  option — GitHub Models is retired (`github_models_retirement_brownout`).

## Tests

```
npm install
npm test
```

Boots the real `src/loadbook.html` in jsdom and asserts it renders and behaves:
93 checks over the catalogue, plates, sheets, buying, the display shelf, filters,
the debounced search, and the routines panel and its workout runner. `test/harness.mjs` injects a `window.__lb` bridge to reach
inside the IIFE; the published file is never modified.

## Layout

```
src/loadbook.html    the application
test/                jsdom regression suite
tools/               the catalogue-plate patch, and the image-format probes
archive/             earlier milestones, for rollback
```

## Related

`~/loadbook-ds` — a 40-component React design-system kit extracted from this page for
`/design-sync`. Built and validated; never uploaded, because that needs `/design-login`
from an interactive `claude` terminal and there is no standalone CLI installed here.
