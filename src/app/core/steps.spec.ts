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

  it('step 5 validation should accept measurable answers', () => {
    const step5 = BASE_STEPS.find(q => q.id === 'q.proof');
    if (step5?.validate) {
      expect(step5.validate('Loads in under 2 seconds')).toBeNull();
      expect(step5.validate('5 of 5 unanswerable questions return an abstain')).toBeNull();
    }
  });
});
