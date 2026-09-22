import { evaluateTriggers, normalize, TRIGGERS } from './triggers';
import { Answer } from './question-graph';

describe('Trigger System', () => {
  describe('normalize()', () => {
    it('should lowercase text', () => {
      expect(normalize('OLLAMA')).toBe('ollama');
    });

    it('should collapse whitespace', () => {
      expect(normalize('a    b\t\nc')).toBe('a b c');
    });

    it('should strip punctuation except hyphens', () => {
      expect(normalize('hello, world!')).toBe('hello world');
      expect(normalize('self-hosted')).toBe('self-hosted');
    });

    it('should trim edges', () => {
      expect(normalize('  hello  ')).toBe('hello');
    });

    it('should handle mixed case with punctuation', () => {
      expect(normalize('OAuth2.0 / SAML?')).toBe('oauth20 saml');
    });

    it('should handle hyphenated words', () => {
      expect(normalize('real-time-analytics')).toBe('real-time-analytics');
    });

    it('should handle numbers', () => {
      expect(normalize('1024 tokens')).toBe('1024 tokens');
    });

    it('should handle empty string', () => {
      expect(normalize('')).toBe('');
    });
  });

  describe('TRIGGERS constant', () => {
    it('should have at least 10 triggers', () => {
      expect(TRIGGERS.length).toBeGreaterThanOrEqual(10);
    });

    it('should have specific trigger ids', () => {
      const ids = new Set(TRIGGERS.map((t) => t.id));
      expect(ids.has('local_model')).toBe(true);
      expect(ids.has('corpus')).toBe(true);
      expect(ids.has('vector_db')).toBe(true);
      expect(ids.has('realtime')).toBe(true);
      expect(ids.has('payments')).toBe(true);
      expect(ids.has('auth')).toBe(true);
      expect(ids.has('browser_ai')).toBe(true);
      expect(ids.has('nixos_deploy')).toBe(true);
      expect(ids.has('angular')).toBe(true);
      expect(ids.has('nestjs')).toBe(true);
    });

    it('should have no duplicate trigger ids', () => {
      const ids = new Map<string, number>();
      for (const trigger of TRIGGERS) {
        if (ids.has(trigger.id)) {
          fail(`Duplicate trigger id: ${trigger.id}`);
        }
        ids.set(trigger.id, 1);
      }
    });

    it('should have patterns with at least one entry per trigger', () => {
      for (const trigger of TRIGGERS) {
        expect(trigger.patterns.length).toBeGreaterThan(0);
      }
    });

    it('should have questions with at least one entry per trigger', () => {
      for (const trigger of TRIGGERS) {
        expect(trigger.questions.length).toBeGreaterThan(0);
      }
    });

    it('should have maxQuestions <= 3 per trigger', () => {
      for (const trigger of TRIGGERS) {
        expect(trigger.maxQuestions).toBeLessThanOrEqual(3);
      }
    });

    it('should have unique adaptive question ids', () => {
      const ids = new Set<string>();
      for (const trigger of TRIGGERS) {
        for (const q of trigger.questions) {
          if (ids.has(q.id)) {
            fail(`Duplicate adaptive question id: ${q.id}`);
          }
          ids.add(q.id);
        }
      }
    });

    it('should have all adaptive questions marked as such', () => {
      for (const trigger of TRIGGERS) {
        for (const q of trigger.questions) {
          expect(q.adaptive).toBeTruthy();
          expect(q.adaptive?.triggerId).toBe(trigger.id);
        }
      }
    });
  });

  describe('evaluateTriggers()', () => {
    it('should return empty questions and traces for empty answers', () => {
      const result = evaluateTriggers([]);
      expect(result.questions).toEqual([]);
      expect(result.traces).toEqual([]);
    });

    it('should be deterministic: running 100 times produces identical output', () => {
      const answers: Answer[] = [
        {
          id: 'q.stack',
          questionId: 'q.stack',
          text: 'Angular 20, Node.js, PostgreSQL with pgvector, Docker on Kubernetes',
          kind: 'list',
          askedAt: Date.now(),
          source: 'base',
        },
      ];

      const results = [];
      for (let i = 0; i < 100; i++) {
        const result = evaluateTriggers(answers);
        results.push(JSON.stringify(result));
      }

      // All results should be byte-identical (as JSON strings)
      for (let i = 1; i < 100; i++) {
        expect(results[i]).toBe(results[0]);
      }
    });

    it('should fire local_model trigger on Ollama mention', () => {
      const answers: Answer[] = [
        {
          id: 'q.idea',
          questionId: 'q.idea',
          text: 'An Angular app using a local Ollama model and pgvector',
          kind: 'longtext',
          askedAt: Date.now(),
          source: 'base',
        },
      ];

      const result = evaluateTriggers(answers);
      const triggerIds = new Set(result.traces.map((t) => t.triggerId));

      expect(triggerIds.has('local_model')).toBe(true);
      expect(triggerIds.has('vector_db')).toBe(true);
      expect(triggerIds.has('angular')).toBe(true);
    });

    it('should yield at most 7 follow-ups for three-trigger match', () => {
      const answers: Answer[] = [
        {
          id: 'q.idea',
          questionId: 'q.idea',
          text: 'An Angular app using a local Ollama model and pgvector',
          kind: 'longtext',
          askedAt: Date.now(),
          source: 'base',
        },
      ];

      const result = evaluateTriggers(answers);
      // local_model: 3 max, vector_db: 2 max, angular: 2 max = 7 total
      expect(result.questions.length).toBeLessThanOrEqual(7);
    });

    it('should track matched phrases exactly', () => {
      const answers: Answer[] = [
        {
          id: 'q.stack',
          questionId: 'q.stack',
          text: 'Using Stripe for payments',
          kind: 'list',
          askedAt: Date.now(),
          source: 'base',
        },
      ];

      const result = evaluateTriggers(answers);
      const traces = result.traces.filter((t) => t.triggerId === 'payments');

      expect(traces.length).toBeGreaterThan(0);
      expect(traces[0].matchedPhrase).toBe('stripe');
    });

    it('should retract questions when trigger keyword is removed', () => {
      const askedAt = 1_000;
      let answers: Answer[] = [
        {
          id: 'q.idea',
          questionId: 'q.idea',
          text: 'An Angular app using a local model with pgvector',
          kind: 'longtext',
          askedAt,
          source: 'base',
        },
      ];

      const result1 = evaluateTriggers(answers);

      answers = [
        {
          id: 'q.idea',
          questionId: 'q.idea',
          text: 'An Angular app using pgvector',
          kind: 'longtext',
          askedAt,
          editedAt: 2_000,
          source: 'base',
        },
      ];

      const result2 = evaluateTriggers(answers);
      const initialTriggerIds = new Set(
        result1.questions.map((question) => question.adaptive?.triggerId),
      );
      const editedTriggerIds = new Set(
        result2.questions.map((question) => question.adaptive?.triggerId),
      );

      expect(initialTriggerIds.has('local_model')).toBe(true);
      expect(editedTriggerIds.has('local_model')).toBe(false);
      expect(editedTriggerIds.has('angular')).toBe(true);
      expect(editedTriggerIds.has('vector_db')).toBe(true);
    });

    it('should enforce 12 global follow-up cap', () => {
      // Craft an answer that triggers many patterns
      const answers: Answer[] = [
        {
          id: 'q.stack',
          questionId: 'q.stack',
          text: `
            Angular with NestJS backend, Ollama local model with pgvector embeddings,
            real-time WebSocket updates, Stripe payments with OAuth2 auth,
            PostgreSQL storage, browser-based inference with WebGPU,
            Nix deployment to NixOS, 1M document corpus
          `,
          kind: 'list',
          askedAt: Date.now(),
          source: 'base',
        },
      ];

      const result = evaluateTriggers(answers);
      expect(result.questions.length).toBeLessThanOrEqual(12);
    });

    it('should not exceed maxQuestions per trigger', () => {
      const answers: Answer[] = [
        {
          id: 'q.stack',
          questionId: 'q.stack',
          text: `
            ollama ollama ollama local-model local-model on-device self-hosted
            corpus corpus corpus corpus corpus
            vector pgvector pgvector
            realtime streaming websocket
            stripe payment oauth saml
            nestjs express fastify
            angular typescript
            nix flakes declarative
            webgpu wasm browser-ai
          `,
          kind: 'list',
          askedAt: Date.now(),
          source: 'base',
        },
      ];

      const result = evaluateTriggers(answers);

      // Count questions per trigger
      const perTrigger = new Map<string, number>();
      for (const q of result.questions) {
        if (q.adaptive?.triggerId) {
          perTrigger.set(
            q.adaptive.triggerId,
            (perTrigger.get(q.adaptive.triggerId) ?? 0) + 1,
          );
        }
      }

      // Verify each trigger respects its maxQuestions
      for (const trigger of TRIGGERS) {
        const count = perTrigger.get(trigger.id) ?? 0;
        expect(count).toBeLessThanOrEqual(trigger.maxQuestions);
      }
    });

    it('should sort adaptive groups immediately after their trigger step', () => {
      const answers: Answer[] = [
        {
          id: 'q.idea',
          questionId: 'q.idea',
          text: 'An Angular app using pgvector',
          kind: 'longtext',
          askedAt: 1_000,
          source: 'base',
        },
        {
          id: 'q.stack',
          questionId: 'q.stack',
          text: 'Stripe payments with OAuth login',
          kind: 'list',
          askedAt: 2_000,
          source: 'base',
        },
      ];

      const result = evaluateTriggers(answers);

      for (const triggerId of ['angular', 'vector_db']) {
        const group = result.questions.filter(
          (question) => question.adaptive?.triggerId === triggerId,
        );
        for (const question of group) {
          expect(question.step).toBeGreaterThan(1);
          expect(question.step).toBeLessThan(2);
        }
      }

      for (const triggerId of ['payments', 'auth']) {
        const group = result.questions.filter(
          (question) => question.adaptive?.triggerId === triggerId,
        );
        for (const question of group) {
          expect(question.step).toBeGreaterThan(7);
          expect(question.step).toBeLessThan(8);
        }
      }

      const triggerIds = result.questions.map((question) => question.adaptive?.triggerId);
      expect(triggerIds).toEqual([
        'vector_db',
        'vector_db',
        'angular',
        'angular',
        'payments',
        'payments',
        'payments',
        'auth',
        'auth',
      ]);
    });

    it('should capture TriggerTrace with all fields', () => {
      const askedAt = 1_000;
      const editedAt = 2_000;
      const answers: Answer[] = [
        {
          id: 'q.stack',
          questionId: 'q.stack',
          text: 'Using Stripe for billing',
          kind: 'list',
          askedAt,
          editedAt,
          source: 'base',
        },
      ];

      const result = evaluateTriggers(answers);
      const trace = result.traces[0];

      expect(trace.triggerId).toBe('payments');
      expect(trace.becauseAnswerId).toBe('q.stack');
      expect(trace.matchedPhrase).toBe('stripe');
      expect(typeof trace.matchedAt).toBe('number');
      expect(trace.matchedAt).toBe(editedAt);
    });

    it('should not fire framework triggers for TypeScript alone', () => {
      const result = evaluateTriggers([
        {
          id: 'q.stack',
          questionId: 'q.stack',
          text: 'TypeScript',
          kind: 'list',
          askedAt: 1_000,
          source: 'base',
        },
      ]);
      const triggerIds = result.traces.map((trace) => trace.triggerId);

      expect(triggerIds).not.toContain('angular');
      expect(triggerIds).not.toContain('nestjs');
    });

    it('should handle multiple answers firing the same trigger', () => {
      const answers: Answer[] = [
        {
          id: 'q.goal',
          questionId: 'q.goal',
          text: 'Use Angular for the frontend',
          kind: 'longtext',
          askedAt: Date.now(),
          source: 'base',
        },
        {
          id: 'q.stack',
          questionId: 'q.stack',
          text: 'TypeScript with @angular/core',
          kind: 'list',
          askedAt: Date.now(),
          source: 'base',
        },
      ];

      const result = evaluateTriggers(answers);

      // Angular trigger should fire twice
      const angularTraces = result.traces.filter((t) => t.triggerId === 'angular');
      expect(angularTraces.length).toBeGreaterThanOrEqual(2);

      // But questions should only be added once (deduped by trigger)
      const angularQuestions = result.questions.filter(
        (q) => q.adaptive?.triggerId === 'angular',
      );
      expect(angularQuestions.length).toBeLessThanOrEqual(2);
    });

    it('should handle case-insensitive pattern matching', () => {
      const answers: Answer[] = [
        {
          id: 'q.stack',
          questionId: 'q.stack',
          text: 'POSTGRESQL WITH PGVECTOR SUPPORT',
          kind: 'list',
          askedAt: Date.now(),
          source: 'base',
        },
      ];

      const result = evaluateTriggers(answers);
      const vectorTriggers = result.traces.filter((t) => t.triggerId === 'vector_db');

      expect(vectorTriggers.length).toBeGreaterThan(0);
    });
  });
});
