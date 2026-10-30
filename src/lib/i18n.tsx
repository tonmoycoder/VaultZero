import React, { createContext, useContext, useState } from 'react';

export type Language = 'bn' | 'en';

export interface Translations {
  // Common / Navigation
  appName: string;
  appTagline: string;
  searchPlaceholder: string;
  allItems: string;
  favorites: string;
  logins: string;
  bookmarks: string;
  safeNotes: string;
  identities: string;
  payments: string;
  folders: string;
  createFolder: string;
  newFolderPlaceholder: string;
  deleteFolderConfirm: string;
  emptyVault: string;
  emptyVaultDesc: string;
  addItemHere: string;
  clearFilters: string;
  noMatchingResults: string;
  noMatchingDesc: string;

  // Views & Tabs
  entriesView: string;
  securityCenter: string;
  authenticator: string;
  passwordGenerator: string;
  p2pSync: string;
  allBrands: string;

  // Header Actions
  newItem: string;
  commandPalette: string;
  lockVault: string;
  antiSpyTitle: string;
  antiSpyActive: string;
  antiSpyOff: string;
  antiSpyTooltip: string;
  ocrTool: string;
  exportShredTool: string;
  emergencyKit: string;
  checkUpdates: string;
  zenMode: string;
  zenModeActive: string;
  themeLight: string;
  themeDark: string;
  themeZen: string;

  // Security Health Bar
  securityScore: string;
  compromisedCount: string;
  reusedCount: string;
  weakCount: string;
  auditPassed: string;

  // Detail Inspector
  copyPassword: string;
  copiedPassword: string;
  copyUsername: string;
  copiedUsername: string;
  copyOtp: string;
  copiedOtp: string;
  editItem: string;
  deleteItem: string;
  confirmDelete: string;
  website: string;
  notes: string;
  securityAudit: string;
  passwordHistory: string;
  recoveryCodes: string;
  createdOn: string;
  lastUpdated: string;

  // Modal Titles & Buttons
  save: string;
  cancel: string;
  create: string;
  delete: string;
  close: string;
  passwordStrength: string;
  generatePassword: string;

  // OCR Modal
  ocrTitle: string;
  ocrSubtitle: string;
  ocrDropzone: string;
  ocrOrBrowse: string;
  ocrPasteHint: string;
  ocrScanning: string;
  ocrDetectedData: string;
  ocrSaveToVault: string;

  // Emergency Recovery Kit
  recoveryKitTitle: string;
  recoveryKitSubtitle: string;
  handwritingMode: string;
  digitalMode: string;
  printOrSavePdf: string;
  masterPasswordLabel: string;
  duressPasswordLabel: string;
  keyfileFingerprint: string;
  instructionsTitle: string;
  instructionsBody: string;

  // Auto Updater
  updaterTitle: string;
  updaterChecking: string;
  updaterUpToDate: string;
  updaterNewVersionFound: string;
  downloadAndUpdate: string;
  releaseNotes: string;

  // P2P Sync
  p2pTitle: string;
  p2pScanHint: string;
  p2pPairingCode: string;
  p2pSyncNow: string;
  p2pConnectedDevices: string;
}

