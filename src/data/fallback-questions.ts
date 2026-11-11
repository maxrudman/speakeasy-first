/**
 * Built-in practice questions used when the Claude API isn't configured or a request fails.
 * {role} is replaced with what the user typed in "Role / subject" (or "this role").
 */
export const FALLBACK_QUESTION_TEMPLATES: string[] = [
  "Tell me about yourself and what draws you to {role}.",
  "Why are you interested in {role} at this point in your career?",
  "Walk me through how your background prepares you for {role}.",
  "What do you think a successful first 90 days in {role} would look like?",
  "Describe a time you had to learn something new quickly. How did you approach it?",
  "Tell me about a time you made a mistake. What did you do next?",
  "Describe a situation where you disagreed with a teammate. How did you handle it?",
  "What's an accomplishment you're especially proud of, and why?",
  "Tell me about a time you managed several deadlines at once.",
  "What skills do you think matter most for {role}, and how have you shown them?",
  "Describe a time you received difficult feedback. What did you change?",
  "Give an example of when you went beyond what was asked of you.",
  "Tell me about a time you had to explain something complex to someone without your background.",
  "How do you stay organized when priorities shift suddenly?",
  "Describe a project that didn't go as planned. What did you learn?",
  "What would your previous supervisor say is your greatest strength?",
  "Which part of {role} do you expect to be most challenging for you?",
  "Tell me about a time you had to work with incomplete information.",
  "How do you handle a situation where you don't know the answer?",
  "Describe a time you influenced someone without having authority over them.",
  "What is a weakness you're actively working on?",
  "Tell me about a time you noticed a problem before others did.",
  "Describe a time you worked with someone whose style was very different from yours.",
  "What does professionalism mean to you in {role}?",
  "Where do you see yourself in five years, and how does {role} fit into that path?",
  "Tell me about a time you had to make an unpopular decision.",
  "How do you make sure your work is accurate when the stakes are high?",
  "Describe a time you supported a teammate who was struggling.",
  "What questions do you have for us about {role}?",
  "If you were hired for {role}, what would you want to learn first?",
];

export function fallbackQuestions(role: string, exclude: string[], count: number): string[] {
  const label = role.trim() || "this role";
  const seen = new Set(exclude.map((q) => q.trim().toLowerCase()));
  const all = FALLBACK_QUESTION_TEMPLATES.map((t) => t.replaceAll("{role}", label));
  const fresh = all.filter((q) => !seen.has(q.toLowerCase()));
  // If the user has seen every built-in question, start the cycle again.
  const pool = fresh.length ? fresh : all;
  return shuffle(pool).slice(0, count);
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
