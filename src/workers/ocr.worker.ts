import { createWorker } from "tesseract.js";

self.onmessage = async (e: MessageEvent) => {
  const { id, image, lang = "eng" } = e.data;

  try {
    const worker = await createWorker(lang, undefined, {
      langPath: "/tessdata",
      gzip: false,
      logger: (m) => {
        if (m.status === "recognizing text" && typeof m.progress === "number") {
          self.postMessage({
            id,
            type: "progress",
            progress: Math.min(99, Math.round(m.progress * 100)),
          });
        }
      },
    });

    const ret = await worker.recognize(image);
    await worker.terminate();

    self.postMessage({
      id,
      type: "success",
      text: ret.data.text.trim(),
    });
  } catch (err: any) {
    self.postMessage({
      id,
      type: "error",
      error: err?.message || String(err),
    });
  }
};

