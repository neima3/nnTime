import { describe, expect, it } from "vitest";
import { renderQuizBankSwift } from "@/lib/quiz-bank-swift";

/**
 * Web ↔ iOS quiz-bank mirror contract.
 *
 * QuizBank.swift is generated from src/lib/games.ts, so both platforms teach
 * from byte-identical content. If this fails you edited a bank (or the
 * renderer) without regenerating the Swift side: run `pnpm quiz:sync-ios`
 * and commit the result.
 */
describe("iOS QuizBank mirror", () => {
  it("QuizBank.swift matches the renderer output for games.ts", async () => {
    await expect(renderQuizBankSwift()).toMatchFileSnapshot(
      "../ios/App/Features/Play/QuizBank.swift",
    );
  });
});
