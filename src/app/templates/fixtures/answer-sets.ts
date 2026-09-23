/**
 * Answer sets used by the template tests and by the readability eval.
 *
 * The five readability sets are grounded in five of the eleven sibling specs in
 * `portfolio-projects`, with the prose cut down to answer length. They are inputs,
 * not outputs: nothing here is generated text.
 *
 * `askedAt` is 0 on every answer so a fixture never carries a clock into a
 * comparison.
 */

import { Answer } from '../../core/question-graph';
import { questionById } from '../../core/mapping';

export interface AnswerSetFixture {
  readonly id: string;
  readonly label: string;
  /** The sibling spec this set is modelled on. */
  readonly basedOn: string;
  readonly answers: Answer[];
}

/** Build one answer, taking its kind and source from the question graph. */
export function answer(questionId: string, text: string, askedAt = 0): Answer {
  const question = questionById(questionId);

  return {
    id: questionId,
    questionId,
    text,
    kind: question?.kind ?? 'text',
    askedAt,
    source: question?.adaptive ? 'adaptive' : 'base',
  };
}

/** Values for the adaptive questions, one per id in the trigger table. */
export const ADAPTIVE_VALUES: Readonly<Record<string, string>> = {
  'a.ctx_window': '4096',
  'a.vram_gb': '8',
  'a.wasm_fallback': 'Yes',
  'a.doc_count': '20 documents',
  'a.avg_doc_words': '900',
  'a.embedding_dim': '768',
  'a.vector_count': '18000',
  'a.p99_latency': '250',
  'a.throughput_qps': '50',
  'a.payment_processor': 'Stripe',
  'a.pci_compliance': 'No, the processor handles it',
  'a.currency_support': 'EUR and USD',
  'a.auth_method': 'OAuth2',
  'a.mfa_required': 'Yes',
  'a.model_size': '3B',
  'a.gpu_requirement': 'Optional, with a WASM fallback',
  'a.nix_lang': 'Self maintained',
  'a.flakes_usage': 'Yes',
  'a.angular_version': '20.3',
  'a.standalone_components': 'Standalone',
  'a.nestjs_version': '11',
  'a.http_framework': 'Fastify',
};

/** Every question in the graph, answered. The strongest path the templates can take. */
export function maximalAnswers(): Answer[] {
  return [
    ...completeAnswers().filter((entry) => entry.source === 'base'),
    ...Object.keys(ADAPTIVE_VALUES).map((id) => answer(id, ADAPTIVE_VALUES[id])),
  ];
}

/**
 * The nine base steps plus the three model follow-ups. A complete interview with
 * one adaptive branch open.
 */
export function completeAnswers(): Answer[] {
  return [
    answer(
      'q.idea',
      'A reading list that turns highlights into spaced repetition cards on the device. It keeps every book and every card in the browser and syncs ciphertext to a folder the reader owns.',
    ),
    answer(
      'q.problem',
      'Readers highlight a book and then never see the highlight again. The notes live in one app, the book lives in another, and the review habit dies in the gap between them.',
    ),
    answer(
      'q.workaround',
      'They keep a plain text file of quotes and reread it by hand, or they pay for a hosted service that reads every note to build a feed.',
    ),
    answer(
      'q.goal',
      'Turn a highlight into a card in one gesture and keep the whole library searchable with no network. Do not build a mobile app and do not add a social feed.',
    ),
    answer(
      'q.proof',
      'A card is created from a highlight in under 300 ms and 20 of 20 cards survive a reload, measured with performance.now() and a reload check.',
    ),
    answer(
      'q.constraints',
      'library size | 10,000 highlights\ncard creation | p95 under 300 ms\ncold start | under 2 s\nstorage | under 50 MB on disk',
    ),
    answer(
      'q.stack',
      'Angular 20 with signals\nTypeScript strict\nIndexedDB for local storage\nOllama with mistral-nemo for card suggestions\nWebLLM in a worker as the offline path\nCloudflare Pages for the static build',
    ),
    answer(
      'q.scope_out',
      'Mobile clients\nA social feed\nServer side search\nShared libraries',
    ),
    answer(
      'q.risk',
      'A local model may be too slow to suggest cards in the time a reader will wait. Build the card writer without a model first instead, and add suggestions behind a flag.',
    ),
    answer('a.ctx_window', '4096'),
    answer('a.vram_gb', '8'),
    answer('a.wasm_fallback', 'Yes, the WASM path is acceptable'),
  ];
}

