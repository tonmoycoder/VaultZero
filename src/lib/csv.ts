import type { Category, VaultItem, BrandKey } from "./vault";
import { brands } from "./vault";

export const MAX_CSV_FILE_SIZE = 8 * 1024 * 1024; // 8 MiB
export const MAX_CSV_COLUMNS = 64;
export const MAX_CSV_ROWS = 10_000;
export const MAX_CSV_CELL_LENGTH = 16_384; // 16 KiB per cell limit against buffer exhaustion

export interface CsvParseOptions {
  hasHeader?: boolean;
  delimiter?: "," | ";" | "\t";
}

export interface CsvPreviewRow {
  index: number;
  raw: Record<string, string>;
  mapped: {
    title: string;
    username: string;
    password: string;
    url: string;
    notes: string;
    category: Category;
    totpSecret?: string;
    unmappedFields: Record<string, string>;
  };
}

export interface CsvImportResult {
  totalRows: number;
  preview: CsvPreviewRow[];
  headers: string[];
  delimiter: string;
  items: VaultItem[];
}

/**
 * Strips UTF-8 BOM if present.
 */
export function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Auto-detects the most probable delimiter from the first few non-empty lines.
 */
export function detectDelimiter(text: string): "," | ";" | "\t" {
  const lines = text.split(/\r?\n/).slice(0, 5).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return ",";

  let commaCount = 0;
  let semiCount = 0;
  let tabCount = 0;

  for (const line of lines) {
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes) {
        if (ch === ",") commaCount++;
        else if (ch === ";") semiCount++;
        else if (ch === "\t") tabCount++;
      }
    }
  }

  if (tabCount > commaCount && tabCount > semiCount) return "\t";
  if (semiCount > commaCount) return ";";
  return ",";
}

/**
 * RFC 4180 compliant CSV parser supporting multiline quoted fields,
 * escaped quotes, arbitrary delimiters, and strict bounds limits.
 */
export function parseCsvRaw(
  input: string,
  delimiter: "," | ";" | "\t" = ","
): string[][] {
  const clean = stripBom(input);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  let i = 0;
  const len = clean.length;

  while (i < len) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && clean[i + 1] === '"') {
          currentCell += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        if (currentCell.length < MAX_CSV_CELL_LENGTH) {
          currentCell += ch;
        }
        i++;
        continue;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (ch === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = "";
        i++;
        continue;
      } else if (ch === "\r" || ch === "\n") {
        currentRow.push(currentCell.trim());
        currentCell = "";
        if (ch === "\r" && i + 1 < len && clean[i + 1] === "\n") {
          i += 2;
        } else {
          i++;
        }
        // Only push non-empty rows
        if (currentRow.some((c) => c.length > 0)) {
          if (currentRow.length > MAX_CSV_COLUMNS) {
            throw new Error(`CSV exceeds maximum column limit of ${MAX_CSV_COLUMNS} (found ${currentRow.length})`);
          }
          rows.push(currentRow);
          if (rows.length >= MAX_CSV_ROWS) {
            break;
          }
        }
        currentRow = [];
        continue;
      } else {
        currentCell += ch;
        i++;
        continue;
      }
    }
  }

  // Final cell & row if any
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      if (currentRow.length > MAX_CSV_COLUMNS) {
        throw new Error(`CSV exceeds maximum column limit of ${MAX_CSV_COLUMNS} (found ${currentRow.length})`);
      }
      rows.push(currentRow);
    }
  }

  return rows;
}

