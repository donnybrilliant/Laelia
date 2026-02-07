import { useCallback, useEffect, useState, useRef } from "react";
import {
  audioEngine,
  PerformanceMode,
  PERFORMANCE_MODES,
  NOTE_NAMES,
} from "@/lib/audioEngine";
import { RotaryDial } from "./RotaryDial";
import { ChordButton } from "./ChordButton";
import { Keyboard } from "./Keyboard";
import { Display } from "./Display";
import { ModeButton } from "./ModeButton";
import { Visualizer } from "./Visualizer";
import { LandscapeLayout } from "./LandscapeLayout";
import { useLandscapeMobile } from "@/hooks/use-landscape-mobile";

export function LaeliaSynth() {
  const isLandscapeMobile = useLandscapeMobile();
  const [isReady, setIsReady] = useState(false);
  const [currentChord, setCurrentChord] = useState("");
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set()); // Keyboard keys currently pressed
  const [activeNotes, setActiveNotes] = useState<
    Array<{ note: string; mode: PerformanceMode }>
  >([]);
  const pollRef = useRef<number | null>(null);
  /** Track whether we've started initializing audio (to avoid multiple init calls) */
  const initStartedRef = useRef(false);

  const [volume, setVolume] = useState(0.7);
  const [sound, setSound] = useState(0);
  const [fx, setFx] = useState(0.3);
  const [key, setKey] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [chordVoicing, setChordVoicing] = useState(0);
  const [bassVoicing, setBassVoicing] = useState(0);
  const [performanceMode, setPerformanceMode] =
    useState<PerformanceMode>("poly");
  const [chordType, setChordType] = useState<"maj" | "min" | "dim" | "sus">(
    "maj",
  );
  const [extensions, setExtensions] = useState<Set<"6" | "m7" | "M7" | "9">>(
    new Set(),
  );

  const unlockAudio = useCallback(() => audioEngine.unlockAudio(), []);

  const ensureAudio = useCallback(async () => {
    unlockAudio();
    if (!isReady) {
      const success = await audioEngine.ensureReady();
      if (success) setIsReady(true);
      return success;
    }
    return true;
  }, [isReady, unlockAudio]);

  // Eagerly initialize audio on first user interaction with the page
  // This ensures audio is ready before keyboard keys are pressed
  useEffect(() => {
    const initOnInteraction = () => {
      if (initStartedRef.current) return;
      initStartedRef.current = true;
      ensureAudio();
      // Remove listeners once init has started
      document.removeEventListener("pointerdown", initOnInteraction);
      document.removeEventListener("keydown", initOnInteraction);
    };
    document.addEventListener("pointerdown", initOnInteraction, { once: true });
    document.addEventListener("keydown", initOnInteraction, { once: true });
    return () => {
      document.removeEventListener("pointerdown", initOnInteraction);
      document.removeEventListener("keydown", initOnInteraction);
    };
  }, [ensureAudio]);

  const toggleExtension = (ext: "6" | "m7" | "M7" | "9") => {
    setExtensions((prev) => {
      const next = new Set(prev);
      if (next.has(ext)) next.delete(ext);
      else next.add(ext);
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "1") setChordType("dim");
      if (e.key === "2") setChordType("min");
      if (e.key === "3") setChordType("maj");
      if (e.key === "4") setChordType("sus");
      if (e.key === "5") toggleExtension("6");
      if (e.key === "6") toggleExtension("m7");
      if (e.key === "7") toggleExtension("M7");
      if (e.key === "8") toggleExtension("9");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isReady) audioEngine.updateVolume(volume);
  }, [volume, isReady]);
  useEffect(() => {
    if (isReady) audioEngine.updateSound(sound);
  }, [sound, isReady]);
  useEffect(() => {
    if (isReady) audioEngine.updateFx(fx);
  }, [fx, isReady]);
  useEffect(() => {
    if (isReady) audioEngine.updateBpm(bpm);
  }, [bpm, isReady]);
  useEffect(() => {
    if (isReady) audioEngine.state.key = key;
  }, [key, isReady]);
  useEffect(() => {
    if (isReady) audioEngine.state.chordVoicing = chordVoicing;
  }, [chordVoicing, isReady]);
  useEffect(() => {
    if (isReady) audioEngine.state.bassVoicing = bassVoicing;
  }, [bassVoicing, isReady]);
  useEffect(() => {
    if (isReady) audioEngine.setChordType(chordType);
  }, [chordType, isReady]);
  useEffect(() => {
    if (isReady) audioEngine.state.extensions = extensions;
  }, [extensions, isReady]);
  useEffect(() => {
    if (isReady) audioEngine.setPerformanceMode(performanceMode);
  }, [performanceMode, isReady]);

  useEffect(() => {
    if (!isReady) return;
    const poll = () => {
      setActiveNotes(audioEngine.getActiveNotes());
      pollRef.current = requestAnimationFrame(poll);
    };
    pollRef.current = requestAnimationFrame(poll);
    return () => {
      if (pollRef.current) cancelAnimationFrame(pollRef.current);
    };
  }, [isReady]);

  useEffect(
    () => () => {
      audioEngine.dispose();
    },
    [],
  );

  const handleNoteOn = useCallback(
    (note: number) => {
      // Start init if not already (in case user somehow bypassed the document listener)
      if (!initStartedRef.current) {
        initStartedRef.current = true;
        ensureAudio();
      }
      // Only play if audio engine is ready - this avoids race conditions
      // If not ready yet, we simply don't play (user can press again once ready)
      if (!isReady) return;
      
      const chordName = audioEngine.playNote(note);
      setCurrentChord(chordName);
      setPressedKeys((prev) => new Set(prev).add(note));
    },
    [ensureAudio, isReady],
  );

  const handleNoteOff = useCallback((note: number) => {
    audioEngine.releaseNote(note);
    setPressedKeys((prev) => {
      const next = new Set(prev);
      next.delete(note);
      if (next.size === 0) setCurrentChord("");
      return next;
    });
  }, []);

  const handleRemoveActiveNote = useCallback((note: string) => {
    audioEngine.releaseSpecificNote(note);
  }, []);

  // Landscape mobile layout - optimized for horizontal phone orientation
  if (isLandscapeMobile) {
    return (
      <LandscapeLayout
        isReady={isReady}
        currentChord={currentChord}
        pressedKeys={pressedKeys}
        activeNotes={activeNotes}
        handleRemoveActiveNote={handleRemoveActiveNote}
        volume={volume}
        setVolume={setVolume}
        sound={sound}
        setSound={setSound}
        fx={fx}
        setFx={setFx}
        keyValue={key}
        setKey={setKey}
        bpm={bpm}
        setBpm={setBpm}
        chordVoicing={chordVoicing}
        setChordVoicing={setChordVoicing}
        bassVoicing={bassVoicing}
        setBassVoicing={setBassVoicing}
        performanceMode={performanceMode}
        setPerformanceMode={setPerformanceMode}
        chordType={chordType}
        setChordType={setChordType}
        extensions={extensions}
        toggleExtension={toggleExtension}
        ensureAudio={ensureAudio}
        handleNoteOn={handleNoteOn}
        handleNoteOff={handleNoteOff}
        getPresetName={() => audioEngine.getPresetName()}
      />
    );
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-2 sm:p-4 overflow-auto">
      <div className="synth-panel w-full max-w-4xl flex flex-col p-3 sm:p-4 md:p-6 gap-3 sm:gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isReady ? "bg-primary animate-pulse-glow" : "bg-muted-foreground"}`}
            />
            <h1 className="font-display text-lg sm:text-xl font-bold tracking-wider text-foreground">
              LAELIA
            </h1>
          </div>
          {activeNotes.length > 0 && (
            <div className="flex items-center gap-1.5 font-mono text-xs">
              {activeNotes.map(({ note, mode }, i) => (
                <button
                  key={`${note}-${i}`}
                  onClick={() => handleRemoveActiveNote(note)}
                  className={`cursor-pointer hover:opacity-60 active:scale-90 transition-all ${
                    mode === "poly"
                      ? "text-cyan-400"
                      : mode === "strum"
                        ? "text-amber-400"
                        : mode === "arp"
                          ? "text-fuchsia-400"
                          : "text-emerald-400"
                  }`}
                  title={`Click to release ${note}`}
                >
                  {note}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="relative min-h-[100px]">
            <Display
              chord={currentChord}
              keyName={NOTE_NAMES[key]}
              bpm={bpm}
              sound={isReady ? audioEngine.getPresetName() : "Piano"}
              mode={performanceMode}
            />
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg opacity-60">
              <Visualizer 
                isActive={isReady} 
                hasActiveNotes={activeNotes.length > 0}
                performanceMode={performanceMode}
              />
            </div>
          </div>

          <div className="flex items-center justify-around gap-2 flex-wrap">
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
              displayValue={isReady ? audioEngine.getPresetName() : "Piano"}
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
              value={key}
              min={0}
              max={11}
              step={1}
              onChange={(v) => {
                ensureAudio();
                setKey(v);
              }}
              displayValue={NOTE_NAMES[key]}
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">
                Performance
              </span>
              <div className="grid grid-cols-4 gap-1">
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
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">
                Chord Type (1-4)
              </span>
              <div className="grid grid-cols-4 gap-1">
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
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">
                Extensions (5-8)
              </span>
              <div className="grid grid-cols-4 gap-1">
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

          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">
              Keyboard (Z–, keys)
            </span>
            <div className="flex gap-4 items-stretch">
              <div className="flex flex-col justify-center gap-4">
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
              <div className="flex-1 h-36 sm:h-44 md:h-52">
                <Keyboard
                  onNoteOn={handleNoteOn}
                  onNoteOff={handleNoteOff}
                  activeNotes={pressedKeys}
                />
              </div>
            </div>
          </div>
        </div>

        <footer className="flex flex-col items-center gap-1.5 text-[10px] text-muted-foreground font-mono text-center">
          <p>
            Inspired by{" "}
            <span className="text-foreground">Telepathic Instruments</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
