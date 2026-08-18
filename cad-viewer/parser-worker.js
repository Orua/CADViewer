let runtimePromise;

function getRuntime() {
  if (!runtimePromise) {
    runtimePromise = import('./bindings/libredwg-web.js').then(async (bindings) => ({
      bindings,
      libredwg: await bindings.LibreDwg.create(new URL('./wasm/', import.meta.url).href.replace(/\/$/, '')),
    }));
  }
  return runtimePromise;
}

function errorCode(message) {
  return /out of memory|memory access|data cannot be cloned/i.test(message) ? 'worker_oom' : 'worker_error';
}

self.onmessage = async ({ data }) => {
  if (data?.type !== 'open') return;
  const startedAt = performance.now();
  let dwg;

  try {
    self.postMessage({ type: 'phase', phase: 'runtime' });
    const { bindings, libredwg } = await getRuntime();
    self.postMessage({ type: 'phase', phase: 'decode' });
    dwg = libredwg.dwg_read_data(new Uint8Array(data.buffer), bindings.Dwg_File_Type.DWG);
    if (dwg == null) throw new Error('LibreDWG 无法读取这个文件');

    const decodedAt = performance.now();
    let firstBatchAt = 0;
    const summary = libredwg.convertForViewer(
      dwg,
      (batch) => {
        if (!firstBatchAt) firstBatchAt = performance.now();
        self.postMessage({ type: 'batch', batch });
      },
      2000,
    );

    self.postMessage({
      type: 'done',
      summary,
      timing: {
        decodeMs: decodedAt - startedAt,
        firstBatchMs: firstBatchAt ? firstBatchAt - decodedAt : 0,
        convertMs: performance.now() - decodedAt,
        totalMs: performance.now() - startedAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    self.postMessage({ type: 'error', message, errorCode: errorCode(message) });
  } finally {
    if (dwg) {
      try { (await getRuntime()).libredwg.dwg_free(dwg); } catch { /* Worker 结束时由 WASM 回收。 */ }
    }
  }
};
