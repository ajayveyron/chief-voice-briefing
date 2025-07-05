import { useState, useEffect, useRef } from "react";

export const useProximitySensor = () => {
  const [isNearEar, setIsNearEar] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const orientationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const motionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Method 1: Screen visibility change (most reliable)
    const handleVisibilityChange = () => {
      if (isCallActive && document.hidden) {
        setIsNearEar(true);
      } else if (!document.hidden) {
        setIsNearEar(false);
      }
    };

    // Method 2: Device orientation detection
    const handleOrientationChange = () => {
      if (!isCallActive) return;

      const orientation = screen.orientation?.angle || window.orientation || 0;
      const isPortrait =
        Math.abs(orientation) < 45 || Math.abs(orientation) > 135;

      if (orientationTimeoutRef.current) {
        clearTimeout(orientationTimeoutRef.current);
      }

      if (isPortrait) {
        // Delay to avoid false positives
        orientationTimeoutRef.current = setTimeout(() => {
          if (isCallActive) {
            setIsNearEar(true);
          }
        }, 500);
      } else {
        setIsNearEar(false);
      }
    };

    // Method 3: Device motion detection (if available)
    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      if (!isCallActive || !event.accelerationIncludingGravity) return;

      const { x, y, z } = event.accelerationIncludingGravity;

      // Detect if device is held vertically and stable (typical ear position)
      const isVertical = Math.abs(x || 0) < 3 && Math.abs(y || 0) > 7;
      const isStable = Math.abs(z || 0) < 3;

      if (motionTimeoutRef.current) {
        clearTimeout(motionTimeoutRef.current);
      }

      if (isVertical && isStable) {
        motionTimeoutRef.current = setTimeout(() => {
          if (isCallActive) {
            setIsNearEar(true);
          }
        }, 800);
      }
    };

    // Method 4: Screen Wake Lock detection
    const handleWakeLockChange = () => {
      if (!isCallActive) return;

      // If wake lock is released, user might have moved phone to ear
      if ("wakeLock" in navigator) {
        navigator.wakeLock
          .request("screen")
          .then((wakeLock) => {
            wakeLock.addEventListener("release", () => {
              if (isCallActive) {
                setIsNearEar(true);
              }
            });
          })
          .catch(() => {
            // Wake lock not supported or denied
          });
      }
    };

    // Add event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    screen.orientation?.addEventListener("change", handleOrientationChange);
    window.addEventListener("orientationchange", handleOrientationChange);
    window.addEventListener("devicemotion", handleDeviceMotion);

    // Initialize wake lock monitoring
    handleWakeLockChange();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      screen.orientation?.removeEventListener(
        "change",
        handleOrientationChange
      );
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.removeEventListener("devicemotion", handleDeviceMotion);

      if (orientationTimeoutRef.current) {
        clearTimeout(orientationTimeoutRef.current);
      }
      if (motionTimeoutRef.current) {
        clearTimeout(motionTimeoutRef.current);
      }
    };
  }, [isCallActive]);

  // Manual control for testing
  const setCallActive = (active: boolean) => {
    setIsCallActive(active);
    if (!active) {
      setIsNearEar(false);
    }
  };

  return {
    isNearEar,
    setCallActive,
    isCallActive,
  };
};