export const READABILITY_FIXTURES: readonly AnswerSetFixture[] = [
  {
    id: 'f01-local-rag-api',
    label: 'Local retrieval API over a document folder',
    basedOn: '01-ai-digital-twin-portfolio',
    answers: [
      answer(
        'q.idea',
        'A local retrieval API that answers questions about a folder of markdown documents and cites the exact passage it used. One machine, no API key, no managed vector service.',
      ),
      answer(
        'q.problem',
        'Engineers keep the answer to a question in a document nobody can find. They reopen six files and grep by hand, and the answer they finally find has no citation attached.',
      ),
      answer(
        'q.workaround',
        'They grep the folder, or they paste whole documents into a chat window and trust the summary.',
      ),
      answer(
        'q.goal',
        'Return an answer with a resolvable citation on a warm model and publish the retrieval numbers next to the build. Do not build a web crawler and do not add user accounts.',
      ),
      answer(
        'q.proof',
        '24 of 24 questions in the golden set return a citation that resolves to a real chunk, counted by the eval script.',
      ),
      answer(
        'q.constraints',
        'corpus size | 20 documents\nquery latency | p95 under 2 s warm\nanswer quality | at least 4.0 of 5\nindex size | under 2 GB',
      ),
      answer(
        'q.stack',
        'TypeScript on Node.js 20\nNestJS 11 for the API\nPostgreSQL 16 with pgvector\nnomic-embed-text through Ollama for embeddings\nmistral-nemo through Ollama for generation\nNixOS module on the homelab behind Caddy',
      ),
      answer(
        'q.scope_out',
        'A web crawler\nUser accounts and billing\nCloud inference endpoints\nPDF ingestion',
      ),
      answer(
        'q.risk',
        'The judge model may score its own family generously. Build the citation resolver first instead, because a citation either resolves or it does not.',
      ),
      answer('a.ctx_window', '4096'),
      answer('a.vram_gb', '8'),
      answer('a.wasm_fallback', 'Yes, a WASM path is acceptable'),
    ],
  },
  {
    id: 'f02-local-first-vault',
    label: 'Encrypted notes vault in the browser',
    basedOn: '04-local-first-vault',
    answers: [
      answer(
        'q.idea',
        'A notes vault that encrypts every note in the browser and syncs ciphertext to a folder the writer owns. The server never sees plaintext.',
      ),
      answer(
        'q.problem',
        'People keep sensitive notes in hosted tools that read every word to build features. Moving to local files means losing search and every device sync.',
      ),
      answer(
        'q.workaround',
        'They keep a plain folder of markdown and sync it with a file tool, and they accept that anything with disk access can read the folder.',
      ),
      answer(
        'q.goal',
        'Search stays instant over ten thousand notes while the key never leaves the device. Do not build a mobile client and do not add shared vaults.',
      ),
      answer(
        'q.proof',
        'Search over 10,000 notes returns its first result in under 150 ms from a cold cache, measured with performance.now().',
      ),
      answer(
        'q.constraints',
        'vault size | 10,000 notes\nsearch latency | p95 under 150 ms\ncold start | under 2 s\nkey material | never leaves the device',
      ),
      answer(
        'q.stack',
        'Angular 20 with signals\nSQLite compiled to WASM for local storage\nWebCrypto AES-GCM for encryption\nCloudflare Pages for the static build',
      ),
      answer(
        'q.scope_out',
        'Mobile clients\nShared vaults\nServer side search\nPassword recovery',
      ),
      answer(
        'q.risk',
        'A WASM SQLite build may not hold ten thousand notes in the memory a browser tab allows. Build the indexer first instead and measure the ceiling before writing any UI.',
      ),
    ],
  },
  {
    id: 'f03-review-agent',
    label: 'Pull request review service',
    basedOn: '03-pr-review-agent',
    answers: [
      answer(
        'q.idea',
        'A service that reviews a pull request diff, runs the project linter, and posts one comment with the findings and a confidence number.',
      ),
      answer(
        'q.problem',
        'Reviewers open a large diff and the mechanical problems hide the design problems. The first comment is usually about spacing.',
      ),
      answer(
        'q.workaround',
        'They run the linter by hand, read the diff top to bottom, and leave a dozen small comments.',
      ),
      answer(
        'q.goal',
        'Post one comment per pull request that names every lint error and no false positives. Do not approve or merge anything and do not write code.',
      ),
      answer(
        'q.proof',
        'Zero false positives across 20 pull requests from public repositories, checked by hand and recorded in the README.',
      ),
      answer(
        'q.constraints',
        'review latency | p95 under 45 s per pull request\nfalse positives | 0 across 20 runs\ncomment size | under 4,000 characters',
      ),
      answer(
        'q.stack',
        'TypeScript strict\nNestJS 11 with Octokit for the GitHub App\nPostgreSQL 16 for the run log\nDocker Compose on the homelab',
      ),
      answer(
        'q.scope_out',
        'Merge automation\nCode suggestions with patches\nMulti repository dashboards',
      ),
      answer(
        'q.risk',
        'A large diff can exceed the prompt budget and the run fails halfway. Chunk the diff by file first instead, and review one file per call.',
      ),
    ],
  },
  {
    id: 'f04-realtime-board',
    label: 'Convergent shared board',
    basedOn: '08-realtime-collab',
    answers: [
      answer(
        'q.idea',
        'A shared board where several people move cards at the same time and every client converges on the same order without an arbitration step.',
      ),
      answer(
        'q.problem',
        'Teams keep the plan in a document and the document loses edits when two people type at once. The conflict costs a meeting to resolve.',
      ),
      answer(
        'q.workaround',
        'They take turns editing, or they keep one owner per section and merge by hand in the weekly call.',
      ),
      answer(
        'q.goal',
        'Two clients that edit offline both keep their work after they reconnect. Do not build chat and do not add presence avatars.',
      ),
      answer(
        'q.proof',
        '100 of 100 synthetic concurrent edits converge to identical documents on both clients, asserted by the conflict test.',
      ),
      answer(
        'q.constraints',
        'sync latency | p95 under 250 ms\nconcurrent editors | 8 per board\nreconnect | converges under 3 s',
      ),
      answer(
        'q.stack',
        'Angular 20 with signals\nYjs for the shared document\nA WebSocket relay in Node.js\nPostgreSQL 16 for the snapshot log\nCaddy for TLS',
      ),
      answer(
        'q.scope_out',
        'Chat\nVideo\nFile attachments\nPermissions beyond owner and editor',
      ),
      answer(
        'q.risk',
        'The relay may drop a delta and leave the two clients diverged. Build the convergence test first instead, with a synthetic editor that runs with no network.',
      ),
    ],
  },
  {
    id: 'f05-transcript-skill-compiler',
    label: 'Transcript to skill file, chunked',
    basedOn: '11-md-skill-forge',
    answers: [
      answer(
        'q.idea',
        'A browser tool that turns a long transcript into a skill file in chunks with a local model. Every output sentence traces back to a transcript line.',
      ),
      answer(
        'q.problem',
        'A long transcript does not fit a small context window, so a single pass either fails or drops the middle. The middle is where the decisions are.',
      ),
      answer(
        'q.workaround',
        'They paste the transcript in pieces, keep the outputs in a scratch file, and stitch the result by hand.',
      ),
      answer(
        'q.goal',
        'Keep every output sentence traceable and keep every run inside the model budget. Do not call a cloud model and do not store the transcript on a server.',
      ),
      answer(
        'q.proof',
        'Marker coverage at or above 0.80 on 15 of 15 chunk runs, read off the run log.',
      ),
      answer(
        'q.constraints',
        'context budget | 4096 tokens\noutput reserve | 640 tokens per chunk\ncoverage threshold | 0.80\nchunk count | under 40 per transcript',
      ),
      answer(
        'q.stack',
        'Angular 20 standalone components\nCodeMirror 6 for the transcript pane\nWebLLM in a worker for local inference\nShiki for syntax highlighting',
      ),
      answer(
        'q.scope_out',
        'Cloud inference\nA hosted transcript store\nAudio transcription\nTeam workspaces',
      ),
      answer(
        'q.risk',
        'A 3B model may ignore the marker protocol and produce unmarked sentences. Build the marker validator first instead, and keep the template output when coverage fails.',
      ),
      answer('a.ctx_window', '4096'),
      answer('a.vram_gb', '8'),
      answer('a.wasm_fallback', 'Yes'),
    ],
  },
];
