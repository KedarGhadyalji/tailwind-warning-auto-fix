import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTailwindOptimizationMessage } from "../../src/parsers/diagnosticParser";

test("parses a standard optimization message", () => {
  const result = parseTailwindOptimizationMessage(
    "The class `max-w-[1600px]` can be written as `max-w-400`",
  );
  assert.deepEqual(result, {
    oldClass: "max-w-[1600px]",
    newClass: "max-w-400",
  });
});

test("parses the important-modifier rewrite example", () => {
  const result = parseTailwindOptimizationMessage(
    "The class `!bg-surface` can be written as `bg-surface!`",
  );
  assert.deepEqual(result, {
    oldClass: "!bg-surface",
    newClass: "bg-surface!",
  });
});

test("trims surrounding whitespace before matching", () => {
  const result = parseTailwindOptimizationMessage(
    "  The class `p-[16px]` can be written as `p-4`  \n",
  );
  assert.deepEqual(result, { oldClass: "p-[16px]", newClass: "p-4" });
});

test("handles class names containing special regex characters safely", () => {
  const result = parseTailwindOptimizationMessage(
    "The class `w-[calc(100%-2rem)]` can be written as `w-[100%-2rem]`",
  );
  assert.deepEqual(result, {
    oldClass: "w-[calc(100%-2rem)]",
    newClass: "w-[100%-2rem]",
  });
});

test("returns null for a conflict-style message (wrong category)", () => {
  const result = parseTailwindOptimizationMessage(
    "'text-left' applies the same CSS properties as 'text-center'.",
  );
  assert.equal(result, null);
});

test("returns null for a completely unrelated diagnostic message", () => {
  assert.equal(
    parseTailwindOptimizationMessage('Cannot find module "foo"'),
    null,
  );
});

test("returns null for an empty string", () => {
  assert.equal(parseTailwindOptimizationMessage(""), null);
});

test("returns null when the message is missing the trailing backtick", () => {
  const result = parseTailwindOptimizationMessage(
    "The class `p-[16px]` can be written as `p-4",
  );
  assert.equal(result, null);
});

test("returns null when the message is missing the leading backtick", () => {
  const result = parseTailwindOptimizationMessage(
    "The class p-[16px]` can be written as `p-4`",
  );
  assert.equal(result, null);
});

test("returns null for wording that only partially matches", () => {
  assert.equal(
    parseTailwindOptimizationMessage("The class `p-4` is deprecated"),
    null,
  );
});
