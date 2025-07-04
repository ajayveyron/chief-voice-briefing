# Sound Effects Feature

The RealtimeVoiceChief component now includes comprehensive sound effects to enhance the user experience and provide audio feedback for various interactions.

## Overview

Sound effects are generated using the Web Audio API and provide immediate audio feedback for user actions and system state changes. The system supports both procedurally generated sounds and file-based audio, with automatic fallback to generated sounds if files are not available or fail to load.

## Sound Effects Available

### Call Actions

- **Call Start**: Ascending tone (800Hz, 0.3s) - Plays when starting a conversation
- **Call End**: Descending tone (400Hz, 0.4s) - Plays when ending a conversation

### Connection States

- **Connecting**: Modem-like ascending tones (1200Hz → 800Hz → 1600Hz) - Plays when connecting to Chief
- **Connected**: Success sequence (600Hz → 800Hz → 1000Hz) - Plays when successfully connected
- **Disconnected**: Descending modem tones (1600Hz → 800Hz → 400Hz) - Plays when disconnecting

### Control Actions

- **Mute Toggle**: Short square wave beep (1200Hz, 0.15s) - Plays when toggling microphone mute
- **Caption Toggle**: Double beep sequence (600Hz → 800Hz) - Plays when toggling captions
- **Volume Change**: Soft triangle wave click (200Hz, 0.1s) - Plays when adjusting volume

### Error States

- **Error**: Descending sawtooth sequence (400Hz → 300Hz) - Plays when trying to call while not ready
- **Loading Error**: Same as error sound - Plays when attempting actions while system is loading

## Implementation Details

### SoundEffects Class

Located in `src/utils/soundEffects.ts`, this class provides:

- **Procedural sound generation** using Web Audio API
- **File-based sound loading** with automatic fallback to generated sounds
- **Automatic audio context management** with browser autoplay policy compliance
- **Volume control** for each sound effect
- **Error handling** for audio playback failures
- **Sound caching** for improved performance
- **Preloading capabilities** for file-based sounds

### Key Features

- **Browser Compatibility**: Handles suspended audio contexts and autoplay restrictions
- **Performance**: Lightweight, no external dependencies
- **Customizable**: Easy to modify frequencies, durations, and volumes
- **Non-blocking**: All sound effects are asynchronous

### Usage in RealtimeVoiceChief

The component automatically:

1. **Initializes** sound effects on mount
2. **Monitors** conversation status changes
3. **Plays appropriate sounds** for user interactions
4. **Handles errors** gracefully with fallbacks

### File-Based Sound Configuration

You can configure custom audio files for any sound effect:

```typescript
import { SoundEffects } from "@/utils/soundEffects";

// Configure sound files (optional)
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

// Preload all configured files for better performance
await SoundEffects.preloadSoundFiles();
```

**Supported Audio Formats:**

- MP3
- WAV
- OGG
- AAC
- Any format supported by the browser's Web Audio API

**Fallback Behavior:**

- If a file is not configured, the system uses procedurally generated sounds
- If a file fails to load, the system automatically falls back to generated sounds
- No errors are thrown - the system gracefully degrades

### Utility Methods

The SoundEffects class provides several utility methods for managing sound files:

```typescript
// Check current configuration
const config = SoundEffects.getSoundFileConfig();
console.log("Current sound files:", config);

// Check if a specific sound has a file
if (SoundEffects.hasSoundFile("callStart")) {
  console.log("Call start has a custom file");
}

// Remove a specific sound file
SoundEffects.removeSoundFile("callStart");

// Clear all cached sounds (useful for memory management)
SoundEffects.clearCache();

// Preload all configured files
await SoundEffects.preloadSoundFiles();
```

## Visual Indicators

The interface includes:

- **Sound Effects Enabled** indicator in the header
- **Animated dots** showing sound system is active
- **Visual feedback** for all interactive elements

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (with user interaction requirement)
- **Mobile browsers**: Supported with touch interaction

## Future Enhancements

Potential improvements:

- **User preference** to disable sound effects
- **Volume control** for sound effects
- **Custom sound themes**
- **Accessibility options** for hearing-impaired users

## Technical Notes

- All sounds are generated at 44.1kHz sample rate
- Volume levels are optimized for voice conversation contexts
- Audio context is automatically resumed on user interaction
- Error handling prevents crashes if audio fails to play
