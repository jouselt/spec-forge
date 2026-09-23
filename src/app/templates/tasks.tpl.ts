/**
 * Frames for `tasks.md`, plus the tag classifier.
 *
 * Every item is a checkbox with a tag:
 * - `G` a gate test: something a unit test or a fixture can hold;
 * - `E` an eval: a model call, a threshold, or a sample;
 * - `M` manual verification: everything else.
 *
 * The classifier is keyword-based on purpose, and its guess is always editable in
 * the output editor, so a wrong tag costs one click. `classifyTag` is exported
 * because the output editor (phase 5) re-tags an item after a manual edit.
 */

import {
  DEPLOY_STACK_PATTERN,
  TemplateSection,
  UNMEASURED_PATTERN,
} from './frame';

export type TaskTag = 'G' | 'E' | 'M';

/**
 * `E` is checked first: a sentence about measuring sits closer to an eval than to
 * a unit test, even when it also says the word "test".
 *
 * The model signals are phrases, not the bare word "model". A manual verification
 * step that happens to mention a model is still manual verification, and tagging
 * it `E` would send it to the wrong lane.
 */
const EVAL_SIGNALS: readonly RegExp[] = [
  /\b(model call|model calls|model path|model output|model weights|model id|local model|llm|judge|shaping run|inference call|prompt the model|call the model)\b/i,
  /\b(threshold|thresholds|sample|samples|eval|evals|benchmark|benchmarks)\b/i,
  /\b(latency|p95|p99|throughput|score|scores)\b/i,
];

/** `G` next: a named function, a fixture, or a command a gate test runs. */
const GATE_SIGNALS: readonly RegExp[] = [
  /\b(test|tests|spec|specs|fixture|fixtures|assert|asserts|asserting|unit|deterministic|typecheck|typechecks)\b/i,
  /npm (run )?(test|build)/i,
  /\b(migration|migrations|schema|schemas|interface|interfaces|contract|contracts)\b/i,
];

export function classifyTag(text: string): TaskTag {
  if (EVAL_SIGNALS.some((pattern) => pattern.test(text))) {
    return 'E';
  }

  if (GATE_SIGNALS.some((pattern) => pattern.test(text))) {
    return 'G';
  }

  return 'M';
}

/** One checkbox item, tagged. The tag defaults to the classifier's guess. */
export function itemLine(body: string, tag: TaskTag = classifyTag(body)): string {
  return `- [ ] \`[${tag}]\` ${body}`;
}

