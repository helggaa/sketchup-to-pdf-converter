// ---------------------------------------------------------------------------
// PDF Filename Derivation
// ---------------------------------------------------------------------------

/**
 * Derives the PDF download filename from an uploaded SKP filename.
 *
 * Strips the file extension (the last `.`-separated segment) and appends
 * `-views.pdf`. Examples:
 *   - "MyModel.skp"   → "MyModel-views.pdf"
 *   - "my.model.skp"  → "my.model-views.pdf"
 *   - "MyModel"       → "MyModel-views.pdf"
 *
 * Implements Requirement 8.2.
 */
export function derivePdfFilename(skpFilename: string): string {
  // Remove extension: "MyModel.skp" → "MyModel"
  const base = skpFilename.replace(/\.[^.]+$/, '');
  return `${base}-views.pdf`;
}
