import assert from "node:assert/strict";
import test from "node:test";
import { kisaraSecretAudioTracks } from "../src/themes/kisara/lib/audio.ts";

test("Kisara secret tracks are one-shot unlocks within the current document", () => {
  for (const track of kisaraSecretAudioTracks) {
    assert.equal(track.persistAcrossReload, false, `${track.id} must not survive a refresh`);
    assert.equal(track.consumeAfterPlayback, true, `${track.id} must leave the queue after playback`);
  }
});

test("Darekare Scramble is consumed per playback but can be granted again later", () => {
  const scramble = kisaraSecretAudioTracks.find((track) => track.id === "darekare-scramble");
  assert.ok(scramble, "Darekare Scramble must be registered as a secret track");
  assert.equal("singleUseSession" in scramble, false);
  assert.equal(scramble.consumeAfterPlayback, true);
  assert.equal(scramble.variant, "scramble");
});
