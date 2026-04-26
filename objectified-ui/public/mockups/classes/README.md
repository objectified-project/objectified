# Class editor dialog · redesign mockup

Polish pass on the **new / edit class dialog** that lives in
`objectified-ui/src/app/components/ade/studio/ClassEditDialog.tsx`.

Open [`gallery.html`](./gallery.html) for the index of all variants, or
jump straight to a screen below.

This is form-only — class properties (the row table) are still edited in
the canvas / PropertyDialog and are not in scope here. We have a
`with-properties.html` exploration for the alternate direction, but
we did not pick it.

---

## Variants

| File | What it shows |
| --- | --- |
| [`index.html`](./index.html) | The default Advanced view: section nav · form · live preview & lint |
| [`wizard.html`](./wizard.html) | Wizard mode — single-step focus with a stepper |
| [`empty-state.html`](./empty-state.html) | Brand-new class — quick-start cards, AI prompt, blank form |
| [`ai-mode.html`](./ai-mode.html) | AI sidekick panel open, mid-conversation, suggestions queued in the form |
| [`errors.html`](./errors.html) | Validation errors + warnings; save blocked; quick fixes |
| [`with-properties.html`](./with-properties.html) | Exploratory variant — property table inside the dialog (not chosen) |

---

## What the current dialog does well

- All 14 form sections are present and round-trip cleanly to JSON Schema 2020-12.
- Wizard mode + Advanced mode lets first-timers and power users coexist.
- `FormSection` / `FormSubsection` primitives give a consistent visual rhythm.
- The AI assistant for "create from prompt" is a real productivity win.

## What the current dialog does poorly

1. **Cognitive load.** 14 separate sections in a single linear scroll — a
   user can't tell at a glance which sections matter for their class.
2. **Tabs hide the schema.** Edit / JSON / YAML / Example are mutually
   exclusive tabs, so you can never see your form *and* the resulting
   schema at the same time.
3. **No per-section feedback.** A section can be "wrong" (lint warning,
   missing required field) but the only signal is buried inside the
   section. No completeness indicator.
4. **No impact context.** When editing `Subscription`, you don't see
   that 6 paths and 3 other classes depend on it — even though that's
   exactly what makes a "save" risky.
5. **AI assistant is modal.** It takes over the whole dialog instead of
   being available alongside the form.
6. **No clear unsaved state.** "4 unsaved changes" — but which? When were
   they made? By whom (in shared editing scenarios)?

---

## Design moves in this mockup

### 1. Three-pane layout

```
[ section nav | form sections | inspector (validation + live schema + impact) ]
```

The right inspector is always visible and shows:

- a **validation card** (passes / warns / errors with quick-fix links)
- a **live JSON / YAML preview** (no tab switch required)
- a **references / impact card** (paths and classes that reference this one)

This collapses the existing tabbed `Edit / JSON / YAML / Example`
experience into a single page where the form *and* the artifact are
always in view.

### 2. Header at-a-glance

- **Completeness ring** (e.g. `62%`) = filled / available fields.
- **Status pill**: `4 unsaved · Last saved 2m ago by Kenji`. The amber
  dot shows there are unsaved edits; closing without saving prompts.
- **Tags + namespace context** in the title row, not buried in the
  Basics section.

### 3. Section grouping (14 → 6)

The left nav groups existing sections under semantic headers:

| Group | Sections |
| --- | --- |
| Identity | Basics |
| Validation | Object constraints · Additional · Unevaluated |
| Composition | Inheritance (allOf / anyOf / oneOf + discriminator) |
| Conditional & Dynamic | Pattern · Dependent schemas · Dependent required · If/then/else |
| Documentation | Examples · External docs · Schema metadata |
| Advanced | XML · Extensions |

Each item has a colored dot:

- **indigo dot** = changed in this session
- **amber dot** = lint warning
- **rose dot** = invalid (would block save)

### 4. Progressive disclosure within the form

Sections in use expand with their full UI; untouched optional sections
collapse to a single-row "add me" stub at the bottom of the form.

### 5. View artifacts via a `View ▾` header menu

JSON Schema, YAML, Example payload, and OpenAPI fragment are no longer
top-level tabs that hide the form. They live in the `View ▾` header
menu and open in a side sheet (Monaco-backed) for read/copy/edit. The
right inspector also shows a live JSON preview that's enough for the
common case.

### 6. AI sidekick — persistent, toggleable panel

The AI lives as a togglable side panel rather than a modal takeover or
inline buttons sprinkled across fields. Toggle the **AI sidekick** button
in the header to open a chat panel that:

- sees the current class as live context
- can edit form fields directly (changes appear as accept/reject suggestions)
- offers quick actions (Suggest description, Discriminator, Lint fix, Generate examples)

See [`ai-mode.html`](./ai-mode.html) for the open state.

### 7. Composition picker as cards, not tabs

Three radio cards for allOf / anyOf / oneOf — only the chosen one expands
its picker. Discriminator configuration becomes a `<details>` block.

### 8. Conditional builder reads as a sentence

```
[IF] [status ▾] [equals ▾] [ trialing ] [THEN] require [ trial_end ]
```

### 9. Footer dock

Discard / Cancel / Save with keyboard hints (`⌘ S`, `⌘ ⏎`, `⌘ K`, `Esc`)
visible. Save is **explicit** — autosave is intentionally not used.
Closing with unsaved changes prompts the user.

---

## Decisions (locked in for implementation)

| Question | Decision |
| --- | --- |
| Wizard mode | **Keep the toggle** — Advanced + Wizard are both first-class |
| Properties table inside the dialog | **No** — properties stay in the canvas / PropertyDialog |
| Schema / YAML / Example views | **Move to a `View ▾` menu** in the header (Monaco opens in a side sheet) |
| Save model | **Explicit save**, with unsaved-changes warning on close. No autosave. |
| Diff card | **Removed from this dialog** — diffing lives in the Versions screen |
| AI assistant | **Persistent sidekick panel**, toggleable alongside the form |

---

## Files

```
mockups/classes/
├── README.md             ← this file
├── gallery.html          ← visual index of all variants
├── index.html            ← Advanced view (default)
├── wizard.html           ← Wizard step view
├── empty-state.html      ← Brand-new class
├── ai-mode.html          ← Sidekick panel open
├── errors.html           ← Validation errors blocking save
└── with-properties.html  ← Exploratory; not chosen
```

---

## Implementation notes (for the build phase)

- `ClassEditDialog.tsx` already has `CLASS_SECTION_ORDER` and
  `CLASS_WIZARD_STEPS` — the new section grouping maps cleanly onto these,
  so the underlying state model doesn't have to change.
- The right inspector is new component territory: split into
  `ValidationCard`, `LivePreviewCard`, `ImpactCard`, each subscribing to
  the form state via the existing `formData` reducer.
- The AI sidekick reuses the existing Ollama chat plumbing
  (`/api/ollama/models`, `/api/ollama/chat`) — what changes is layout
  (right panel vs full takeover) and the new "apply suggestion to form"
  contract that lets the assistant emit accept/reject patches against
  the form state.
- The `View ▾` menu side sheet can wrap the existing Monaco editor
  components — they just no longer drive the active tab.
