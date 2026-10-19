import { GeneratedDoc, Block } from './question-graph';

import { assemble } from '../templates/assembly';
import { completeAnswers } from '../templates/fixtures/answer-sets';
import { BANNED_WORDS, EM_DASH } from './banned-words';
import { lintStyle, lintText } from './style-lint';

describe('style-lint', () => {
  function baseline(): GeneratedDoc[] {
    return assemble(completeAnswers());
  }

  it('should flag every banned word on its own', () => {
    expect(BANNED_WORDS.length).toBe(19);

    for (const word of BANNED_WORDS) {
      const hits = lintText(`This sentence is ${word} on purpose.`);

      expect(hits.map((hit) => hit.word)).withContext(word).toEqual([word]);
      expect(hits[0].kind).withContext(word).toBe('banned-word');
    }
  });

  it('should flag each banned word regardless of case', () => {
    for (const word of BANNED_WORDS) {
      const hits = lintText(`SHOUTING ${word.toUpperCase()} HERE`);

      expect(hits.length).withContext(word).toBe(1);
    }
  });

  it('should flag the inflections the words actually appear in', () => {
    expect(lintText('showcasing the work').map((hit) => hit.word)).toEqual(['showcase']);
    expect(lintText('many landscapes').map((hit) => hit.word)).toEqual(['landscape']);
    expect(lintText('fostered it').map((hit) => hit.word)).toEqual(['foster']);
  });

  it('should not flag a derived adverb, which is a different word', () => {
    expect(lintText('fundamentally different')).toEqual([]);
    expect(lintText('significantly faster')).toEqual([]);
    expect(lintText('crucially important')).toEqual([]);
  });

  it('should not flag a word that merely contains a banned one', () => {
    expect(lintText('the unfolding story')).toEqual([]);
    expect(lintText('underneath it')).toEqual([]);
    expect(lintText('delved')).toEqual([{ kind: 'banned-word', word: 'delve', at: 0 }]);
  });

  it('should flag an em dash and name its position', () => {
    const hits = lintText(`one ${EM_DASH} two`);

    expect(hits.length).toBe(1);
    expect(hits[0].kind).toBe('em-dash');
    expect(hits[0].at).toBe(4);
  });

  it('should flag an em dash and a word in the same text', () => {
    const hits = lintText(`a ${EM_DASH} robust thing`);

    expect(hits.map((hit) => hit.kind)).toEqual(['em-dash', 'banned-word']);
  });

  it('should name the block a finding came from, with an excerpt', () => {
    const docs = baseline();
    const block: Block = {
      ...docs[0].blocks[0],
      id: 'proposal:problem:dirty',
      text: `A ${EM_DASH} thing.`,
    };
    const patched = docs.map((doc, index) =>
      index === 0 ? { ...doc, blocks: [...doc.blocks, block] } : doc,
    );
    const findings = lintStyle(patched);

    expect(findings.length).toBe(1);
    expect(findings[0].file).toBe('proposal');
    expect(findings[0].blockId).toBe('proposal:problem:dirty');
    expect(findings[0].excerpt).toContain(EM_DASH);
  });

  it('should find nothing in the spec this app generates itself', () => {
    const findings = lintStyle(baseline());

    expect(findings.map((finding: { blockId: string; word: string }) => `${finding.blockId}: ${finding.word}`)).toEqual([]);
  });

  it('should report one finding per rule per block, not per occurrence', () => {
    const docs = baseline();
    const block: Block = {
      ...docs[0].blocks[0],
      id: 'proposal:problem:repeat',
      text: 'robust and robust and robust',
    };
    const patched = docs.map((doc: GeneratedDoc, index: number) =>
      index === 0 ? { ...doc, blocks: [...doc.blocks, block] } : doc,
    );

    expect(lintStyle(patched).length).toBe(1);
  });
});
