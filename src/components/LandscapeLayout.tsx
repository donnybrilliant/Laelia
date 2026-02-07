import { useState } from "react";
import {
  PerformanceMode,
  PERFORMANCE_MODES,
  NOTE_NAMES,
} from "@/lib/audioEngine";
import { RotaryDial } from "./RotaryDial";
import { ChordButton } from "./ChordButton";
import { Keyboard } from "./Keyboard";
import { ModeButton } from "./ModeButton";
import { Visualizer } from "./Visualizer";

interface LandscapeLayoutProps {
  isReady: boolean;
  currentChord: string;
  pressedKeys: Set<number>;
  activeNotes: Array<{ note: string; mode: PerformanceMode }>;
  handleRemoveActiveNote: (note: string) => void;
  volume: number;
  setVolume: (v: number) => void;
  sound: number;
  setSound: (v: number) => void;
  fx: number;
  setFx: (v: number) => void;
  keyValue: number;
  setKey: (v: number) => void;
  bpm: number;
  setBpm: (v: number) => void;
  chordVoicing: number;
  setChordVoicing: (v: number) => void;
  bassVoicing: number;
  setBassVoicing: (v: number) => void;
  performanceMode: PerformanceMode;
  setPerformanceMode: (m: PerformanceMode) => void;
  chordType: "maj" | "min" | "dim" | "sus";
  setChordType: (t: "maj" | "min" | "dim" | "sus") => void;
  extensions: Set<"6" | "m7" | "M7" | "9">;
  toggleExtension: (ext: "6" | "m7" | "M7" | "9") => void;
  ensureAudio: () => void;
  handleNoteOn: (note: number) => void;
  handleNoteOff: (note: number) => void;
  getPresetName: () => string;
  triggerAudioInit: () => void;
}

