import assert from "node:assert/strict";
import test from "node:test";
import { kisaraSecretAudioTracks } from "../src/themes/kisara/lib/audio.ts";

test("Kisara secret tracks are one-shot unlocks within the current document", () => {
  for (const track of kisaraSecretAudioTracks) {
    assert.equal(track.persistAcrossReload, false, `${track.id} must not survive a refresh`);
    assert.equal(track.consumeAfterPlayback, true, `${track.id} must leave the queue after playback`);
  }
});

test("Darekare Scramble can only be granted once per tab session", () => {
  const scramble = kisaraSecretAudioTracks.find((track) => track.id === "darekare-scramble");
  assert.ok(scramble, "Darekare Scramble must be registered as a secret track");
  assert.equal(scramble.singleUseSession, true);
  assert.equal(scramble.variant, "scramble");
});
