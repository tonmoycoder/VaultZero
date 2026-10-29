import { invoke, isTauri } from '@tauri-apps/api/core';
import type {
  BrandInfo,
  DomainGroup,
  Entry,
  EntrySecretPayload,
  EntrySummary,
  SecurityAuditReport,
  TotpResponse,
  VaultStatus,
} from '@/types/vault';

// In-browser mock store for non-Tauri / test environments
let mockUnlocked = false;
let mockDuress = false;
let mockEntries: Entry[] = [
  {
    id: 'e1111111-1111-1111-1111-111111111111',
    title: 'GitHub',
    url: 'https://github.com/login',
    username: 'developer-tonmoy',
    email: 'tonmoy@example.com',
    password: 'GithUb_S3cur3_P@ssw0rd!2026',
    notes: 'Personal GitHub with SSH keys configured',
    category: 'Logins',
    tags: ['work', 'dev'],
    favorite: true,
    brand_color: '#181717',
    brand_icon_slug: 'github',
    totp_config: {
      secret: 'JBSWY3DPEHPK3PXP',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    },
    recovery_codes: [
      { code: 'A1B2-C3D4-E5F6', used: false, note: 'Primary 1' },
      { code: 'G7H8-J9K0-L1M2', used: true, note: 'Used on 2026-01-10' },
      { code: 'N3P4-Q5R6-S7T8', used: false },
    ],
    last_autofill: Math.floor(Date.now() / 1000) - 3600,
    created_at: Math.floor(Date.now() / 1000) - 86400 * 30,
    updated_at: Math.floor(Date.now() / 1000) - 86400 * 2,
    password_history: [
      { password: 'OldPassword123!', changed_at: Math.floor(Date.now() / 1000) - 86400 * 60 }
    ],
    hlc_timestamp: Date.now() * 1000,
    device_id: 'local-mock',
    is_deleted: false,
  },
  {
    id: 'e2222222-2222-2222-2222-222222222222',
    title: 'Google Workspace',
    url: 'https://accounts.google.com',
    username: 'tonmoy.cloud',
    email: 'tonmoy.cloud@gmail.com',
    password: 'password123', // Weak & breached for audit demo
    notes: 'Main administrative email account',
    category: 'Logins',
    tags: ['personal'],
    favorite: true,
    brand_color: '#4285F4',
    brand_icon_slug: 'google',
    totp_config: {
      secret: 'MZXW633PN5XW6MZX',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    },
    recovery_codes: [
      { code: '9840-2139-4401', used: false },
      { code: '1039-4402-9931', used: false },
    ],
    created_at: Math.floor(Date.now() / 1000) - 86400 * 15,
    updated_at: Math.floor(Date.now() / 1000) - 86400 * 5,
    password_history: [],
    hlc_timestamp: Date.now() * 1000,
    device_id: 'local-mock',
    is_deleted: false,
  },
  {
    id: 'e3333333-3333-3333-3333-333333333333',
    title: 'Discord',
    url: 'https://discord.com/login',
    username: 'TonmoyDev#1337',
    email: 'tonmoy@example.com',
    password: 'password123', // Reused password demo
    notes: 'Gaming & developer communities',
    category: 'Logins',
    tags: ['social'],
    favorite: false,
    brand_color: '#5865F2',
    brand_icon_slug: 'discord',
    totp_config: null,
    recovery_codes: [],
    created_at: Math.floor(Date.now() / 1000) - 86400 * 10,
    updated_at: Math.floor(Date.now() / 1000) - 86400 * 1,
    password_history: [],
    hlc_timestamp: Date.now() * 1000,
    device_id: 'local-mock',
    is_deleted: false,
  },
  {
    id: 'e4444444-4444-4444-4444-444444444444',
    title: 'Airbnb',
    url: 'https://airbnb.com',
    username: 'tonmoy_traveler',
    email: 'tonmoy@example.com',
    password: 'K9#vL2$mQ8@zP1*wY',
    notes: 'Travel bookings & vacation rentals',
    category: 'Logins',
    tags: ['personal', 'travel'],
    favorite: false,
    brand_color: '#FF5A5F',
    brand_icon_slug: 'airbnb',
    totp_config: null,
    recovery_codes: [],
    created_at: Math.floor(Date.now() / 1000) - 86400 * 45,
    updated_at: Math.floor(Date.now() / 1000) - 86400 * 12,
    password_history: [],
    hlc_timestamp: Date.now() * 1000,
    device_id: 'local-mock',
    is_deleted: false,
  },
  {
    id: 'e5555555-5555-5555-5555-555555555555',
    title: 'Netflix',
    url: 'https://netflix.com',
    username: 'family_stream',
    email: 'family@example.com',
    password: '123456', // Compromised
    notes: 'Living room 4K TV account',
    category: 'Logins',
    tags: ['entertainment'],
    favorite: false,
    brand_color: '#E50914',
    brand_icon_slug: 'netflix',
    totp_config: null,
    recovery_codes: [],
    created_at: Math.floor(Date.now() / 1000) - 86400 * 60,
    updated_at: Math.floor(Date.now() / 1000) - 86400 * 30,
    password_history: [],
    hlc_timestamp: Date.now() * 1000,
    device_id: 'local-mock',
    is_deleted: false,
  }
];

