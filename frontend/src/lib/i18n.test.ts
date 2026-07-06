import { describe, it, expect } from "vitest";
import { LANGUAGES, translations, type Lang } from "./i18n";

const langs = Object.keys(translations) as Lang[];

describe("i18n dictionaries", () => {
  it("covers every language declared in LANGUAGES", () => {
    expect(new Set(langs)).toEqual(new Set(LANGUAGES.map((l) => l.code)));
  });

  // Every dictionary must have exactly the same key set as English (the reference).
  const enKeys = Object.keys(translations.en).sort();

  for (const lang of langs) {
    describe(`"${lang}" dictionary`, () => {
      it("has exactly the same keys as the English dictionary", () => {
        const keys = Object.keys(translations[lang]).sort();
        const missing = enKeys.filter((k) => !keys.includes(k));
        const extra = keys.filter((k) => !enKeys.includes(k));
        expect(missing, `keys missing from "${lang}"`).toEqual([]);
        expect(extra, `extra keys in "${lang}" not present in "en"`).toEqual([]);
      });

      it("has no empty values", () => {
        const empty = Object.entries(translations[lang])
          .filter(([, value]) => value.trim() === "")
          .map(([key]) => key);
        expect(empty, `empty values in "${lang}"`).toEqual([]);
      });
    });
  }
});
