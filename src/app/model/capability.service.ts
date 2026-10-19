/**
 * What the browser can do, decided once at startup.
 *
 * The only question that matters is whether WebGPU exists, because everything else about
 * the model path follows from it: with WebGPU the model runs at a usable speed, without it
 * the WASM fallback is 5 to 20 times slower, and on a machine with neither the template path
 * is still perfect. That is the point of the whole design, and this service is where it
 * becomes a sentence a person reads instead of a spinner that never stops.
 */

import { Injectable, computed, signal } from '@angular/core';
import { Capabilities, wasmBanner } from './model-provider';

/** The shape of `navigator.gpu` this reads, declared here so no `any` is needed. */
interface GpuAdapter {
  readonly info?: { readonly vendor?: string; readonly architecture?: string };
  readonly limits?: { readonly maxBufferSize?: number };
}

interface GpuLike {
  requestAdapter(): Promise<GpuAdapter | null>;
}

function gpuOf(navigatorLike: { gpu?: GpuLike } | undefined): GpuLike | undefined {
  return navigatorLike?.gpu;
}

@Injectable({ providedIn: 'root' })
export class CapabilityService {
  private readonly state = signal<Capabilities>({ webgpu: false });
  private readonly detected = signal(false);

  readonly capabilities = this.state.asReadonly();
  readonly hasWebGpu = computed(() => this.state().webgpu);
  readonly hasDetected = this.detected.asReadonly();

  /** The banner text, or null when there is nothing to warn about. */
  readonly banner = computed(() => wasmBanner(this.state()));

  /** Ask the browser. Absent `navigator.gpu` is a normal answer, not an error. */
  async detect(navigatorLike: { gpu?: GpuLike } | undefined = typeof navigator === 'undefined'
    ? undefined
    : (navigator as unknown as { gpu?: GpuLike })): Promise<Capabilities> {
    const gpu = gpuOf(navigatorLike);

    if (!gpu) {
      const capabilities: Capabilities = { webgpu: false };

      this.state.set(capabilities);
      this.detected.set(true);

      return capabilities;
    }

    try {
      const adapter = await gpu.requestAdapter();

      if (!adapter) {
        const capabilities: Capabilities = { webgpu: false };

        this.state.set(capabilities);
        this.detected.set(true);

        return capabilities;
      }

      const vendor = adapter.info?.vendor ?? 'an unnamed adapter';
      const architecture = adapter.info?.architecture;
      const capabilities: Capabilities = {
        webgpu: true,
        adapterInfo: architecture ? `${vendor} ${architecture}` : vendor,
        maxBufferSize: adapter.limits?.maxBufferSize,
      };

      this.state.set(capabilities);
      this.detected.set(true);

      return capabilities;
    } catch {
      // A rejected adapter request is the same answer as no adapter: shape with the
      // template, or wait for a browser that supports it.
      const capabilities: Capabilities = { webgpu: false };

      this.state.set(capabilities);
      this.detected.set(true);

      return capabilities;
    }
  }
}
