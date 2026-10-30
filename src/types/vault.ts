export type Category = 'Logins' | 'Bookmarks' | 'Safenotes' | 'Identities' | 'Payments';

export interface Folder {
  id: string;
  name: string;
  icon?: string | null;
  created_at?: number;
}

export interface RecoveryCode {
  code: string;
  used: boolean;
  note?: string | null;
}

export interface PasswordHistoryEntry {
  password: string;
  changed_at: number;
}

export interface TotpConfig {
  secret: string;
  algorithm: string; // SHA1, SHA256, SHA512
  digits: number;    // 6 or 8
  period: number;    // 30
}

export interface Entry {
  id: string;
  title: string;
  url: string;
  username: string;
  email: string;
  password: string;
  notes: string;
  folder_id?: string | null;
  category: Category;
  tags: string[];
  favorite: boolean;
  brand_color?: string | null;
  brand_icon_slug?: string | null;
  custom_icon_base64?: string | null;
  totp_config?: TotpConfig | null;
  recovery_codes: RecoveryCode[];
  last_autofill?: number | null;
  created_at: number;
  updated_at: number;
  password_history: PasswordHistoryEntry[];
  hlc_timestamp: number;
  device_id: string;
  is_deleted: boolean;
}

export interface EntrySummary {
  id: string;
  title: string;
  url: string;
  domain: string;
  username: string;
  email: string;
  folder_id?: string | null;
  category: Category;
  tags: string[];
  favorite: boolean;
  brand_color?: string | null;
  brand_icon_slug?: string | null;
  custom_icon_base64?: string | null;
  has_totp: boolean;
  recovery_codes_count: number;
  created_at: number;
  updated_at: number;
  is_deleted: boolean;
  password_length: number;
}

export interface VaultStatus {
  is_unlocked: boolean;
  is_duress: boolean;
  entry_count: number;
  vault_path?: string | null;
}

export interface EntrySecretPayload {
  password: string;
  notes: string;
  recovery_codes: RecoveryCode[];
}

export interface TotpResponse {
  code: string;
  remaining_seconds: number;
}

export interface DomainGroup {
  domain: string;
  count: number;
  entry_ids: string[];
}

export interface SecurityAuditReport {
  total_entries: number;
  compromised_count: number;
  compromised_ids: string[];
  reused_count: number;
  reused_ids: string[];
  weak_count: number;
  weak_ids: string[];
  overall_security_score: number;
}

export interface BrandInfo {
  slug: string;
  name: string;
  domain_keywords: string[];
  brand_color: string;
  text_color: string;
  svg_icon: string;
}

export interface AmbiguousCharacter {
  position: number;
  original_char: string;
  alternatives: string[];
}

export interface OcrParsedResult {
  title: string | null;
  url: string | null;
  email: string | null;
  username: string | null;
  password: string | null;
  totp_secret: string | null;
  recovery_codes: string[];
  ambiguous_characters: AmbiguousCharacter[];
  raw_lines: string[];
}

export interface ImportPreview {
  total_parsed: number;
  new_entries: Entry[];
  duplicate_count: number;
  duplicate_titles: string[];
}


