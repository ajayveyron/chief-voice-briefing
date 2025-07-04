import { useState, useEffect } from "react";

export interface UseCallTimerReturn {
  callDuration: number;
  isCallActive: boolean;
  setIsCallActive: (active: boolean) => void;
  formatTime: (seconds: number) => string;
  resetTimer: () => void;
}

export const useCallTimer = (): UseCallTimerReturn => {
  const [callDuration, setCallDuration] = useState(0);
  const [isCallActive, setIsCallActive] = useState(false);

  // Timer effect for call duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCallActive) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCallActive]);

  // Format timer display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const resetTimer = () => {
    setCallDuration(0);
  };

  return {
    callDuration,
    isCallActive,
    setIsCallActive,
    formatTime,
    resetTimer,
  };
};
