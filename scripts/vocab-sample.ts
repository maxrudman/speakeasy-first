/**
 * Prints sample vocabulary batches for a few profiles and checks the mix and duplicates.
 * Uses the real Claude API if ANTHROPIC_API_KEY is set, otherwise SPEAKEASY_MOCK_AI.
 * No database needed. Usage: npm run vocab:sample
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();
if (!process.env.ANTHROPIC_API_KEY) process.env.SPEAKEASY_MOCK_AI ||= "1";

const PROFILES = [
  { level: "Intermediate", field: "Psychology, Business, Design", audience: "Hiring managers, employees" },
  { level: "Advanced", field: "corporate law", audience: "hiring managers" },
  { level: "Beginner", field: "nursing", audience: "patients' families" },
];

const PASTED_LIST = `Nursing vocabulary – week 3
1. Triage
2. vital signs
- care plan: the written plan for a patient's care and goals
• medication reconciliation, informed consent
hemodynamic stability`;

async function main() {
  const { generateTerms, extractListTerms } = await import("../src/lib/ai");
  const { countMix, mixFor, splitFields, termKey } = await import("../src/lib/vocab-tailoring");
  let failures = 0;
  const check = (ok: boolean, label: string) => {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
    if (!ok) failures++;
  };

  for (const profile of PROFILES) {
    console.log(`\n=== ${profile.level} / ${profile.field} / ${profile.audience} ===`);
    const owned: string[] = [];
    // A 10-term batch, then the 5 terms a settings change adds, with the first batch already owned.
    for (const [i, count] of [10, 5].entries()) {
      const { terms, source } = await generateTerms({ ...profile, count, exclude: owned });
      console.log(`\nBatch ${i + 1} (${count} terms, source: ${source})`);
      for (const t of terms) {
        const tag = t.category === "field" && t.fields?.length ? `field: ${t.fields.join(" + ")}` : t.category;
        console.log(`- [${tag}] ${t.term} (${t.partOfSpeech}): ${t.definition}\n    "${t.example}"`);
      }
      const mix = countMix(terms.map((t) => ({ category: t.category ?? "broad" })));
      const want = mixFor(count);
      check(terms.length === count, `${terms.length} of ${count} terms`);
      check(
        mix.field === want.field && mix.audience === want.audience && mix.broad === want.broad,
        `mix ${mix.field}/${mix.audience}/${mix.broad} (want ${want.field}/${want.audience}/${want.broad})`,
      );
      const keys = terms.map((t) => termKey(t.term));
      check(new Set(keys).size === keys.length, "no duplicates within the batch");
      check(!keys.some((k) => owned.includes(k)), "no repeats of terms from earlier batches");
      const fields = splitFields(profile.field);
      if (fields.length > 1 && count >= 10) {
        const covered = fields.filter((f) => terms.some((t) => t.fields?.includes(f)));
        check(covered.length === fields.length, `field terms cover every field (${covered.join(", ")})`);
        check(terms.some((t) => (t.fields?.length ?? 0) >= 2), "includes a bridge term");
      }
      owned.push(...keys);
    }
  }

  console.log("\n=== Import: pasted list (Beginner / nursing / patients' families) ===");
  console.log(PASTED_LIST.split("\n").map((l) => `  | ${l}`).join("\n"));
  const alreadyOwned = ["Triage"];
  const { terms, source } = await extractListTerms({
    ...PROFILES[2],
    source: { kind: "text", text: PASTED_LIST },
    max: 30,
    exclude: alreadyOwned,
  });
  console.log(`\nImported (source: ${source}; user already had "Triage"):`);
  for (const t of terms) console.log(`- ${t.term} (${t.partOfSpeech || "?"}): ${t.definition}\n    "${t.example}"`);
  const keys = terms.map((t) => termKey(t.term));
  check(!keys.includes("triage"), "skips a term the user already has");
  check(new Set(keys).size === keys.length, "no duplicates");
  check(
    keys.every((k) => PASTED_LIST.toLowerCase().includes(k)),
    "every imported term appears in the pasted list",
  );

  console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
