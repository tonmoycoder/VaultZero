import { test, expect } from "@playwright/test";
import {
  stripBom,
  detectDelimiter,
  parseCsvRaw,
  processCsvData,
  exportVaultToCsv,
  MAX_CSV_FILE_SIZE,
  MAX_CSV_COLUMNS,
} from "../src/lib/csv";

test.describe("Generic CSV Import & Lossless Data Preservation", () => {
  test("strips UTF-8 BOM and parses Google Chrome CSV export", () => {
    const chromeCsv = "\uFEFFname,url,username,password,note\r\n" +
      "Google,https://accounts.google.com,testuser@gmail.com,SuperSecret123,Personal email\r\n" +
      "GitHub,https://github.com,octocat,ghp_987654321,Dev tokens";

    const result = processCsvData(chromeCsv);
    expect(result.totalRows).toBe(2);
    expect(result.items.length).toBe(2);

    const item1 = result.items[0];
    expect(item1.title).toBe("Google");
    expect(item1.url).toBe("https://accounts.google.com");
    expect(item1.username).toBe("testuser@gmail.com");
    expect(item1.password).toBe("SuperSecret123");
    expect(item1.note).toBe("Personal email");
    expect(item1.brand).toBe("google");

    const item2 = result.items[1];
    expect(item2.title).toBe("GitHub");
    expect(item2.username).toBe("octocat");
    expect(item2.brand).toBe("github");
  });

  test("parses Bitwarden CSV and preserves unmapped fields losslessly in notes", () => {
    const bitwardenCsv =
      "folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\r\n" +
      "Work,1,login,Slack,Team workspace,custom_pin: 4490,0,https://slack.com,ayaan@company.com,SlackPassword!,JBSWY3DPEHPK3PXP";

    const result = processCsvData(bitwardenCsv);
    expect(result.totalRows).toBe(1);
    const item = result.items[0];

    expect(item.title).toBe("Slack");
    expect(item.username).toBe("ayaan@company.com");
    expect(item.password).toBe("SlackPassword!");
    expect(item.url).toBe("https://slack.com");
    expect(item.totp).toBe("JBSWY3DPEHPK3PXP");
    expect(item.folder).toBe("Work");

    // Check lossless preservation
    expect(item.note).toContain("Team workspace");
    expect(item.note).toContain("[Imported Metadata]");
    expect(item.note).toContain("fields: custom_pin: 4490");
    expect(item.note).toContain("reprompt: 0");
  });

  test("handles semicolon and tab delimiters, multiline cells, and escaped quotes", () => {
    // Semicolon with quotes and multiline
    const semicolonCsv =
      'Title;Username;Password;Notes\r\n' +
      '"Bank of Bengal";"user_101";"pass;word";"First line\r\nSecond line with ""quotes"" and ; semicolon"\r\n' +
      '"Cloudflare";"admin";"cf-token-99";"DNS & CDN"';

    const detected = detectDelimiter(semicolonCsv);
    expect(detected).toBe(";");

    const result = processCsvData(semicolonCsv);
    expect(result.totalRows).toBe(2);

    const bankItem = result.items[0];
    expect(bankItem.title).toBe("Bank of Bengal");
    expect(bankItem.username).toBe("user_101");
    expect(bankItem.password).toBe("pass;word");
    expect(bankItem.note).toContain('Second line with "quotes" and ; semicolon');
  });

  test("enforces strict security bounds: rejects >8MB and >64 columns", () => {
    // > 64 columns
    const wideHeaders = Array.from({ length: 65 }, (_, i) => `Col_${i}`).join(",");
    const wideData = Array.from({ length: 65 }, (_, i) => `Val_${i}`).join(",");
    const wideCsv = `${wideHeaders}\r\n${wideData}`;

    expect(() => processCsvData(wideCsv)).toThrow(/maximum column limit/);

    // > 8 MiB file size
    const fakeHugeString = "a".repeat(MAX_CSV_FILE_SIZE + 10);
    expect(() => processCsvData(fakeHugeString)).toThrow(/exceeds 8 MiB limit/);
  });

  test("protects against CSV / Formula Injection on export", () => {
    const maliciousItems = [
      {
        id: "test-1",
        title: "=CMD|' /C calc'!A0",
        username: "+1234567890",
        password: "-DANGEROUS",
        url: "@http://evil.com",
        category: "login" as const,
        brand: "vault" as const,
        note: "\tSecret formula inside",
        favorite: false,
        strength: "strong" as const,
        score: 4,
        modified: "Just now",
      },
    ];

    const exported = exportVaultToCsv(maliciousItems);
    expect(exported).toContain("\"'=CMD|' /C calc'!A0\"");
    expect(exported).toContain("\"'+1234567890\"");
    expect(exported).toContain("\"'-DANGEROUS\"");
    expect(exported).toContain("\"'@http://evil.com\"");
    expect(exported).toContain("\"'\tSecret formula inside\"");
  });
});
