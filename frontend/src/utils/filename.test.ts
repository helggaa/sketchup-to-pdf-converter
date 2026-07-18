import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { derivePdfFilename } from './filename';

// ---------------------------------------------------------------------------
// Unit tests – specific examples
// ---------------------------------------------------------------------------

describe('derivePdfFilename', () => {
  it('strips .skp extension and appends -views.pdf', () => {
    expect(derivePdfFilename('MyModel.skp')).toBe('MyModel-views.pdf');
  });

  it('handles a filename with no extension', () => {
    expect(derivePdfFilename('MyModel')).toBe('MyModel-views.pdf');
  });

  it('strips only the last extension when there are multiple dots', () => {
    expect(derivePdfFilename('my.model.skp')).toBe('my.model-views.pdf');
  });

  it('works with an empty string input', () => {
    expect(derivePdfFilename('')).toBe('-views.pdf');
  });

  it('works with other extensions', () => {
    expect(derivePdfFilename('archive.tar.gz')).toBe('archive.tar-views.pdf');
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

/**
 * Property 15: Download filename follows the naming pattern
 *
 * For any base name, derivePdfFilename(base + ".skp") SHALL produce a string
 * ending in "-views.pdf" and starting with base.
 *
 * **Validates: Requirements 8.2**
 */
describe('Property 15 – download filename follows the naming pattern', () => {
  it('always produces a string ending in -views.pdf and starting with the base name', () => {
    // Arbitrary base name: any string that does not itself contain a '.' so
    // the regex only strips the appended ".skp" extension.
    const baseName = fc.stringMatching(/^[^.]*$/);

    fc.assert(
      fc.property(baseName, (base) => {
        const result = derivePdfFilename(`${base}.skp`);
        return result.endsWith('-views.pdf') && result.startsWith(base);
      }),
      { numRuns: 500 }
    );
  });
});
