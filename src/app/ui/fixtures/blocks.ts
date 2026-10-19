import { Block, GeneratedDoc, Origin, OriginKind, ReviewState } from '../../core/question-graph';
import { blockId } from '../../core/provenance';

/** The gap question the fixtures use when they need a `missing` origin. */
export const FIXTURE_QUESTION = 'Which constraints can you measure before starting?';

/** A valid origin of the requested kind, for building block fixtures. */
export function originOf(kind: OriginKind): Origin {
  switch (kind) {
    case 'answer':
      return { kind: 'answer', answerIds: ['q.idea'], frame: 'answer-frame' };
    case 'template':
      return { kind: 'template', frame: 'template-frame', inputs: ['q.idea'] };
    case 'model':
      return {
        kind: 'model',
        modelId: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
        basedOn: ['q.idea'],
        temperature: 0,
      };
    case 'imported':
      return { kind: 'imported', section: 'Goal' };
    case 'edited':
      return {
        kind: 'edited',
        derivedFrom: { kind: 'template', frame: 'template-frame', inputs: ['q.idea'] },
      };
    case 'missing':
      return { kind: 'missing', placeholder: FIXTURE_QUESTION };
  }
}

/** One block of the requested kind, with a stable id. */
export function block(
  file: Block['file'],
  section: string,
  ord: number,
  kind: OriginKind,
  text = `${section} text ${ord}`,
  review: ReviewState = 'unreviewed',
): Block {
  return { id: blockId(file, section, ord), file, section, ord, text, origin: originOf(kind), review, locked: false };
}

/** A generated document holding the given blocks. */
export function doc(file: Block['file'], blocks: Block[]): GeneratedDoc {
  return { file, blocks, version: 1, generatedAt: 0, path: 'template' };
}
