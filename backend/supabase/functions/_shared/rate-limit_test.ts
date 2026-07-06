import { assertEquals } from "jsr:@std/assert@1";
import { clientIp, rateLimit } from "./rate-limit.ts";

Deno.test("allows up to the limit then blocks within the window", () => {
  const key = `test:${crypto.randomUUID()}`;
  for (let i = 0; i < 5; i++) {
    assertEquals(rateLimit(key, { limit: 5, windowSec: 60 }).allowed, true);
  }
  const blocked = rateLimit(key, { limit: 5, windowSec: 60 });
  assertEquals(blocked.allowed, false);
  assertEquals(blocked.remaining, 0);
  assertEquals(blocked.retryAfterSec > 0, true);
});

Deno.test("separate keys have independent counters", () => {
  const a = `a:${crypto.randomUUID()}`;
  const b = `b:${crypto.randomUUID()}`;
  assertEquals(rateLimit(a, { limit: 1 }).allowed, true);
  assertEquals(rateLimit(a, { limit: 1 }).allowed, false);
  assertEquals(rateLimit(b, { limit: 1 }).allowed, true);
});

Deno.test("clientIp reads the first x-forwarded-for hop", () => {
  const req = new Request("https://x", {
    headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
  });
  assertEquals(clientIp(req), "203.0.113.7");
});
