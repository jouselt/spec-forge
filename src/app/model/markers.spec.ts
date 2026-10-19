import {
  GOOD_COVERAGE,
  MIN_COVERAGE,
  blocksFromShaped,
  measureCoverage,
  parseMarkers,
  routeCoverage,
  shapedDoc,
  splitSentences,
} from './markers';

/** One sentence per line, `marked` of them citing an answer. */
function run(total: number, marked: number): string {
  return Array.from({ length: total }, (_, index) =>
    index < marked
      ? `Sentence number ${index + 1} that cites something [[answer:${(index % 9) + 1}]].`
      : `Sentence number ${index + 1} that cites nothing at all.`,
  ).join(' ');
}

describe('splitSentences', () => {
  it('should split on sentence ends and keep the punctuation', () => {
    expect(splitSentences('One. Two! Three?')).toEqual(['One.', 'Two!', 'Three?']);
  });

  it('should return nothing for empty text', () => {
    expect(splitSentences('   ')).toEqual([]);
  });

  it('should keep a sentence with no final punctuation whole', () => {
    expect(splitSentences('No full stop here')).toEqual(['No full stop here']);
  });
});

describe('parseMarkers', () => {
  it('should read the answer number and strip the marker', () => {
    const sentence = parseMarkers('The app stores drafts. [[answer:3]]');

    expect(sentence.marked).toBe(true);
    expect(sentence.answerIndexes).toEqual([3]);
    expect(sentence.text).toBe('The app stores drafts.');
  });

  it('should read several markers in one sentence', () => {
    expect(parseMarkers('Two facts. [[answer:1]] [[answer:2]]').answerIndexes).toEqual([1, 2]);
  });

  it('should ignore a marker that is not a positive number', () => {
    expect(parseMarkers('A fact. [[answer:0]]').marked).toBe(false);
    expect(parseMarkers('A fact. [[answer:x]]').marked).toBe(false);
  });

  it('should call a sentence with no marker unmarked', () => {
    expect(parseMarkers('A fact with nothing behind it.').marked).toBe(false);
  });
});

describe('routeCoverage', () => {
  it('should accept at or above the good threshold', () => {
    expect(GOOD_COVERAGE).toBe(0.8);
    expect(routeCoverage(1)).toBe('accept');
    expect(routeCoverage(0.8)).toBe('accept');
  });

  it('should accept with a banner between the two thresholds', () => {
    expect(routeCoverage(0.79)).toBe('accept-with-banner');
    expect(routeCoverage(0.6)).toBe('accept-with-banner');
  });

  it('should reject under the minimum', () => {
    expect(MIN_COVERAGE).toBe(0.6);
    expect(routeCoverage(0.59)).toBe('reject');
    expect(routeCoverage(0)).toBe('reject');
  });
});

describe('measureCoverage', () => {
  it('should score seven of ten at 0.70 and ask for a banner', () => {
    const report = measureCoverage(run(10, 7));

    expect(report.total).toBe(10);
    expect(report.marked).toBe(7);
    expect(report.coverage).toBeCloseTo(0.7, 5);
    expect(report.verdict).toBe('accept-with-banner');
    expect(report.banner).toContain('70%');
  });

  it('should fail ten sentences with five markers', () => {
    const report = measureCoverage(run(10, 5));

    expect(report.coverage).toBe(0.5);
    expect(report.verdict).toBe('reject');
    expect(report.banner).toContain('template output is unchanged');
  });

  it('should accept ten of ten with no banner', () => {
    const report = measureCoverage(run(10, 10));

    expect(report.verdict).toBe('accept');
    expect(report.banner).toBeNull();
  });

  it('should call empty text zero coverage rather than a division by zero', () => {
    const report = measureCoverage('   ');

    expect(report.total).toBe(0);
    expect(report.coverage).toBe(0);
    expect(report.verdict).toBe('reject');
  });
});

describe('blocksFromShaped', () => {
  const answers = [{ id: 'q.idea' }, { id: 'q.problem' }, { id: 'q.goal' }];

  it('should make a marked sentence an answer block naming what it cited', () => {
    const blocks = blocksFromShaped(
      'A cited fact. [[answer:2]]',
      'proposal',
      'Problem',
      'Qwen2.5',
      answers,
      0.2,
    );

    expect(blocks.length).toBe(1);
    expect(blocks[0].origin.kind).toBe('answer');
    expect(blocks[0].review).toBe('confirmed');
    expect(blocks[0].text).toBe('A cited fact.');
  });

  it('should make an unmarked sentence its own unreviewed model block', () => {
    const blocks = blocksFromShaped(
      'A cited fact. [[answer:1]] An invented fact.',
      'proposal',
      'Problem',
      'Qwen2.5',
      answers,
      0.2,
    );

    expect(blocks.length).toBe(2);
    expect(blocks[0].origin.kind).toBe('answer');
    expect(blocks[1].origin.kind).toBe('model');
    expect(blocks[1].review).toBe('unreviewed');
    expect(blocks[1].text).toBe('An invented fact.');
  });

  it('should split a mixed paragraph instead of merging it', () => {
    const blocks = blocksFromShaped(
      run(10, 8),
      'design',
      'Architecture',
      'Qwen2.5',
      answers,
      0.2,
    );

    expect(blocks.length).toBe(10);
    expect(blocks.filter((block) => block.origin.kind === 'model').length).toBe(2);
  });

  it('should give every block a distinct id', () => {
    const blocks = blocksFromShaped(run(10, 8), 'proposal', 'Goal', 'Qwen2.5', answers, 0.2);
    const ids = new Set(blocks.map((block) => block.id));

    expect(ids.size).toBe(blocks.length);
  });
});

describe('shapedDoc', () => {
  const answers = [{ id: 'q.idea' }];

  it('should return null under the minimum coverage so the template stays', () => {
    expect(shapedDoc(run(10, 5), 'proposal', 'Problem', 'Qwen2.5', answers, 0.2)).toBeNull();
  });

  it('should return a shaped document at good coverage', () => {
    const doc = shapedDoc(run(10, 9), 'proposal', 'Problem', 'Qwen2.5', answers, 0.2);

    expect(doc).not.toBeNull();
    expect(doc?.file).toBe('proposal');
    expect(doc?.path).toBe('shaped');
    expect(doc?.blocks.length).toBe(10);
  });
});
