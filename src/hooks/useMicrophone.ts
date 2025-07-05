import { useState, useCallback, useRef } from "react";

export interface MicrophoneState {
  isMuted: boolean;
  isSupported: boolean;
  isInitialized: boolean;
}

export const useMicrophone = () => {
  const [micState, setMicState] = useState<MicrophoneState>({
    isMuted: false,
    isSupported: true, // Assume supported for simplicity
    isInitialized: true,
  });

  const currentStreamRef = useRef<MediaStream | null>(null);
  const mutedTracksRef = useRef<Set<MediaStreamTrack>>(new Set());

  // Store reference to current stream for muting
  const setCurrentStream = useCallback((stream: MediaStream | null) => {
    currentStreamRef.current = stream;
  }, []);

  // Mute/unmute function using MediaStreamTrack.enabled
  const toggleMute = useCallback(() => {
    if (!currentStreamRef.current) {
      console.warn("Cannot toggle mute: no active stream");
      return;
    }

    const newMutedState = !micState.isMuted;
    const audioTracks = currentStreamRef.current.getAudioTracks();

    audioTracks.forEach((track) => {
      track.enabled = !newMutedState;
      if (newMutedState) {
        mutedTracksRef.current.add(track);
      } else {
        mutedTracksRef.current.delete(track);
      }
    });

    setMicState((prev) => ({ ...prev, isMuted: newMutedState }));

    console.log(`🎤 Microphone ${newMutedState ? "muted" : "unmuted"}`);
  }, [micState.isMuted]);

  // Set mute state directly
  const setMuted = useCallback((muted: boolean) => {
    if (!currentStreamRef.current) {
      console.warn("Cannot set mute: no active stream");
      return;
    }

    const audioTracks = currentStreamRef.current.getAudioTracks();

    audioTracks.forEach((track) => {
      track.enabled = !muted;
      if (muted) {
        mutedTracksRef.current.add(track);
      } else {
        mutedTracksRef.current.delete(track);
      }
    });

    setMicState((prev) => ({ ...prev, isMuted: muted }));

    console.log(`🎤 Microphone ${muted ? "muted" : "unmuted"}`);
  }, []);

  // Reset mute state (called when starting a new call)
  const resetMute = useCallback(() => {
    setMicState((prev) => ({ ...prev, isMuted: false }));
    mutedTracksRef.current.clear();
    console.log("🎤 Microphone mute state reset");
  }, []);

  return {
    ...micState,
    toggleMute,
    setMuted,
    setCurrentStream,
    resetMute,
  };
};
