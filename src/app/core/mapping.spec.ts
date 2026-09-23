import {
  ALL_SECTIONS,
  MAP,
  PROPOSAL_SECTIONS,
  SECTION_ALIASES,
  answerIds,
  canonicalSectionName,
  isKnownSection,
  questionById,
  sectionNamesFor,
  sectionsFor,
  targetsFor,
} from './mapping';

/** The six sections every one of the eleven sibling specs carries. */
const SHARED_SECTIONS = [
  'Problem',
  'Goal',
  'Target Signal',
  'Tech Stack',
  'Acceptance Criteria',
  'Timeline',
];

describe('answer to section mapping', () => {
  describe('answer ids', () => {
    it('keys a real answer id in every entry', () => {
      const real = answerIds();

      for (const id of Object.keys(MAP)) {
        expect(real).withContext(`MAP key ${id}`).toContain(id);
      }
    });

    it('maps every answer the question graph can produce', () => {
      // An unmapped answer would be dropped from the output without a word.
      for (const id of answerIds()) {
        expect(MAP[id]).withContext(`missing MAP entry for ${id}`).toBeDefined();
      }
    });

    it('keeps the base steps and the adaptive questions distinct', () => {
      const ids = answerIds();

      expect(ids.filter((id) => id.startsWith('a.')).length).toBe(22);
      expect(ids.filter((id) => id.startsWith('q.')).length).toBe(9);
    });

    it('resolves a question by id', () => {
      expect(questionById('q.constraints')?.prompt).toBe('Which constraints can you measure before starting?');
      expect(questionById('nope')).toBeNull();
    });
  });

  describe('section targets', () => {
    it('targets a real section name in every file', () => {
      for (const [id, targets] of Object.entries(MAP)) {
        for (const name of targets.proposal) {
          expect(sectionNamesFor('proposal')).withContext(`${id} to proposal ${name}`).toContain(name);
        }
        for (const name of targets.design) {
          expect(sectionNamesFor('design')).withContext(`${id} to design ${name}`).toContain(name);
        }
        for (const name of targets.tasks) {
          expect(sectionNamesFor('tasks')).withContext(`${id} to tasks ${name}`).toContain(name);
        }
      }
    });

    it('returns an empty target set for an unmapped id', () => {
      expect(targetsFor('q.not-a-question')).toEqual({ proposal: [], design: [], tasks: [] });
    });

    it('maps the idea answer to the architecture and the layout', () => {
      expect(targetsFor('q.idea').design).toContain('Architecture');
      expect(targetsFor('q.idea').proposal).toContain('Goal');
    });

    it('maps the proof and the constraints to the acceptance criteria', () => {
      expect(targetsFor('q.proof').proposal).toContain('Acceptance Criteria');
      expect(targetsFor('q.constraints').proposal).toContain('Acceptance Criteria');
    });
  });

  describe('the six shared sections', () => {
    it('is reachable from at least one mapped answer', () => {
      const reached = new Set<string>();

      for (const targets of Object.values(MAP)) {
        for (const name of targets.proposal) {
          reached.add(name);
        }
      }

      for (const name of SHARED_SECTIONS) {
        expect(reached.has(name)).withContext(`${name} is unreachable`).toBe(true);
      }
    });

    it('is emitted by the proposal skeleton in the order the corpus uses', () => {
      const names = sectionNamesFor('proposal');

      for (const name of SHARED_SECTIONS) {
        expect(names).withContext(name).toContain(name);
      }

      expect(names.indexOf('Problem')).toBeLessThan(names.indexOf('Goal'));
      expect(names.indexOf('Goal')).toBeLessThan(names.indexOf('Target Signal'));
      expect(names.indexOf('Tech Stack')).toBeLessThan(names.indexOf('Timeline'));
      expect(names.indexOf('Timeline')).toBeLessThan(names.indexOf('Acceptance Criteria'));
    });

    it('reaches Timeline from the risk answer, which names what to build first', () => {
      expect(targetsFor('q.risk').proposal).toContain('Timeline');
    });
  });

  describe('the spelling decision', () => {
    it('emits the app spelling, not the corpus spelling', () => {
      expect(sectionNamesFor('proposal')).toContain('Target Signal');
      expect(sectionNamesFor('proposal')).not.toContain('Target Recruiter Signal');
    });

    it('accepts both spellings on the way in', () => {
      expect(canonicalSectionName('Target Recruiter Signal')).toBe('Target Signal');
      expect(canonicalSectionName('Target Signal')).toBe('Target Signal');
      expect(SECTION_ALIASES['Target Recruiter Signal']).toBe('Target Signal');
    });

    it('accepts the heading variants the eleven sibling specs use', () => {
      // 8 of the 11 specs qualify Tech Stack; one qualifies it as high-level.
      expect(canonicalSectionName('Tech Stack (Angular/NestJS)')).toBe('Tech Stack');
      expect(canonicalSectionName('Tech Stack (high-level)')).toBe('Tech Stack');
      expect(canonicalSectionName('  Acceptance   Criteria ')).toBe('Acceptance Criteria');
      expect(canonicalSectionName('acceptance criteria')).toBe('Acceptance Criteria');
      expect(canonicalSectionName('Architecture (ASCII diagram)')).toBe('Architecture');
    });

    it('rejects a heading that belongs to no registry', () => {
      expect(canonicalSectionName('The Numbers')).toBeNull();
      expect(canonicalSectionName('')).toBeNull();
    });

    it('knows which file a heading belongs to', () => {
      expect(isKnownSection('proposal', 'Risks')).toBe(true);
      expect(isKnownSection('design', 'Risks')).toBe(false);
      expect(isKnownSection('tasks', 'Definition of Done')).toBe(true);
    });
  });

  describe('the section registry', () => {
    it('files every section under its own file', () => {
      for (const section of ALL_SECTIONS) {
        expect(sectionsFor(section.file)).withContext(section.name).toContain(section);
      }
    });

    it('splits the three files as the design states', () => {
      expect(sectionNamesFor('proposal').length).toBe(PROPOSAL_SECTIONS.length);
      expect(sectionNamesFor('design').length).toBe(11);
      expect(sectionNamesFor('tasks').length).toBe(6);
    });

    it('marks the six shared sections and Risks required', () => {
      const required = sectionsFor('proposal')
        .filter((section) => section.required)
        .map((section) => section.name);

      for (const name of [...SHARED_SECTIONS, 'Risks']) {
        expect(required).withContext(name).toContain(name);
      }
    });

    it('leaves capability handling optional, because it needs an adaptive answer', () => {
      const capability = sectionsFor('design').find((section) => section.name === 'Capability handling');

      expect(capability?.required).toBe(false);
    });

    it('reaches every registered section from at least one answer', () => {
      const reached = new Set<string>();

      for (const targets of Object.values(MAP)) {
        for (const name of [...targets.proposal, ...targets.design, ...targets.tasks]) {
          reached.add(name);
        }
      }

      for (const section of ALL_SECTIONS) {
        expect(reached.has(section.name)).withContext(`${section.name} is unreachable`).toBe(true);
      }
    });
  });
});
