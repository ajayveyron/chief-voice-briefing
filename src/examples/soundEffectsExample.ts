// Example usage of SoundEffects with file-based sounds
import { SoundEffects } from "@/utils/soundEffects";

// Example 1: Basic configuration with some custom files
export const configureBasicSounds = () => {
  SoundEffects.configureSoundFiles({
    callStart: "/sounds/call-start.mp3",
    callEnd: "/sounds/call-end.mp3",
    // Other sounds will use generated tones
  });
};

// Example 2: Full custom sound set
export const configureFullCustomSounds = () => {
  SoundEffects.configureSoundFiles({
    callStart: "/sounds/call-start.mp3",
    callEnd: "/sounds/call-end.mp3",
    muteToggle: "/sounds/mute-beep.mp3",
    captionToggle: "/sounds/caption-toggle.mp3",
    volumeChange: "/sounds/volume-click.mp3",
    error: "/sounds/error-tone.mp3",
    success: "/sounds/success-chime.mp3",
    connection: "/sounds/connection-modem.mp3",
    disconnect: "/sounds/disconnect-modem.mp3",
  });
};

// Example 3: Initialize and preload sounds
export const initializeWithCustomSounds = async () => {
  // Configure custom sounds
  configureFullCustomSounds();

  // Initialize the audio context
  await SoundEffects.initialize();

  // Preload all sound files for better performance
  await SoundEffects.preloadSoundFiles();

  console.log("✅ Sound effects initialized with custom files");
};

// Example 4: Dynamic sound management
export const manageSoundsDynamically = () => {
  // Add a new sound file
  SoundEffects.configureSoundFiles({
    callStart: "/sounds/new-call-start.mp3",
  });

  // Check current configuration
  const config = SoundEffects.getSoundFileConfig();
  console.log("Current sound files:", config);

  // Check if a specific sound has a file
  if (SoundEffects.hasSoundFile("callStart")) {
    console.log("Call start has a custom file");
  }

  // Remove a sound file
  SoundEffects.removeSoundFile("callStart");

  // Clear cache if needed
  SoundEffects.clearCache();
};

// Example 5: Error handling and fallback demonstration
export const demonstrateFallback = async () => {
  // Configure a non-existent file to test fallback
  SoundEffects.configureSoundFiles({
    callStart: "/sounds/non-existent-file.mp3",
  });

  // This will fall back to generated sound
  await SoundEffects.playCallStart();

  // Remove the bad configuration
  SoundEffects.removeSoundFile("callStart");

  // Now it will use generated sound directly
  await SoundEffects.playCallStart();
};

// Example 6: Integration with React component
export const useSoundEffectsInComponent = () => {
  // This would be used in a React component
  const initializeSounds = async () => {
    try {
      await initializeWithCustomSounds();
    } catch (error) {
      console.warn(
        "Failed to initialize custom sounds, using generated sounds"
      );
      await SoundEffects.initialize();
    }
  };

  return { initializeSounds };
};

// Example 7: Different audio formats
export const configureDifferentFormats = () => {
  SoundEffects.configureSoundFiles({
    callStart: "/sounds/call-start.wav", // WAV format
    callEnd: "/sounds/call-end.ogg", // OGG format
    muteToggle: "/sounds/mute-beep.aac", // AAC format
    success: "/sounds/success-chime.mp3", // MP3 format
  });
};

// Example 8: Conditional sound configuration
export const configureConditionalSounds = (useCustomSounds: boolean) => {
  if (useCustomSounds) {
    configureFullCustomSounds();
  } else {
    // Clear any existing configuration to use generated sounds
    SoundEffects.clearCache();
    // Clear file configurations
    [
      "callStart",
      "callEnd",
      "muteToggle",
      "captionToggle",
      "volumeChange",
      "error",
      "success",
      "connection",
      "disconnect",
    ].forEach((key) => SoundEffects.removeSoundFile(key));
  }
};
