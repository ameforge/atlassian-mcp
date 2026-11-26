// Only replayable methods retry a 429/5xx: a write's 500 may come after the write went through.
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
 * @param {object} product
 * @param {string} product.name
 * @param {string[]} product.replayable
 * @param {boolean} [product.retryAfter]
 * @param {string} [product.effect]
 * @param {(text: string) => string} [product.errorText]
 * @param {(res: Response) => Promise<any>} [product.parse]
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
   * @param {string} url
   * @param {{body?: any, headers?: Record<string, string>, raw?: boolean, timeout?: boolean}} [init]
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
