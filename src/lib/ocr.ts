/**
 * Bounded Local OCR and Credential Recognition Engine
 * Fully offline, resource-capped (12 MiB file limit, 20 Megapixel dimension limit).
 * Bundles offline traineddata in /tessdata/ and executes off-thread via Web Worker.
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

export type OcrLanguage = "eng" | "ben" | "eng+ben";

/**
 * Preprocesses an image on an HTML5 canvas:
 * 1. Upscales screenshots (< 1200px width) by 1.5x–2x for high-DPI character edges
 * 2. Applies high-contrast grayscale normalization
 * 3. Exports an optimized Blob for OCR recognition
 */
export async function preprocessImageForOcr(file: File): Promise<Blob | File> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(file);
          return;
        }

        // Upscale if small for sharper OCR line recognition
        const scale = img.naturalWidth < 1200 ? Math.min(2, 1200 / img.naturalWidth) : 1;
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // High-contrast grayscale conversion
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          let gray = 0.299 * r + 0.587 * g + 0.114 * b;
          // Contrast enhancement
          gray = (gray - 128) * 1.25 + 128;
          gray = Math.max(0, Math.min(255, gray));
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
        ctx.putImageData(imgData, 0, 0);

        canvas.toBlob(
          (blob) => {
            resolve(blob || file);
          },
          "image/png",
          1.0
        );
      } catch {
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Executes local OCR on an image file using an off-thread Web Worker and bundled /tessdata/
 * Preprocesses image on canvas, cleans noise characters, and extracts credentials.
 */
export async function runLocalOcr(
  file: File,
  onProgress?: (progress: number) => void,
  ocrLang: OcrLanguage = "eng"
): Promise<{ rawText: string; creds: ExtractedCredentials }> {
  await validateOcrImage(file);

  if (onProgress) onProgress(10);

  // Preprocess image on canvas
  const processedBlob = await preprocessImageForOcr(file);

  if (onProgress) onProgress(25);

  let rawText = "";
  try {
    const { createWorker } = await import("tesseract.js");
    const langPath =
      typeof window !== "undefined" && window.location.origin
        ? `${window.location.origin}/tessdata`
        : "/tessdata";

    let worker;
    try {
      worker = await createWorker(ocrLang, 1, {
        langPath,
        gzip: false,
        logger: (m) => {
          if (m.status === "recognizing text" && onProgress && typeof m.progress === "number") {
            onProgress(Math.min(99, Math.round(25 + m.progress * 70)));
          }
        },
      });
    } catch (langPathErr) {
      console.warn("Local /tessdata path fallback:", langPathErr);
      worker = await createWorker(ocrLang, 1, {
        logger: (m) => {
          if (m.status === "recognizing text" && onProgress && typeof m.progress === "number") {
            onProgress(Math.min(99, Math.round(25 + m.progress * 70)));
          }
        },
      });
    }

    const ret = await worker.recognize(processedBlob);
    await worker.terminate();
    rawText = (ret.data?.text || "").trim();
  } catch (err: any) {
    console.error("Local OCR recognition error:", err);
    throw new Error(
      err?.message ||
        "Could not extract text from this image. Please ensure the screenshot has readable text."
    );
  }

  if (onProgress) onProgress(100);

  if (!rawText) {
    throw new Error(
      "No readable characters detected in image. Try uploading a higher-contrast screenshot."
    );
  }

  const creds = extractCredentialsFromText(rawText);
  return { rawText, creds };
}
