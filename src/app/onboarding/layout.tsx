import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set up your planner · Kairo",
};

export default function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
