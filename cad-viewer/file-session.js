// Only the newest file request may update the viewer. Aborting a request never
// cancels a newer request or clears its error/loading state.
export class FileSession {
  constructor() { this.sequence = 0; this.active = null; }
  begin(source) {
    this.active?.controller.abort();
    const request = { id: ++this.sequence, source, controller: new AbortController() };
    this.active = request;
    return request;
  }
  isCurrent(request) { return this.active === request && !request.controller.signal.aborted; }
  cancel() { this.active?.controller.abort(); this.active = null; this.sequence++; }
}

export function sameOriginFileUrl(value, base) {
  const url = new URL(value, base);
  if (url.origin !== new URL(base).origin || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only same-origin HTTP files can be opened.');
  }
  return url.href;
}
