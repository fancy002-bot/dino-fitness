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
| | `settings/goals.bodyweight` |
| | `profiles/*`, `invites/*`, `friends/*/list/*` |

Collector cards (`lb-me`) and the theme choice are browser-local, not in the db.

## Three volumes

- **I — The Ledger.** Set logging, goal dials, daily stipend, streak freezes, and five
  eras that unlock at 1 / 3 / 5 / 8 / 12 completed five-day streaks. Plus **Routines**:
  workouts you compose yourself — a title and an ordered list of movements, each with
  sets, reps, a target weight (or minutes, for cardio) and a rest interval. The four
  built-in standards (Push / Pull / Leg / Cardio & Core) are read-only starters you
  *adopt* into a routine of your own. Routines replaced the template pill row and chip
  tray that used to sit above the log form; `TEMPLATES` survives only as the seed for
  those four standards.

  **Four kinds of work, because this is not only a barbell ledger.** `KINDS` is the single
  description of them and everything else reads from it:

  | kind | fields | judged on |
  |---|---|---|
  | `strength` | sets, reps, weight | heaviest set |
  | `bodyweight` | sets, reps, added lb (may be negative for assistance) | most reps at that added load |
  | `hold` | sets, seconds | longest hold |
  | `cardio` | minutes, distance | distance, else duration |

  A pull-up is a `bodyweight` movement, not a 0 lb lift; a plank is a `hold`, not 0.75
  minutes of cardio. Entries written before these kinds existed are `strength`/`cardio` and
  still render through those branches — a legacy 0 lb set still reads "BW × 8".

  **The weekly volume counts bodyweight work.** A calisthenics session used to move the
  Volume dial not at all, because volume was `weight × reps`. `entryLoad()` now counts a
  bodyweight set as `(your bodyweight + added) × reps`, which needs a number from you:
  `settings/goals.bodyweight`, edited beside the goal targets. Until it is set, bodyweight
  sets contribute nothing and the frontispiece says so rather than guessing what you weigh.
  Holds and cardio carry no pounds and are excluded by design.

  **Every movement is typed, never picked.** There is no exercise list to choose from —
  not in the composer, not in the log form. A step carries its own `name` and `type`, so
  it describes itself without consulting the repertoire; the only select is the *Kind*,
  which decides which fields the row shows.
  `ensureExercise()` slugs a typed name into an id and adds it to `exercises/*` the first
  time it is actually used — saving a routine, or logging a set — so merely typing enrols
  nothing. `#chartExercise` is the one remaining select, and it is a filter over what you
  have already logged rather than a suggestion for what to log.

  **The runner.** "Begin" opens a runner overlay: a countdown dial, the ordered
  movements with one filled pip per completed set, and per-set weight/rep fields
  prefilled from the target — with minutes and distance, for a cardio movement.
  Logging a set writes straight into the ledger (PR detection and all) and starts
  *that movement's* rest clock, which chimes through WebAudio at zero — so there is
  no audio asset to ship. The last set of the workout leaves the clock stopped rather
  than resting for nothing. Space toggles the clock,
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

## Three traps in this file

**Number inputs take `step="1"` or `step="any"`, never a grid.** A `step="5"` on the
rest field makes a browser reject 8 as a step mismatch and silently refuse to submit the
whole composer — no error, nothing saved. jsdom does no constraint validation, so the
suite cannot see it; `boot-routines.mjs` guards it structurally instead, by asserting no
number field anywhere carries a restrictive step.

**A row read mid-kind-switch has the old kind's fields.** When the Kind select changes, the
row in the DOM is still drawn for the *previous* kind while the select already reads the new
one, so `readStepRows()` must guard every optional field (`.s-add`, `.s-wt`) rather than
dereference `.value` on it. Read the typed name back *after* `syncDraft()`, not before, or
switching kind silently reverts it.

**`renderStepRows()` redraws from the draft, so read the rows back first.** Anything
typed into a step row lives only in the DOM until `syncDraft()` copies it into
`state.routineDraft`. Every handler that adds, removes or retypes a row calls it first;
skip it and the user's other rows silently revert.

## Tests

```
npm install
npm test
```

Boots the real `src/loadbook.html` in jsdom and asserts it renders and behaves:
226 checks over the catalogue, plates, sheets, buying, the display shelf, filters,
the debounced search, the routines panel and its workout runner — including a block that
walks a three-movement routine set by set and asserts the rest clock tracks whichever
movement was just logged — and `boot-kinds.mjs`, which carries bodyweight reps, weighted
and assisted variants, and timed holds through the composer, the runner, the log form,
the weekly volume, personal records and the repertoire. `test/harness.mjs` injects a `window.__lb` bridge to reach
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
