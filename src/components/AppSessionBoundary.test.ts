import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AppSessionProvider,
  SignedInOnly,
  useAppSession,
} from "./AppSessionBoundary";

function SessionState() {
  const { signedIn } = useAppSession();
  return React.createElement("span", null, signedIn ? "signed-in" : "signed-out");
}

describe("AppSessionBoundary", () => {
  it("fails closed when no provider is mounted", () => {
    expect(renderToStaticMarkup(React.createElement(SessionState))).toContain(
      "signed-out",
    );
  });

  it("renders the fallback without mounting private children while signed out", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        AppSessionProvider,
        { signedIn: false },
        React.createElement(
          SignedInOnly,
          { fallback: React.createElement("p", null, "Sign in") },
          React.createElement("p", null, "Private planner"),
        ),
      ),
    );

    expect(markup).toContain("Sign in");
    expect(markup).not.toContain("Private planner");
  });

  it("renders private children when the server session is present", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        AppSessionProvider,
        { signedIn: true },
        React.createElement(
          SignedInOnly,
          { fallback: React.createElement("p", null, "Sign in") },
          React.createElement("p", null, "Private planner"),
        ),
      ),
    );

    expect(markup).toContain("Private planner");
    expect(markup).not.toContain("Sign in");
  });
});
