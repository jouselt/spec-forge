import { WizardStore, orderQuestions, REQUIRED_MESSAGE } from './wizard-store.service';
import { BASE_STEPS } from '../core/steps';
import { Question } from '../core/question-graph';

describe('WizardStore', () => {
  let store: WizardStore;

  beforeEach(() => {
    store = new WizardStore();
  });

  it('should start on the first base question with no answers', () => {
    expect(store.questions().length).toBe(9);
    expect(store.index()).toBe(0);
    expect(store.current()?.id).toBe('q.idea');
    expect(store.answers()).toEqual([]);
    expect(store.answeredCount()).toBe(0);
  });

  it('should expose the nine base questions in step order', () => {
    expect(store.questions().map((question) => question.id)).toEqual(
      BASE_STEPS.map((question) => question.id),
    );
  });

  describe('answers', () => {
    it('should record an answer with kind, source and timestamp', () => {
      store.setText('q.idea', 'A wizard that interviews you before generating specs.');

      const answer = store.answerFor('q.idea');
      expect(answer?.text).toBe('A wizard that interviews you before generating specs.');
      expect(answer?.kind).toBe('longtext');
      expect(answer?.source).toBe('base');
      expect(answer?.askedAt).toBeGreaterThan(0);
      expect(answer?.editedAt).toBeUndefined();
      expect(store.answeredCount()).toBe(1);
    });

    it('should keep askedAt and stamp editedAt on an edit', () => {
      store.setText('q.idea', 'First draft.');
      const askedAt = store.answerFor('q.idea')?.askedAt;

      store.setText('q.idea', 'Second draft.');

      expect(store.answerFor('q.idea')?.askedAt).toBe(askedAt);
      expect(store.answerFor('q.idea')?.editedAt).toBeGreaterThan(0);
      expect(store.answers().length).toBe(1);
    });

    it('should ignore a write to a question that is not in the list', () => {
      store.setText('a.ctx_window', '4096');

      expect(store.answers().length).toBe(0);
    });

    it('should drop the answer when the text is cleared', () => {
      store.setText('q.idea', 'Something.');
      store.setText('q.idea', '   ');

      expect(store.answerFor('q.idea')).toBeNull();
      expect(store.answeredCount()).toBe(0);
    });
  });

  describe('validation', () => {
    it('should block advancing while a required question is empty', () => {
      expect(store.currentError()).toBe(REQUIRED_MESSAGE);
      expect(store.canAdvance()).toBe(false);

      store.next();

      expect(store.index()).toBe(0);
    });

    it('should reject a vague proof and accept a measurable one', () => {
      store.jumpToQuestion('q.proof');

      store.setText('q.proof', 'it works');
      expect(store.currentError()).toBe(
        'Answer must be at least 12 characters. Name a number, a unit, or an observable behavior.',
      );
      expect(store.canAdvance()).toBe(false);

      store.setText('q.proof', 'loads in under 2s');
      expect(store.currentError()).toBeNull();
      expect(store.canAdvance()).toBe(true);
    });

    it('should not block a non-required question that is empty', () => {
      store.setText('q.stack', 'Ollama on device');
      store.jumpToQuestion('a.ctx_window');

      expect(store.current()?.required).toBe(false);
      expect(store.currentError()).toBeNull();
      expect(store.canAdvance()).toBe(true);
    });
  });

  describe('navigation', () => {
    it('should advance and go back', () => {
      store.setText('q.idea', 'An idea.');
      store.next();

      expect(store.current()?.id).toBe('q.problem');

      store.back();

      expect(store.current()?.id).toBe('q.idea');
      expect(store.isFirst()).toBe(true);
    });

    it('should not go back past the first question', () => {
      store.back();

      expect(store.index()).toBe(0);
    });

    it('should jump to a question by id', () => {
      store.jumpToQuestion('q.risk');

      expect(store.current()?.id).toBe('q.risk');
      expect(store.isLast()).toBe(true);
    });

    it('should clamp a jump outside the list', () => {
      store.jumpTo(99);
      expect(store.index()).toBe(8);

      store.jumpTo(-4);
      expect(store.index()).toBe(0);
    });

    it('should mark the current question and the answered ones in the rail', () => {
      store.setText('q.idea', 'An idea.');
      store.jumpTo(2);

      const rail = store.rail();
      expect(rail.length).toBe(9);
      expect(rail[0].status).toBe('answered');
      expect(rail[0].answered).toBe(true);
      expect(rail[2].status).toBe('current');
      expect(rail[3].status).toBe('pending');
      expect(rail[3].answered).toBe(false);
    });
  });

  describe('adaptive questions', () => {
    it('should drop local_model follow-ups right after the question that mentioned ollama', () => {
      store.jumpToQuestion('q.stack');
      store.setText('q.stack', 'Ollama on device, PostgreSQL, Docker');

      expect(store.total()).toBe(12);
      expect(store.questions().map((question) => question.id)).toEqual([
        'q.idea',
        'q.problem',
        'q.workaround',
        'q.goal',
        'q.proof',
        'q.constraints',
        'q.stack',
        'a.ctx_window',
        'a.vram_gb',
        'a.wasm_fallback',
        'q.scope_out',
        'q.risk',
      ]);
    });

    it('should mark the follow-up in the rail with the reason from the trace', () => {
      store.jumpToQuestion('q.stack');
      store.setText('q.stack', 'Ollama on device');

      const followUpIndex = store.questions().findIndex((question) => question.id === 'a.ctx_window');
      const entry = store.rail()[followUpIndex];

      expect(entry.question.adaptive?.triggerId).toBe('local_model');
      expect(entry.reason).toBe('Asked because you mentioned ollama in step 7');
    });

    it('should record a follow-up answer as adaptive with the trigger trace attached', () => {
      store.jumpToQuestion('q.stack');
      store.setText('q.stack', 'Ollama on device');
      store.setText('a.vram_gb', '16');

      const answer = store.answerFor('a.vram_gb');
      expect(answer?.source).toBe('adaptive');
      expect(answer?.kind).toBe('number');
      expect(answer?.trigger?.triggerId).toBe('local_model');
      expect(answer?.trigger?.becauseAnswerId).toBe('q.stack');
      expect(answer?.trigger?.matchedPhrase).toBe('ollama');
    });

    it('should not fire follow-ups for text that matches no trigger', () => {
      store.setText('q.idea', 'A calm notebook for recipes.');

      expect(store.total()).toBe(9);
      expect(store.rail().every((entry) => entry.reason === null)).toBe(true);
    });

    it('should remove the follow-ups and their answers when the keyword is deleted', () => {
      store.jumpToQuestion('q.stack');
      store.setText('q.stack', 'Ollama on device');
      store.setText('a.vram_gb', '16');

      store.setText('q.stack', 'PostgreSQL and Docker');

      expect(store.total()).toBe(9);
      expect(store.answerFor('a.vram_gb')).toBeNull();
      expect(store.answerFor('q.stack')?.text).toBe('PostgreSQL and Docker');
    });

    it('should keep the position on a valid question when the list shrinks', () => {
      store.jumpToQuestion('q.stack');
      store.setText('q.stack', 'Ollama on device');
      store.jumpTo(10);
      expect(store.current()?.id).toBe('q.scope_out');

      store.setText('q.stack', 'Docker only');

      // The position is clamped into the shorter list instead of pointing past the end.
      expect(store.current()?.id).toBe('q.risk');
      expect(store.total()).toBe(9);
    });
  });

  describe('snapshot() and reset()', () => {
    it('should hand back a copy of the answers', () => {
      store.setText('q.idea', 'An idea.');
      const snapshot = store.snapshot();

      snapshot[0].text = 'mutated';

      expect(store.answerFor('q.idea')?.text).toBe('An idea.');
    });

    it('should return to the initial state', () => {
      store.setText('q.stack', 'Ollama on device');
      store.next();

      store.reset();

      expect(store.answers()).toEqual([]);
      expect(store.total()).toBe(9);
      expect(store.index()).toBe(0);
      expect(store.traces()).toEqual([]);
    });
  });
});

describe('orderQuestions()', () => {
  function question(id: string, step: number): Question {
    return { id, step, prompt: id, kind: 'text', required: false };
  }

  it('should sort by step and keep the incoming order on a tie', () => {
    const ordered = orderQuestions([
      question('b', 2),
      question('a', 1),
      question('c', 2),
    ]);

    expect(ordered.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });

  it('should place a fractional step after its parent step', () => {
    const ordered = orderQuestions([
      question('base2', 2),
      question('adaptive1', 1.0769),
      question('base1', 1),
    ]);

    expect(ordered.map((entry) => entry.id)).toEqual(['base1', 'adaptive1', 'base2']);
  });
});