export function LandscapeLayout({
  isReady,
  currentChord,
  pressedKeys,
  activeNotes,
  handleRemoveActiveNote,
  volume,
  setVolume,
  sound,
  setSound,
  fx,
  setFx,
  keyValue,
  setKey,
  bpm,
  setBpm,
  chordVoicing,
  setChordVoicing,
  bassVoicing,
  setBassVoicing,
  performanceMode,
  setPerformanceMode,
  chordType,
  setChordType,
  extensions,
  toggleExtension,
  ensureAudio,
  handleNoteOn,
  handleNoteOff,
  getPresetName,
  triggerAudioInit,
}: LandscapeLayoutProps) {
  const [isControlsOpen, setIsControlsOpen] = useState(false);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      {/* Top bar - Display with visualizer + active notes */}
      <div className="flex items-center gap-2 px-2 py-1 shrink-0">
        {/* Display area with visualizer overlay - stretches full width */}
        <div className="synth-display relative flex items-center px-3 py-1.5 flex-1 min-w-0 min-h-[40px] overflow-hidden">
          {/* Visualizer background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-50">
            <Visualizer 
              isActive={isReady} 
              hasActiveNotes={activeNotes.length > 0}
              performanceMode={performanceMode}
            />
          </div>

          {/* Content on top of visualizer */}
          <div className="relative flex items-center justify-between w-full z-10">
            {/* Left side: status + chord */}
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${isReady ? "bg-primary animate-pulse-glow" : "bg-muted-foreground"}`}
              />
              {/* Fixed-width chord display to prevent layout shift - longest chord is like "D#sus4maj796" */}
              <div className="synth-display-text text-base font-display font-bold w-[110px]">
                {currentChord || "—"}
              </div>
              {/* Stacked info */}
              <div className="flex gap-3 text-[9px] font-mono leading-tight">
                <div className="flex flex-col gap-0">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">KEY</span>
                    <span className="synth-display-text">
                      {NOTE_NAMES[keyValue]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">BPM</span>
                    <span className="synth-display-text">{bpm}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-0">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">SND</span>
                    <span className="synth-display-text uppercase">
                      {getPresetName()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">MODE</span>
                    <span className="synth-display-text uppercase">
                      {performanceMode}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Active notes display - inside the display panel */}
            <div className="flex items-center gap-1 font-mono text-xs min-w-[80px] justify-end">
              {activeNotes.map(({ note, mode }, i) => (
                <button
                  key={`${note}-${i}`}
                  onClick={() => handleRemoveActiveNote(note)}
                  className={`
                    cursor-pointer hover:opacity-60 active:scale-90 transition-all px-0.5
                    ${
                      mode === "poly"
                        ? "text-cyan-400"
                        : mode === "strum"
                          ? "text-amber-400"
                          : mode === "arp"
                            ? "text-fuchsia-400"
                            : "text-emerald-400"
                    }
                  `}
                  title={`Click to release ${note}`}
                >
                  {note}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Settings toggle button */}
        <button
          onClick={() => setIsControlsOpen(!isControlsOpen)}
          className={`
            synth-button p-1.5 shrink-0 transition-all
            ${isControlsOpen ? "bg-primary text-primary-foreground" : ""}
          `}
          aria-label="Toggle controls"
        >
          <svg
            className={`w-5 h-5 transition-transform ${isControlsOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {/* Pulldown controls sheet */}
      <div
        className={`
          overflow-hidden transition-all duration-300 ease-in-out shrink-0
          ${isControlsOpen ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"}
        `}
      >
        <div className="synth-panel mx-2 p-3 flex flex-col gap-3">
          {/* Top row: Dials */}
          <div className="flex items-start justify-center gap-4">
            <RotaryDial
              label="Volume"
              value={volume}
              onChange={(v) => {
                ensureAudio();
                setVolume(v);
              }}
              displayValue={`${Math.round(volume * 100)}%`}
              size="sm"
            />
            <RotaryDial
              label="Sound"
              value={sound}
              min={0}
              max={7}
              step={1}
              onChange={(v) => {
                ensureAudio();
                setSound(v);
              }}
              displayValue={getPresetName()}
              size="sm"
            />
            <RotaryDial
              label="FX"
              value={fx}
              onChange={(v) => {
                ensureAudio();
                setFx(v);
              }}
              displayValue={`${Math.round(fx * 100)}%`}
              size="sm"
            />
            <RotaryDial
              label="Key"
              value={keyValue}
              min={0}
              max={11}
              step={1}
              onChange={(v) => {
                ensureAudio();
                setKey(v);
              }}
              displayValue={NOTE_NAMES[keyValue]}
              size="sm"
            />
            <RotaryDial
              label="BPM"
              value={bpm}
              min={40}
              max={200}
              step={1}
              onChange={(v) => {
                ensureAudio();
                setBpm(v);
              }}
              displayValue={`${bpm}`}
              size="sm"
            />
            <RotaryDial
              label="Chord"
              value={chordVoicing}
              onChange={(v) => {
                ensureAudio();
                setChordVoicing(v);
              }}
              size="sm"
            />
            <RotaryDial
              label="Bass"
              value={bassVoicing}
              onChange={(v) => {
                ensureAudio();
                setBassVoicing(v);
              }}
              size="sm"
            />
          </div>

          {/* Bottom row: All button groups with labels */}
          <div className="flex items-start justify-center gap-6">
            {/* Performance modes */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">
                Performance
              </span>
              <div className="flex gap-1">
                {PERFORMANCE_MODES.map((mode) => (
                  <ModeButton
                    key={mode}
                    label={mode}
                    isActive={performanceMode === mode}
                    onClick={() => setPerformanceMode(mode)}
                    colorVariant={
                      mode === "poly"
                        ? "cyan"
                        : mode === "strum"
                          ? "amber"
                          : mode === "arp"
                            ? "fuchsia"
                            : "emerald"
                    }
                  />
                ))}
              </div>
            </div>

            {/* Chord types */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">
                Chord Type
              </span>
              <div className="flex gap-1">
                <ChordButton
                  label="Dim"
                  isActive={chordType === "dim"}
                  onClick={() => setChordType("dim")}
                />
                <ChordButton
                  label="Min"
                  isActive={chordType === "min"}
                  onClick={() => setChordType("min")}
                />
                <ChordButton
                  label="Maj"
                  isActive={chordType === "maj"}
                  onClick={() => setChordType("maj")}
                />
                <ChordButton
                  label="Sus"
                  isActive={chordType === "sus"}
                  onClick={() => setChordType("sus")}
                />
              </div>
            </div>

            {/* Extensions */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">
                Extensions
              </span>
              <div className="flex gap-1">
                <ChordButton
                  label="6"
                  isActive={extensions.has("6")}
                  onClick={() => toggleExtension("6")}
                  variant="extension"
                />
                <ChordButton
                  label="m7"
                  isActive={extensions.has("m7")}
                  onClick={() => toggleExtension("m7")}
                  variant="extension"
                />
                <ChordButton
                  label="M7"
                  isActive={extensions.has("M7")}
                  onClick={() => toggleExtension("M7")}
                  variant="extension"
                />
                <ChordButton
                  label="9"
                  isActive={extensions.has("9")}
                  onClick={() => toggleExtension("9")}
                  variant="extension"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard takes remaining space */}
      <div className="flex-1 min-h-0 px-1 pb-1">
        <Keyboard
          onNoteOn={handleNoteOn}
          onNoteOff={handleNoteOff}
          activeNotes={pressedKeys}
          onFirstInteraction={triggerAudioInit}
        />
      </div>
    </div>
  );
}
