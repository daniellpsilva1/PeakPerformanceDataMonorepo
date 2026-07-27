import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createTourState,
  getCurrentStop,
  goToStop,
  isStopAvailable,
  nextStop,
  prevStop,
  stopHasData,
  TOUR_STOPS,
  type TourState,
} from "@bodyviz/core";
import { demoAthlete, demoSnapshots } from "@bodyviz/data";
import {
  BodyCanvas,
  BodyTwin,
  DayScrubber,
  FallbackSilhouette,
  SystemSpotlight,
  TourControls,
  usePrefersReducedMotion,
  useWebGLSupport,
} from "@bodyviz/react";
import { colorPrimitives } from "@bodyviz/tokens";

export function App() {
  const [tourState, setTourState] = useState<TourState>(createTourState());
  const [dayIndex, setDayIndex] = useState(demoSnapshots.length - 1);

  const { supported: webglSupported, loading: webglLoading } =
    useWebGLSupport();
  const reducedMotion = usePrefersReducedMotion();

  const currentStop = getCurrentStop(tourState);
  const currentSnapshot = demoSnapshots[dayIndex]!;
  const useFallback = !webglSupported || reducedMotion;

  const available = isStopAvailable(
    currentStop.id,
    demoAthlete.provider,
  );
  const hasData = stopHasData(currentStop.id, currentSnapshot);

  const handleNext = useCallback(
    () => setTourState((s) => nextStop(s)),
    [],
  );
  const handlePrev = useCallback(
    () => setTourState((s) => prevStop(s)),
    [],
  );
  const handlePlayPause = useCallback(
    () => setTourState((s) => ({ ...s, isPlaying: !s.isPlaying })),
    [],
  );
  const handleSelectStop = useCallback(
    (stop: number) => setTourState((s) => goToStop(s, stop)),
    [],
  );

  useEffect(() => {
    if (!tourState.isPlaying) return;
    const timer = setInterval(() => {
      setTourState((s) => nextStop(s));
    }, 4000);
    return () => clearInterval(timer);
  }, [tourState.isPlaying]);

  const activeSystem = available && hasData ? currentStop.id : null;

  const brandMark = useMemo(
    () => (
      <div style={brandMarkStyle}>
        <svg
          height="20"
          viewBox="0 0 24 24"
          width="20"
        >
          <circle
            cx="12"
            cy="12"
            fill="none"
            r="10"
            stroke={colorPrimitives.primaryBright}
            strokeWidth="1.5"
          />
          <path
            d="M7 16 L12 6 L17 16 Z"
            fill="none"
            stroke={colorPrimitives.accent}
            strokeWidth="1.5"
          />
        </svg>
        <span style={brandTextStyle}>Peak Performance Data</span>
      </div>
    ),
    [],
  );

  return (
    <div style={rootStyle}>
      {/* Brand mark top-left */}
      <div style={topBarStyle}>
        {brandMark}
        <span style={athleteNameStyle}>{demoAthlete.firstName}</span>
      </div>

      {/* 3D scene or fallback */}
      <div style={sceneContainerStyle}>
        {webglLoading ? (
          <div style={loadingStyle}>Loading…</div>
        ) : useFallback ? (
          <FallbackSilhouette
            activeSystem={activeSystem}
            snapshot={currentSnapshot}
            tourStop={currentStop}
          />
        ) : (
          <BodyCanvas>
            <BodyTwin
              activeSystem={activeSystem}
              reducedMotion={reducedMotion}
              snapshot={currentSnapshot}
              tourStop={currentStop}
            />
          </BodyCanvas>
        )}
      </div>

      {/* System spotlight top-right */}
      <div style={spotlightContainerStyle}>
        <SystemSpotlight
          provider={demoAthlete.provider}
          snapshot={currentSnapshot}
          stop={currentStop}
        />
      </div>

      {/* Tour controls bottom-left */}
      <TourControls
        currentStop={tourState.currentStop}
        isPlaying={tourState.isPlaying}
        onNext={handleNext}
        onPlayPause={handlePlayPause}
        onPrev={handlePrev}
        onSelect={handleSelectStop}
      />

      {/* Day scrubber bottom-center */}
      <DayScrubber
        onSelect={setDayIndex}
        selectedIndex={dayIndex}
        snapshots={demoSnapshots}
      />
    </div>
  );
}

const rootStyle: React.CSSProperties = {
  background: colorPrimitives.navy900,
  height: "100vh",
  overflow: "hidden",
  position: "relative",
  width: "100vw",
};

const topBarStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: "16px",
  left: "24px",
  position: "absolute",
  top: "24px",
  zIndex: 10,
};

const brandMarkStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: "8px",
};

const brandTextStyle: React.CSSProperties = {
  color: colorPrimitives.ink,
  fontFamily: "Barlow Condensed, Arial Narrow, sans-serif",
  fontSize: "16px",
  fontWeight: 700,
  letterSpacing: "0.5px",
  textTransform: "uppercase",
};

const athleteNameStyle: React.CSSProperties = {
  color: colorPrimitives.inkMuted,
  fontFamily: "Inter, Helvetica Neue, Arial, sans-serif",
  fontSize: "14px",
  fontWeight: 500,
};

const sceneContainerStyle: React.CSSProperties = {
  height: "100%",
  left: 0,
  position: "absolute",
  top: 0,
  width: "100%",
};

const spotlightContainerStyle: React.CSSProperties = {
  maxWidth: "400px",
  position: "absolute",
  right: "24px",
  top: "24px",
  zIndex: 10,
};

const loadingStyle: React.CSSProperties = {
  alignItems: "center",
  color: colorPrimitives.inkMuted,
  display: "flex",
  fontFamily: "Inter, Helvetica Neue, Arial, sans-serif",
  fontSize: "14px",
  height: "100%",
  justifyContent: "center",
  width: "100%",
};
