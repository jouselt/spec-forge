import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExportGateComponent } from './export-gate.component';
import { DocumentStore } from '../../state/document-store.service';
import { SettingsStore } from '../../state/settings.service';
import { GeneratedDoc } from '../../core/question-graph';
import { assemble } from '../../templates/assembly';
import { completeAnswers } from '../../templates/fixtures/answer-sets';
import { MARKDOWN_TYPE, downloadMarkdown, filenameFor } from '../../core/download';
import { UNREVIEWED_INFERRED_MARKER } from '../../templates/assembly';

describe('ExportGateComponent', () => {
  let fixture: ComponentFixture<ExportGateComponent>;
  let component: ExportGateComponent;
  let store: DocumentStore;
  let settings: SettingsStore;

  function docs(): GeneratedDoc[] {
    return assemble(completeAnswers());
  }

  function withInferred(source: GeneratedDoc[]): GeneratedDoc[] {
    return source.map((doc) =>
      doc.file === 'design'
        ? {
            ...doc,
            blocks: [
              ...doc.blocks,
              {
                id: 'design:architecture:inferred',
                file: 'design' as const,
                section: 'Architecture',
                ord: 9,
                text: 'A shaped sentence with no answer behind it.',
                origin: {
                  kind: 'model' as const,
                  modelId: 'Qwen2.5-0.5B',
                  basedOn: ['q.idea'],
                  temperature: 0.2,
                },
                review: 'unreviewed' as const,
                locked: false,
              },
            ],
          }
        : doc,
    );
  }

  function rows(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.report-row') as NodeListOf<HTMLElement>);
  }

  function buttons(): HTMLButtonElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.download-button') as NodeListOf<HTMLButtonElement>,
    );
  }

  function verdict(): string {
    return (fixture.nativeElement.querySelector('.gate-verdict') as HTMLElement).textContent?.trim() ?? '';
  }

  function toggle(): HTMLInputElement {
    return fixture.nativeElement.querySelector('.warn-toggle') as HTMLInputElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ExportGateComponent] }).compileComponents();

    store = TestBed.inject(DocumentStore);
    settings = TestBed.inject(SettingsStore);
    store.setDocs(docs());

    fixture = TestBed.createComponent(ExportGateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should show one report row per file with its counts', () => {
    expect(rows().map((row) => row.getAttribute('data-file'))).toEqual([
      'proposal',
      'design',
      'tasks',
    ]);
    expect(rows()[0].querySelector('.report-blocks')?.textContent?.trim()).toBe(
      String(store.blocksFor('proposal').length),
    );
  });

  it('should leave the download live on a run with nothing blocking', () => {
    expect(buttons().length).toBe(3);
    expect(buttons().every((button) => button.disabled)).toBe(false);
    expect(verdict()).toBe('Nothing is blocking the export.');
  });

  it('should disable every download when an inference is unreviewed, and name the count', () => {
    store.setDocs(withInferred(docs()));
    fixture.detectChanges();

    expect(buttons().every((button) => button.disabled)).toBe(true);
    expect(verdict()).toBe('1 inferred block needs your review. Export stays locked until then.');
    expect(buttons()[0].getAttribute('title')).toBe(
      '1 inferred block needs your review. Export stays locked until then.',
    );
  });

  it('should list the blocks that are blocking, with their file', () => {
    store.setDocs(withInferred(docs()));
    fixture.detectChanges();

    const rowsFound = Array.from(
      fixture.nativeElement.querySelectorAll('.blocking-row') as NodeListOf<HTMLElement>,
    );

    expect(rowsFound.map((row) => row.getAttribute('data-file'))).toEqual(['design']);
    expect(rowsFound[0].getAttribute('data-kind')).toBe('unreviewed-inferred');
  });

  it('should start with the warn setting off', () => {
    expect(settings.warnInsteadOfBlock()).toBe(false);
    expect(toggle().checked).toBe(false);
  });

  it('should export anyway when the warn setting is turned on', () => {
    store.setDocs(withInferred(docs()));
    fixture.detectChanges();

    toggle().click();
    fixture.detectChanges();

    expect(settings.warnInsteadOfBlock()).toBe(true);
    expect(component.result().canExport).toBe(true);
    expect(buttons().every((button) => button.disabled)).toBe(false);
    expect(verdict()).toBe('1 problem left, exported anyway because the warning setting is on.');
    expect(fixture.nativeElement.querySelectorAll('.blocking-row').length).toBe(1);
  });

  it('should mark unreviewed inferred text in the text it hands over', () => {
    store.setDocs(withInferred(docs()));
    fixture.detectChanges();

    toggle().click();
    fixture.detectChanges();

    const created: Blob[] = [];
    spyOn(URL, 'createObjectURL').and.callFake((blob: Blob | MediaSource) => {
      created.push(blob as Blob);
      return 'blob:test';
    });
    spyOn(URL, 'revokeObjectURL');

    component.download('design');

    expect(created.length).toBe(1);
    expect(created[0].type).toBe(MARKDOWN_TYPE);

    const reader = new FileReader();
    const text = new Promise<string>((resolve) => {
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(created[0]);
    });

    return text.then((content) => {
      expect(content).toContain(UNREVIEWED_INFERRED_MARKER);
      expect(content).toContain('A shaped sentence with no answer behind it.');
    });
  });

  it('should not hand anything over while the export is blocked', () => {
    store.setDocs(withInferred(docs()));
    fixture.detectChanges();

    const spy = spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
    spyOn(URL, 'revokeObjectURL');

    component.download('design');

    expect(spy).not.toHaveBeenCalled();
    expect(component.lastDownload()).toBeNull();
  });

  it('should show the warnings without disabling anything', () => {
    expect(fixture.nativeElement.querySelectorAll('.warning-row').length).toBeGreaterThan(0);
    expect(buttons().every((button) => button.disabled)).toBe(false);
  });

  it('should disable every export button while the export is blocked', () => {
    store.setDocs(withInferred(docs()));
    fixture.detectChanges();

    for (const selector of ['.download-bundle', '.download-zip', '.copy-bundle']) {
      const button = fixture.nativeElement.querySelector(selector) as HTMLButtonElement;

      expect(button).withContext(selector).not.toBeNull();
      expect(button.disabled).withContext(selector).toBe(true);
      expect(button.getAttribute('title')).withContext(selector).toBe(component.verdict());
    }
  });

  it('should leave the three export buttons live on a run with nothing blocking', () => {
    store.generate(completeAnswers());
    fixture.detectChanges();

    expect(component.result().canExport).toBe(true);

    for (const selector of ['.download-bundle', '.download-zip', '.copy-bundle']) {
      expect((fixture.nativeElement.querySelector(selector) as HTMLButtonElement).disabled)
        .withContext(selector)
        .toBe(false);
    }
  });

  it('should save the bundle and the zip under their own names', async () => {
    store.generate(completeAnswers());
    fixture.detectChanges();
    spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
    spyOn(URL, 'revokeObjectURL');

    (fixture.nativeElement.querySelector('.download-bundle') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.exportNote()).toBe('Saved spec-bundle.md.');

    await component.downloadZip();
    fixture.detectChanges();

    expect(component.exportNote()).toBe('Saved spec-bundle.zip.');
    expect(component.exportFailed()).toBe(false);
  });

  it('should report a clipboard failure instead of pretending to copy', async () => {
    store.generate(completeAnswers());
    fixture.detectChanges();
    spyOn(navigator.clipboard, 'writeText').and.rejectWith(new Error('Document is not focused.'));

    await component.copyBundle();
    fixture.detectChanges();

    expect(component.exportFailed()).toBe(true);
    expect(component.exportNote()).toContain('Document is not focused.');
    expect(fixture.nativeElement.querySelector('.export-note.is-error')).not.toBeNull();
  });

  it('should say how much was copied', async () => {
    store.generate(completeAnswers());
    fixture.detectChanges();
    spyOn(navigator.clipboard, 'writeText').and.resolveTo();

    await component.copyBundle();
    fixture.detectChanges();

    expect(component.exportFailed()).toBe(false);
    expect(component.exportNote()).toMatch(/^Copied \d+ characters to the clipboard\.$/);
  });

});

describe('download', () => {
  it('should name each file after its own kind', () => {
    expect(filenameFor('proposal')).toBe('proposal.md');
    expect(filenameFor('design')).toBe('design.md');
    expect(filenameFor('tasks')).toBe('tasks.md');
  });

  it('should build a markdown blob and hand it to the browser', () => {
    const created: Blob[] = [];
    spyOn(URL, 'createObjectURL').and.callFake((blob: Blob | MediaSource) => {
      created.push(blob as Blob);
      return 'blob:test';
    });
    spyOn(URL, 'revokeObjectURL');

    const name = downloadMarkdown('tasks', '# Tasks\n');

    expect(name).toBe('tasks.md');
    expect(created.length).toBe(1);
    expect(created[0].type).toBe(MARKDOWN_TYPE);
    expect(created[0].size).toBe('# Tasks\n'.length);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});