export const VaultApi = {
  isTauriEnvironment(): boolean {
    return isTauri();
  },

  async isUnlocked(): Promise<boolean> {
    if (isTauri()) {
      return await invoke<boolean>('is_vault_unlocked');
    }
    return mockUnlocked;
  },

  async getStatus(): Promise<VaultStatus> {
    if (isTauri()) {
      return await invoke<VaultStatus>('get_vault_status');
    }
    return {
      is_unlocked: mockUnlocked,
      is_duress: mockDuress,
      entry_count: mockEntries.filter(e => !e.is_deleted).length,
      vault_path: 'local-vault.pmv',
    };
  },

  async unlock(password: string, keyfileContent?: string, path = 'vault.pmv'): Promise<VaultStatus> {
    if (isTauri()) {
      return await invoke<VaultStatus>('unlock_vault', {
        path,
        masterPassword: password,
        keyfileContent: keyfileContent || null,
      });
    }
    // Browser mock fallback
    if (password === 'duress' || password === 'decoy') {
      mockUnlocked = true;
      mockDuress = true;
    } else if (password.length >= 4) {
      mockUnlocked = true;
      mockDuress = false;
    } else {
      throw new Error('Invalid master password. Password must be at least 4 characters.');
    }
    return this.getStatus();
  },

  async createVault(password: string, keyfileContent?: string, duressPassword?: string, path = 'vault.pmv'): Promise<void> {
    if (isTauri()) {
      await invoke('create_vault', {
        path,
        masterPassword: password,
        keyfileContent: keyfileContent || null,
        duressPassword: duressPassword || null,
      });
      return;
    }
    mockUnlocked = true;
    mockDuress = false;
  },

  async lock(): Promise<void> {
    if (isTauri()) {
      await invoke('lock_vault');
      return;
    }
    mockUnlocked = false;
    mockDuress = false;
  },

  async listEntries(filter?: Record<string, unknown>): Promise<EntrySummary[]> {
    if (isTauri()) {
      return await invoke<EntrySummary[]>('list_entries', { filter: filter || null });
    }
    return mockEntries
      .filter(e => !e.is_deleted)
      .map(e => ({
        id: e.id,
        title: e.title,
        url: e.url,
        domain: e.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase(),
        username: e.username,
        email: e.email,
        folder_id: e.folder_id,
        category: e.category,
        tags: e.tags,
        favorite: e.favorite,
        brand_color: e.brand_color,
        brand_icon_slug: e.brand_icon_slug,
        custom_icon_base64: e.custom_icon_base64,
        has_totp: !!e.totp_config,
        recovery_codes_count: e.recovery_codes.length,
        created_at: e.created_at,
        updated_at: e.updated_at,
        is_deleted: e.is_deleted,
        password_length: e.password.length,
      }));
  },

  async getDomainGroups(): Promise<DomainGroup[]> {
    if (isTauri()) {
      return await invoke<DomainGroup[]>('get_domain_groups');
    }
    const map = new Map<string, string[]>();
    for (const e of mockEntries.filter(item => !item.is_deleted)) {
      const d = e.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase() || 'other';
      const arr = map.get(d) || [];
      arr.push(e.id);
      map.set(d, arr);
    }
    return Array.from(map.entries()).map(([domain, entry_ids]) => ({
      domain,
      count: entry_ids.length,
      entry_ids,
    }));
  },

  async getSecurityAudit(): Promise<SecurityAuditReport> {
    if (isTauri()) {
      return await invoke<SecurityAuditReport>('get_security_audit');
    }
    const active = mockEntries.filter(e => !e.is_deleted);
    const breached = active.filter(e => ['123456', 'password', 'password123'].includes(e.password.toLowerCase()));
    const weak = active.filter(e => e.password.length < 8);
    
    const pwdCount = new Map<string, string[]>();
    for (const e of active) {
      const arr = pwdCount.get(e.password) || [];
      arr.push(e.id);
      pwdCount.set(e.password, arr);
    }
    const reusedIds: string[] = [];
    for (const [, ids] of pwdCount.entries()) {
      if (ids.length > 1) {
        reusedIds.push(...ids);
      }
    }

    const compIds = breached.map(e => e.id);
    const weakIds = weak.map(e => e.id);

    return {
      total_entries: active.length,
      compromised_count: compIds.length,
      compromised_ids: compIds,
      reused_count: reusedIds.length,
      reused_ids: reusedIds,
      weak_count: weakIds.length,
      weak_ids: weakIds,
      overall_security_score: Math.max(10, 100 - (compIds.length * 25 + reusedIds.length * 15 + weakIds.length * 10)),
    };
  },

  async getBrands(): Promise<BrandInfo[]> {
    if (isTauri()) {
      return await invoke<BrandInfo[]>('get_brands');
    }
    return [
      {
        slug: 'github',
        name: 'GitHub',
        domain_keywords: ['github.com', 'github'],
        brand_color: '#181717',
        text_color: '#FFFFFF',
        svg_icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>',
      },
      {
        slug: 'google',
        name: 'Google',
        domain_keywords: ['google.com', 'gmail.com', 'google'],
        brand_color: '#4285F4',
        text_color: '#FFFFFF',
        svg_icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>',
      },
      {
        slug: 'airbnb',
        name: 'Airbnb',
        domain_keywords: ['airbnb.com', 'airbnb'],
        brand_color: '#FF5A5F',
        text_color: '#FFFFFF',
        svg_icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>',
      },
      {
        slug: 'discord',
        name: 'Discord',
        domain_keywords: ['discord.com', 'discord.gg', 'discord'],
        brand_color: '#5865F2',
        text_color: '#FFFFFF',
        svg_icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.894.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>',
      },
      {
        slug: 'netflix',
        name: 'Netflix',
        domain_keywords: ['netflix.com', 'netflix'],
        brand_color: '#E50914',
        text_color: '#FFFFFF',
        svg_icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.398 0v24c1.196-.135 2.408-.225 3.633-.27V0H5.398zm9.569 0v23.73c1.225.045 2.437.135 3.633.27V0h-3.633zM9.031 0l5.938 23.73h.031l.031-.06V0h-.031L9.031 23.67V0z"/></svg>',
      }
    ];
  },

  async generatePassword(length = 16, uppercase = true, lowercase = true, numbers = true, symbols = true, excludeAmbiguous = false): Promise<string> {
    if (isTauri()) {
      return await invoke<string>('generate_password_cmd', {
        length,
        uppercase,
        lowercase,
        numbers,
        symbols,
        excludeAmbiguous,
      });
    }
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    let res = '';
    for (let i = 0; i < length; i++) {
      res += chars[Math.floor(Math.random() * chars.length)];
    }
    return res;
  },

  async generatePassphrase(words = 5, separator = '-', capitalize = true): Promise<string> {
    if (isTauri()) {
      return await invoke<string>('generate_passphrase_cmd', {
        words,
        separator,
        capitalize,
      });
    }
    const sampleWords = ['vault', 'zero', 'shield', 'crypto', 'offline', 'cipher', 'quantum', 'secure', 'granite', 'zenith'];
    const chosen = [];
    for (let i = 0; i < words; i++) {
      let w = sampleWords[Math.floor(Math.random() * sampleWords.length)];
      if (capitalize) w = w.charAt(0).toUpperCase() + w.slice(1);
      chosen.push(w);
    }
    return chosen.join(separator);
  },

  async revealSecret(entryId: string): Promise<EntrySecretPayload> {
    if (isTauri()) {
      return await invoke<EntrySecretPayload>('reveal_entry_secret', { entryId });
    }
    const e = mockEntries.find(i => i.id === entryId);
    if (!e) throw new Error('Entry not found');
    return {
      password: e.password,
      notes: e.notes,
      recovery_codes: e.recovery_codes,
    };
  },

  async getTotp(entryId: string): Promise<TotpResponse> {
    if (isTauri()) {
      return await invoke<TotpResponse>('get_totp_code', { entryId });
    }
    const period = 30;
    const now = Math.floor(Date.now() / 1000);
    const rem = period - (now % period);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return {
      code,
      remaining_seconds: rem,
    };
  },

  async upsertEntry(entry: Entry): Promise<EntrySummary> {
    if (isTauri()) {
      return await invoke<EntrySummary>('upsert_entry', { entry });
    }
    const idx = mockEntries.findIndex(e => e.id === entry.id);
    if (idx >= 0) {
      mockEntries[idx] = entry;
    } else {
      mockEntries.push(entry);
    }
    return {
      id: entry.id,
      title: entry.title,
      url: entry.url,
      domain: entry.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase(),
      username: entry.username,
      email: entry.email,
      folder_id: entry.folder_id,
      category: entry.category,
      tags: entry.tags,
      favorite: entry.favorite,
      brand_color: entry.brand_color,
      brand_icon_slug: entry.brand_icon_slug,
      custom_icon_base64: entry.custom_icon_base64,
      has_totp: !!entry.totp_config,
      recovery_codes_count: entry.recovery_codes.length,
      created_at: entry.created_at,
      updated_at: Math.floor(Date.now() / 1000),
      is_deleted: entry.is_deleted,
      password_length: entry.password.length,
    };
  },

  async deleteEntry(entryId: string): Promise<void> {
    if (isTauri()) {
      await invoke('delete_entry', { entryId });
      return;
    }
    const e = mockEntries.find(i => i.id === entryId);
    if (e) {
      e.is_deleted = true;
    }
  }
};

