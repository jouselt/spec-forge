/**
 * Turning a string into a file on the reader's disk.
 *
 * Kept apart from the component so the filename and the MIME type are testable
 * without a DOM event, and so Phase 8's bundle and zip can share it.
 */

import { SpecFile } from '../core/mapping';

/** The MIME type a markdown file gets. */
export const MARKDOWN_TYPE = 'text/markdown';

/** The filename for one of the three files, with no path and no version. */
export function filenameFor(file: SpecFile): string {
  return `${file}.md`;
}

/** Hand a string to the browser as a download. Returns the filename used. */
export function downloadText(name: string, text: string, type: string = MARKDOWN_TYPE): string {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return name;
}

/** Hand a byte array to the browser as a download. Used by the zip. */
export function downloadBytes(
  name: string,
  bytes: Uint8Array,
  type = 'application/zip',
): string {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return name;
}

/** Hand one of the three files to the browser as a download. */
export function downloadMarkdown(file: SpecFile, text: string): string {
  return downloadText(filenameFor(file), text, MARKDOWN_TYPE);
}
