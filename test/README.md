# App smoke tests

Run these commands from the repository root with Node.js 24. The engine suite runs with no installation.

```sh
node --test test/*.test.mjs
node build.mjs dist/rebuilt.html
cmp dist/rebuilt.html Kutna_Hora_Solo.html
```

The extra smoke tests exercise controls in the shipped HTML.

```sh
npm install --no-save --no-package-lock jsdom@26.1.0 playwright@1.62.1
node test/dom-smoke.mjs
npx playwright install chromium firefox webkit
node test/browser-smoke.mjs
node test/browser-smoke.mjs firefox
node test/browser-smoke.mjs webkit
```

The DOM test simulates blocked storage and shared tabs. The browser test starts a temporary loopback server for real storage events and also opens the HTML from disk. It covers 390 px touch controls, reload and Undo, two tabs in each mode, offline cards and references, file import and download, and resolving one Mincmistr Plan before resuming the full rival batch. Use `HEADED=1` to see the browser. `BROWSER_EXECUTABLE` can point to an installed browser of the chosen engine.

For a Safari or iPhone check, open the HTML and follow the README's playtest checks. WebKit exercises the engine in the automated suite. Safari's file-opening, storage and print behavior can differ by device.
