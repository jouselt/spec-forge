/**
 * Frames for `proposal.md`: two to four per section, chosen by the shape of the
 * answers, never by a model.
 *
 * The prose frames carry the user's own words verbatim. A frame adds the sentence
 * that says where the words came from and what they mean here; it does not
 * paraphrase, summarize or invent. When an answer is missing the frame does not
 * fire and the section becomes a gap.
 */

import {
  ALTERNATIVE_PATTERN,
  MEASURABLE_PATTERN,
  MODEL_STACK_PATTERN,
  NON_GOAL_PATTERN,
  TemplateSection,
  UNMEASURED_PATTERN,
} from './frame';

export const PROPOSAL_TEMPLATE: readonly TemplateSection[] = [
  {
    section: 'Problem',
    gapQuestion: 'q.problem',
    frames: [
      {
        id: 'problem.with_workaround',
        kind: 'prose',
        text: '{problem}\n\nToday, people work around it like this. {workaround}',
        when: (shape) => shape.has('q.problem') && shape.has('q.workaround'),
      },
      {
        id: 'problem.alone',
        kind: 'prose',
        text: '{problem}',
        when: (shape) => shape.has('q.problem'),
      },
      {
        id: 'problem.workaround_only',
        kind: 'prose',
        text: 'The problem statement is a gap. The workaround being replaced reads: {workaround}',
        when: (shape) => shape.has('q.workaround'),
      },
    ],
  },
  {
    section: 'Goal',
    gapQuestion: 'q.goal',
    frames: [
      {
        id: 'goal.measured',
        kind: 'prose',
        text: '{idea}\n\n{goal}\n\nThe proof is named up front: {proof}',
        when: (shape) => shape.has('q.idea') && shape.has('q.goal') && shape.has('q.proof'),
      },
      {
        id: 'goal.unmeasured',
        kind: 'prose',
        text: '{idea}\n\n{goal}',
        when: (shape) => shape.has('q.idea') && shape.has('q.goal'),
      },
      {
        id: 'goal.without_goal',
        kind: 'prose',
        text: '{idea}',
        when: (shape) => shape.has('q.idea'),
      },
    ],
  },
  {
    section: 'Target Signal',
    gapQuestion: 'q.proof',
    frames: [
      {
        id: 'signal.with_constraints',
        kind: 'prose',
        // The section name says signal, not audience: this is a spec for a
        // project, and nothing here is written for a reader outside the work.
        text: 'What the finished {name} signals: {proof}\n\nThe measured constraints are the numbers to beat.',
        when: (shape) => shape.has('q.proof') && shape.has('q.constraints'),
      },
      {
        id: 'signal.measured',
        kind: 'prose',
        text: 'What the finished {name} signals: {proof}\n\nThat number is the release gate, not a closing paragraph.',
        when: (shape) => shape.has('q.proof') && shape.matches('q.proof', MEASURABLE_PATTERN),
      },
      {
        id: 'signal.observable',
        kind: 'prose',
        text: 'What the finished {name} signals: {proof}\n\nThe run repeats, so the observation can be checked again.',
        when: (shape) => shape.has('q.proof'),
      },
    ],
  },
  {
    section: 'Constraints Measured Up Front',
    gapQuestion: 'q.constraints',
    frames: [
      {
        id: 'constraints.table',
        kind: 'prose',
        text: '| Constraint | Value |\n| --- | --- |\n{constraint_rows}',
        when: (shape) => shape.has('q.constraints') && !shape.matches('q.constraints', UNMEASURED_PATTERN),
      },
      {
        id: 'constraints.unmeasured',
        kind: 'prose',
        text: 'The constraints answer reads: {constraints}\n\nNo constraint is measurable yet. The first task is to pick one number with a unit and write down where it came from.',
        when: (shape) => shape.has('q.constraints') && shape.matches('q.constraints', UNMEASURED_PATTERN),
      },
    ],
  },
  {
    section: 'Tech Stack',
    gapQuestion: 'q.stack',
    frames: [
      {
        id: 'stack.with_provider',
        kind: 'prose',
        text: '{stack_list}\n\nInference is a dependency like any other: it sits behind one seam, so the choice stays replaceable.',
        when: (shape) => shape.has('q.stack') && shape.matches('q.stack', MODEL_STACK_PATTERN),
      },
      {
        id: 'stack.list',
        kind: 'prose',
        text: '{stack_list}',
        when: (shape) => shape.count('q.stack') > 1,
      },
      {
        id: 'stack.single',
        kind: 'prose',
        text: 'The stack answer names one choice so far: {stack_first}\n\nEverything else is still open.',
        when: (shape) => shape.has('q.stack'),
      },
    ],
  },
  {
    section: 'Core Features',
    gapQuestion: 'q.idea',
    frames: [
      {
        id: 'features.idea',
        kind: 'bullet',
        text: 'The thing itself: {idea}',
        when: (shape) => shape.has('q.idea'),
      },
      {
        id: 'features.goal',
        kind: 'bullet',
        text: 'What it is for: {goal}',
        when: (shape) => shape.has('q.goal'),
      },
    ],
  },
  {
    section: 'Scope Boundary',
    gapQuestion: 'q.scope_out',
    frames: [
      {
        id: 'scope.list',
        kind: 'prose',
        text: 'Out of scope, in the words of the answer:\n\n{scope_out_list}',
        when: (shape) => shape.has('q.scope_out'),
      },
      {
        id: 'scope.non_goals',
        kind: 'prose',
        text: 'The goal answer states what this will not do: {non_goals}',
        when: (shape) => shape.has('q.goal') && shape.matches('q.goal', NON_GOAL_PATTERN),
      },
      {
        id: 'scope.from_goal',
        kind: 'prose',
        text: '{goal}',
        when: (shape) => shape.has('q.goal'),
      },
    ],
  },
  {
    section: 'Timeline',
    gapQuestion: 'q.risk',
    frames: [
      {
        id: 'timeline.sequence_named',
        kind: 'prose',
        // The interview collects no dates. Saying so is cheaper than inventing
        // weeks, and the order it can report is the one the risk answer gives.
        text: 'No dates are set in this spec. The order comes from the risk answer, which names what to build first: {alt_build}\n\nRisk stated: {risk}',
        when: (shape) => shape.has('q.risk') && shape.matches('q.risk', ALTERNATIVE_PATTERN),
      },
      {
        id: 'timeline.sequence_from_risk',
        kind: 'prose',
        text: 'No dates are set in this spec. Sequence the work so the biggest risk is faced first, and ship the smallest slice that retires it.\n\nRisk stated: {risk}',
        when: (shape) => shape.has('q.risk'),
      },
    ],
  },
  {
    section: 'Acceptance Criteria',
    gapQuestion: 'q.proof',
    frames: [
      {
        id: 'criteria.proof',
        kind: 'check',
        text: '{proof}',
        when: (shape) => shape.has('q.proof'),
      },
      {
        id: 'criteria.constraint',
        kind: 'check',
        text: '{item_label}: {item_value}',
        when: (shape) => shape.has('q.constraints') && !shape.matches('q.constraints', UNMEASURED_PATTERN),
        each: 'constraint_entries',
      },
      {
        id: 'criteria.hardware',
        kind: 'check',
        text: '{item_label}: {item_value}',
        when: (shape) => shape.has('a.ctx_window') || shape.has('a.vram_gb') || shape.has('a.wasm_fallback'),
        each: 'hardware_entries',
      },
    ],
  },
  {
    section: 'Risks',
    gapQuestion: 'q.risk',
    frames: [
      {
        id: 'risks.with_boundary',
        kind: 'prose',
        text: '**Risk.** {risk}\n\n**The boundary that keeps it small.** {scope_out_inline}',
        when: (shape) => shape.has('q.risk') && shape.has('q.scope_out'),
      },
      {
        id: 'risks.stated',
        kind: 'prose',
        text: '**Risk.** {risk}',
        when: (shape) => shape.has('q.risk'),
      },
    ],
  },
];
