import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalPairKey } from "../../src/utils/conflictKey";

test("produces the same key regardless of argument order", () => {
  assert.equal(
    canonicalPairKey("text-left", "text-center"),
    canonicalPairKey("text-center", "text-left"),
  );
});

test("produces different keys for different pairs", () => {
  assert.notEqual(
    canonicalPairKey("text-left", "text-center"),
    canonicalPairKey("relative", "sticky"),
  );
});

test("is stable and deterministic for the same input", () => {
  assert.equal(
    canonicalPairKey("flex", "block"),
    canonicalPairKey("flex", "block"),
  );
});

test("handles class names containing slashes and numbers", () => {
  assert.equal(
    canonicalPairKey("w-full", "w-1/2"),
    canonicalPairKey("w-1/2", "w-full"),
  );
});
