import { fakeAsync, tick } from '@angular/core/testing';
import { Autosaver, AUTOSAVE_DELAY_MS, DraftPayload } from './autosave';

function payload(step: number, text = 'an answer'): DraftPayload {
  return {
    id: 'draft-1',
    step,
    answers: [
      {
        id: `q.${step}`,
        questionId: `q.${step}`,
        text,
        kind: 'text',
        askedAt: 1,
        source: 'base',
      },
    ],
    traces: [],
    updatedAt: 1000 + step,
  };
}

describe('Autosaver', () => {
  let written: DraftPayload[];
  let saver: Autosaver;

  beforeEach(() => {
    written = [];
    saver = new Autosaver({
      write: (next) => {
        written.push(next);
      },
    });
  });

  it('should wait before writing', fakeAsync(() => {
    saver.schedule(payload(1));

    expect(written.length).toBe(0);

    tick(AUTOSAVE_DELAY_MS);

    expect(written.length).toBe(1);
  }));

  it('should turn twenty rapid edits into one write', fakeAsync(() => {
    for (let index = 0; index < 20; index += 1) {
      saver.schedule(payload(index % 3));
    }

    expect(written.length).toBe(0);

    tick(AUTOSAVE_DELAY_MS);

    expect(written.length).toBe(1);
    expect(saver.stats()).toEqual({ scheduled: 20, written: 1 });
  }));

  it('should write the last payload, not the first', fakeAsync(() => {
    saver.schedule(payload(1, 'first'));
    saver.schedule(payload(2, 'last'));

    tick(AUTOSAVE_DELAY_MS);

    expect(written[0].step).toBe(2);
    expect(written[0].answers[0].text).toBe('last');
  }));

  it('should write at once on a flush and cancel the timer', fakeAsync(() => {
    saver.schedule(payload(7));

    saver.flush();

    expect(written.length).toBe(1);
    expect(written[0].step).toBe(7);

    tick(AUTOSAVE_DELAY_MS);

    // The timer was cancelled, so the flush is not followed by a second write.
    expect(written.length).toBe(1);
  }));

  it('should do nothing on a flush with nothing queued', fakeAsync(() => {
    saver.flush();

    expect(written.length).toBe(0);
    expect(saver.hasPending()).toBe(false);
  }));

  it('should write again on the next edit after a flush', fakeAsync(() => {
    saver.schedule(payload(1));
    saver.flush();
    saver.schedule(payload(2));
    tick(AUTOSAVE_DELAY_MS);

    expect(written.map((entry) => entry.step)).toEqual([1, 2]);
  }));

  it('should drop a queued payload on cancel', fakeAsync(() => {
    saver.schedule(payload(3));
    saver.cancel();

    tick(AUTOSAVE_DELAY_MS);

    expect(written.length).toBe(0);
    expect(saver.hasPending()).toBe(false);
  }));

  it('should report what is pending', fakeAsync(() => {
    expect(saver.hasPending()).toBe(false);

    saver.schedule(payload(1));

    expect(saver.hasPending()).toBe(true);

    tick(AUTOSAVE_DELAY_MS);

    expect(saver.hasPending()).toBe(false);
  }));
});
