import assert from "node:assert/strict";
import test from "node:test";
import { kisaraSecretAudioTracks } from "../src/themes/kisara/lib/audio.ts";

test("Kisara secret tracks are one-shot unlocks within the current document", () => {
  for (const track of kisaraSecretAudioTracks) {
    assert.equal(track.persistAcrossReload, false, `${track.id} must not survive a refresh`);
    assert.equal(track.consumeAfterPlayback, true, `${track.id} must leave the queue after playback`);
  }
});
