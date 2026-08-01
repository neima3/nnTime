import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Clock } from "lucide-react";
import { describe, expect, it } from "vitest";
import { SignedOutCard } from "./EmptyState";

const copy = {
  icon: Clock,
  title: "Continue after you sign in",
  body: "Your planner stays synced across devices.",
};

describe("SignedOutCard heading contract", () => {
  it("uses h2 for embedded cards by default", () => {
    const html = renderToStaticMarkup(React.createElement(SignedOutCard, copy));

    expect(html).toContain("<h2");
    expect(html).not.toContain("<h1");
  });

  it("supports a route-level h1 without duplicating the card", () => {
    const html = renderToStaticMarkup(
      React.createElement(SignedOutCard, { ...copy, headingLevel: "h1" }),
    );

    expect(html).toContain("<h1");
    expect(html).not.toContain("<h2");
  });
});
