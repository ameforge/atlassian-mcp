// Jira, Confluence and Bitbucket answer transient 429/5xx under load. Only a
// method the product lists as replayable is retried: a 500 on a write may
// come after the write went through, so a replay could do it twice, and a
// replayed DELETE's 404 would report a removed item as a failure.
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;
const MAX_RETRY_AFTER_S = 10;
// A product that stops answering would otherwise hang the tool call forever.
export const TIMEOUT_MS = 30_000;

/** @param {Response} res */
const parseJson = async (res) => {
  // Not just 204: Jira answers POST /issueLink with 201 and an empty body.
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

/**
 * The request rules of one Atlassian product. The client builds the URL and
 * headers; this owns timeouts, retries and how answers and errors read.
 * @param {object} product
 * @param {string} product.name e.g. "Jira", in every error message
 * @param {string[]} product.replayable methods safe to send twice
 * @param {boolean} [product.retryAfter] wait as long as a 429's Retry-After asks, capped
 * @param {string} [product.effect] what a timed-out write may already have done
 * @param {(text: string) => string} [product.errorText] reads an error body
 * @param {(res: Response) => Promise<any>} [product.parse] reads a 2xx body
 */
export const productRequest = ({
  name,
  replayable,
  retryAfter = false,
  effect = "been saved",
  errorText = (text) => text,
  parse = parseJson,
}) => {
  /**
   * Turns fetch's bare TimeoutError into one the caller can act on: a write
   * that timed out may still have gone through, and a blind retry of a POST
   * does it twice. Any other error passes through.
   * @param {string} method
   * @returns {(err: Error) => never}
   */
  const onTimeout = (method) => (err) => {
    if (err.name !== "TimeoutError") throw err;
    throw new Error(
      replayable.includes(method)
        ? `${name} did not answer within ${TIMEOUT_MS / 1000}s; safe to retry`
        : `${name} did not answer the ${method} within ${TIMEOUT_MS / 1000}s; it may still have ${effect}, so do not retry: ask the user to check in ${name} first`,
    );
  };

  /**
   * @param {string} method
   * @param {string} url absolute
   * @param {{body?: any, headers?: Record<string, string>, raw?: boolean, timeout?: boolean}} [init]
   *   body goes to fetch as is; raw returns the body text; timeout: false for an upload that may rightly take longer
   */
  const send = async (
    method,
    url,
    {body, headers, raw = false, timeout = true} = {},
  ) => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, {
        body,
        headers,
        method,
        signal: timeout ? AbortSignal.timeout(TIMEOUT_MS) : undefined,
      }).catch(onTimeout(method));
      if (res.ok) return raw ? res.text() : parse(res);
      if (
        attempt < MAX_RETRIES &&
        RETRY_STATUS.has(res.status) &&
        replayable.includes(method)
      ) {
        const after = retryAfter ? Number(res.headers.get("retry-after")) : 0;
        const waitMs =
          after > 0
            ? Math.min(after, MAX_RETRY_AFTER_S) * 1000
            : 250 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw new Error(
        `${name} API ${res.status}: ${errorText(await res.text())}`,
      );
    }
  };

  // Bounds only the wait for headers: a large attachment body may rightly take longer than TIMEOUT_MS.
  const fetchHeaders = async (url, init = {}) => {
    const ctl = new AbortController();
    const timer = setTimeout(
      () => ctl.abort(new DOMException("timeout", "TimeoutError")),
      TIMEOUT_MS,
    );
    try {
      return await fetch(url, {...init, signal: ctl.signal}).catch(
        onTimeout(init.method ?? "GET"),
      );
    } finally {
      clearTimeout(timer);
    }
  };

  return {fetchHeaders, onTimeout, send};
};
