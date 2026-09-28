import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MidiInput } from '../src/lib/midiInput.ts';

function setup(accept = true) {
  const attacks: Array<{ note: number; velocity: number; source: string }> = [];
  const releases: Array<{ note: number; source: string }> = [];
  const controls: Array<[number, number]> = [];
  const midi = new MidiInput({
    noteOn: (note, velocity, source) => { attacks.push({ note, velocity, source }); return accept; },
    noteOff: (note, source) => { releases.push({ note, source }); },
    controlChange: (cc, value) => { controls.push([cc, value]); },
  });
  const send = (bytes: number[], id = 'keyboard') => midi.receive(id, new Uint8Array(bytes));
  return { midi, send, attacks, releases, controls };
}

test('preserves MIDI octave and velocity, including the lowest and highest notes', () => {
  const { send, attacks } = setup();
  for (const note of [0, 48, 60, 127]) send([0x90, note, 64]);
  assert.deepEqual(attacks.map(a => a.note), [-48, 0, 12, 79]);
  assert.ok(attacks.every(a => a.velocity === 64 / 127));
});

test('note-on with zero velocity releases only a tracked note', () => {
  const { send, releases, attacks } = setup();
  send([0x90, 60, 100]);
  send([0x90, 60, 0]);
  send([0x80, 60, 64]);
  send([0x80, 61, 0]);
  assert.deepEqual(releases, [{ note: 12, source: attacks[0].source }]);
});

test('sustain keeps released keys until pedal-up, while physically held keys continue', () => {
  const { send, releases } = setup();
  send([0x90, 60, 100]);
  send([0xb0, 64, 127]);
  send([0x80, 60, 0]);
  send([0x90, 64, 100]);
  assert.equal(releases.length, 0);
  send([0xb0, 64, 0]);
  assert.deepEqual(releases.map(r => r.note), [12]);
  send([0x80, 64, 0]);
  assert.deepEqual(releases.map(r => r.note), [12, 16]);
});

test('replaying a sustained note remains held when the pedal is released', () => {
  const { send, releases } = setup();
  send([0x90, 60, 100]);
  send([0xb0, 64, 127]);
  send([0x80, 60, 0]);
  send([0x90, 60, 80]);
  send([0xb0, 64, 0]);
  assert.equal(releases.length, 0);
  send([0x80, 60, 0]);
  assert.equal(releases.length, 1);
});

test('sustain and releases are isolated by device and MIDI channel', () => {
  const { send, attacks, releases } = setup();
  send([0x90, 60, 100], 'a');
  send([0x91, 60, 100], 'a');
  send([0x90, 60, 100], 'b');
  send([0xb0, 64, 127], 'a');
  send([0x80, 60, 0], 'a');
  send([0x81, 60, 0], 'a');
  send([0x80, 60, 0], 'b');
  assert.equal(new Set(attacks.map(a => a.source)).size, 3);
  assert.deepEqual(releases.map(r => r.source), [attacks[1].source, attacks[2].source]);
});

test('unplugging a keyboard releases its sustained notes without releasing another device', () => {
  const { midi, send, attacks, releases } = setup();
  send([0x90, 60, 100], 'a');
  send([0xb0, 64, 127], 'a');
  send([0x80, 60, 0], 'a');
  send([0x90, 60, 100], 'b');
  midi.releaseInput('a');
  assert.deepEqual(releases.map(r => r.source), [attacks[0].source]);
  midi.releaseInput();
  assert.deepEqual(releases.map(r => r.source), attacks.map(a => a.source));
});

test('focus loss clears pedal state so reconnecting cannot leave new notes stuck', () => {
  const { midi, send, releases } = setup();
  send([0x90, 60, 100]);
  send([0xb0, 64, 127]);
  midi.releaseInput();
  send([0x90, 60, 100]);
  send([0x80, 60, 0]);
  assert.equal(releases.length, 2);
});

test('all-notes-off and all-sound-off clear only their channel, including sustain', () => {
  for (const cc of [120, 123]) {
    const { send, attacks, releases } = setup();
    send([0x90, 60, 100]);
    send([0x91, 60, 100]);
    send([0xb0, 64, 127]);
    send([0x80, 60, 0]);
    send([0xb0, cc, 0]);
    assert.deepEqual(releases.map(r => r.source), [attacks[0].source]);
    send([0x90, 62, 100]);
    send([0x80, 62, 0]);
    assert.equal(releases.length, 2);
  }
});

test('reset controllers releases pedal-held notes but retains physically held notes', () => {
  const { send, releases } = setup();
  send([0x90, 60, 100]);
  send([0xb0, 64, 127]);
  send([0x80, 60, 0]);
  send([0x90, 64, 100]);
  send([0xb0, 121, 0]);
  assert.deepEqual(releases.map(r => r.note), [12]);
});

test('volume and modulation controls normalize values and leave other CCs alone', () => {
  const { send, controls } = setup();
  send([0xb0, 7, 127]);
  send([0xbf, 1, 32]);
  send([0xb0, 11, 100]);
  assert.deepEqual(controls, [[7, 1], [1, 32 / 127]]);
});

test('ignores unsupported, incomplete and malformed messages', () => {
  const { send, attacks, releases, controls } = setup();
  for (const bytes of [[0xf8], [0xc0, 2], [0x90, 60], [0x90, 128, 60], [0x90, 60, 128], [0xe0, 0, 64]]) send(bytes);
  assert.deepEqual([attacks, releases, controls], [[], [], []]);
});

test('notes rejected before audio readiness cannot produce later phantom releases', () => {
  const { midi, send, releases } = setup(false);
  send([0x90, 60, 100]);
  send([0x80, 60, 0]);
  midi.releaseInput();
  assert.equal(releases.length, 0);
});
