"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Browser speech-to-text (th-TH). A stand-in for the engine ADR-008 will choose.
 * Press-and-hold: start() on pointer down, stop() on pointer up; onFinal gets the whole utterance.
 */
export function useSpeech(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const rec = useRef<Recognition | null>(null);
  const buffer = useRef("");
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => setSupported(getCtor() !== null), []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = "th-TH";
    r.interimResults = true;
    r.continuous = true;
    buffer.current = "";
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) buffer.current += res[0].transcript;
        else live += res[0].transcript;
      }
      setInterim(buffer.current + live);
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
      setInterim("");
      if (buffer.current.trim()) cb.current(buffer.current);
    };
    r.onerror = () => r.stop();
    rec.current = r;
    r.start();
    setListening(true);
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { supported, listening, interim, start, stop };
}
