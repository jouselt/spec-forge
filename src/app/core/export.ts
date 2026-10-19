/**
 * The three ways a finished spec leaves the app: one file, one bundle, one zip.
 *
 * All of them read the documents from the store and render through the same
 * `renderMarkdown`, so re-exporting a document that was imported or restored keeps its
 * provenance and review state. Nothing here writes to a server, because there is no
 * server.
 *
 * The zip is the only dependency-shaped piece and it is behind `await import`, so
 * `fflate` stays out of the initial bundle. A test asserts the built main bundle does
 * not contain the string.
 */

import { GeneratedDoc } from './question-graph';
import { SpecFile } from './mapping';
import { RenderOptions, renderMarkdown } from '../templates/assembly';
import { downloadBytes, downloadText } from './download';

/** The bundle's filename. */
export const BUNDLE_NAME = 'spec-bundle.md';

/** The zip's filename. */
export const ZIP_NAME = 'spec-bundle.zip';

/** The three files in the order they are read and exported. */
export const FILE_ORDER: readonly SpecFile[] = ['proposal', 'design', 'tasks'];

/** The separator a reader greps for when one bundle holds three files. */
export function fileMarker(file: SpecFile): string {
  return `<!-- FILE: ${file}.md -->`;
}

/**
 * The documents in reading order, dropping files that do not exist yet.
 *
 * Dropping instead of rendering an empty file matters: an import that brought in one
 * `proposal.md` should export one file, not two headers with nothing under them.
 */
export function orderedDocs(docs: readonly GeneratedDoc[]): GeneratedDoc[] {
  return FILE_ORDER.map((file) => docs.find((doc) => doc.file === file)).filter(
    (doc): doc is GeneratedDoc => doc !== undefined,
  );
}

/** The three files concatenated, each behind a comment naming it. */
export function bundleMarkdown(
  docs: readonly GeneratedDoc[],
  options: RenderOptions = {},
): string {
  const parts = orderedDocs(docs).map(
    (doc) => `${fileMarker(doc.file)}\n\n${renderMarkdown(doc, options)}`,
  );

  return parts.length === 0 ? '' : `${parts.join('\n\n')}\n`;
}

/** What goes inside the zip: one entry per file, named as the single downloads are. */
export function filesFor(docs: readonly GeneratedDoc[], options: RenderOptions = {}): Record<string, string> {
  const files: Record<string, string> = {};

  for (const doc of orderedDocs(docs)) {
    files[`${doc.file}.md`] = renderMarkdown(doc, options);
  }

  return files;
}

/**
 * The zip, as bytes.
 *
 * `fflate` is imported here and nowhere else. If this were a top-level import the whole
 * library would ship to every visitor who never asks for a zip.
 */
export async function zipMarkdown(
  docs: readonly GeneratedDoc[],
  options: RenderOptions = {},
): Promise<Uint8Array> {
  const { zipSync, strToU8 } = await import('fflate');
  const entries: Record<string, Uint8Array> = {};

  for (const [name, text] of Object.entries(filesFor(docs, options))) {
    entries[name] = strToU8(text);
  }

  return zipSync(entries);
}

/** Download the bundle and report the filename used. */
export function downloadBundle(
  docs: readonly GeneratedDoc[],
  options: RenderOptions = {},
): string {
  return downloadText(BUNDLE_NAME, bundleMarkdown(docs, options));
}

/** Download the zip and report the filename used. */
export async function downloadZip(
  docs: readonly GeneratedDoc[],
  options: RenderOptions = {},
): Promise<string> {
  const bytes = await zipMarkdown(docs, options);

  return downloadBytes(ZIP_NAME, bytes);
}

/** The slice of `navigator.clipboard` this needs, so a test can pass its own. */
export interface ClipboardSink {
  writeText(text: string): Promise<void>;
}

/**
 * Copy text, and say what was copied.
 *
 * `navigator.clipboard` is undefined outside a secure context, which includes the way
 * people run this locally over plain http on a LAN address. Failing with a sentence
 * beats a button that silently does nothing.
 *
 * The second argument is `undefined` when omitted and `null` when the caller is saying
 * there is no clipboard: a default parameter makes those two indistinguishable, so a
 * test that wants to exercise the unavailable branch has to pass `null`.
 */
export async function copyText(
  text: string,
  clipboard?: ClipboardSink | null,
): Promise<string> {
  const sink = clipboard === undefined ? browserClipboard() : clipboard;

  if (!sink) {
    throw new Error('The clipboard is unavailable here. Use Download instead.');
  }

  await sink.writeText(text);

  return text;
}

function browserClipboard(): ClipboardSink | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.clipboard;
}
