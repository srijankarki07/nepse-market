/**
 * The two archive boundaries that are not the client's business.
 *
 * The failure these guard against was live: a session published a few minutes before its
 * CDN copy was readable produced a 404, and the client — correctly, for every other date —
 * treated it as a permanent fact. One early visitor's browser then remembered "there is no
 * 16 October" until they cleared site data. The tests pin both halves: asking the origin
 * before believing the CDN, and refusing to persist a recent negative answer.
 */

import { describe, expect, it } from "vitest";
import { CDN_HOST, ORIGIN_HOST, memoryCache } from "@srijankarki44/nepse-data";

import { createArchiveFetch, createRecentSafeCache, isRecentArchiveDate } from "./nepse";

/** A fetch that answers with the given statuses in order and records every URL asked. */
function recordingFetch(statuses: readonly number[]): {
  fetchImpl: typeof fetch;
  calls: string[];
} {
  const calls: string[] = [];

  const fetchImpl = (async (input: string | URL | Request) => {
    calls.push(String(input));
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)] ?? 200;
    return { status } as Response;
  }) as unknown as typeof fetch;

  return { fetchImpl, calls };
}

describe("createArchiveFetch", () => {
  const today = new Date().toISOString().slice(0, 10);
  const recentPath = `data/daily/${today.slice(0, 4)}/${today}.csv`;

  it("asks the origin when the CDN has not got a recent session yet", async () => {
    const { fetchImpl, calls } = recordingFetch([404, 200]);
    const archiveFetch = createArchiveFetch(fetchImpl);

    const response = await archiveFetch(`${CDN_HOST}/${recentPath}`, {});

    expect(response.status).toBe(200);
    expect(calls).toEqual([`${CDN_HOST}/${recentPath}`, `${ORIGIN_HOST}/${recentPath}`]);
  });

  it("treats a 403 like a 404, because both mean 'not at this path'", async () => {
    const { fetchImpl, calls } = recordingFetch([403, 200]);
    const archiveFetch = createArchiveFetch(fetchImpl);

    expect((await archiveFetch(`${CDN_HOST}/${recentPath}`, {})).status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it("does not retry an old date at the origin", async () => {
    // A date the archive genuinely does not hold would only cost a second request. The
    // fallback is for the narrow window in which the archive is ahead of its edge.
    const { fetchImpl, calls } = recordingFetch([404]);
    const archiveFetch = createArchiveFetch(fetchImpl);

    expect((await archiveFetch(`${CDN_HOST}/data/daily/2011/2011-06-13.csv`, {})).status).toBe(404);
    expect(calls).toHaveLength(1);
  });

  it("does not retry a path that is not a session file", async () => {
    const { fetchImpl, calls } = recordingFetch([404]);
    const archiveFetch = createArchiveFetch(fetchImpl);

    expect((await archiveFetch(`${CDN_HOST}/data/latest.json`, {})).status).toBe(404);
    expect(calls).toHaveLength(1);
  });

  it("passes a successful CDN response straight through", async () => {
    const { fetchImpl, calls } = recordingFetch([200]);
    const archiveFetch = createArchiveFetch(fetchImpl);

    expect((await archiveFetch(`${CDN_HOST}/${recentPath}`, {})).status).toBe(200);
    expect(calls).toHaveLength(1);
  });
});

describe("createRecentSafeCache", () => {
  const now = () => Date.parse("2026-10-18T00:00:00Z");

  it("does not remember that a recent session was missing", async () => {
    const inner = memoryCache();
    const cache = createRecentSafeCache(inner, now);

    await cache.set("session/2026-10-16", "");

    expect(await cache.get("session/2026-10-16")).toBeNull();
    expect(await inner.get("session/2026-10-16")).toBeNull();
  });

  it("ignores a negative entry already in storage, which repairs an affected browser", async () => {
    const inner = memoryCache();
    await inner.set("session/2026-10-16", "");

    expect(await createRecentSafeCache(inner, now).get("session/2026-10-16")).toBeNull();
  });

  it("still remembers that an old date did not trade", async () => {
    // "The market was shut on 13 June 2011" is a fact and should stay cheap.
    const inner = memoryCache();
    const cache = createRecentSafeCache(inner, now);

    await cache.set("session/2011-06-13", "");

    expect(await cache.get("session/2011-06-13")).toBe("");
    expect(await inner.get("session/2011-06-13")).toBe("");
  });

  it("leaves a session body alone, whatever its date", async () => {
    const inner = memoryCache();
    const cache = createRecentSafeCache(inner, now);

    await cache.set("session/2026-10-16", "date,symbol\n2026-10-16,A");

    expect(await cache.get("session/2026-10-16")).toBe("date,symbol\n2026-10-16,A");
  });

  it("does not touch keys that are not sessions", async () => {
    const inner = memoryCache();
    const cache = createRecentSafeCache(inner, now);

    await cache.set("manifest", "");

    expect(await cache.get("manifest")).toBe("");
  });
});

describe("isRecentArchiveDate", () => {
  const now = Date.parse("2026-10-18T00:00:00Z");

  it("treats the last month as recent", () => {
    expect(isRecentArchiveDate("2026-10-16", now)).toBe(true);
    expect(isRecentArchiveDate("2026-09-20", now)).toBe(true);
  });

  it("treats an old date as old", () => {
    expect(isRecentArchiveDate("2011-06-13", now)).toBe(false);
  });

  it("refuses a string that is not a date", () => {
    expect(isRecentArchiveDate("yesterday", now)).toBe(false);
  });
});