const FIELD_ALIASES = {
  title: ["title", "name", "service", "account", "label", "system", "app", "itemname"],
  username: ["username", "user", "loginusername", "login", "email", "loginemail", "id", "loginid"],
  password: ["password", "pass", "secret", "loginpassword", "pwd", "credential"],
  url: ["url", "uri", "website", "websiteurl", "loginuri", "link", "address", "loginurl"],
  notes: ["notes", "note", "comments", "comment", "description", "extra"],
  category: ["category", "folder", "group", "type"],
  totpSecret: ["totp", "authenticatorkey", "otp", "otpauth", "secretkey", "2fa", "twofactor", "logintotp"],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Automatically maps raw CSV rows into VaultItems with 100% lossless preservation
 * of unmapped fields in a structured note block.
 */
export function processCsvData(
  input: string,
  options: CsvParseOptions = {}
): CsvImportResult {
  if (input.length > MAX_CSV_FILE_SIZE) {
    throw new Error(`File size exceeds 8 MiB limit (${Math.round(input.length / 1024 / 1024)} MiB)`);
  }

  const delimiter = options.delimiter || detectDelimiter(input);
  const rawRows = parseCsvRaw(input, delimiter);

  if (rawRows.length === 0) {
    return {
      totalRows: 0,
      preview: [],
      headers: [],
      delimiter,
      items: [],
    };
  }

  const hasHeader = options.hasHeader ?? true;
  let headers: string[] = [];
  let dataRows: string[][] = [];

  if (hasHeader) {
    headers = rawRows[0];
    dataRows = rawRows.slice(1);
  } else {
    headers = rawRows[0].map((_, idx) => `Column_${idx + 1}`);
    dataRows = rawRows;
  }

  // Build column index mapping
  const mapping: {
    title?: number;
    username?: number;
    password?: number;
    url?: number;
    notes?: number;
    category?: number;
    totpSecret?: number;
  } = {};

  const mappedIndices = new Set<number>();

  headers.forEach((header, idx) => {
    const norm = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(norm) && mapping[field as keyof typeof mapping] === undefined) {
        mapping[field as keyof typeof mapping] = idx;
        mappedIndices.add(idx);
        break;
      }
    }
  });

  const preview: CsvPreviewRow[] = [];
  const items: VaultItem[] = [];

  dataRows.forEach((row, rowIdx) => {
    const rawMap: Record<string, string> = {};
    headers.forEach((h, i) => {
      rawMap[h] = row[i] || "";
    });

    const titleVal = mapping.title !== undefined ? row[mapping.title] || "" : "";
    const usernameVal = mapping.username !== undefined ? row[mapping.username] || "" : "";
    const passwordVal = mapping.password !== undefined ? row[mapping.password] || "" : "";
    const urlVal = mapping.url !== undefined ? row[mapping.url] || "" : "";
    let notesVal = mapping.notes !== undefined ? row[mapping.notes] || "" : "";
    const categoryRaw = mapping.category !== undefined ? row[mapping.category] || "" : "";
    const totpVal = mapping.totpSecret !== undefined ? row[mapping.totpSecret] || "" : "";

    // Unmapped non-empty columns preservation
    const unmapped: Record<string, string> = {};
    headers.forEach((header, idx) => {
      if (!mappedIndices.has(idx)) {
        const val = row[idx];
        if (val && val.trim().length > 0) {
          unmapped[header] = val.trim();
        }
      }
    });

    // Append lossless metadata if unmapped fields exist
    if (Object.keys(unmapped).length > 0) {
      const extraLines = Object.entries(unmapped)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      notesVal = notesVal ? `${notesVal}\n\n[Imported Metadata]\n${extraLines}` : `[Imported Metadata]\n${extraLines}`;
    }

    // Resolve category
    let category: Category = "login";
    const catLower = categoryRaw.toLowerCase();
    if (catLower.includes("card") || catLower.includes("payment")) category = "payment";
    else if (catLower.includes("note") || catLower.includes("secure")) category = "note";
    else if (catLower.includes("id") || catLower.includes("identity")) category = "identity";

    // Resolve brand key from URL or title
    let brandKey: BrandKey = "vault";
    const searchTarget = `${titleVal} ${urlVal}`.toLowerCase();
    for (const [key, b] of Object.entries(brands)) {
      if (searchTarget.includes(b.name.toLowerCase())) {
        brandKey = key as BrandKey;
        break;
      }
    }

    // Fallback title
    const resolvedTitle =
      titleVal.trim() ||
      (urlVal ? extractDomain(urlVal) : "") ||
      usernameVal.trim() ||
      `Imported Item #${rowIdx + 1}`;

    const score = passwordVal.length >= 16 ? 4 : passwordVal.length >= 10 ? 3 : 2;
    const strength = score >= 4 ? "strong" : score === 3 ? "fair" : "weak";

    const item: VaultItem = {
      id: `item-csv-${Date.now()}-${rowIdx}-${Math.random().toString(36).substring(2, 7)}`,
      title: resolvedTitle,
      category,
      brand: brandKey,
      username: usernameVal.trim(),
      password: passwordVal,
      url: urlVal.trim(),
      note: notesVal.trim() || undefined,
      folder: categoryRaw && !["login", "payment", "note", "identity"].includes(catLower) ? categoryRaw.trim() : "Personal",
      favorite: false,
      strength,
      score,
      modified: "Just now",
      totp: totpVal.trim() || undefined,
      tags: ["Imported", "CSV"],
    };

    items.push(item);

    if (rowIdx < 5) {
      preview.push({
        index: rowIdx,
        raw: rawMap,
        mapped: {
          title: resolvedTitle,
          username: usernameVal,
          password: passwordVal,
          url: urlVal,
          notes: notesVal,
          category,
          totpSecret: totpVal || undefined,
          unmappedFields: unmapped,
        },
      });
    }
  });

  return {
    totalRows: dataRows.length,
    preview,
    headers,
    delimiter,
    items,
  };
}

function extractDomain(urlStr: string): string {
  try {
    const withProto = urlStr.includes("://") ? urlStr : `https://${urlStr}`;
    const parsed = new URL(withProto);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return urlStr.replace(/^https?:\/\//, "").split("/")[0];
  }
}

/**
 * Sanitizes cell values to prevent CSV / Excel Formula Injection (DDE).
 */
export function sanitizeCsvExportCell(val: string): string {
  if (!val) return "";
  const trimmed = val.trimStart();
  const first = trimmed.charAt(0);
  if (first === "=" || first === "+" || first === "-" || first === "@" || first === "\t" || first === "\r" || first === "|") {
    return `'${val}`;
  }
  return val;
}

/**
 * Exports vault items to RFC 4180 CSV with formula injection defense.
 *
 * SECURITY (V-30 / V-41): the export deliberately contains **no** TOTP
 * material at all.
 *
 * The previous header said "TOTP Secret" but the value written was
 * `item.totp` — the *current rotating code*, which expires in 30 seconds and
 * is therefore useless in a backup. Exporting it was misleading, and the
 * column name invited someone to "fix" it by exporting the real setup
 * secret, which is a permanent 2FA bypass.
 *
 * The setup secret is available only through the explicit, individually
 * confirmed "export 2FA key" action in the inspector — never as a side
 * effect of exporting the vault.
 */
export function exportVaultToCsv(items: VaultItem[]): string {
  const headers = ["Title", "Username", "Password", "URL", "Category", "Folder", "Notes"];
  const rows: string[] = [headers.join(",")];

  for (const item of items) {
    const cells = [
      item.title,
      item.username,
      item.password,
      item.url,
      item.category,
      item.folder || "",
      item.note || "",
    ].map((raw) => {
      const sanitized = sanitizeCsvExportCell(raw);
      return `"${sanitized.replace(/"/g, '""')}"`;
    });
    rows.push(cells.join(","));
  }

  return rows.join("\r\n");
}
