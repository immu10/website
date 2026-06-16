// Pre-commit guard: extracts the text from public/cv.pdf and blocks the commit
// if it looks like a phone number is present. Bypass once with: git commit --no-verify

const fs = require("fs");

const PATH = "public/cv.pdf";

(async () => {
  if (!fs.existsSync(PATH)) process.exit(0); // no CV to check

  let text = "";
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(fs.readFileSync(PATH));
    const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(" ") + "\n";
    }
  } catch (e) {
    // Don't block a commit just because the parser hiccuped — warn instead.
    console.error("check-cv: couldn't read the PDF, skipping the phone check.", e.message);
    process.exit(0);
  }

  // Find phone-number-looking sequences, then keep only ones with >= 9 digits
  // (so years/short numbers don't trigger false positives).
  const candidates = (text.match(/\+?\d[\d\s().\-]{7,}\d/g) || []).filter(
    (m) => m.replace(/\D/g, "").length >= 9
  );

  if (candidates.length) {
    console.error("\n⛔ Commit blocked — a possible phone number is in public/cv.pdf:");
    [...new Set(candidates.map((m) => m.trim()))].forEach((m) =>
      console.error("   " + m)
    );
    console.error("\nRemove it from the CV, or bypass once with:  git commit --no-verify\n");
    process.exit(1);
  }

  console.log("check-cv: no phone number found in CV ✓");
  process.exit(0);
})();
