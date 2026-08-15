import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("lets users clear and replace the activity capacity without a leading zero", async () => {
  const [createSheet, createFields] = await Promise.all([
    readFile(new URL("components/activity/create-sheet.tsx", root), "utf8"),
    readFile(
      new URL("components/activity/create-activity-fields.tsx", root),
      "utf8",
    ),
  ]);

  assert.match(createFields, /capacity: string/);
  assert.match(createSheet, /capacity: "6"/);
  assert.match(createFields, /const capacity = event\.target\.value\.replace/);
  assert.doesNotMatch(createFields, /capacity: Number\(event\.target\.value\)/);
  assert.match(createSheet, /const capacity = Number\(form\.capacity\)/);
  assert.ok(createSheet.split("\n").length < 130);
});
