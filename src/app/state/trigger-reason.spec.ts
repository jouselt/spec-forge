import { describeTrigger } from './trigger-reason';
import { Answer, TriggerTrace } from '../core/question-graph';

describe('describeTrigger()', () => {
  const stackAnswer: Answer = {
    id: 'q.stack',
    questionId: 'q.stack',
    text: 'Angular, Node.js, Ollama, Docker',
    kind: 'list',
    askedAt: 1000,
    source: 'base',
  };

  it('should fill the trigger template with the matched phrase and the base step', () => {
    const trace: TriggerTrace = {
      triggerId: 'local_model',
      becauseAnswerId: 'q.stack',
      matchedPhrase: 'ollama',
      matchedAt: 1000,
    };

    expect(describeTrigger(trace, [stackAnswer])).toBe(
      'Asked because you mentioned ollama in step 7',
    );
  });

  it('should name the step of the answer that fired the trigger', () => {
    const trace: TriggerTrace = {
      triggerId: 'local_model',
      becauseAnswerId: 'q.stack',
      matchedPhrase: 'local model',
      matchedAt: 1000,
    };

    expect(describeTrigger(trace, [stackAnswer])).toContain('in step 7');
  });

  it('should fall back to a fixed sentence when the trigger came from a follow-up', () => {
    const followUp: Answer = {
      id: 'a.ctx_window',
      questionId: 'a.ctx_window',
      text: '8K tokens from a local model',
      kind: 'text',
      askedAt: 2000,
      source: 'adaptive',
    };
    const trace: TriggerTrace = {
      triggerId: 'local_model',
      becauseAnswerId: 'a.ctx_window',
      matchedPhrase: 'local model',
      matchedAt: 2000,
    };

    expect(describeTrigger(trace, [followUp])).toBe(
      'Asked because you mentioned local model in a follow-up question',
    );
  });

  it('should fall back to the fixed sentence when the answer is unknown', () => {
    const trace: TriggerTrace = {
      triggerId: 'local_model',
      becauseAnswerId: 'missing',
      matchedPhrase: 'ollama',
      matchedAt: 1000,
    };

    expect(describeTrigger(trace, [])).toContain('in a follow-up question');
  });

  it('should use the default template when the trigger id is unknown', () => {
    const trace: TriggerTrace = {
      triggerId: 'not_a_trigger',
      becauseAnswerId: 'q.stack',
      matchedPhrase: 'something',
      matchedAt: 1000,
    };

    expect(describeTrigger(trace, [stackAnswer])).toBe(
      'Asked because you mentioned something in step 7',
    );
  });
});
