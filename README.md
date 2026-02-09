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

---

## License

MIT. If you’re from Telepathic Instruments and this is wildly wrong, no hard feelings - I really did only watch the first teaser.
