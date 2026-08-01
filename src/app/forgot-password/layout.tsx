import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset your password · Kairo",
};

export default function ForgotPasswordLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
