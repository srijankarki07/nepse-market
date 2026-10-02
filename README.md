# nepse-market

A market browser for the Nepal Stock Exchange, every listed scrip, closing prices from
2011 to today, read from a public archive in the browser.

**End-of-day only.** There is no live or intraday data behind this, and there cannot be:
the archive holds one file per trading session, published an hour after the close. The
header says so on every page, because a reader who assumes a live feed will read a stale
number as a current one.

## There is no server

The data is static files on a CDN with CORS open, so the browser fetches it directly. This
is a fully statically exported Next.js app, `pnpm build` emits plain files and any static
host serves them. Nothing is fetched at build time either, so the build works whether the
archive is reachable or not, and a company listed this morning appears without a rebuild.

## What it shows

- **`/`**, the latest session: 353 scrips with their day change, sortable and filterable,
  plus turnover, volume and market breadth.
- **`/symbol/?t=NABIL`**, one scrip: its price, the day's OHLC, a closing-price chart with
  the session high–low range banded behind it, over 1M / 3M / 6M / 1Y.

The ticker is a query parameter rather than a path segment deliberately. `/symbol/NABIL`
would be prettier, but a dynamic segment in a static export must be enumerated at build
time, which would make the build depend on the network, and 404 a newly listed scrip until
the next deploy. See the note at the top of `src/app/symbol/page.tsx`.

## Running it

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # 29 tests, no network
pnpm build        # static export to out/
```

`nepse-data` is installed from a packed tarball rather than linked, because Turbopack will
not follow a symlink outside the project root. To work on the client and the site
together, repack and reinstall:

```bash
cd ../nepse-client && pnpm build && npm pack --pack-destination /tmp/pack
cd ../nepse-market && pnpm add "file:/tmp/pack/nepse-data-0.1.0.tgz"
```

## Where the numbers come from

[`srijankarki07/nepse-data`](https://github.com/srijankarki07/nepse-data) scrapes the
exchange's end-of-day figures daily and commits one CSV per session. This site reads that
through the `nepse-data` client, which handles the fetching, parsing and caching.

Prices are **not adjusted** for bonus shares, rights issues or splits, because the source
does not adjust them. A long chart therefore shows the nominal price, and a bonus issue
appears as a sudden fall.

## Licence

MIT for the code. The data is not covered by it, the prices are the exchange's, and this
project neither owns nor re-licenses them.
