// Milestone 1 dummy response (swap for API later)
export function mockAskMom(message: string) {
  const t = (message || "").trim().toLowerCase();

  if (t.includes("anydesk") || t.includes("teamviewer") || t.includes("remote")) {
    return `Hard no. Remote access requests are a common scam.

If you installed anything:
• Disconnect Wi-Fi
• Restart the device
• Tell me what you installed and what it asked for.`;
  }

  if (t.includes("code") || t.includes("otp") || t.includes("verification")) {
    return `Nope. Don’t share any codes.

Real companies don’t ask you to read a login code to a person.`;
  }

  if (t.includes("urgent") || t.includes("suspended") || t.includes("click") || t.includes("link")) {
    return `Looks suspicious.

SoCal rules:
• we don’t rush
• we don’t click random links
• we verify inside the real app/site (typed by you, not the link).`;
  }

  return `Okay — tell me:
1) What device are you on (iPhone, Android, Windows, Mac)?
2) What exactly did it say or do?
3) Did you click anything or enter any info?

Paste the exact wording if you can.`;
}
