/**
 * Renders ios/App/Features/Play/QuizBank.swift from the web quiz banks —
 * the single source of truth in games.ts. The Swift file is generated, never
 * hand-edited: tests/ios-quiz-bank-sync.test.ts pins the checked-in file to
 * this renderer's output, so any bank edit that skips `pnpm quiz:sync-ios`
 * fails CI instead of silently drifting the platforms apart.
 */
import {
  GRAMMAR_BANK,
  QUIZ_TOPIC_LABELS,
  SPELLING_BANK,
  type QuizItem,
} from "./games";

/** Escape a JS string into a Swift double-quoted literal body. */
function swiftString(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  const control = escaped.match(/[\u0000-\u001f]/);
  if (control) {
    throw new Error(
      `Bank string contains an unescapable control character (U+${control[0].charCodeAt(0).toString(16).padStart(4, "0")}): ${value.slice(0, 60)}`,
    );
  }
  return `"${escaped}"`;
}

function swiftStringArray(values: string[]): string {
  return `[${values.map(swiftString).join(", ")}]`;
}

function renderItem(item: QuizItem, fallbackTopic: string): string {
  const lines = [
    `        QuizItem(`,
    `            topic: ${swiftString(item.topic ?? fallbackTopic)},`,
    `            prompt: ${swiftString(item.prompt)},`,
    `            options: ${swiftStringArray(item.options)},`,
    `            answer: ${swiftString(item.answer)},`,
  ];
  const tail: string[] = [];
  if (item.examples && item.examples.length > 0) {
    const rows = item.examples.map(
      (ex) =>
        `                QuizExample(word: ${swiftString(ex.word)}, sample: ${swiftString(ex.sample)})`,
    );
    tail.push(`            examples: [\n${rows.join(",\n")}\n            ]`);
  }
  if (item.stress) tail.push(`            stress: ${swiftString(item.stress)}`);
  const note = `            note: ${swiftString(item.note)}`;
  const fields = [note, ...tail];
  return `${lines.join("\n")}\n${fields.join(",\n")}),`;
}

function renderBank(items: QuizItem[], fallbackTopic: string): string {
  const out: string[] = [];
  let lastTopic: string | null = null;
  for (const item of items) {
    const topic = item.topic ?? fallbackTopic;
    if (topic !== lastTopic) {
      const label = QUIZ_TOPIC_LABELS[topic] ?? topic;
      out.push(`        // -- ${label} (${topic}) --`);
      lastTopic = topic;
    }
    out.push(renderItem(item, fallbackTopic));
  }
  return out.join("\n");
}

export function renderQuizBankSwift(): string {
  const labels = Object.entries(QUIZ_TOPIC_LABELS)
    .map(([slug, label]) => `        ${swiftString(slug)}: ${swiftString(label)},`)
    .join("\n");

  return `import Foundation

// GENERATED FILE — do not edit by hand.
// Source of truth: src/lib/games.ts (QUIZ_TOPIC_LABELS, GRAMMAR_BANK,
// SPELLING_BANK). Regenerate with \`pnpm quiz:sync-ios\`; drift fails
// tests/ios-quiz-bank-sync.test.ts.

struct QuizExample: Equatable {
    let word: String
    let sample: String
}

struct QuizItem: Equatable {
    let topic: String
    let prompt: String
    let options: [String]
    let answer: String
    let note: String
    var examples: [QuizExample] = []
    var stress: String? = nil
}

enum QuizBank {
    static let topicLabels: [String: String] = [
${labels}
    ]

    static let grammar: [QuizItem] = [
${renderBank(GRAMMAR_BANK, "general")}
    ]

    static let spelling: [QuizItem] = [
${renderBank(SPELLING_BANK, "spelling")}
    ]
}
`;
}
