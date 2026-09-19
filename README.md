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
3. **Check** — grades your selection and opens the answer panel if hidden.
4. **Show answer** / **Hide answer** — toggles Correct Answer and Explanation (saved in the note as `answer-revealed`).
5. **Reset** — clears selections, grading highlights, and the answer panel (also clears `[x]` and sets `answer-revealed: false`).

Title, stem, options, Correct Answer body, and Explanation body support markdown; flag **names** never appear in Reading view.
