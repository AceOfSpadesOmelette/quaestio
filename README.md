# Quaestio

Turn `quaestio` code blocks into interactive multiple-choice questions in Obsidian **Reading view** (and Live Preview). Selections are saved as `[x]` markers; Show/Hide answer is saved as `answer-revealed: true|false`.

## Install

1. Copy this folder into your vault’s `.obsidian/plugins/` directory (folder name: `quaestio`).
2. Run `npm install` and `npm run build` inside the plugin folder.
3. Enable **Quaestio** under Settings → Community plugins.

## Required format

All structure is driven by **flags** (flag names are never shown in Reading view). Option lines use `[ ]` / `[x]`. Flag values support plain text or markdown.

````markdown
```quaestio
number-of-correct-answers: 1
correct-index: [2]
question-title: Question 1
question-stem: What is 1 + 1?

[ ] A. 1
[ ] B. 2
[ ] C. 3
[ ] D. 4

correct-answer: B. 2
explanation: 1 plus 1 is equal to 2.
```
````

### Flags

| Flag | Required | Meaning |
|------|----------|---------|
| `number-of-correct-answers: N` | yes | `1` = single-select; `N > 1` = multi-select |
| `correct-index: [...]` | yes | **1-based** indexes of correct options (e.g. `[2]` or `[2, 4]`) |
| `question-title:` | yes | Title shown at the top |
| `question-stem:` | yes | Question body |
| `correct-answer:` | no | Body under the UI label **Correct Answer:** |
| `explanation:` | no | Body under the UI label **Explanation:** |
| `answer-revealed: true\|false` | no | Whether the answer panel is open (`false` / omitted = hidden) |

Machine flags and content flags may appear in any order **before** the first option line. `correct-answer`, `explanation`, and `answer-revealed` may also appear **after** the options. Each flag key may appear only once.

Inline values and multi-line bodies both work:

```text
question-stem: What is 1 + 1?

correct-answer:
B. 2

explanation:
1 plus 1 is equal to 2.
```

Validation errors (shown in place of the block) if:

- Required flags are missing
- A flag key is duplicated or unknown
- `N` does not match the length of `correct-index`
- Any index is out of range or duplicated
- `N` is greater than the number of options
- Fewer than 2 options

Grading uses **indexes only**. Option labels (`A.` / `1.` / anything else) and the `correct-answer` / `explanation` bodies are for display.

### Multi-correct example

````markdown
```quaestio
number-of-correct-answers: 2
correct-index: [2, 4]
question-title: Question 2
question-stem: Which numbers are even?

[ ] A. 1
[ ] B. 2
[ ] C. 3
[ ] D. 4

correct-answer: B. 2, D. 4
explanation: 2 and 4 are divisible by 2.
```
````

### Numbered labels (optional style)

````markdown
```quaestio
number-of-correct-answers: 1
correct-index: [2]
question-title: Question 3
question-stem: Pick the prime.

[ ] 1. 4
[ ] 2. 7
[ ] 3. 9
[ ] 4. 15

correct-answer: 2. 7
explanation: 7 is prime.
```
````

## Using Quaestio

1. Open the note in **Reading view**.
2. Select options — hollow circle = empty, filled circle = selected. Single-select: click again to clear.
3. **Check** — grades your selection and highlights correct / incorrect / missed options. Does **not** open Correct Answer or Explanation.
4. **Show answer** / **Hide answer** — toggles Correct Answer and Explanation (saved in the note as `answer-revealed`). Hide only closes the panel; it does not re-enable picking.
5. After **Check** or **Show answer**, options cannot be changed until **Reset**.
6. **Reset** — clears selections, grading highlights, the answer panel, and unlocks options (also clears `[x]` and sets `answer-revealed: false`).

Title, stem, options, Correct Answer body, and Explanation body support markdown; flag **names** never appear in Reading view.

## Dashboard

A `quaestio-dashboard` block controls and scores every `quaestio` block in the **same note**. Flag order is the display order. Several dashboards in one note stay consistent (same counts and the same Check / Show / Reset results) but can list different flags.

````markdown
```quaestio-dashboard
live-update: true
check-answered
check-all
show-hide-all
reset-all
correct-score: Correct: {x} / {y} ({pct}%)
incorrect-score: Incorrect: {x} / {y}
unanswered-score: Unanswered: {x} / {y}
total-score: Total: {y}
```
````

| Flag | Meaning |
|------|---------|
| `live-update: true\|false` | Config only (not shown). Default `true`: score lines refresh as answers change. `false` freezes scores until **Update**. |
| `check-answered` | Check blocks that already have a selection |
| `check-all` | Check every block (empty selections become Unanswered) |
| `show-hide-all` | Show all answers, or hide them if any answer panel is open |
| `reset-all` | Reset every block |
| `correct-score` | Correct count. Tokens: `{x}` count, `{y}` total blocks, `{pct}` percent (at most 2 decimals) |
| `incorrect-score` | Incorrect count. Same tokens |
| `unanswered-score` | Unanswered count. Same tokens |
| `total-score` | Total `quaestio` blocks (`{x}` and `{y}` are both the total; `{pct}` is `100` when the note has questions) |

Scores are recomputed from current selections, not from whether Check was pressed. Action buttons always run immediately; only the score lines follow `live-update`.



## Develop

```bash
npm install
npm run build
npm test
```

CI runs build + Jest on push/PR. Tag a version matching `manifest.json` (for example `1.0.0`) to create a draft GitHub release with `main.js`, `manifest.json`, and `styles.css` when present.
