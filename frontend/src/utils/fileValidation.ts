// ---------------------------------------------------------------------------
// File Validation
// ---------------------------------------------------------------------------

export type FileValidationResult =
  | { valid: true; file: File }
  | { valid: false; error: 'WRONG_EXTENSION' | 'FILE_TOO_LARGE' };

/** 200 MB expressed in bytes. */
export const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;

/**
 * Validates a file for use as a SketchUp model upload.
 *
 * - Rejects files whose extension (case-insensitive) is not `.skp`
 *   (Req 1.1, 1.2).
 * - Rejects files whose size exceeds 200 MB (Req 1.6, 1.7).
 * - Returns the original File object on success so callers can use it
 *   directly without re-referencing the input.
 */
export function validateSkpFile(file: File): FileValidationResult {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'skp') {
    return { valid: false, error: 'WRONG_EXTENSION' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'FILE_TOO_LARGE' };
  }
  return { valid: true, file };
}
