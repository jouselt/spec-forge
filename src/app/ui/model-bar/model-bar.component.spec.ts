import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModelBarComponent } from './model-bar.component';
import { ModelService } from '../../state/model.service';
import { CapabilityService } from '../../model/capability.service';
import { DEFAULT_MODEL_ID, RECOMMENDED_MODEL_ID } from '../../model/models';
import { TemplateShaper } from '../../model/shaper';
import { completeAnswers } from '../../templates/fixtures/answer-sets';
import { renderMarkdown } from '../../templates/assembly';

describe('ModelBarComponent', () => {
  let fixture: ComponentFixture<ModelBarComponent>;
  let service: ModelService;

  function modeSelect(): HTMLSelectElement {
    return fixture.nativeElement.querySelector('.mode-select') as HTMLSelectElement;
  }

  function modelSelect(): HTMLSelectElement | null {
    return fixture.nativeElement.querySelector('.model-select') as HTMLSelectElement | null;
  }

  function pick(select: HTMLSelectElement, value: string): void {
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ModelBarComponent] }).compileComponents();

    service = TestBed.inject(ModelService);
    service.setMode('off');
    service.selectModel(DEFAULT_MODEL_ID);
    TestBed.inject(CapabilityService).capabilities();

    fixture = TestBed.createComponent(ModelBarComponent);
    fixture.detectChanges();
  });

  it('should start off', () => {
    expect(service.mode()).toBe('off');
    expect(modeSelect().value).toBe('off');
    expect(modelSelect()).toBeNull();
  });

  it('should say no model is used while it is off', () => {
    expect(fixture.nativeElement.querySelector('.quiet')?.textContent).toContain(
      'template path writes all three files',
    );
  });

  it('should hide the picker on template only and say nothing is downloaded', () => {
    pick(modeSelect(), 'template');

    expect(service.mode()).toBe('template');
    expect(modelSelect()).toBeNull();
    expect(fixture.nativeElement.querySelector('.quiet')?.textContent).toContain(
      'Nothing is downloaded',
    );
  });

  it('should show every model with its cost when shaping is on', () => {
    pick(modeSelect(), 'shape');

    const select = modelSelect();

    expect(select).not.toBeNull();
    expect(select!.options.length).toBe(service.models().length);
    expect(select!.options[0].textContent).toContain('879 MB');
  });

  it('should mark the default and the recommended one next to the name', () => {
    pick(modeSelect(), 'shape');

    const options = Array.from(modelSelect()!.options).map((option) => option.textContent ?? '');

    expect(options.some((text) => text.includes('(default)') && text.includes('879 MB'))).toBe(true);
    expect(
      options.some((text) => text.includes('(recommended)') && text.includes('3.4 GB')),
    ).toBe(true);
  });

  it('should show the context window and the download for the selected model', () => {
    pick(modeSelect(), 'shape');

    expect(fixture.nativeElement.querySelector('.context')?.textContent).toContain('4096 context');
  });

  it('should switch the selection without loading anything', () => {
    pick(modeSelect(), 'shape');
    pick(modelSelect()!, RECOMMENDED_MODEL_ID);

    expect(service.selectedId()).toBe(RECOMMENDED_MODEL_ID);
    expect(service.selectedModel()?.id).toBe(RECOMMENDED_MODEL_ID);
  });

  it('should show the WASM banner when WebGPU is missing', async () => {
    await TestBed.inject(CapabilityService).detect({});
    pick(modeSelect(), 'shape');

    expect(fixture.nativeElement.querySelector('.wasm-banner')?.textContent).toContain('5 to 20x');
  });

  it('should fall back to the template with the reason when the runtime is missing', async () => {
    service.setMode('shape');

    const result = await service.shape(completeAnswers());

    expect(result.path).toBe('template');
    expect(service.note()).toContain('not bundled in this build');
    expect(result.docs.map((doc) => renderMarkdown(doc))).toEqual(
      (await new TemplateShaper().shape(completeAnswers())).docs.map((doc) => renderMarkdown(doc)),
    );
  });

  it('should show that reason in the panel', async () => {
    service.setMode('shape');
    await service.shape(completeAnswers());
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.note')?.textContent).toContain(
      'not bundled in this build',
    );
  });

  it('should shape with an injected fake engine and accept a cited run', async () => {
    service.setMode('shape');

    const cited = Array.from({ length: 10 }, () => 'A cited fact. [[answer:1]]').join(' ');
    const loader = async () => ({
      engine: {
        chat: {
          completions: {
            create: async () => {
              async function* chunks() {
                yield { choices: [{ delta: { content: cited } }] };
              }

              return chunks();
            },
          },
          interruptGenerate: () => undefined,
        },
        unload: async () => undefined,
      },
    });

    const result = await service.shape(completeAnswers(), loader);

    expect(result.path).toBe('shaped');
    expect(result.docs[0].blocks[0].origin.kind).toBe('answer');
    expect(service.note()).toBeNull();
  });
});
