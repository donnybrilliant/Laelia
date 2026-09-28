# Laelia

[![Netlify Status](https://api.netlify.com/api/v1/badges/d5a67f3f-0218-4385-893e-36682a893008/deploy-status)](https://app.netlify.com/projects/laelia/deploys)

A browser-based chord synth. Chords, strums, arpeggios, harp modes.
Add to home screen and pretend it’s a real instrument.

Inspired by the [Orchid](https://telepathicinstruments.com/) from Telepathic Instruments - except I only ever watched the first teaser. No demo, no manual, never held one.
So this isn’t a clone; it’s just how I picture the thing from that one video.

## What’s in the box

- **Keyboard** — play notes. Poly, strum, arp, or harp mode.
- **Chord buttons** — tap a chord, get a chord. Maj, min, dim, sus, plus extensions (6, m7, M7, 9).
- **Rotary dials** — volume, sound, FX, key, BPM, chord voicing, bass voicing. You know, _knob stuff_.
- **Sound presets** — Piano, Pad, Strings, Organ, Pluck, Bell, Synth, Brass (Tone.js under the hood).
- **Visualizer** — so it looks like a synth and not a tax form.
- **PWA** — installable, works on phones, dark theme, splash screens. The whole “it’s an app” illusion.

Tech: React, Vite, TypeScript, [Tone.js](https://tonejs.github.io/), Tailwind. No backend. No account. No tracking. Just vibes and Web Audio.

## MIDI keyboards

Connect a USB MIDI keyboard, then click the MIDI socket icon at the right of the header and allow browser access. There is no setup menu: Laelia listens to all connected MIDI inputs and channels, and picks up keyboards plugged in later. Click the icon again to see the connection status or retry. It appears while idle; playing notes takes its place, including the sound's release tail.

Every key triggers a **chord**, using the selected chord type, extensions, voicing, key transposition, and performance mode. MIDI preserves the played octave and velocity. The on-screen keys highlight the corresponding pitch classes. Poly, strum, and harp play the latest held chord, returning to the previous held chord on release; arp combines held chords. The bass stays in the range selected by the Bass dial.

- Sustain pedal (**CC64**) holds chords until released.
- Volume (**CC7**) controls the Volume dial.
- Modulation wheel (**CC1**) controls the FX dial.
- Unplugging a keyboard, leaving the app, and all-notes-off/all-sound-off messages release its notes.

Other knobs and pads can send MIDI too, but their assignments vary by controller. Custom button mappings and MIDI Learn are not included yet.

Web MIDI needs HTTPS (or localhost) and a supported browser, such as desktop Chrome/Edge or Android Chrome with compatible USB/OTG hardware. Safari and iOS PWAs do not support Web MIDI. Unsupported browsers show an explanation when the icon is tapped. Audio still needs the initial click/tap; a hardware key alone cannot unlock it.

---

## Add as PWA (install to home screen)

- **iOS (Safari):** Open the site → Share → “Add to Home Screen.” Unlock audio with a tap after opening from the home screen.
- **Android (Chrome):** Open the site → menu (⋮) → “Install app” or “Add to Home screen.”
- **Desktop (Chrome/Edge):** Visit the site → install icon in the address bar (⊕ or “Install Laelia”) → Install.

Use the live site (e.g. your Netlify URL) for install; `localhost` won’t offer install on most devices.

## Run it

```bash
npm install
npm run dev
```

Then open the URL (e.g. `http://localhost:5173`), tap to unlock audio, and play.

**Build for production:**

```bash
npm run build
npm run preview
```

**MIDI protocol tests** (Node.js 22.18+): `node --test tests/midi-input.test.ts`

---

## License

MIT. If you’re from Telepathic Instruments and this is wildly wrong, no hard feelings - I really did only watch the first teaser.
