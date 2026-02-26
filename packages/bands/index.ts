/**
 * @bands/bands - Official band definitions
 *
 * This package contains curated band definitions for common use cases.
 * Each band is a directory with a BAND.md file.
 *
 * Directory structure:
 *   bands/
 *     <band-name>/
 *       BAND.md
 *       scripts/     (optional)
 *       references/  (optional)
 *       assets/      (optional)
 */

export const BANDS_DIR = new URL(".", import.meta.url).pathname;
