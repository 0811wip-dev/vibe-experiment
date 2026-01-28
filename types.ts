
export interface NoteStep {
  step: number;
  trigger: boolean;
  note?: string; // e.g., "C2", "F#4"
  velocity?: number; // 0-1
  duration?: string; // "8n", "16n"
}

export interface TrackData {
  bpm: number;
  key: string;
  mood: string;
  visualSummary: string;
  soundEffect?: 'cat' | 'dog' | 'bird' | 'water' | 'thunder' | 'traffic' | 'wind' | 'machinery' | 'people' | 'none';
  synthSettings: {
    waveform: 'sawtooth' | 'square' | 'sine' | 'triangle';
    cutoff: number; // 100 - 10000 Hz
    resonance: number; // 0 - 20
    attack: number;
    decay: number;
  };
  bassSettings: {
    waveform: 'sawtooth' | 'square' | 'sine' | 'triangle';
    filterFreq: number;
  };
  drumSettings: {
    kickPunch: number; // 0-1
    hatBright: number; // 0-1
  };
  sequences: {
    kick: boolean[]; // 16 steps
    hat: boolean[]; // 16 steps
    bass: (string | null)[]; // 16 steps, note names or null
    lead: (string | null)[]; // 16 steps
    sfx: boolean[]; // 16 steps for the sound effect trigger
    custom?: boolean[]; // 16 steps for the user uploaded sample rhythm
  };
}

export enum AppState {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  ANALYZING = 'ANALYZING',
  PLAYING = 'PLAYING',
  ERROR = 'ERROR'
}