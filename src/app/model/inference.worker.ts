/**
 * The worker that would run the model off the main thread.
 *
 * `@mlc-ai/web-llm` is not a dependency of this project, so this file guards its own import:
 * the module is resolved at run time and, when it is absent, the worker answers with a
 * sentence rather than a stack trace. A build that installs the library gets the real
 * handler without touching this file.
 *
 * It exists as a file rather than as a plan because the protocol around it is what keeps the
 * main thread free: `DeltaCoalescer` on the other side flushes every 60 ms, so a paragraph
 * costs about sixteen paints instead of one per token.
 */

import { FromWorker, ToWorker } from './worker-protocol';

/** The slice of the library this worker uses. Declared so no `any` and no hard dependency. */
interface MlcHandler {
  onmessage(event: MessageEvent): void;
}

interface WebLlmModule {
  readonly WebWorkerMLCEngineHandler: new () => MlcHandler;
}

/** The package name, held in a variable so the bundler leaves the import alone. */
const RUNTIME_PACKAGE = '@mlc-ai/web-llm';

/** The message a runtime-less build answers with. */
export const RUNTIME_MISSING =
  'The WebLLM runtime is not installed in this build, so the model cannot run here. The template path is unaffected.';

type Scope = {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage(message: FromWorker): void;
};

const scope = self as unknown as Scope;

let handler: MlcHandler | null = null;
let currentRun: string | null = null;

function reply(message: FromWorker): void {
  scope.postMessage(message);
}

async function loadHandler(): Promise<MlcHandler | null> {
  if (handler) {
    return handler;
  }

  try {
    // A variable and not a literal: a literal would make the bundler try to resolve a
    // package that is deliberately not installed, and the build would fail for a path
    // nobody without the library can use anyway.
    const module = (await import(/* @vite-ignore */ RUNTIME_PACKAGE)) as unknown as WebLlmModule;

    handler = new module.WebWorkerMLCEngineHandler();

    return handler;
  } catch {
    return null;
  }
}

scope.onmessage = (event: MessageEvent): void => {
  const message = event.data as ToWorker;

  void (async () => {
    const loaded = await loadHandler();

    if (!loaded) {
      if (message.type === 'generate') {
        currentRun = message.runId;
        reply({ type: 'error', runId: message.runId, message: RUNTIME_MISSING });
      }

      return;
    }

    if (message.type === 'generate') {
      currentRun = message.runId;
    }

    if (message.type === 'interrupt' && currentRun !== null) {
      reply({ type: 'done', runId: currentRun });
      currentRun = null;

      return;
    }

    loaded.onmessage(event);
  })();
};
