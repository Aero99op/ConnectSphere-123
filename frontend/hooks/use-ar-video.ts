"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AREngine, ARFilterId } from "@/lib/ar/ar-engine";

interface UseArVideoOptions {
  rawStream: MediaStream | null;
  enabled: boolean;
}

interface UseArVideoReturn {
  processedStream: MediaStream | null;
  activeFilter: ARFilterId;
  setFilter: (id: ARFilterId) => void;
  isReady: boolean;
}

/**
 * useArVideo - React hook for AR processing pipeline
 *
 * Takes the raw camera MediaStream, chains it through AREngine,
 * and returns a processedStream with visual filters baked in.
 * This processed stream is what gets sent over WebRTC.
 */
export function useArVideo({ rawStream, enabled }: UseArVideoOptions): UseArVideoReturn {
  const engineRef = useRef<AREngine | null>(null);
  const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
  const [activeFilter, setActiveFilter] = useState<ARFilterId>("none");
  const [isReady, setIsReady] = useState(false);

  // Start/stop engine when stream changes or enabled state changes
  useEffect(() => {
    if (!rawStream || !enabled) {
      // Teardown
      if (engineRef.current) {
        try { engineRef.current.stop(); } catch { /* ignore */ }
        engineRef.current = null;
      }
      setProcessedStream(null);
      setIsReady(false);
      return;
    }

    let active = true;

    const init = async () => {
      try {
        const engine = new AREngine(rawStream);
        engineRef.current = engine;

        // Apply current filter if restarting
        engine.setFilter(activeFilter);

        await engine.start();

        if (active) {
          setProcessedStream(engine.getProcessedStream());
          setIsReady(true);
        } else {
          engine.stop();
        }
      } catch (err) {
        console.error("[useArVideo] Engine init failed:", err);
        // Fallback: pass rawStream through unchanged
        if (active) {
          setProcessedStream(rawStream);
          setIsReady(true);
        }
      }
    };

    init();

    return () => {
      active = false;
      if (engineRef.current) {
        try { engineRef.current.stop(); } catch { /* ignore */ }
        engineRef.current = null;
      }
    };
  }, [rawStream, enabled]);

  const setFilter = useCallback((id: ARFilterId) => {
    setActiveFilter(id);
    engineRef.current?.setFilter(id);
  }, []);

  return {
    processedStream: enabled ? processedStream : rawStream,
    activeFilter,
    setFilter,
    isReady,
  };
}
