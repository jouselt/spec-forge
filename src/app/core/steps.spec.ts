import { BASE_STEPS, validateBaseSteps } from './steps';
import { Question } from './question-graph';

describe('Base Steps', () => {
  it('should have exactly 9 base steps', () => {
    expect(BASE_STEPS.length).toBe(9);
  });

  it('should have all required flags set to true', () => {
    for (const step of BASE_STEPS) {
      expect(step.required).toBe(true);
    }
  });

  it('should have sequential step numbers 1-9', () => {
    for (let i = 0; i < BASE_STEPS.length; i++) {
      expect(BASE_STEPS[i].step).toBe(i + 1);
    }
  });

  it('should have unique question ids', () => {
    const ids = new Set(BASE_STEPS.map(q => q.id));
    expect(ids.size).toBe(9);
  });

  it('should validate successfully', () => {
    const errors = validateBaseSteps();
    expect(errors).toEqual([]);
  });

  it('step 1 help should state the shape and the reader, with no outside audience', () => {
    const step1 = BASE_STEPS.find(q => q.id === 'q.idea');

    expect(step1?.help).toBe(
      'One paragraph. State what it is and who it is for, plainly enough that someone who has never seen it gets it on a first read.',
    );
  });

  it('should name no reader outside the project in any prompt or help line', () => {
    const outsideAudience = /\b(recruiter|recruiting|hiring manager|interviewer)\b/i;

    for (const step of BASE_STEPS) {
      expect(outsideAudience.test(step.prompt)).toBe(
        false,
        `Prompt for ${step.id} describes an outside audience`,
      );
      expect(outsideAudience.test(step.help ?? '')).toBe(
        false,
        `Help for ${step.id} describes an outside audience`,
      );
    }
  });

  it('step 5 validation should reject "it works"', () => {
    const step5 = BASE_STEPS.find(q => q.id === 'q.proof');
    expect(step5).toBeTruthy();
    if (step5?.validate) {
      expect(step5.validate('it works')).not.toBeNull();
    }
  });

  it('step 5 validation should reject answers under 12 chars', () => {
    const step5 = BASE_STEPS.find(q => q.id === 'q.proof');
    if (step5?.validate) {
      expect(step5.validate('fast')).not.toBeNull();
    }
  });

  it('step 5 validation: 6 rejection cases and 4 acceptance cases', () => {
    const step5 = BASE_STEPS.find(q => q.id === 'q.proof');
    if (!step5?.validate) return fail('step 5 should have validate function');

    // 6 rejection cases
    const rejections = [
      'it works',
      'works',
      'good',
      'fast',
      'better',
      'done',
    ];

    for (const answer of rejections) {
      expect(step5.validate(answer)).not.toBeNull(`Expected rejection for: "${answer}"`);
    }

    // 4 acceptance cases
    const acceptances = [
      'Loads in under 2 seconds',
      '5 of 5 unanswerable questions return an abstain',
      'P99 latency < 100ms',
      'Processes 10000 items per second',
    ];

    for (const answer of acceptances) {
      expect(step5.validate(answer)).toBeNull(`Expected acceptance for: "${answer}"`);
    }
  });

  it('step 5 validation should accept measurable answers', () => {
    const step5 = BASE_STEPS.find(q => q.id === 'q.proof');
    if (step5?.validate) {
      expect(step5.validate('Loads in under 2 seconds')).toBeNull();
      expect(step5.validate('5 of 5 unanswerable questions return an abstain')).toBeNull();
    }
  });
});
