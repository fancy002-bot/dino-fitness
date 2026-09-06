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
| warm-up and cool-down drills | `settings/goals.bodyweight` |
| (derived from a routine's movements) | `routines/*.warmup`, `routines/*.cooldown` |
| | `sessions/*.prep` (what the drills came to) |
| commission rates and movement pools | `settings/goals.height`, `.units` |
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

  **Commission — a programme drawn up from your build and your goal.** You give bodyweight,
  height, training age, days a week and what equipment you have; it draws a split and enters it
  as ordinary routines, which then run, get preliminaries and log like any other.

  **The goal is checked before anything is drawn.** `assessGoal()` works from the rates
  ordinarily used in strength training and shows its arithmetic rather than hiding it:

  - Fat loss above **1% of bodyweight a week** stops being mostly fat. Between 0.65% and 1% is
    called a stretch and allowed through with a word.
  - Muscle gain is capped by training age — about **0.5 / 0.3 / 0.15 lb a week** for a first
    year, a few years, and long-trained.
  - Height sets a floor: a target that would take you under **BMI 18.5** is refused on that
    ground and the room that does exist is offered instead.
  - Goals without a number (strength, endurance, general) have nothing to check and only shape
    the work.

  **When it cannot be met, it says so and answers.** Two ways out are offered and *the one that
  keeps the number you asked for comes first*: "Keep 30 lb, take 15 weeks" before "Keep 4 weeks,
  aim for 8 lb". Nothing is drawn until one is chosen — the refusal never quietly substitutes a
  smaller goal, and never quietly proceeds with an impossible one.

  **What the plan is made of.** `SPLITS` gives 2–6 day shapes; `KIT` holds movement pools for a
  full gym, dumbbells and a bar, or bodyweight only; `RX` sets sets/reps/rest per goal — 5×4 at
  170s rest for strength, 3×12 at 50s with conditioning for fat loss. Starting loads come from
  `LOAD_RATIO` as a fraction of bodyweight by training age (a 200 lb novice squats 100 to start)
  and are labelled as a starting point, not a prescription. Bodyweight-only plans contain no
  loaded lift at all.

  **The table — the eating drawn up beside the programme.** Energy from **Mifflin-St Jeor**,
  which is why the form asks for sex and age: the same body is about 166 kcal apart at rest
  between the male and female constants, and that difference carries through the whole plan.
  Activity comes from the days a week the programme actually asks for.

  **The deficit or surplus is sized from the rate the goal was agreed at**, not guessed
  separately — a pound a week is 3500 kcal, so 500 a day. That is what "match the work" means
  here: negotiate the goal, and the eating follows the number you settled on. Protein is 1.0 g
  per lb in a deficit and 0.85 otherwise, fat 0.35 g per lb, carbs the remainder. The day is
  split into three meals and a training snack, each with a plate worked back from its macros —
  lean protein, a carb, greens, a fat, in grams.

  **A floor the arithmetic cannot go under.** If hitting the agreed rate by eating alone would
  put the target below the resting requirement, it is held at BMR and says so: *training burns
  the rest — do not close the gap by eating less*. This is reachable in practice, for a small
  frame training lightly at the top of the allowed rate, and it is the point at which the app
  stops doing arithmetic and says something. Everything here is labelled an estimate, and
  anything with a medical dimension is pointed at a professional.

  **Preliminaries — a warm-up and a cool-down, optional per routine.** Switched on from
  the routine's *Preliminaries* panel, which opens by itself the moment a routine is created.
  Both default to off; only the two flags `warmup` and `cooldown` are stored on the routine.

  **The drills are derived, never stored**, so revising a routine revises them. Movement
  names are typed freely, so the pattern is read off the name and the kind rather than any
  fixed exercise list: `PATTERN_TESTS` matches a name to one of squat, hinge, pushH, pushV,
  pullV, pullH, core, arms or cardio, a `cardio` kind implies cardio and a `hold` implies
  core, and a name that matches nothing falls back to `other` — whose warm-up is two ramp-up
  sets, which is the right answer for a lift the app has never heard of.

  `collectDrills()` then goes **round-robin** across the routine's patterns rather than
  draining one before starting the next, so under the cap (six warm-up, five cool-down) every
  movement in the routine is still represented. A general drill bookends: easy cardio opens a
  warm-up, slow breathing closes a cool-down. A leg day gets ankle rocks and hip hinges; a
  pull day gets dead hangs and face pulls; neither gets the other's.

  **In the runner they actually run.** The drills sit either side of the movements. *Run
  warm-up* starts the first one that is not done and the block plays itself through: each
  drill counts down on the same clock, chimes at zero, ticks itself off and starts the next,
  until the block is finished or *Stop* takes the clock back. A single drill can be started
  on its own, and logging a set always claims the clock back for the rest interval. A
  rep-counted drill has no natural length, so it is given `max(20, reps × 3)` seconds as a
  guide — it can still be ticked by hand at any point.

  **What was ticked is added up.** Each block header carries a live tally — *4 of 6 · 5:15* —
  and every drill shows what it counted. On closing the workout the totals are written to the
  day as `session.prep`, and the ledger shows a Preliminaries line under that day's sets:
  "warm-up 6 · 6:15 · cool-down 2 · 2:00". They remain preparation, not training: ticking a
  drill writes no entry, the set tally ignores them, they carry no volume, and `prep` is only
  kept on a day that has actual sets in it — so a warm-up alone never counts as a session.

  **Every movement is typed, never picked.** There is no exercise list to choose from —
  not in the composer, not in the log form. A step carries its own `name` and `type`, so
  it describes itself without consulting the repertoire; the only select is the *Kind*,
  which decides which fields the row shows.
  `ensureExercise()` slugs a typed name into an id and adds it to `exercises/*` the first
  time it is actually used — saving a routine, or logging a set — so merely typing enrols
  nothing. `#chartExercise` is the one remaining select, and it is a filter over what you
  have already logged rather than a suggestion for what to log.

  **What to do next session.** The runner used to open on the routine's plan, which never
  moved — week 15 of a commissioned programme prescribed exactly what week 1 did.
  `suggestNext()` now works it out from the ledger by **double progression**, and like the
  warm-up drills it is **derived, never written back**: the routine keeps stating the plan,
  while the numbers you are handed come from what you actually did, so revising a routine still
  works and nothing rewrites your programme behind your back.

  | kind | met the target | missed it |
  |---|---|---|
  | strength | + `loadStep(name)` | hold; **miss twice → ease off ~10%** |
  | bodyweight | +1 rep, or + load once you are carrying any | hold |
  | hold | +5 sec | hold |
  | cardio | +1 min | hold |

  `loadStep()` reuses `PATTERN_TESTS` to size the jump — 10 for squats and hinges, 5 for
  presses and rows, 2.5 for isolation. Two rules keep it honest: **specimen sample entries are
  never progressed from** (they are illustration, not your work), and **the plan is a floor** —
  a plan heavier than your history stands, and a plan that adds load keeps that load rather than
  having it quietly dropped. The runner shows its reasoning under the target — *last time 225 lb
  × 5, 5, 5 · stepping up* — so it is obvious when to overrule it. The log form does the same:
  type a movement it knows and it sets the kind and fills in where you left off.

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

## The parts an app is expected to have

**Settings**, reached from the masthead or the frontispiece. Units, bodyweight, the three
weekly targets, the default rest, the theme, a summary of your record, an export and a
two-step clear. The goal editor that used to live inline on the dials is gone; the
frontispiece only reports now.

**Units.** `settings/goals.units` is `lb` or `kg`. Weight is stored canonically in pounds and
converted only at the edges — `wOut`/`wIn` on the way out and in — so switching units never
rewrites a single entry: 100 kg is kept as 220.46 lb and reads back as 100 kg. Distance
deliberately stays in kilometres whichever weight unit is chosen; pairing lb with miles would
quietly restate every run already in the ledger, which is not a units toggle's job.

**A record per movement.** Tap a movement's name on any entry in the ledger and it opens that
movement's own sheet — its best in the right unit, how many sets over how many days, when it was
last done, its recent sets with PRs marked, and a way through to the progression chart. This
replaced the Repertoire panel, which listed every movement with its best and was otherwise a
dead list; the frontispiece's "Repertoire" count went with it, since it counted the same thing.
The ledger is the better way in — you reach a movement from a set you actually did.

**Attendance.** A year of days, seven rows to the week, shaded by how many sets that day
carried, with today outlined and frozen days hatched. It scrolls inside its own panel on a
narrow screen.

**Your data is yours.** *Copy my ledger* puts the whole thing on the clipboard as JSON —
sessions with their entries and preliminaries, movements, routines and settings. The artifact
sandbox makes page-initiated downloads inert, so the clipboard is the honest route out.

## Three things that make the ledger usable during a session

**Striking a set is undoable.** It is the only destructive thing a user can do, it is one
tap, and it had no confirmation and no way back. The toast now carries an Undo for nine
seconds and `restoreEntry()` puts the entry back with its original id, so undoing twice
cannot duplicate it.

**The rest clock is not locked inside the runner.** It used to exist only while a routine was
running, which left freeform training — the commonest way a log gets used — with no timer at
all. The log panel has a rest bar sharing the same `timer`: one clock, two faces, with
`timerModeText()`/`timerToggleText()` as the single description so the runner's dial and the
bar can never disagree. A logged set starts the rest unless the runner is open, since the
runner owns the clock during a routine. The length is remembered in `lb-rest`, and a rest of
zero starts nothing, for anyone who does not want one.

**A workout in progress survives a closed tab.** Only the pip count was ever runner-local —
the sets are already in the ledger — so losing it meant re-logging recorded work and doubling
it up. `lb-run` keeps `{routineId, date, done[]}` and the runner picks up where it left off.
It is kept per routine and per day rather than counted back out of the ledger, because
counting the ledger would let three squats logged in the morning arrive pre-ticked on an
unrelated leg routine that evening. A finished workout clears it and starts over next time;
revising the routine invalidates it by length.

## The log form keeps what you typed

A set logger is used by repeating the same set. The form used to empty its fields on every
submit, so pressing *Enter into ledger* a second time did nothing at all and read as the app
refusing the movement — and a 3×5 meant retyping the weight and the reps three times. Nothing
is cleared now; the button turns green and names the set so you can see it landed. The same
reasoning applies in the runner, where a finished movement still accepts an extra set rather
than disabling its Log button: a ledger that will not write down work you actually did is the
wrong kind of strict. Extra sets are marked `+n` beside the planned pips.

## Rendering cost

`renderShop()` rebuilds 618 catalogue cards, and `renderAll()` runs on every logged set: on a
4×-throttled CPU that measured **143 ms per set**, 104 ms of it the catalogue. `shopSignature()`
now folds every input that changes those cards — filter, query, tokens, owned, eras, finishes —
into one string, and `renderShop()` returns early when it has not moved. Logging a set touches
none of them, so it fell to **37 ms**; buying, claiming or unlocking an era still redraws in
full. Add to the signature if you add an input, or the catalogue will go stale.

## What the third round of user testing changed

Thirteen agents drove the published build as real people — a powerlifter on a heavy/light
split, a first-timer, a calisthenics athlete, a metric lifter, a coach with six months of
history, a keyboard-only user at 200% text, a data migration, an adversarial pass. What
they found were not missing features. They were places where the app was confidently wrong.

**Escaping belongs in `showToast`, not at its call sites.** Four of about thirty callers
passed a movement, routine or collector name straight into `innerHTML`. A movement named
`<img src=x onerror=…>` executed on its own personal-record toast, survived into the export,
and came back on import. `showToast` now escapes `title` and `sub` itself and the call sites
pass raw text; the icon parameter is still markup on purpose.

**Every numeric write is bounded at the boundary.** `sane(v, ceil)` returns `null` for
anything non-finite or out of range, and the log form, the inline pencil edit, the weigh-in,
the settings targets and `importLedger` all go through it. One `1e308` used to make `round1`
overflow to `Infinity`, which made the whole progression chart `NaN` with no way to find the
row responsible.

**The specimen flag lives on the entry, not the session.** It was per session, so one demo
plank made a whole day of real work invisible to progression and deletable by "Clear
specimen entries". Legacy records are normalised down onto their entries once at load.

**Import reconciles, and says what it skipped.** Dedupe is scoped to `date + id` rather than
globally (the seed reused `squat-0` on every specimen day, so restoring your own backup
dropped 41% of it); an entry without an id is given one; a re-import with changed values is a
correction rather than a duplicate; bad dates and unreadable rows are counted and reported;
`rewards`, units, progression and sex all come back, because the export had always carried
them and the import had always thrown them away.

**Eras unlock on weeks that met your session target.** They used to need five consecutive
training days. A Mon/Tue/Thu/Fri programme can never reach five, so eighty-three correct
sessions unlocked nothing at all — the reward loop punished exactly the programming it
should reward.

**Progression reads the right day, and notices a lay-off.** Sets logged through a runner
carry their `routineId`, so a heavy/light split no longer progresses Monday off Thursday's
lighter work. Ten days or more since the last session sets `stale`, backs the prescription
off, and says so on the runner line; `suggestNote` now dates itself.

**Loads land on a grid you can actually load.** `loadStep` and `roundLoad` are unit-aware,
so a metric deload is 75 kg rather than 74.8, and a step is 2.5 kg rather than 10 lb.

**The plate is solved, not stacked.** `buildPlate` sized the protein food to hit the protein
target on its own and never subtracted the protein already in 250 g of rice — the food
listed came out 47% over on protein against the header printed above it. It now iterates to
a solution, and the figure beside each meal is computed from the food on the plate.

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
738 checks over the catalogue, plates, sheets, buying, the display shelf, filters,
the debounced search, the routines panel and its workout runner — including a block that
walks a three-movement routine set by set and asserts the rest clock tracks whichever
movement was just logged — and `boot-kinds.mjs`, which carries bodyweight reps, weighted
and assisted variants, and timed holds through the composer, the runner, the log form,
the weekly volume, personal records and each movement's own record; and `boot-prelude.mjs`, which proves
the derivation does its job — a leg routine and a pull routine get demonstrably different
drills, every pattern survives the cap, that the clock chains drill to drill on its own and
lets go at the end, that a logged set claims it back, and that what was ticked is added up onto
the day without ever becoming an entry. and `boot-hardening.mjs`, which pins the third round of user-test findings: the toast
escapes what it is handed, an overflowing figure is refused with a reason, a weigh-in is
neither a session nor a record, specimen entries clear without taking real work with them,
an export round-trips every set including ids that repeat across days, an import corrects
rather than duplicates and reports what it skipped, a weighted hold outranks a longer bare
one, a four-day week counts toward an era, the ledger is searchable past fourteen sessions,
and the volumes are a real tab pattern with an inert background behind a dialog.
`test/harness.mjs` injects a `window.__lb` bridge to reach
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
