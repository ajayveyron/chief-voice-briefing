// Sound effects utility for the voice chief application
export class SoundEffects {
  private static audioContext: AudioContext | null = null;
  private static sounds: Map<string, AudioBuffer> = new Map();
  private static soundFiles: Map<string, string> = new Map();

  // Configure sound file paths (optional)
  static configureSoundFiles(config: {
    callStart?: string;
    callEnd?: string;
    muteToggle?: string;
    captionToggle?: string;
    volumeChange?: string;
    error?: string;
    success?: string;
    connection?: string;
    disconnect?: string;
  }) {
    Object.entries(config).forEach(([key, filePath]) => {
      if (filePath) {
        this.soundFiles.set(key, filePath);
      }
    });
  }

  // Initialize audio context
  private static async getAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    // Resume audio context if it's suspended (required for autoplay policies)
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    return this.audioContext;
  }

  // Generate simple sound effects using Web Audio API
  private static async generateSound(
    frequency: number,
    duration: number,
    type: OscillatorType = "sine",
    volume: number = 0.3
  ): Promise<AudioBuffer> {
    const audioContext = await this.getAudioContext();
    const buffer = audioContext.createBuffer(
      1,
      audioContext.sampleRate * duration,
      audioContext.sampleRate
    );
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < buffer.length; i++) {
      const t = i / audioContext.sampleRate;
      const envelope = Math.exp(-t * 2); // Simple decay envelope
      channelData[i] =
        Math.sin(2 * Math.PI * frequency * t) * envelope * volume;
    }

    return buffer;
  }

  // Load audio file and convert to AudioBuffer
  private static async loadAudioFile(filePath: string): Promise<AudioBuffer> {
    const audioContext = await this.getAudioContext();

    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to load audio file: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      return audioBuffer;
    } catch (error) {
      console.warn(`Failed to load audio file ${filePath}:`, error);
      throw error;
    }
  }

  // Get or create audio buffer (file-based or generated)
  private static async getAudioBuffer(
    soundKey: string,
    generateFallback: () => Promise<AudioBuffer>
  ): Promise<AudioBuffer> {
    // Check if we already have this buffer cached
    if (this.sounds.has(soundKey)) {
      return this.sounds.get(soundKey)!;
    }

    // Check if we have a file path for this sound
    const filePath = this.soundFiles.get(soundKey);

    if (filePath) {
      try {
        // Try to load the audio file
        const buffer = await this.loadAudioFile(filePath);
        this.sounds.set(soundKey, buffer);
        return buffer;
      } catch (error) {
        console.warn(`Falling back to generated sound for ${soundKey}:`, error);
        // Fall back to generated sound if file loading fails
        const buffer = await generateFallback();
        this.sounds.set(soundKey, buffer);
        return buffer;
      }
    } else {
      // No file path, use generated sound
      const buffer = await generateFallback();
      this.sounds.set(soundKey, buffer);
      return buffer;
    }
  }

  // Play a sound effect
  private static async playSound(buffer: AudioBuffer, volume: number = 0.3) {
    try {
      const audioContext = await this.getAudioContext();
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();

      source.buffer = buffer;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      source.start();
    } catch (error) {
      console.warn("Failed to play sound effect:", error);
    }
  }

  // Call start sound - ascending tone
  static async playCallStart() {
    const buffer = await this.getAudioBuffer("callStart", () =>
      this.generateSound(800, 0.3, "sine", 0.2)
    );
    await this.playSound(buffer, 0.2);
  }

  // Call end sound - descending tone
  static async playCallEnd() {
    const buffer = await this.getAudioBuffer("callEnd", () =>
      this.generateSound(400, 0.4, "sine", 0.2)
    );
    await this.playSound(buffer, 0.2);
  }

  // Mute sound - short beep
  static async playMuteToggle() {
    const buffer = await this.getAudioBuffer("muteToggle", () =>
      this.generateSound(1200, 0.15, "square", 0.15)
    );
    await this.playSound(buffer, 0.15);
  }

  // Caption toggle sound - double beep
  static async playCaptionToggle() {
    const buffer1 = await this.getAudioBuffer("captionToggle1", () =>
      this.generateSound(600, 0.1, "sine", 0.15)
    );
    const buffer2 = await this.getAudioBuffer("captionToggle2", () =>
      this.generateSound(800, 0.1, "sine", 0.15)
    );

    await this.playSound(buffer1, 0.15);
    setTimeout(async () => {
      await this.playSound(buffer2, 0.15);
    }, 120);
  }

  // Volume change sound - soft click
  static async playVolumeChange() {
    const buffer = await this.getAudioBuffer("volumeChange", () =>
      this.generateSound(200, 0.1, "triangle", 0.1)
    );
    await this.playSound(buffer, 0.1);
  }

  // Error sound - descending tone sequence
  static async playError() {
    const buffer1 = await this.getAudioBuffer("error1", () =>
      this.generateSound(400, 0.2, "sawtooth", 0.15)
    );
    const buffer2 = await this.getAudioBuffer("error2", () =>
      this.generateSound(300, 0.2, "sawtooth", 0.15)
    );

    await this.playSound(buffer1, 0.15);
    setTimeout(async () => {
      await this.playSound(buffer2, 0.15);
    }, 200);
  }

  // Success sound - ascending tone sequence
  static async playSuccess() {
    const buffer1 = await this.getAudioBuffer("success1", () =>
      this.generateSound(600, 0.15, "sine", 0.15)
    );
    const buffer2 = await this.getAudioBuffer("success2", () =>
      this.generateSound(800, 0.15, "sine", 0.15)
    );
    const buffer3 = await this.getAudioBuffer("success3", () =>
      this.generateSound(1000, 0.15, "sine", 0.15)
    );

    await this.playSound(buffer1, 0.15);
    setTimeout(async () => {
      await this.playSound(buffer2, 0.15);
    }, 150);
    setTimeout(async () => {
      await this.playSound(buffer3, 0.15);
    }, 300);
  }

  // Connection sound - modem-like tones
  static async playConnection() {
    const buffer1 = await this.getAudioBuffer("connection1", () =>
      this.generateSound(1200, 0.1, "sine", 0.1)
    );
    const buffer2 = await this.getAudioBuffer("connection2", () =>
      this.generateSound(800, 0.1, "sine", 0.1)
    );
    const buffer3 = await this.getAudioBuffer("connection3", () =>
      this.generateSound(1600, 0.1, "sine", 0.1)
    );

    await this.playSound(buffer1, 0.1);
    setTimeout(async () => {
      await this.playSound(buffer2, 0.1);
    }, 100);
    setTimeout(async () => {
      await this.playSound(buffer3, 0.1);
    }, 200);
  }

  // Disconnect sound - descending modem tones
  static async playDisconnect() {
    const buffer1 = await this.getAudioBuffer("disconnect1", () =>
      this.generateSound(1600, 0.1, "sine", 0.1)
    );
    const buffer2 = await this.getAudioBuffer("disconnect2", () =>
      this.generateSound(800, 0.1, "sine", 0.1)
    );
    const buffer3 = await this.getAudioBuffer("disconnect3", () =>
      this.generateSound(400, 0.1, "sine", 0.1)
    );

    await this.playSound(buffer1, 0.1);
    setTimeout(async () => {
      await this.playSound(buffer2, 0.1);
    }, 100);
    setTimeout(async () => {
      await this.playSound(buffer3, 0.1);
    }, 200);
  }

  // Initialize audio context on user interaction
  static async initialize() {
    try {
      await this.getAudioContext();
      console.log("✅ Sound effects initialized");
    } catch (error) {
      console.warn("Failed to initialize sound effects:", error);
    }
  }

  // Clear all cached sounds (useful for memory management)
  static clearCache() {
    this.sounds.clear();
    console.log("🗑️ Sound effects cache cleared");
  }

  // Get current sound file configuration
  static getSoundFileConfig() {
    return Object.fromEntries(this.soundFiles);
  }

  // Check if a specific sound has a file configured
  static hasSoundFile(soundKey: string): boolean {
    return this.soundFiles.has(soundKey);
  }

  // Remove a specific sound file configuration
  static removeSoundFile(soundKey: string) {
    this.soundFiles.delete(soundKey);
    this.sounds.delete(soundKey); // Also clear the cached buffer
  }

  // Preload all configured sound files
  static async preloadSoundFiles() {
    const promises = Array.from(this.soundFiles.entries()).map(
      async ([key, filePath]) => {
        try {
          const buffer = await this.loadAudioFile(filePath);
          this.sounds.set(key, buffer);
          console.log(`✅ Preloaded sound: ${key}`);
        } catch (error) {
          console.warn(`❌ Failed to preload sound ${key}:`, error);
        }
      }
    );

    await Promise.all(promises);
    console.log("🎵 Sound files preloading completed");
  }
}
