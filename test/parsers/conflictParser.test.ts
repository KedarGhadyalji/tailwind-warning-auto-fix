import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTailwindConflictMessage } from "../../src/parsers/conflictParser";

test("parses a standard conflict message", () => {
  const result = parseTailwindConflictMessage(
    "'text-left' applies the same CSS properties as 'text-center'.",
  );
  assert.deepEqual(result, {
    flaggedClass: "text-left",
    conflictsWith: "text-center",
  });
});

test("parses the reciprocal direction of the same conflict", () => {
  const result = parseTailwindConflictMessage(
    "'text-center' applies the same CSS properties as 'text-left'.",
  );
  assert.deepEqual(result, {
    flaggedClass: "text-center",
    conflictsWith: "text-left",
  });
});

test("parses correctly without a trailing period", () => {
  const result = parseTailwindConflictMessage(
    "'relative' applies the same CSS properties as 'sticky'",
  );
  assert.deepEqual(result, {
    flaggedClass: "relative",
    conflictsWith: "sticky",
  });
});

test("parses class names containing slashes and numbers (fractional utilities)", () => {
  const result = parseTailwindConflictMessage(
    "'w-full' applies the same CSS properties as 'w-1/2'.",
  );
  assert.deepEqual(result, { flaggedClass: "w-full", conflictsWith: "w-1/2" });
});

test("returns null for an optimization-style message (wrong category)", () => {
  const result = parseTailwindConflictMessage(
    "The class `max-w-[1600px]` can be written as `max-w-400`",
  );
  assert.equal(result, null);
});

test("returns null for an unrelated message", () => {
  assert.equal(parseTailwindConflictMessage("Unknown at rule @tailwind"), null);
});

test("returns null for an empty string", () => {
  assert.equal(parseTailwindConflictMessage(""), null);
});

test("returns null when quotes are missing", () => {
  assert.equal(
    parseTailwindConflictMessage(
      "text-left applies the same CSS properties as text-center.",
    ),
    null,
  );
});
