export interface QuaestioOption {
	/** 1-based position in the option list */
	index: number;
	/** Display text after the [ ] / [x] marker */
	text: string;
	selected: boolean;
}

export interface QuaestioQuestion {
	numberOfCorrectAnswers: number;
	/** 1-based correct option indexes */
	correctIndexes: number[];
	title: string;
	stem: string;
	options: QuaestioOption[];
	/** Display-only Correct Answer body */
	correctAnswerRaw: string;
	/** Display-only Explanation body */
	explanation: string;
}

export type GradeResult = "correct" | "incorrect" | "unanswered";

export type ParseResult =
	| { ok: true; question: QuaestioQuestion }
	| { ok: false; error: string };
