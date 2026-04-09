const { createWorker, OEM, PSM } = require("tesseract.js");

/** One shared worker — avoids re-downloading / re-spawning on every registration (was the main slowdown). */
let workerPromise = null;
/** Serialize OCR: Tesseract worker is not safe for concurrent recognize() on one instance. */
let queueTail = Promise.resolve();

function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker("eng", OEM.LSTM_ONLY, {
        logger: () => {},
      });
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-",
      });
      return worker;
    })();
  }
  return workerPromise;
}

async function doRecognize(imagePath) {
  const worker = await getWorker();
  const { data } = await worker.recognize(imagePath);
  return String(data?.text ?? "");
}

async function runLicenseOcr(imagePath) {
  const next = queueTail.then(() => doRecognize(imagePath));
  queueTail = next.catch(() => {});
  return next;
}

/** Call once on server start so the first driver signup does not pay full init + model load time. */
async function warmupLicenseOcrWorker() {
  try {
    await getWorker();
    console.log("[licenseOcr] Tesseract worker ready (license OCR).");
  } catch (e) {
    console.warn("[licenseOcr] Warmup skipped:", e.message);
  }
}

function normalizeLicense(value = "") {
  return String(value).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function licenseMatchesOcr(ocrText, typedRaw) {
  const typed = normalizeLicense(typedRaw);
  if (typed.length < 4) return false;

  const normFull = normalizeLicense(ocrText);
  if (normFull.includes(typed)) return true;

  const tokens = String(ocrText).split(/[^a-zA-Z0-9]+/).filter(Boolean);
  for (const t of tokens) {
    if (normalizeLicense(t) === typed) return true;
  }

  for (let i = 0; i < tokens.length - 1; i++) {
    const merged = normalizeLicense(tokens[i] + tokens[i + 1]);
    if (merged === typed) return true;
  }

  return false;
}

/** Best-effort string to show the user when verification fails (not guaranteed correct). */
function guessScannedLicenseFromOcr(text) {
  const tokens = String(text).split(/[^a-zA-Z0-9]+/).filter(Boolean);
  let best = "";
  for (const t of tokens) {
    const n = normalizeLicense(t);
    if (n.length >= 4 && n.length > normalizeLicense(best).length) best = t;
  }
  return best.trim();
}

module.exports = {
  normalizeLicense,
  licenseMatchesOcr,
  guessScannedLicenseFromOcr,
  runLicenseOcr,
  warmupLicenseOcrWorker,
};