export const TASKS_TEMPLATE: readonly TemplateSection[] = [
  {
    section: 'Phase 1: Contracts and scaffold',
    gapQuestion: 'q.stack',
    frames: [
      {
        id: 'phase1.stack_item',
        kind: 'check',
        text: 'Add {item} to the scaffold and typecheck it; `npm run build` stays green.',
        when: (shape) => shape.has('q.stack'),
        each: 'stack_entries',
      },
      {
        id: 'phase1.contracts',
        kind: 'check',
        text: 'Write the contracts module for {name}; a fixture payload typechecks under strict mode.',
        when: (shape) => shape.has('q.idea'),
      },
      {
        id: 'phase1.offline_fixtures',
        kind: 'check',
        text: 'Add a fixture for every dependency in {stack_inline}; the tests run with no network.',
        when: (shape) => shape.count('q.stack') >= 3,
      },
    ],
  },
  {
    section: 'Phase 2: Core implementation',
    gapQuestion: 'q.idea',
    frames: [
      {
        id: 'phase2.walking_skeleton',
        kind: 'check',
        text: 'Implement the smallest end to end path through {name}; a unit test covers the seam between the parts.',
        when: (shape) => shape.has('q.idea'),
      },
      {
        id: 'phase2.goal_under_test',
        kind: 'check',
        text: 'Cover this with a test: {goal_sentence}',
        when: (shape) => shape.has('q.goal'),
      },
      {
        id: 'phase2.boundary_check',
        kind: 'check',
        text: 'Confirm {item} stays out of the build; a reviewer signs off on the boundary.',
        when: (shape) => shape.has('q.scope_out'),
        each: 'scope_entries',
      },
    ],
  },
  {
    section: 'Phase 3: Constraints and measurement',
    gapQuestion: 'q.constraints',
    frames: [
      {
        id: 'phase3.measure_constraint',
        kind: 'check',
        text: 'Measure {item_label} and record the value with a date; the threshold is written before the code is.',
        when: (shape) => shape.has('q.constraints') && !shape.matches('q.constraints', UNMEASURED_PATTERN),
        each: 'constraint_entries',
      },
      {
        id: 'phase3.record_hardware',
        kind: 'check',
        text: 'Record {item_label} in the README next to the model id; the number is measured, not assumed.',
        when: (shape) => shape.has('a.ctx_window') || shape.has('a.vram_gb') || shape.has('a.wasm_fallback'),
        each: 'hardware_entries',
      },
      {
        id: 'phase3.pick_one_number',
        kind: 'check',
        text: 'Pick one number with a unit and treat it as a threshold for {name}: measured before the first commit, not after.',
        when: (shape) => shape.has('q.constraints') && shape.matches('q.constraints', UNMEASURED_PATTERN),
      },
    ],
  },
  {
    section: 'Phase 4: Acceptance and verification',
    gapQuestion: 'q.proof',
    frames: [
      {
        id: 'phase4.assert_proof',
        kind: 'check',
        text: 'Assert {proof_sentence} in the gate suite; the check fails the build when it regresses.',
        when: (shape) => shape.has('q.proof'),
      },
      {
        id: 'phase4.remeasure',
        kind: 'check',
        text: 'Re-measure {item_label} on the finished build; a threshold that moved gets a note.',
        when: (shape) => shape.has('q.constraints') && !shape.matches('q.constraints', UNMEASURED_PATTERN),
        each: 'constraint_entries',
      },
      {
        id: 'phase4.sampled_runs',
        kind: 'check',
        text: 'Sample repeated runs and compare them against {proof_sentence}; record the mean and the spread.',
        when: (shape) => shape.has('q.proof'),
      },
    ],
  },
  {
    section: 'Phase 5: Hardening and ship',
    gapQuestion: 'q.risk',
    frames: [
      {
        id: 'phase5.risk_first',
        kind: 'check',
        text: 'Write a spec for the riskiest seam first: {risk_sentence}; the fixture reproduces the failure.',
        when: (shape) => shape.has('q.risk'),
      },
      {
        id: 'phase5.deploy',
        kind: 'check',
        text: 'Deploy with {deploy_item}; a clean machine can serve the build from configuration alone.',
        when: (shape) => shape.matches('q.stack', DEPLOY_STACK_PATTERN),
      },
      {
        id: 'phase5.run_instructions',
        kind: 'check',
        text: 'Write the run instructions for {name} in the README; a fresh clone starts in one command.',
        when: (shape) => shape.has('q.stack'),
      },
    ],
  },
  {
    section: 'Definition of Done',
    gapQuestion: 'q.proof',
    frames: [
      {
        id: 'done.gate_green',
        kind: 'check',
        text: 'All gate tests pass on a clean checkout of {name}: `npm run typecheck`, `npm test` and `npm run build` are green.',
        when: (shape) => shape.has('q.idea'),
      },
      {
        id: 'done.proof_holds',
        kind: 'check',
        text: '{proof_sentence} holds on the finished build, recorded with the date it was measured.',
        when: (shape) => shape.has('q.proof'),
      },
      {
        id: 'done.thresholds_recorded',
        kind: 'check',
        text: 'Every threshold named in this spec is measured for {name} and written next to the build notes.',
        when: (shape) => shape.has('q.constraints'),
      },
      {
        id: 'done.boundary_held',
        kind: 'check',
        text: 'Nothing from the out of scope list was built: {scope_out_inline}',
        when: (shape) => shape.has('q.scope_out'),
      },
    ],
  },
];
