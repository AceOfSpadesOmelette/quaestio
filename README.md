# Quaestio

Turn a `quaestio` block into a multiple-choice question in Reading view and in Live Preview.

Your selection is saved with `[x]`. **Check** is saved as `answer-checked: true` or `false`. **Show answer** and **Hide answer** are saved as `answer-revealed: true` or `false`.

## Question format

Flags control the question. Flag names are not shown in Reading view. Each option is a line that starts with `[ ]` or `[x]`. Flag values can be plain text or Markdown.

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
| --- | --- | --- |
| `number-of-correct-answers: N` | yes | `1` is single-select. Greater than `1` is multi-select. |
| `correct-index: [...]` | yes | Correct options, counting from 1. Example: `[2]` or `[2, 4]`. |
| `question-title:` | yes | Title at the top |
| `question-stem:` | yes | Question body |
| `correct-answer:` | no | Text under **Correct Answer** |
| `explanation:` | no | Text under **Explanation** |
| `answer-revealed: true` or `false` | no | Whether the answer panel is open. Omitted means hidden. |
| `answer-checked: true` or `false` | no | Whether Check has been applied. Omitted means not graded. Restores the Correct, Incorrect, or Unanswered banner. |

Flags that describe the question can appear in any order before the first option. `correct-answer`, `explanation`, `answer-revealed`, and `answer-checked` may also appear after the options. Each flag may appear only once.

A value can sit on the same line as the flag, or on the following lines:

```text
question-stem: What is 1 + 1?

correct-answer:
B. 2

explanation:
1 plus 1 is equal to 2.
```

The block shows an error instead of the question when:

- A required flag is missing
- A flag is repeated or unknown
- `number-of-correct-answers` does not match how many indexes are listed
- An index is out of range or repeated
- There are more correct answers than options
- There are fewer than two options

Grading uses the indexes only. Labels such as `A.` or `1.`, and the correct-answer and explanation text, are only for display.

### More than one correct option

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

### Numbered choices

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

## Answering

1. Open the note in Reading view.
2. Select options. An empty circle is unselected. A filled circle is selected. For a single answer, click the selected option again to clear it.
3. **Check** grades the selection, highlights correct, incorrect, and missed options, and shows Correct, Incorrect, or Unanswered. That state is saved as `answer-checked: true`. Check does not open Correct Answer or Explanation. Reopening the note restores the banner.
4. **Show answer** and **Hide answer** open or close Correct Answer and Explanation. Hide only closes the panel. It does not let you change the selection.
5. After **Check** or **Show answer**, the options stay locked until **Reset**.
6. **Reset** clears the selection, the highlights, and the answer panel, and unlocks the options. It also clears `[x]`, sets `answer-checked: false`, and sets `answer-revealed: false`.

The title, stem, options, correct answer, and explanation can contain Markdown. Flag names stay hidden.

## Dashboard

A `quaestio-dashboard` block scores every `quaestio` block in the same note. Flag order is the order on screen. Several dashboards in one note share the same counts and the same Check, Show, and Reset results. Each dashboard can list different flags.

````markdown
```quaestio-dashboard
live-update: true
include-unanswered: true
check-answered
check-all
show-hide-all
reset-all
correct-score: Correct: {count} / {total} ({pct}%)
incorrect-score: Incorrect: {count} / {total} ({pct}%)
unanswered-score: Unanswered: {count} / {total} ({pct}%)
```
````

| Flag | Meaning |
| --- | --- |
| `live-update: true` or `false` | Not shown. Default `true`: scores refresh as answers change. `false` keeps the scores until **Update**. |
| `include-unanswered: true` or `false` | Not shown. Default `true`. When `false`, the correct and incorrect totals count answered questions only. The unanswered total is always every question in the note. |
| `check-answered` | Check questions that already have a selection |
| `check-all` | Check every question. An empty selection becomes Unanswered. |
| `show-hide-all` | Show every answer, or hide them if any answer panel is open |
| `reset-all` | Reset every question |
| `correct-score` | Correct count. `{count}` is the numerator, `{total}` is the denominator, and `{pct}` is the percent with at most two decimals. `{x}` and `{y}` are older names for `{count}` and `{total}`. |
| `incorrect-score` | Incorrect count, with the same tokens |
| `unanswered-score` | Unanswered count. `{total}` is always the number of questions. |

Action buttons sit on one wrapping row, then the score lines. Scores come from the current selections, not from whether Check was pressed. The buttons always run immediately. Only the score lines wait when live update is off.

## Support

[![Buy Me a Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://buymeacoffee.com/aceofspadesomelette)

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=AceOfSpadesOmelette/quaestio&type=Date)](https://www.star-history.com/#AceOfSpadesOmelette/quaestio&Date)
