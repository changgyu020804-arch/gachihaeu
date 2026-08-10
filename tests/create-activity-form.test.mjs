import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("lets users clear and replace the activity capacity without a leading zero", async () => {
  const createSheet = await readFile(
    new URL("components/activity/create-sheet.tsx", root),
    "utf8",
  );

  assert.match(createSheet, /capacity: string/);
  assert.match(createSheet, /capacity: "6"/);
  assert.match(createSheet, /const capacity = e\.target\.value\.replace/);
  assert.doesNotMatch(createSheet, /capacity: Number\(e\.target\.value\)/);
  assert.match(createSheet, /const capacity = Number\(form\.capacity\)/);
});
