# Quaestio sample

Open this note in **Reading view** (or Live Preview) with the Quaestio plugin enabled.

Flags (`number-of-correct-answers`, `correct-index`, `question-title`, `question-stem`, `correct-answer`, `explanation`) are hidden in Reading view. Their **values** are what you see.

## How to use Check

1. Select your answer(s) — hollow circle = empty, filled circle = selected. For single-select, click the filled option again to clear it.
2. Click **Check** → **Correct**, **Incorrect**, or **Unanswered** (yellow-orange), with highlights.
3. Correct Answer and Explanation open after Check; use **Hide answer** / **Show answer** to toggle.
4. Change your selection and Check again to re-grade.
5. **Reset** clears selections, feedback, and the answer panel back to a fresh block.

---

## Single-correct (letter labels)

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
explanation: 1 plus 1 is equal to 2. Check after you select B.
```

---

## Pre-selected wrong answer

Already has option 1 marked `[x]`. Press **Check** (Incorrect), then select option 2 and Check again.

```quaestio
number-of-correct-answers: 1
correct-index: [2]
question-title: Question 2
question-stem: What is 2 + 2?

[x] A. 3
[ ] B. 4
[ ] C. 5
[ ] D. 22

correct-answer: B. 4
explanation: 2 + 2 = 4.
```

---

## Multi-correct

`number-of-correct-answers: 2` enables multi-select. You must pick options 2 and 4.

```quaestio
number-of-correct-answers: 2
correct-index: [2, 4]
question-title: Question 3
question-stem: Which of the following numbers are even?

[ ] A. 1
[ ] B. 2
[ ] C. 3
[ ] D. 4

correct-answer: B. 2, D. 4
explanation: Select both B and D, then Check. Selecting only B is Incorrect.
```

---

## Numbered option labels

Indexes still refer to position (1 = first option), not the printed number in the label text.

```quaestio
number-of-correct-answers: 1
correct-index: [2]
question-title: Question 4
question-stem: Pick the prime number.

[ ] 1. 4
[ ] 2. 7
[ ] 3. 9
[ ] 4. 15

correct-answer: 2. 7
explanation: 7 is prime. The correct-index is [2] (second option), which happens to be labeled "2. 7".
```

---

## Check vs Show answer

```quaestio
number-of-correct-answers: 1
correct-index: [2]
question-title: Question 5
question-stem: Which planet is known as the Red Planet?

[ ] A. Venus
[ ] B. Mars
[ ] C. Jupiter
[ ] D. Saturn

correct-answer: B. Mars
explanation: **Show answer** peeks at the key without selecting. **Check** grades your selection.
```

---

## Multi-line stem and answer (flag bodies)

```quaestio
number-of-correct-answers: 1
correct-index: [1]
question-title: Question 6
question-stem:
Choose the best description of water at room temperature.

[ ] A. Liquid
[ ] B. Solid
[ ] C. Gas
[ ] D. Plasma

correct-answer:
A. Liquid

explanation:
Water is a liquid at typical room temperature.
```
