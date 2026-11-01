import { test, expect } from "@playwright/test";
import { translations } from "../src/lib/vault";

test.describe("WP-12: Full Bilingual i18n Verification", () => {
  test("en and bn translation dictionaries have identical keys and non-empty values", () => {
    const enKeys = Object.keys(translations.en) as (keyof typeof translations.en)[];
    const bnKeys = Object.keys(translations.bn) as (keyof typeof translations.bn)[];

    const missingInBn = enKeys.filter((k) => !(k in translations.bn));
    const missingInEn = bnKeys.filter((k) => !(k in translations.en));

    expect(missingInBn).toEqual([]);
    expect(missingInEn).toEqual([]);

    // Ensure all strings are non-empty
    enKeys.forEach((key) => {
      expect(translations.en[key]).toBeTruthy();
      expect(translations.bn[key]).toBeTruthy();
    });
  });
});
