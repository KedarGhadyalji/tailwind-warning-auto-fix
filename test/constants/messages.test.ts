import { test } from "node:test";
import assert from "node:assert/strict";
import { Messages } from "../../src/constants/messages";

test("confirmApplyTitle uses singular wording for exactly one warning", () => {
  assert.equal(
    Messages.confirmApplyTitle(1),
    "Found 1 Tailwind optimization warning.",
  );
});

test("confirmApplyTitle uses plural wording for multiple warnings", () => {
  assert.equal(
    Messages.confirmApplyTitle(18),
    "Found 18 Tailwind optimization warnings.",
  );
});

test("confirmApplyTitle uses plural wording for zero warnings", () => {
  assert.equal(
    Messages.confirmApplyTitle(0),
    "Found 0 Tailwind optimization warnings.",
  );
});

test("fixAllSummary reports only optimizations when no conflicts resolved", () => {
  assert.equal(Messages.fixAllSummary(5, 0, 0), "5 optimizations fixed.");
});

test("fixAllSummary uses singular wording for exactly one optimization", () => {
  assert.equal(Messages.fixAllSummary(1, 0, 0), "1 optimization fixed.");
});

test("fixAllSummary reports only conflicts when no optimizations applied", () => {
  assert.equal(Messages.fixAllSummary(0, 3, 0), "3 conflicts resolved.");
});

test("fixAllSummary uses singular wording for exactly one conflict", () => {
  assert.equal(Messages.fixAllSummary(0, 1, 0), "1 conflict resolved.");
});

test("fixAllSummary combines both categories", () => {
  assert.equal(
    Messages.fixAllSummary(5, 3, 0),
    "5 optimizations fixed, 3 conflicts resolved.",
  );
});

test("fixAllSummary appends skipped count when present", () => {
  assert.equal(
    Messages.fixAllSummary(5, 3, 2),
    "5 optimizations fixed, 3 conflicts resolved. 2 warnings skipped.",
  );
});

test('fixAllSummary uses singular "warning" when exactly one skipped', () => {
  assert.equal(
    Messages.fixAllSummary(1, 0, 1),
    "1 optimization fixed. 1 warning skipped.",
  );
});

test('fixAllSummary reports "No changes applied." when everything is zero', () => {
  assert.equal(Messages.fixAllSummary(0, 0, 0), "No changes applied.");
});

test("fixAllSummary reports only skipped count when nothing was fixed or resolved", () => {
  assert.equal(
    Messages.fixAllSummary(0, 0, 4),
    "No changes applied. 4 warnings skipped.",
  );
});
