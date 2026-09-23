/**
 * Frames for `design.md`: the architecture, the layout, the data model, and the
 * seams. Same rule as every template in this folder: the answer text is carried
 * verbatim and the frame says what it is doing there.
 */

import {
  MEASURABLE_PATTERN,
  MODEL_STACK_PATTERN,
  NON_GOAL_PATTERN,
  STORAGE_STACK_PATTERN,
  TemplateSection,
  UNMEASURED_PATTERN,
} from './frame';

export const DESIGN_TEMPLATE: readonly TemplateSection[] = [
  {
    section: 'Architecture',
    gapQuestion: 'q.idea',
    frames: [
      {
        id: 'architecture.with_stack',
        kind: 'prose',
        text: '{idea}\n\nThe pieces, from the stack answer:\n\n{stack_list}',
        when: (shape) => shape.has('q.idea') && shape.has('q.stack'),
      },
      {
        id: 'architecture.with_workaround',
        kind: 'prose',
        text: '{idea}\n\nIt replaces this: {workaround}',
        when: (shape) => shape.has('q.idea') && shape.has('q.workaround'),
      },
      {
        id: 'architecture.idea_only',
        kind: 'prose',
        text: '{idea}',
        when: (shape) => shape.has('q.idea'),
      },
    ],
  },
  {
    section: 'Package layout',
    gapQuestion: 'q.stack',
    frames: [
      {
        id: 'layout.with_boundary',
        kind: 'prose',
        text: '{stack_list}\n\nThe boundary keeps the layout small:\n\n{scope_out_list}',
        when: (shape) => shape.has('q.stack') && shape.has('q.scope_out'),
      },
      {
        id: 'layout.list',
        kind: 'prose',
        text: '{stack_list}',
        when: (shape) => shape.count('q.stack') > 1,
      },
      {
        id: 'layout.single',
        kind: 'prose',
        text: 'One choice so far, from the stack answer: {stack_first}',
        when: (shape) => shape.has('q.stack'),
      },
    ],
  },
  {
    section: 'Data model',
    gapQuestion: 'q.stack',
    frames: [
      {
        id: 'data.storage_measured',
        kind: 'prose',
        text: 'Storage: {storage}\n\nThe measured constraints are the sizing inputs, not guesses: {constraint_inline}',
        when: (shape) =>
          shape.matches('q.stack', STORAGE_STACK_PATTERN) && shape.has('q.constraints'),
      },
      {
        id: 'data.storage_plain',
        kind: 'prose',
        text: 'Storage: {storage}',
        when: (shape) => shape.matches('q.stack', STORAGE_STACK_PATTERN),
      },
      {
        id: 'data.constraints_only',
        kind: 'prose',
        text: 'The sizing inputs come from the constraints answer: {constraint_inline}',
        when: (shape) => shape.has('q.constraints'),
      },
    ],
  },
  {
    section: 'Provider seams',
    gapQuestion: 'q.stack',
    frames: [
      {
        id: 'seams.model',
        kind: 'prose',
        text: 'Inference is named in the stack answer: {provider}\n\nOne interface, one fake for tests, one place to swap providers.',
        when: (shape) => shape.matches('q.stack', MODEL_STACK_PATTERN),
      },
      {
        id: 'seams.services',
        kind: 'prose',
        text: 'Each external dependency gets one seam: {stack_inline}\n\nA seam is the only module that knows an address, a credential or a retry policy.',
        when: (shape) => shape.count('q.stack') > 2,
      },
      {
        id: 'seams.single',
        kind: 'prose',
        text: '{stack_first} is the only dependency named. Around it goes one module, so the rest of the code never reaches for it directly.',
        when: (shape) => shape.has('q.stack'),
      },
    ],
  },
  {
    section: 'Validation and Provenance',
    gapQuestion: 'q.proof',
    frames: [
      {
        id: 'validation.metric_and_constraints',
        kind: 'prose',
        text: 'The build is checked against: {proof}\n\nAnd against the measured constraints: {constraint_inline}',
        when: (shape) => shape.has('q.proof') && shape.has('q.constraints'),
      },
      {
        id: 'validation.metric',
        kind: 'prose',
        text: 'The build is checked against: {proof}',
        when: (shape) => shape.has('q.proof'),
      },
      {
        id: 'validation.constraints',
        kind: 'prose',
        text: 'The build is checked against the measured constraints: {constraint_inline}',
        when: (shape) => shape.has('q.constraints'),
      },
    ],
  },
  {
    section: 'Persistence',
    gapQuestion: 'q.stack',
    frames: [
      {
        id: 'persistence.storage_named',
        kind: 'prose',
        text: 'What has to survive a restart is written to {storage}. Nothing else is persisted.',
        when: (shape) => shape.matches('q.stack', STORAGE_STACK_PATTERN),
      },
      {
        id: 'persistence.stack_present',
        kind: 'prose',
        text: 'The stack answer does not name a datastore: {stack_inline}\n\nDecide what has to survive a restart before the first storage call is written.',
        when: (shape) => shape.has('q.stack'),
      },
    ],
  },
  {
    section: 'Capability handling',
    gapQuestion: 'a.vram_gb',
    frames: [
      {
        id: 'capability.hardware_measured',
        kind: 'prose',
        text: 'The numbers this has to fit:\n\n| Constraint | Value |\n| --- | --- |\n{hardware_rows}\n\nA device that cannot meet them takes the fallback path, stated here, not discovered at runtime.',
        when: (shape) => shape.has('a.ctx_window') || shape.has('a.vram_gb'),
      },
      {
        id: 'capability.fallback_named',
        kind: 'prose',
        text: 'Fallback answer: {a.wasm_fallback}\n\nThe fallback is a path with its own tests, not an error page.',
        when: (shape) => shape.has('a.wasm_fallback'),
      },
      {
        id: 'capability.open',
        kind: 'prose',
        text: 'The capability numbers are a gap. Measure them for {name} before the first model call is written.',
        when: (shape) =>
          shape.has('a.ctx_window') ||
          shape.has('a.vram_gb') ||
          shape.has('a.wasm_fallback') ||
          shape.has('a.model_size') ||
          shape.has('a.gpu_requirement'),
      },
    ],
  },
  {
    section: 'Trade-offs Considered',
    gapQuestion: 'q.scope_out',
    frames: [
      {
        id: 'tradeoffs.boundary_and_risk',
        kind: 'prose',
        text: 'Left out on purpose:\n\n{scope_out_list}\n\nThe bet that buys the time: {risk}',
        when: (shape) => shape.has('q.scope_out') && shape.has('q.risk'),
      },
      {
        id: 'tradeoffs.boundary',
        kind: 'prose',
        text: 'Left out on purpose:\n\n{scope_out_list}',
        when: (shape) => shape.has('q.scope_out'),
      },
      {
        id: 'tradeoffs.risk',
        kind: 'prose',
        text: 'The bet being made: {risk}',
        when: (shape) => shape.has('q.risk'),
      },
    ],
  },
  {
    section: 'What This Proves',
    gapQuestion: 'q.proof',
    frames: [
      {
        id: 'proves.metric',
        kind: 'prose',
        text: '{proof}\n\nEverything else in this document exists to make that reachable.',
        when: (shape) => shape.has('q.proof') && shape.matches('q.proof', MEASURABLE_PATTERN),
      },
      {
        id: 'proves.metric_without_number',
        kind: 'prose',
        text: '{proof}\n\nEverything else in this document exists to make that observable.',
        when: (shape) => shape.has('q.proof'),
      },
      {
        id: 'proves.goal',
        kind: 'prose',
        text: '{goal}',
        when: (shape) => shape.has('q.goal') && shape.matches('q.goal', NON_GOAL_PATTERN),
      },
      {
        id: 'proves.idea',
        kind: 'prose',
        text: '{idea}',
        when: (shape) => shape.has('q.idea'),
      },
    ],
  },
  {
    section: 'Acceptance criteria (design-verifiable)',
    gapQuestion: 'q.proof',
    frames: [
      {
        id: 'design-criteria.proof',
        kind: 'check',
        text: '{proof}',
        when: (shape) => shape.has('q.proof'),
      },
      {
        id: 'design-criteria.constraint',
        kind: 'check',
        text: '{item_label}: {item_value}',
        when: (shape) => shape.has('q.constraints') && !shape.matches('q.constraints', UNMEASURED_PATTERN),
        each: 'constraint_entries',
      },
      {
        id: 'design-criteria.hardware',
        kind: 'check',
        text: '{item_label}: {item_value}',
        when: (shape) =>
          shape.has('a.ctx_window') || shape.has('a.vram_gb') || shape.has('a.wasm_fallback'),
        each: 'hardware_entries',
      },
    ],
  },
  {
    section: 'Open Questions',
    gapQuestion: 'q.risk',
    frames: [
      {
        id: 'open.risk',
        kind: 'prose',
        text: 'The biggest unknown, in the words of the answer: {risk}',
        when: (shape) => shape.has('q.risk'),
      },
      {
        id: 'open.boundary',
        kind: 'prose',
        text: 'Anything that turns out to be undecided later lands against the boundary already written down:\n\n{scope_out_list}',
        when: (shape) => shape.has('q.scope_out'),
      },
    ],
  },
];
