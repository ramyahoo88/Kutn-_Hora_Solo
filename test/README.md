# App tests

Run from the repository root with Node.js 24. The engine suite and app build need no npm dependencies.

```sh
npm test
npm run build
```

`npm test` runs the engine tests and the Mincmistr card-play checks. `npm run build` writes `dist/index.html`. For a release, install the [print build dependencies](../mincmistr/README.md#build-the-print-packet) and run `npm run verify`. It compares the shipped files with a rebuild from source.

Install the locked smoke test dependencies and Chromium, then exercise the controls in the shipped HTML.

```sh
npm ci
npx playwright install --only-shell chromium
npm run smoke
```

The DOM checks simulate blocked storage and shared tabs. The browser checks cover saves and Undo, Plan explanations and round-end effects, report replay, deck transfer, phone layouts and print views. Run them independently with `npm run smoke:dom` and `npm run smoke:browser`. Use `HEADED=1` and install full Chromium to see the browser, or set `BROWSER_EXECUTABLE` to the path of an installed browser.

```sh
npx playwright install firefox webkit
npm run smoke:browser -- firefox
npm run smoke:browser -- webkit
```

For a Safari or iPhone check, open the HTML and follow the [playtest checks](../README.md#playtest-checks). The automated WebKit check covers the engine. File opening, storage and printing can differ on Safari.
