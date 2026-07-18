import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateSkpFile, MAX_FILE_SIZE_BYTES } from './fileValidation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal File stub with a given name and size. */
function makeFile(name: string, size: number): File {
  // File constructor: (parts, filename, options?)
  // Using a Uint8Array of the right length as the blob part would be
  // impractical for large sizes, so we override `size` via Object.defineProperty.
  const file = new File([], name);
  Object.defineProperty(file, 'size', { value: size, configurable: true });
  return file;
}

// ---------------------------------------------------------------------------
// Unit tests – specific examples
// ---------------------------------------------------------------------------

describe('validateSkpFile', () => {
  describe('extension check', () => {
    it('accepts a valid .skp file', () => {
      const result = validateSkpFile(makeFile('model.skp', 1024));
      expect(result).toEqual({ valid: true, file: expect.any(File) });
    });

    it('accepts a .skp filename with uppercase extension (.SKP)', () => {
      const result = validateSkpFile(makeFile('model.SKP', 1024));
      expect(result).toEqual({ valid: true, file: expect.any(File) });
    });

    it('accepts a .skp filename with mixed-case extension (.SkP)', () => {
      const result = validateSkpFile(makeFile('model.SkP', 1024));
      expect(result).toEqual({ valid: true, file: expect.any(File) });
    });

    it('rejects a .pdf file', () => {
      const result = validateSkpFile(makeFile('document.pdf', 1024));
      expect(result).toEqual({ valid: false, error: 'WRONG_EXTENSION' });
    });

    it('rejects a file with no extension', () => {
      const result = validateSkpFile(makeFile('modelfile', 1024));
      expect(result).toEqual({ valid: false, error: 'WRONG_EXTENSION' });
    });

    it('rejects a file whose final extension is not .skp (e.g. model.skp.zip)', () => {
      const result = validateSkpFile(makeFile('model.skp.zip', 1024));
      expect(result).toEqual({ valid: false, error: 'WRONG_EXTENSION' });
    });

    it('rejects a file with an empty name', () => {
      const result = validateSkpFile(makeFile('', 1024));
      expect(result).toEqual({ valid: false, error: 'WRONG_EXTENSION' });
    });
  });

  describe('size check', () => {
    it('accepts a file exactly at the 200 MB limit', () => {
      const result = validateSkpFile(makeFile('model.skp', MAX_FILE_SIZE_BYTES));
      expect(result).toEqual({ valid: true, file: expect.any(File) });
    });

    it('rejects a file one byte over the 200 MB limit', () => {
      const result = validateSkpFile(makeFile('model.skp', MAX_FILE_SIZE_BYTES + 1));
      expect(result).toEqual({ valid: false, error: 'FILE_TOO_LARGE' });
    });

    it('rejects a very large file', () => {
      const result = validateSkpFile(makeFile('model.skp', MAX_FILE_SIZE_BYTES * 2));
      expect(result).toEqual({ valid: false, error: 'FILE_TOO_LARGE' });
    });

    it('accepts a zero-byte .skp file', () => {
      const result = validateSkpFile(makeFile('model.skp', 0));
      expect(result).toEqual({ valid: true, file: expect.any(File) });
    });
  });

  describe('priority: extension is checked before size', () => {
    it('returns WRONG_EXTENSION even when the file is also too large', () => {
      const result = validateSkpFile(
        makeFile('model.txt', MAX_FILE_SIZE_BYTES + 1)
      );
      expect(result).toEqual({ valid: false, error: 'WRONG_EXTENSION' });
    });
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

/**
 * Property 1: File extension validation rejects non-SKP files
 *
 * For any filename whose final extension is not `.skp` (case-insensitive),
 * validateSkpFile SHALL return { valid: false, error: 'WRONG_EXTENSION' }.
 *
 * **Validates: Requirements 1.2**
 */
describe('Property 1 – non-SKP extensions are always rejected', () => {
  it('rejects any filename that does not end with .skp', () => {
    // Generate filenames whose lowercased final extension is never 'skp'.
    const nonSkpName = fc.string({ minLength: 1 }).filter((name) => {
      const ext = name.split('.').pop()?.toLowerCase();
      return ext !== 'skp';
    });

    fc.assert(
      fc.property(nonSkpName, fc.nat({ max: MAX_FILE_SIZE_BYTES }), (name, size) => {
        const result = validateSkpFile(makeFile(name, size));
        return result.valid === false && result.error === 'WRONG_EXTENSION';
      }),
      { numRuns: 500 }
    );
  });
});

/**
 * Property 2: File size validation enforces the 200 MB limit
 *
 * For any file size s with a valid .skp extension:
 *   - s ≤ MAX_FILE_SIZE_BYTES  →  valid: true
 *   - s > MAX_FILE_SIZE_BYTES  →  { valid: false, error: 'FILE_TOO_LARGE' }
 *
 * **Validates: Requirements 1.6, 1.7**
 */
describe('Property 2 – size limit is consistently enforced', () => {
  it('accepts any .skp file at or below 200 MB', () => {
    fc.assert(
      fc.property(fc.nat({ max: MAX_FILE_SIZE_BYTES }), (size) => {
        const result = validateSkpFile(makeFile('model.skp', size));
        return result.valid === true;
      }),
      { numRuns: 500 }
    );
  });

  it('rejects any .skp file above 200 MB', () => {
    // Generate sizes strictly above MAX_FILE_SIZE_BYTES
    const oversizedArb = fc
      .nat({ max: MAX_FILE_SIZE_BYTES })
      .map((extra) => MAX_FILE_SIZE_BYTES + 1 + extra);

    fc.assert(
      fc.property(oversizedArb, (size) => {
        const result = validateSkpFile(makeFile('model.skp', size));
        return result.valid === false && result.error === 'FILE_TOO_LARGE';
      }),
      { numRuns: 500 }
    );
  });
});
