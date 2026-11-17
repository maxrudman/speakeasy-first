/**
 * The coach's last-resort tier: useful feedback with no AI at all.
 * Measures what can be measured (length, filler words, pace, sentence length,
 * structure signals) and offers general guidance for other requests.
 */

const FILLERS = ["um", "uh", "er", "ah", "like", "you know", "i mean", "basically", "actually", "literally", "kind of", "sort of", "so yeah", "right"];

export type AnswerStats = {
  words: number;
  sentences: number;
  avgSentenceWords: number;
  fillers: { word: string; count: number }[];
  fillerTotal: number;
  wpm: number | null;
  hasNumbers: boolean;
  hasResult: boolean;
  firstPerson: number;
};

export function analyzeAnswer(text: string, seconds?: number | null): AnswerStats {
  const clean = text.trim();
  const words = clean ? clean.split(/\s+/).length : 0;
  const sentences = Math.max(1, clean.split(/[.!?]+\s/).filter((s) => s.trim()).length);
  const lower = ` ${clean.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, " ")} `;
  const fillers = FILLERS.map((f) => ({ word: f, count: lower.split(` ${f} `).length - 1 }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count);
  return {
    words,
    sentences,
    avgSentenceWords: Math.round(words / sentences),
    fillers,
    fillerTotal: fillers.reduce((n, f) => n + f.count, 0),
    wpm: seconds && seconds > 5 ? Math.round((words / seconds) * 60) : null,
    hasNumbers: /\d|percent|hundred|thousand|million/i.test(clean),
    hasResult: /\b(result|outcome|so that|which meant|led to|increased|reduced|improved|saved|learned)\b/i.test(clean),
    firstPerson: (lower.match(/ i /g) ?? []).length,
  };
}

export function builtinCritique(answer: string, seconds?: number | null): string {
  const s = analyzeAnswer(answer, seconds);
  if (s.words < 5) return "Paste or record an answer first and I'll give you feedback on structure, length, filler words and pace.";
  const lines: string[] = ["Here's quick feedback measured from your answer (the AI coach is offline right now, so this is automatic):", ""];
  lines.push(`- Length: ${s.words} words${s.wpm ? ` in about ${seconds} seconds` : ""}. ${s.words < 60 ? "That's short; add a specific example." : s.words > 350 ? "That's long; aim for 1–2 minutes (150–300 words)." : "A good length for a spoken answer."}`);
  if (s.wpm) lines.push(`- Pace: about ${s.wpm} words per minute. ${s.wpm > 175 ? "That's fast; pause between points." : s.wpm < 110 ? "That's slow; tighten the pauses a little." : "A comfortable speaking pace."}`);
  lines.push(
    s.fillerTotal
      ? `- Filler words: ${s.fillerTotal} (${s.fillers.slice(0, 4).map((f) => `"${f.word}" ×${f.count}`).join(", ")}). Try a short silent pause instead.`
      : "- Filler words: none found. Nice.",
  );
  lines.push(`- Sentences average ${s.avgSentenceWords} words. ${s.avgSentenceWords > 28 ? "Break the longest ones up so listeners can follow." : "Easy to follow."}`);
  lines.push(`- Specifics: ${s.hasNumbers ? "you used numbers or concrete details. Good." : "add a number, name or concrete detail to make it memorable."}`);
  lines.push(`- Structure: ${s.hasResult ? "you described a result. Make sure the situation and your action come first (STAR)." : "end with the result: what changed because of what you did (Situation, Task, Action, Result)."}`);
  return lines.join("\n");
}

export function builtinCoachReply(message: string, context: { lastAnswer?: string | null; seconds?: number | null }): string {
  const m = message.toLowerCase();
  if (/critique|feedback|how did i do|review my/.test(m)) {
    const answer = extractQuotedAnswer(message) ?? context.lastAnswer ?? "";
    return builtinCritique(answer, context.seconds);
  }
  if (/explain|what does .* mean|define/.test(m)) {
    return "The AI coach is offline right now, so I can't look that word up. Try again in a minute, or flip the card on the Vocabulary page to see its definition and example.";
  }
  if (/mock interview|interview me/.test(m)) {
    return "The AI coach is offline, so here's a quick mock interview you can run yourself. Answer each one out loud on the Practice page:\n\n1. Tell me about yourself.\n2. Why do you want this role?\n3. Tell me about a time you solved a difficult problem.\n4. Describe a time you disagreed with someone. What happened?\n5. What questions do you have for us?";
  }
  if (/harder|more difficult|tougher/.test(m)) {
    return "To make practice harder, open \"Who is your audience?\" on the Practice page and add to Specifications: \"hard difficulty, follow-up questions, ask me to quantify results\". Then get new questions.";
  }
  if (/easier|simpler/.test(m)) {
    return "To make practice easier, open \"Who is your audience?\" on the Practice page and add to Specifications: \"easy, warm-up questions about my background\". Then get new questions.";
  }
  return "The AI coach is offline for a moment, but I can still measure your answers. Paste one and ask me to critique it, or try again in a minute.";
}

/** Pulls the answer out of messages built by the quick actions ("My answer: …"). */
function extractQuotedAnswer(message: string): string | null {
  const i = message.search(/my answer[^:\n]*:/i);
  if (i === -1) return null;
  return message.slice(message.indexOf(":", i) + 1).trim() || null;
}
