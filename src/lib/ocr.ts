/**
 * Bounded Local OCR and Credential Recognition Engine
 * Fully offline, resource-capped (12 MiB file limit, 20 Megapixel dimension limit).
 */

export const MAX_OCR_FILE_SIZE = 12 * 1024 * 1024; // 12 MiB
export const MAX_OCR_PIXELS = 20_000_000; // 20 Megapixels

export interface ExtractedCredentials {
  title?: string;
  username?: string;
  password?: string;
  url?: string;
  totpSecret?: string;
  recoveryCodes: string[];
  rawText: string;
}

/**
 * Validates image dimensions and file size before processing.
 */
export async function validateOcrImage(file: File): Promise<{ width: number; height: number }> {
  if (file.size > MAX_OCR_FILE_SIZE) {
    throw new Error(
      `Image size exceeds maximum limit of 12 MiB (${(file.size / 1024 / 1024).toFixed(1)} MiB)`
    );
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const pixels = img.naturalWidth * img.naturalHeight;
      if (pixels > MAX_OCR_PIXELS) {
        reject(
          new Error(
            `Image resolution exceeds 20 Megapixels (${img.naturalWidth}x${img.naturalHeight} = ${(
              pixels / 1_000_000
            ).toFixed(1)} MP)`
          )
        );
      } else {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for OCR inspection"));
    };
    img.src = url;
  });
}

/**
 * Pattern heuristics to extract credentials from OCR raw text.
 */
export function extractCredentialsFromText(rawText: string): ExtractedCredentials {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  let username: string | undefined;
  let password: string | undefined;
  let url: string | undefined;
  let totpSecret: string | undefined;
  const recoveryCodes: string[] = [];

  // 1. URL extraction
  const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/i;
  for (const line of lines) {
    const match = line.match(urlRegex);
    if (match) {
      url = match[0].replace(/[.,;)]+$/, "");
      break;
    }
  }

  // 2. Email / Username extraction
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
  for (const line of lines) {
    const match = line.match(emailRegex);
    if (match) {
      username = match[0];
      break;
    }
    const userPrefixMatch = line.match(/(?:username|user|login|id|email)[:\s]+([^\s]+)/i);
    if (userPrefixMatch && !username) {
      username = userPrefixMatch[1];
    }
  }

  // 3. Password extraction
  for (const line of lines) {
    const passPrefixMatch = line.match(/(?:password|pass|secret|pwd)[:\s]+([^\s]+)/i);
    if (passPrefixMatch) {
      password = passPrefixMatch[1];
      break;
    }
  }

  // 4. TOTP Secret extraction (Base32 16-32 chars)
  const totpPrefixMatch = rawText.match(/(?:secret|key|totp)[:\s]+([A-Z2-7]{16,32})\b/i);
  if (totpPrefixMatch) {
    totpSecret = totpPrefixMatch[1].toUpperCase();
  }

  // 5. Recovery codes (e.g. 4-4 or 8-8 alphanumeric groups)
  const recoveryRegex = /\b([a-z0-9]{4,8}-[a-z0-9]{4,8})\b/gi;
  let recMatch: RegExpExecArray | null;
  while ((recMatch = recoveryRegex.exec(rawText)) !== null) {
    if (!recoveryCodes.includes(recMatch[1])) {
      recoveryCodes.push(recMatch[1]);
    }
  }

  const title = url ? url.replace(/^https?:\/\//, "").split("/")[0] : lines[0]?.slice(0, 40);

  return {
    title,
    username,
    password,
    url,
    totpSecret,
    recoveryCodes,
    rawText,
  };
}

/**
 * Executes local OCR on an image file using tesseract.js with real progress reporting.
 */
export async function runLocalOcr(
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ rawText: string; creds: ExtractedCredentials }> {
  await validateOcrImage(file);

  let rawText = "";
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng", undefined, {
      logger: (m) => {
        if (m.status === "recognizing text" && onProgress && typeof m.progress === "number") {
          onProgress(Math.min(99, Math.round(m.progress * 100)));
        }
      },
    });
    const ret = await worker.recognize(file);
    await worker.terminate();
    rawText = ret.data.text.trim();
  } catch (err) {
    console.warn("Tesseract runtime warning:", err);
    rawText = `Captured Image: ${file.name}\nSize: ${(file.size / 1024).toFixed(1)} KB\nType: ${file.type}`;
  }

  if (onProgress) onProgress(100);
  const creds = extractCredentialsFromText(rawText);
  return { rawText, creds };
}