const translations: Record<Language, Translations> = {
  bn: {
    appName: 'VaultZero',
    appTagline: '১০০% অফলাইন, জিরো-ট্রাস্ট পাসওয়ার্ড ও পরিচয় সুরক্ষা কেন্দ্র',
    searchPlaceholder: 'পাসওয়ার্ড, নোটস, কার্ড ও ট্যাগ সার্চ করুন... (Ctrl+K)',
    allItems: 'সকল আইটেম',
    favorites: 'পছন্দের তালিকা',
    logins: 'লগইন অ্যাকাউন্ট',
    bookmarks: 'বুকমার্কস',
    safeNotes: 'নিরাপদ নোট',
    identities: 'পরিচয় ও কার্ড',
    payments: 'ব্যাংকিং ও পেমেন্ট',
    folders: 'ফোল্ডারসমূহ',
    createFolder: 'নতুন ফোল্ডার',
    newFolderPlaceholder: 'ফোল্ডারের নাম লিখুন...',
    deleteFolderConfirm: 'আপনি কি নিশ্চিত যে এই ফোল্ডারটি মুছে ফেলতে চান?',
    emptyVault: 'কোনো পাসওয়ার্ড বা আইটেম পাওয়া যায়নি',
    emptyVaultDesc: 'আপনার বর্তমান নির্বাচন অথবা ফিল্টারে কোনো রেকর্ড নেই।',
    addItemHere: '+ নতুন আইটেম যোগ করুন',
    clearFilters: 'ফিল্টার রিসেট করুন',
    noMatchingResults: 'খুঁজে পাওয়া যায়নি',
    noMatchingDesc: 'আপনার অনুসন্ধানের সাথে মিলে এমন কোনো অ্যাকাউন্ট বা পাসওয়ার্ড নেই।',

    entriesView: 'ভল্ট ড্যাশবোর্ড',
    securityCenter: 'সিকিউরিটি সেন্টার',
    authenticator: '২FA অথেন্টিকেটর',
    passwordGenerator: 'পাসওয়ার্ড জেনারেটর',
    p2pSync: 'P2P ডিভাইস সিঙ্ক',
    allBrands: 'সব ব্র্যান্ড',

    newItem: 'নতুন আইটেম',
    commandPalette: 'কমান্ড প্যালেট',
    lockVault: 'ভল্ট লক করুন',
    antiSpyTitle: 'অ্যান্টি-স্ক্রিন রেকর্ডিং',
    antiSpyActive: 'সুরক্ষা সক্রিয়',
    antiSpyOff: 'সুরক্ষা বন্ধ',
    antiSpyTooltip: 'স্ক্রিন ক্যাপচার সুরক্ষা চালু থাকলে কোনো অ্যাপ (OBS, Snipping Tool) স্ক্রিনশট বা ভিডিও নিতে পারবে না (কালো স্ক্রিন দেখাবে)।',
    ocrTool: 'OCR স্নাইপিং টুল (Ctrl+Shift+S)',
    exportShredTool: 'এক্সপোর্ট ও ফাইল শ্রেডার',
    emergencyKit: 'ইমার্জেন্সি রিকভারি কিট',
    checkUpdates: 'আপডেট চেক করুন',
    zenMode: 'জেন মোড',
    zenModeActive: 'জেন লোফি সক্রিয়',
    themeLight: 'লাইট মোড',
    themeDark: 'ডার্ক মোড',
    themeZen: 'জেন লোফি মোড',

    securityScore: 'নিরাপত্তা স্কোর',
    compromisedCount: 'লিক হওয়া পাসওয়ার্ড',
    reusedCount: 'পুনর্ব্যবহৃত পাসওয়ার্ড',
    weakCount: 'দুর্বল পাসওয়ার্ড',
    auditPassed: 'নিরাপত্তা সম্পূর্ণ সুরক্ষিত',

    copyPassword: 'পাসওয়ার্ড কপি করুন',
    copiedPassword: 'পাসওয়ার্ড কপি হয়েছে! (১২ সেকেন্ডে মুছবে)',
    copyUsername: 'ইউজারনেম কপি করুন',
    copiedUsername: 'ইউজারনেম কপি হয়েছে!',
    copyOtp: 'OTP কোড কপি করুন',
    copiedOtp: 'OTP কোড কপি হয়েছে!',
    editItem: 'এডিট করুন',
    deleteItem: 'মুছে ফেলুন',
    confirmDelete: 'আপনি কি নিশ্চিত যে এই এন্ট্রিটি স্থায়ীভাবে মুছে ফেলতে চান?',
    website: 'ওয়েবসাইট লিংক',
    notes: 'গোপন নোট ও মেমো',
    securityAudit: 'পাসওয়ার্ড বিশ্লেষণ',
    passwordHistory: 'পূর্বের পাসওয়ার্ড ইতিহাস',
    recoveryCodes: 'ব্যাকআপ রিকভারি কোড',
    createdOn: 'তৈরির তারিখ',
    lastUpdated: 'সর্বশেষ পরিবর্তন',

    save: 'সংরক্ষণ করুন',
    cancel: 'বাতিল',
    create: 'তৈরি করুন',
    delete: 'মুছে ফেলুন',
    close: 'বন্ধ করুন',
    passwordStrength: 'পাসওয়ার্ডের শক্তি',
    generatePassword: 'শক্তিশালী পাসওয়ার্ড তৈরি করুন',

    ocrTitle: 'স্মার্ট OCR ও QR কোড রিডার',
    ocrSubtitle: 'স্ক্রিনশট বা ছবি পেস্ট/ড্রপ করুন; স্বয়ংক্রিয়ভাবে টেক্সট ও 2FA কোড শনাক্ত হবে',
    ocrDropzone: 'যেকোনো ছবি বা স্ক্রিনশট এখানে ড্র্যাগ করে ড্রপ করুন',
    ocrOrBrowse: 'অথবা ফাইল সিলেক্ট করতে ক্লিক করুন',
    ocrPasteHint: 'টিপ: কিবোর্ডে Ctrl+V চাপলেও কপি করা স্ক্রিনশট পেস্ট হয়ে যাবে!',
    ocrScanning: 'ছবি স্ক্যান ও টেক্সট বিশ্লেষণ হচ্ছে...',
    ocrDetectedData: 'শনাক্ত করা ক্রেডেনশিয়াল',
    ocrSaveToVault: 'ভল্টে সংরক্ষণ করুন',

    recoveryKitTitle: 'প্রিন্টযোগ্য ইমার্জেন্সি রিকভারি কিট',
    recoveryKitSubtitle: 'মাস্টার পাসওয়ার্ড ভুলে গেলে রিকভারির জন্য এই কাগজটি প্রিন্ট করে নিরাপদ লকারে রাখুন',
    handwritingMode: 'হাতে লেখার মোড (প্রিন্টের পর লিখুন)',
    digitalMode: 'ডিজিটাল মোড (প্রিন্টের আগে টাইপ করুন)',
    printOrSavePdf: 'প্রিন্ট বা PDF হিসেবে সংরক্ষণ করুন',
    masterPasswordLabel: 'ভল্টের মাস্টার পাসওয়ার্ড',
    duressPasswordLabel: 'ডিকয় / ড্যুরেস পাসওয়ার্ড (ঐচ্ছিক)',
    keyfileFingerprint: 'সিক্রেট কি-ফাইল হ্যাশ',
    instructionsTitle: 'জরুরি নির্দেশনা ও নিরাপত্তা নীতি',
    instructionsBody: 'এই রিকভারি শিটে আপনার ভল্টের মূল চাবি রয়েছে। এটি কখনোই অনলাইনে আপলোড বা ছবি তুলে ক্লাউডে রাখবেন না। প্রিন্ট করার পর একটি সিলগালা খামে ভরে ব্যক্তিগত ভল্ট বা ব্যাংক লকারে সংরক্ষণ করুন।',

    updaterTitle: 'VaultZero অটো-আপডেটার',
    updaterChecking: 'সর্বশেষ রিলিজ চেক করা হচ্ছে...',
    updaterUpToDate: 'আপনার অ্যাপটি সম্পূর্ণ আপডেট আছে (ভার্সন v1.0.1)',
    updaterNewVersionFound: 'একটি নতুন আপডেট পাওয়া গেছে!',
    downloadAndUpdate: 'ডাউনলোড ও আপডেট করুন',
    releaseNotes: 'রিলিজের নতুন ফিচার ও পরিবর্তনসমূহ:',

    p2pTitle: 'অফলাইন লোকাল P2P সিঙ্ক',
    p2pScanHint: 'আপনার অন্য ডিভাইস দিয়ে এই কিউআর কোডটি স্ক্যান করে লোকাল ওয়াইফাইয়ের মাধ্যমে ভল্ট সিঙ্ক করুন',
    p2pPairingCode: 'নিরাপদ ৬-সংখ্যার পেয়ারিং কোড',
    p2pSyncNow: 'এখনি সিঙ্ক করুন',
    p2pConnectedDevices: 'সংযুক্ত লোকাল ডিভাইসসমূহ',
  },

  en: {
    appName: 'VaultZero',
    appTagline: '100% Offline, Zero-Trust Self-Sovereign Identity Fortress',
    searchPlaceholder: 'Search passwords, notes, cards & tags... (Ctrl+K)',
    allItems: 'All Items',
    favorites: 'Favorites',
    logins: 'Logins',
    bookmarks: 'Bookmarks',
    safeNotes: 'Safe Notes',
    identities: 'Identities',
    payments: 'Payments & Cards',
    folders: 'Folders',
    createFolder: 'New Folder',
    newFolderPlaceholder: 'Enter folder name...',
    deleteFolderConfirm: 'Are you sure you want to delete this folder?',
    emptyVault: 'No Entries Found',
    emptyVaultDesc: 'No items match your currently selected filters or categories.',
    addItemHere: '+ Add New Item Here',
    clearFilters: 'Clear Filters',
    noMatchingResults: 'No Matching Records',
    noMatchingDesc: 'No credentials matched your search query.',

    entriesView: 'Vault Dashboard',
    securityCenter: 'Security Center',
    authenticator: '2FA Authenticator',
    passwordGenerator: 'Password Generator',
    p2pSync: 'P2P Device Sync',
    allBrands: 'All Brands',

    newItem: 'New Item',
    commandPalette: 'Command Palette',
    lockVault: 'Lock Vault',
    antiSpyTitle: 'Anti-Screen Capture',
    antiSpyActive: 'Protection ACTIVE',
    antiSpyOff: 'Protection OFF',
    antiSpyTooltip: 'When active, Windows prevents screenshot apps (OBS, Snipping Tool) from capturing this window (shows black screen).',
    ocrTool: 'OCR Snipping Tool (Ctrl+Shift+S)',
    exportShredTool: 'Export & File Shredder',
    emergencyKit: 'Emergency Recovery Kit',
    checkUpdates: 'Check for Updates',
    zenMode: 'Zen Mode',
    zenModeActive: 'Zen Lofi Active',
    themeLight: 'Light Mode',
    themeDark: 'Dark Mode',
    themeZen: 'Zen Lofi Mode',

    securityScore: 'Security Score',
    compromisedCount: 'Compromised Passwords',
    reusedCount: 'Reused Passwords',
    weakCount: 'Weak Passwords',
    auditPassed: 'All Passwords Secure',

    copyPassword: 'Copy Password',
    copiedPassword: 'Password Copied! (Clears in 12s)',
    copyUsername: 'Copy Username',
    copiedUsername: 'Username Copied!',
    copyOtp: 'Copy OTP Code',
    copiedOtp: 'OTP Copied!',
    editItem: 'Edit Item',
    deleteItem: 'Delete Item',
    confirmDelete: 'Are you sure you want to permanently delete this entry?',
    website: 'Website URL',
    notes: 'Secure Notes & Memos',
    securityAudit: 'Password Audit',
    passwordHistory: 'Previous Password History',
    recoveryCodes: 'Backup Recovery Codes',
    createdOn: 'Created',
    lastUpdated: 'Updated',

    save: 'Save Changes',
    cancel: 'Cancel',
    create: 'Create',
    delete: 'Delete',
    close: 'Close',
    passwordStrength: 'Password Strength',
    generatePassword: 'Generate Strong Password',

    ocrTitle: 'Smart OCR & QR Code Reader',
    ocrSubtitle: 'Paste or drop any image/screenshot to automatically detect text & 2FA keys',
    ocrDropzone: 'Drag & drop any image or screenshot here',
    ocrOrBrowse: 'or click to browse from files',
    ocrPasteHint: 'Tip: Press Ctrl+V to paste your clipboard screenshot directly!',
    ocrScanning: 'Scanning image and parsing text...',
    ocrDetectedData: 'Detected Credentials',
    ocrSaveToVault: 'Save to Vault',

    recoveryKitTitle: 'Printable Emergency Recovery Kit',
    recoveryKitSubtitle: 'Print and store in a physical safe in case master credentials are ever forgotten',
    handwritingMode: 'Handwriting Mode (fill after printing)',
    digitalMode: 'Digital Mode (type before printing)',
    printOrSavePdf: 'Print or Save as PDF',
    masterPasswordLabel: 'Vault Master Password',
    duressPasswordLabel: 'Decoy / Duress Password (Optional)',
    keyfileFingerprint: 'Secret Keyfile Fingerprint',
    instructionsTitle: 'Emergency Protocols & Custody',
    instructionsBody: 'This document contains the recovery parameters for your local encrypted enclave. Never scan, photograph, or store this sheet in cloud storage. Keep inside a sealed envelope in a physical safe deposit box.',

    updaterTitle: 'VaultZero Auto-Updater',
    updaterChecking: 'Checking for updates on GitHub...',
    updaterUpToDate: 'Your application is up to date (version v1.0.1)',
    updaterNewVersionFound: 'New update available!',
    downloadAndUpdate: 'Download & Install Update',
    releaseNotes: 'Release Notes & Improvements:',

    p2pTitle: 'Air-Gapped Local P2P Sync',
    p2pScanHint: 'Scan this encrypted QR code with your mobile device to sync over your local network',
    p2pPairingCode: 'Secure 6-Digit Pairing Code',
    p2pSyncNow: 'Sync Now',
    p2pConnectedDevices: 'Connected LAN Devices',
  },
};

interface I18nContextType {
  lang: Language;
  isBn: boolean;
  setLang: (lang: Language) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'bn',
  isBn: true,
  setLang: () => {},
  t: translations.bn,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('vaultzero_lang');
      if (saved === 'en' || saved === 'bn') return saved;
    } catch {}
    return 'bn'; // Default to beautiful Bangla as requested
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem('vaultzero_lang', newLang);
    } catch {}
  };

  return (
    <I18nContext.Provider value={{ lang, isBn: lang === 'bn', setLang, t: translations[lang] }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
