export type PrivacySection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

export const privacyPolicy = {
  updated: "July 28, 2026",
  contactEmail: "neima@nakhaee.us",
  summary:
    "Kairo stores the account and planner information needed to keep your day available across devices. We do not sell personal information, do not run ads, and do not use advertising trackers.",
  sections: [
    {
      id: "information",
      title: "Information Kairo receives",
      paragraphs: [
        "When you create an account, Kairo receives your email address, account identifier, and authentication records. Kairo stores the plans, tasks, routines, notes, checklists, preferences, completion history, focus sessions, and mood check-ins you choose to add.",
        "Kairo also processes limited technical records needed to sync changes, prevent abuse, diagnose failures, and keep the service secure. If you connect or import a calendar, Kairo receives the calendar events and connection information required for that feature.",
      ],
    },
    {
      id: "health",
      title: "Apple Health stays on your device",
      paragraphs: [
        "Apple Health access is off by default and requires separate permission for each feature. Kairo can write a completed focus session as mindful minutes and can read recent Sleep Analysis to suggest a wind-down time.",
        "Raw Health samples, sleep times, Health source metadata, and the locally inferred wind-down schedule are never uploaded to Kairo. They remain on your iPhone. You can turn either Health feature off at any time in Kairo Settings and manage permission in the Health app.",
      ],
    },
    {
      id: "uses",
      title: "How information is used",
      paragraphs: [
        "Kairo uses your information to provide the planner, synchronize your account, personalize the interface, calculate your own progress and insights, send reminders you request, respond to support, and protect the service.",
        "Kairo does not sell or rent your personal information, does not build advertising profiles, and does not use advertising trackers across apps or websites.",
      ],
    },
    {
      id: "services",
      title: "Services that help Kairo operate",
      paragraphs: [
        "Kairo is hosted with its application and database infrastructure. Service providers receive only the information needed to perform their role and are not authorized by Kairo to use it for their own advertising.",
      ],
      bullets: [
        "Anthropic processes a task or the minimum planner context only when you explicitly use an AI planning feature. Suggestions are returned for your review; the model has no direct account-mutation tools.",
        "Resend delivers account and security email when email delivery is configured.",
        "Google Calendar processes calendar authorization and events only if you choose to connect Google Calendar.",
      ],
    },
    {
      id: "choices",
      title: "Your choices and control",
      paragraphs: [
        "You control what you add, which optional integrations you enable, whether notifications are allowed, and whether either Apple Health feature is on. Imported calendar connections can be removed from Settings.",
        "Signed-in users can export their Kairo data or delete their account from Settings. Account deletion removes active account and planner records from the service. Recovery backups may retain a protected copy for a limited operational period before they expire.",
      ],
    },
    {
      id: "retention",
      title: "Retention",
      paragraphs: [
        "Kairo keeps account and planner information while your account is active so the service can work across devices. Some security and operational records may be kept for a limited period to prevent abuse, investigate failures, or meet legal obligations.",
        "When you delete your account, Kairo starts the deletion described above. Information may be retained longer only where required for security, legal compliance, dispute resolution, or enforcing agreements.",
      ],
    },
    {
      id: "security",
      title: "Security",
      paragraphs: [
        "Kairo uses encrypted network connections, access controls, scoped account queries, and protected operational backups. No online service can promise perfect security. If you believe your account or data is at risk, contact Kairo promptly.",
      ],
    },
    {
      id: "children",
      title: "Children’s privacy",
      paragraphs: [
        "Kairo is not directed to children under 13, and Kairo does not knowingly collect personal information from a child under 13. A parent or guardian who believes a child provided information can contact Kairo to request review and deletion.",
      ],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      paragraphs: [
        "Kairo may update this policy as the product or its service providers change. The updated date will change here, and material changes will be communicated in the product or by another appropriate channel.",
      ],
    },
    {
      id: "contact",
      title: "Contact",
      paragraphs: [
        "Questions, privacy requests, and security reports can be sent to neima@nakhaee.us.",
      ],
    },
  ] satisfies readonly PrivacySection[],
} as const;
