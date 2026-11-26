import assert from "node:assert/strict";
import {test} from "node:test";
import {productRequest} from "../src/index.js";

const {fetchHeaders, send} = productRequest({
  name: "Acme",
  replayable: ["GET"],
});

const stubFetch = (answers) => {
  const methods = [];
  globalThis.fetch = async (_url, init) => {
    const [status, body] = answers[methods.length] ?? [200, "{}"];
    methods.push(init.method);
    return {
      headers: new Headers(),
      ok: status < 400,
      status,
      text: async () => body,
    };
  };
  return methods;
};

for (const [why, answers, calls, outcome] of [
  [
    "retries a replayable 429/5xx twice",
    [
      [429, ""],
      [503, ""],
      [200, '{"ok":true}'],
    ],
    3,
    {ok: true},
  ],
  [
    "gives up after two retries",
    [
      [500, "x"],
      [500, "x"],
      [500, "boom"],
    ],
    3,
    /Acme API 500: boom/,
  ],
  ["does not retry a 4xx", [[400, "bad"]], 1, /Acme API 400: bad/],
]) {
  test(`send ${why}`, async () => {
    const methods = stubFetch(answers);
    const result = send("GET", "https://acme/x");
    if (outcome instanceof RegExp) await assert.rejects(result, outcome);
    else assert.deepEqual(await result, outcome);
    assert.equal(methods.length, calls);
  });
}

// A 500 may come after the write went through; replaying it would repeat it.
test("send does not replay a method outside replayable", async () => {
  const methods = stubFetch([[503, "busy"]]);
  await assert.rejects(send("POST", "https://acme/x"), /Acme API 503: busy/);
  assert.deepEqual(methods, ["POST"]);
});

test("send returns null for an empty 2xx body, and the text when raw", async () => {
  stubFetch([
    [201, ""],
    [200, "diff --git"],
  ]);
  assert.equal(await send("POST", "https://acme/x"), null);
  assert.equal(await send("GET", "https://acme/x", {raw: true}), "diff --git");
});

for (const [method, says] of [
  ["GET", /^Acme did not answer within 30s; safe to retry$/],
  [
    "POST",
    /POST within 30s; it may still have been saved, so do not retry: ask the user to check in Acme first/,
  ],
]) {
  test(`send says what a timed-out ${method} means for a retry`, async () => {
    globalThis.fetch = async () => {
      throw new DOMException("timed out", "TimeoutError");
    };
    await assert.rejects(send(method, "https://acme/x"), {message: says});
  });
}

test("fetchHeaders times out waiting for headers only", {
  timeout: 2000,
}, async (t) => {
  t.mock.timers.enable({apis: ["setTimeout"]});
  let signal;
  globalThis.fetch = (_url, init) =>
    new Promise((_, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason));
    });
  const silent = fetchHeaders("https://acme/a");
  t.mock.timers.tick(30_000);
  await assert.rejects(silent, {
    message: "Acme did not answer within 30s; safe to retry",
  });

  globalThis.fetch = async (_url, init) => {
    signal = init.signal;
    return {ok: true};
  };
  await fetchHeaders("https://acme/a");
  t.mock.timers.tick(30_000);
  assert.equal(signal.aborted, false);
});
