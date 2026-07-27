"use client";

import { useEffect, useState } from "react";

export interface WebGLGateResult {
  supported: boolean;
  loading: boolean;
}

/**
 * Probe WebGL support and prefers-reduced-motion before rendering 3D.
 * Returns loading=true until the probe completes.
 */
export function useWebGLSupport(): WebGLGateResult {
  const [state, setState] = useState<WebGLGateResult>({
    supported: false,
    loading: true,
  });

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");
      setState({ supported: !!gl, loading: false });
    } catch {
      setState({ supported: false, loading: false });
    }
  }, []);

  return state;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);

    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}
