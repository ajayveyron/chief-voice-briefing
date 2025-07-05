import { useState, useEffect, useRef, useCallback } from "react";

export type AudioRoute = "earpiece" | "speaker";

export const useAudioRouting = () => {
  const [audioRoute, setAudioRoute] = useState<AudioRoute>("earpiece");
  const [isInitialized, setIsInitialized] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentStreamRef = useRef<MediaStream | null>(null);

  // Initialize audio context
  useEffect(() => {
    const initializeAudioContext = async () => {
      try {
        audioContextRef.current = new AudioContext();
        setIsInitialized(true);
      } catch (error) {
        console.warn("AudioContext initialization failed:", error);
      }
    };

    initializeAudioContext();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Get audio constraints based on route
  const getAudioConstraints = (route: AudioRoute): MediaStreamConstraints => {
    const baseConstraints = {
      audio: {
        sampleRate: 24000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };

    if (route === "earpiece") {
      return {
        audio: {
          ...baseConstraints.audio,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Mobile browsers may support earpiece routing
          ...(navigator.mediaDevices.getSupportedConstraints().facingMode && {
            facingMode: "user",
          }),
        },
      };
    } else {
      // Speaker mode
      return {
        audio: {
          ...baseConstraints.audio,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...(navigator.mediaDevices.getSupportedConstraints().facingMode && {
            facingMode: "environment",
          }),
        },
      };
    }
  };

  // Apply audio routing
  const applyAudioRouting = useCallback(
    async (route: AudioRoute) => {
      if (!isInitialized) return;

      try {
        // For web browsers, we can't directly control hardware routing
        // but we can adjust audio processing parameters
        const constraints = getAudioConstraints(route);

        // If we have an active stream, we need to update it
        if (currentStreamRef.current) {
          // Stop current stream
          currentStreamRef.current.getTracks().forEach((track) => track.stop());
        }

        // Get new stream with updated constraints
        const newStream = await navigator.mediaDevices.getUserMedia(
          constraints
        );
        currentStreamRef.current = newStream;

        // Apply audio context settings
        if (audioContextRef.current) {
          const gainNode = audioContextRef.current.createGain();

          if (route === "speaker") {
            gainNode.gain.value = 1.2; // Boost volume for speaker
          } else {
            gainNode.gain.value = 0.8; // Lower volume for earpiece
          }
        }

        console.log(`Audio routing switched to: ${route}`);
      } catch (error) {
        console.error("Failed to apply audio routing:", error);
      }
    },
    [isInitialized]
  );

  const switchToEarpiece = async () => {
    setAudioRoute("earpiece");
    await applyAudioRouting("earpiece");
  };

  const switchToSpeaker = async () => {
    setAudioRoute("speaker");
    await applyAudioRouting("speaker");
  };

  const toggleAudioRoute = async () => {
    const newRoute = audioRoute === "earpiece" ? "speaker" : "earpiece";
    if (newRoute === "speaker") {
      await switchToSpeaker();
    } else {
      await switchToEarpiece();
    }
  };

  // Auto-apply current route when initialized
  useEffect(() => {
    if (isInitialized) {
      applyAudioRouting(audioRoute);
    }
  }, [isInitialized, audioRoute, applyAudioRouting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    audioRoute,
    isInitialized,
    switchToEarpiece,
    switchToSpeaker,
    toggleAudioRoute,
    setAudioRoute,
  };
};
