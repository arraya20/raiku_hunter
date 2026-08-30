import assert from "node:assert/strict";
import test from "node:test";

import * as ui from "../src/ui.js";

function companionElements() {
  const companion = { hidden: false };
  const message = { textContent: "" };
  globalThis.document = {
    querySelector(selector) {
      return selector === "#companion-event" ? companion : message;
    },
  };
  return { companion, message };
}

test("successful outcomes keep the companion hidden", () => {
  const { companion } = companionElements();
  try {
    ui.showCompanion("perfect");
    assert.equal(companion.hidden, true);
  } finally {
    delete globalThis.document;
  }
});

test("miss outcomes still show the companion", () => {
  const { companion, message } = companionElements();
  try {
    ui.showCompanion("miss");
    assert.equal(companion.hidden, false);
    assert.equal(message.textContent, "HEH-HEH! SIGNAL LOST!");
  } finally {
    delete globalThis.document;
  }
});

test("successful target delay is a quarter second", () => {
  assert.equal(ui.intermissionDelay?.("perfect", false), 250);
});

test("miss and reduced-motion delays remain unchanged", () => {
  assert.equal(ui.intermissionDelay?.("miss", false), 1_150);
  assert.equal(ui.intermissionDelay?.("perfect", true), 150);
});
