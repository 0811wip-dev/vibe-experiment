import { TrackData } from "../types";

// Note to Frequency map
const NOTE_FREQS: { [key: string]: number } = {
  "C1": 32.70, "C#1": 34.65, "D1": 36.71, "D#1": 38.89, "E1": 41.20, "F1": 43.65, "F#1": 46.25, "G1": 49.00, "G#1": 51.91, "A1": 55.00, "A#1": 58.27, "B1": 61.74,
  "C2": 65.41, "C#2": 69.30, "D2": 73.42, "D#2": 77.78, "E2": 82.41, "F2": 87.31, "F#2": 92.50, "G2": 98.00, "G#2": 103.83, "A2": 110.00, "A#2": 116.54, "B2": 123.47,
  "C3": 130.81, "C#3": 138.59, "D3": 146.83, "D#3": 155.56, "E3": 164.81, "F3": 174.61, "F#3": 185.00, "G3": 196.00, "G#3": 207.65, "A3": 220.00, "A#3": 233.08, "B3": 246.94,
  "C4": 261.63, "C#4": 277.18, "D4": 293.66, "D#4": 311.13, "E4": 329.63, "F4": 349.23, "F#4": 369.99, "G4": 392.00, "G#4": 415.30, "A4": 440.00, "A#4": 466.16, "B4": 493.88,
  "C5": 523.25, "C#5": 554.37, "D5": 587.33, "D#5": 622.25, "E5": 659.25, "F5": 698.46, "F#5": 739.99, "G5": 783.99, "G#5": 830.61, "A5": 880.00, "A#5": 932.33, "B5": 987.77
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null; 
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  
  // FX Sends
  private reverbNode: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;
  
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delaySend: GainNode | null = null;

  private distortionNode: WaveShaperNode | null = null;
  private distortionSend: GainNode | null = null;

  private nextNoteTime: number = 0;
  private currentStep: number = 0;
  private timerID: number | undefined;
  private isPlaying: boolean = false;
  private trackData: TrackData | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private recordedChunks: BlobPart[] = [];
  
  // Custom Sample
  private customBuffer: AudioBuffer | null = null;
  private isCustomMuted: boolean = false;

  // Real-time Modifiers
  private tempoModifier: number = 1.0;
  private bassDistortionActive: boolean = false;

  // Callbacks
  public onStep: ((step: number) => void) | null = null;

  constructor() {
    // Lazy init
  }

  public async init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;

      // Master Filter (Low Pass)
      this.masterFilter = this.ctx.createBiquadFilter();
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.value = 22000;
      this.masterFilter.Q.value = 1;

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.ratio.value = 6;
      
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      
      this.dest = this.ctx.createMediaStreamDestination();
      
      // --- FX SETUP ---
      
      // 1. Reverb (Convolver)
      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = this.createImpulseResponse(2.0, 2.0); // 2 seconds reverb
      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = 0; // Dry by default

      // 2. Delay
      this.delayNode = this.ctx.createDelay();
      this.delayNode.delayTime.value = 0.375; // Dotted 8th approx at 120bpm
      this.delayFeedback = this.ctx.createGain();
      this.delayFeedback.gain.value = 0.6;
      this.delaySend = this.ctx.createGain();
      this.delaySend.gain.value = 0; // Dry by default
      
      this.delayNode.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode);

      // 3. Distortion
      this.distortionNode = this.ctx.createWaveShaper();
      this.distortionNode.curve = this.makeDistortionCurve(400);
      this.distortionSend = this.ctx.createGain();
      this.distortionSend.gain.value = 0; // Dry by default

      // --- ROUTING ---
      
      // Master Gain -> Filter -> Compressor -> Analyser -> Out
      this.masterGain.connect(this.masterFilter);
      this.masterFilter.connect(this.compressor);
      
      // FX Routing (Parallel)
      // Signal flows from MasterFilter -> FX Sends -> FX Nodes -> Compressor (to glue it back)
      this.masterFilter.connect(this.reverbSend);
      this.reverbSend.connect(this.reverbNode);
      this.reverbNode.connect(this.compressor);

      this.masterFilter.connect(this.delaySend);
      this.delaySend.connect(this.delayNode);
      this.delayNode.connect(this.compressor);

      this.masterFilter.connect(this.distortionSend);
      this.distortionSend.connect(this.distortionNode);
      this.distortionNode.connect(this.compressor);

      this.compressor.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.compressor.connect(this.dest);
    }
    
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // Utility to create reverb impulse
  private createImpulseResponse(duration: number, decay: number) {
      if (!this.ctx) return null;
      const length = this.ctx.sampleRate * duration;
      const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      for (let i = 0; i < length; i++) {
        const n = length - i;
        const multi = Math.pow(n / length, decay);
        left[i] = (Math.random() * 2 - 1) * multi;
        right[i] = (Math.random() * 2 - 1) * multi;
      }
      return impulse;
  }

  // Utility for distortion curve
  private makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50,
      n_samples = 44100,
      curve = new Float32Array(n_samples),
      deg = Math.PI / 180;
    let x;
    for (let i = 0; i < n_samples; ++i) {
      x = i * 2 / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public async loadCustomSample(arrayBuffer: ArrayBuffer) {
      if (!this.ctx) await this.init();
      if (!this.ctx) return;
      try {
          this.customBuffer = await this.ctx.decodeAudioData(arrayBuffer);
          this.isCustomMuted = false;
      } catch (error) {
          console.error("Failed to decode custom audio:", error);
      }
  }

  public muteCustomTrack(mute: boolean) {
      this.isCustomMuted = mute;
  }

  public loadTrack(data: TrackData) {
    this.trackData = data;
    this.currentStep = 0;
  }

  public play() {
    if (!this.ctx || !this.trackData) return;
    this.isPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.scheduler();
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerID) window.clearTimeout(this.timerID);
  }

  public startRecording() {
    if (!this.dest) return;
    this.recordedChunks = [];
    const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
      ? { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 320000 } 
      : undefined;
    this.mediaRecorder = new MediaRecorder(this.dest.stream, options);
    this.mediaRecorder.ondataavailable = (evt) => {
      if (evt.data.size > 0) this.recordedChunks.push(evt.data);
    };
    this.mediaRecorder.start();
  }

  public stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) return resolve(new Blob());
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  // --- REAL-TIME MODIFIERS ---

  public setVolume(level: number) {
      if (this.masterGain && this.ctx) {
          // Smooth volume transition
          this.masterGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.1);
      }
  }

  public setTempoModifier(modifier: number) {
      // Clamp reasonable values (e.g., 0.5x to 2.0x)
      this.tempoModifier = Math.max(0.5, Math.min(2.0, modifier));
  }

  public setBassDistortion(active: boolean) {
      this.bassDistortionActive = active;
  }

  // --- GESTURE EFFECTS ---

  public triggerGestureFX(effectName: string) {
    if (!this.ctx) return;
    const time = this.ctx.currentTime;
    
    switch (effectName) {
      case 'reverb': // Handwave
        this.triggerReverb(time);
        break;
      case 'filter': // Closed Fist
        this.triggerLowPass(time);
        break;
      case 'distortion': // Pinch
        this.triggerDistortion(time);
        break;
      case 'delay': // Open Palm
        this.triggerDelay(time);
        break;
    }
  }

  public triggerCowbell() {
    if (!this.ctx || !this.masterGain) return;
    const time = this.ctx.currentTime;
    
    // 808 Cowbell approximation
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'square'; osc2.type = 'square';
    osc1.frequency.value = 540;
    osc2.frequency.value = 800;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200; // Adjusted for snappy sound
    filter.Q.value = 2; // Resonance creates the character

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    osc1.connect(filter); osc2.connect(filter);
    filter.connect(gain); gain.connect(this.masterGain);

    osc1.start(time); osc2.start(time);
    osc1.stop(time + 0.2); osc2.stop(time + 0.2);
  }

  private triggerReverb(time: number) {
      if (!this.reverbSend) return;
      // Wash the track in reverb
      this.reverbSend.gain.cancelScheduledValues(time);
      this.reverbSend.gain.setValueAtTime(this.reverbSend.gain.value, time);
      this.reverbSend.gain.linearRampToValueAtTime(1.0, time + 0.1);
      this.reverbSend.gain.exponentialRampToValueAtTime(0.01, time + 2.0);
  }

  private triggerLowPass(time: number) {
      if (!this.masterFilter) return;
      // Muffle the sound (Low Pass Filter)
      this.masterFilter.frequency.cancelScheduledValues(time);
      this.masterFilter.frequency.setValueAtTime(this.masterFilter.frequency.value, time);
      this.masterFilter.frequency.exponentialRampToValueAtTime(100, time + 0.2); // Sweep down
      this.masterFilter.frequency.exponentialRampToValueAtTime(22000, time + 1.5); // Sweep up
  }

  private triggerDistortion(time: number) {
      if (!this.distortionSend) return;
      // Crunch the sound
      this.distortionSend.gain.cancelScheduledValues(time);
      this.distortionSend.gain.setValueAtTime(this.distortionSend.gain.value, time);
      this.distortionSend.gain.linearRampToValueAtTime(0.8, time + 0.1);
      this.distortionSend.gain.linearRampToValueAtTime(0, time + 0.5);
  }

  private triggerDelay(time: number) {
      if (!this.delaySend) return;
      // Dub delay throw
      this.delaySend.gain.cancelScheduledValues(time);
      this.delaySend.gain.setValueAtTime(this.delaySend.gain.value, time);
      this.delaySend.gain.linearRampToValueAtTime(1.0, time + 0.1);
      this.delaySend.gain.linearRampToValueAtTime(0, time + 0.4); // Quick throw
  }

  // --- SYNTHESIS ENGINE ---

  private scheduler() {
    if (!this.ctx || !this.trackData || !this.isPlaying) return;

    const lookahead = 25.0; // ms
    const scheduleAheadTime = 0.1; // s

    while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
      this.scheduleStep(this.currentStep, this.nextNoteTime);
      this.nextStep();
    }
    this.timerID = window.setTimeout(() => this.scheduler(), lookahead);
  }

  private nextStep() {
    if (!this.trackData) return;
    // Apply tempo modifier to the calculation
    const currentBpm = this.trackData.bpm * this.tempoModifier;
    const secondsPerBeat = 60.0 / currentBpm;
    this.nextNoteTime += 0.25 * secondsPerBeat;
    this.currentStep = (this.currentStep + 1) % 16;
  }

  private scheduleStep(step: number, time: number) {
    if (!this.trackData || !this.ctx || !this.masterGain) return;
    
    if (this.onStep) {
        const delay = (time - this.ctx.currentTime) * 1000;
        setTimeout(() => this.onStep!(step), Math.max(0, delay));
    }

    const { sequences, synthSettings, bassSettings, drumSettings, soundEffect } = this.trackData;

    if (sequences.kick[step]) this.triggerKick(time, drumSettings.kickPunch);
    if (sequences.hat[step]) this.triggerHat(time, drumSettings.hatBright);
    
    const bassNote = sequences.bass[step];
    if (bassNote && NOTE_FREQS[bassNote]) this.triggerBass(time, NOTE_FREQS[bassNote], bassSettings);

    const leadNote = sequences.lead[step];
    if (leadNote && NOTE_FREQS[leadNote]) this.triggerLead(time, NOTE_FREQS[leadNote], synthSettings);

    if (sequences.sfx && sequences.sfx[step] && soundEffect && soundEffect !== 'none') {
        this.triggerSFX(time, soundEffect);
    }

    const shouldTriggerCustom = sequences.custom ? sequences.custom[step] : false;
    if (this.customBuffer && shouldTriggerCustom && !this.isCustomMuted) {
        this.triggerCustomSample(time);
    }
  }

  private triggerCustomSample(time: number) {
      if (!this.ctx || !this.masterGain || !this.customBuffer || this.isCustomMuted) return;
      const source = this.ctx.createBufferSource();
      source.buffer = this.customBuffer;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.7;
      source.connect(gain);
      gain.connect(this.masterGain);
      source.start(time);
  }

  private triggerSFX(time: number, type: string) {
      if (!this.ctx || !this.masterGain) return;
      switch(type) {
          case 'cat': this.synthesizeMeow(time); break;
          case 'dog': this.synthesizeBark(time); break;
          case 'bird': this.synthesizeChirp(time); break;
          case 'thunder': this.synthesizeThunder(time); break;
          case 'water': this.synthesizeWater(time); break;
          case 'traffic': this.synthesizeTraffic(time); break;
          case 'wind': this.synthesizeWind(time); break;
          case 'machinery': this.synthesizeMachinery(time); break;
          case 'people': this.synthesizePeople(time); break;
      }
  }

  // --- SYNTH HELPERS ---

  private synthesizePeople(time: number) {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 4.0;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Pink Noise
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        data[i] *= 0.11; 
        b6 = white * 0.115926;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter1 = this.ctx.createBiquadFilter();
    filter1.type = 'bandpass'; filter1.frequency.setValueAtTime(400, time); filter1.Q.value = 4;
    const filter2 = this.ctx.createBiquadFilter();
    filter2.type = 'bandpass'; filter2.frequency.setValueAtTime(850, time); filter2.Q.value = 5;

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 2.5; 
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 150; 
    lfo.connect(lfoGain);
    lfoGain.connect(filter1.frequency);
    lfoGain.connect(filter2.frequency);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0, time);
    noiseGain.gain.linearRampToValueAtTime(0.4, time + 0.5);
    noiseGain.gain.linearRampToValueAtTime(0, time + 3.8);

    noise.connect(filter1); noise.connect(filter2);
    filter1.connect(noiseGain); filter2.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    
    noise.start(time); lfo.start(time); lfo.stop(time + 4.0);
  }

  private synthesizeMeow(time: number) {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, time);
      osc.frequency.linearRampToValueAtTime(800, time + 0.15);
      osc.frequency.linearRampToValueAtTime(300, time + 0.4);
      filter.type = 'bandpass'; filter.Q.value = 5;
      filter.frequency.setValueAtTime(800, time);
      filter.frequency.linearRampToValueAtTime(1200, time + 0.15);
      filter.frequency.linearRampToValueAtTime(600, time + 0.4);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.3, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
      osc.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
      osc.start(time); osc.stop(time + 0.5);
  }

  private synthesizeBark(time: number) {
    if (!this.ctx || !this.masterGain) return;
    const triggerOne = (t: number) => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
        const bufferSize = this.ctx!.sampleRate * 0.15;
        const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx!.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx!.createBiquadFilter();
        noiseFilter.type = 'lowpass'; noiseFilter.frequency.value = 1200;
        const gain = this.ctx!.createGain();
        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain); noise.connect(noiseFilter); noiseFilter.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(t); osc.stop(t + 0.15); noise.start(t);
    };
    triggerOne(time); triggerOne(time + 0.18);
  }

  private synthesizeChirp(time: number) {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2000, time);
      osc.frequency.linearRampToValueAtTime(3000, time + 0.05);
      osc.frequency.linearRampToValueAtTime(1500, time + 0.1);
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
      osc.connect(gain); gain.connect(this.masterGain);
      osc.start(time); osc.stop(time + 0.15);
  }

  private synthesizeThunder(time: number) {
      this.synthesizeNoiseBurst(time, 'lowpass', 150, 1.5, 0.4);
  }
  
  private synthesizeWater(time: number) {
       this.synthesizeNoiseBurst(time, 'bandpass', 600, 0.3, 0.15);
  }

  private synthesizeWind(time: number) {
      this.synthesizeNoiseBurst(time, 'lowpass', 400, 1.0, 0.2);
  }

  private synthesizeMachinery(time: number) {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const fm = this.ctx.createOscillator();
      const fmGain = this.ctx.createGain();
      const gain = this.ctx.createGain();
      osc.type = 'square'; osc.frequency.value = 110;
      fm.frequency.value = 500; fm.type = 'sawtooth'; fmGain.gain.value = 300;
      fm.connect(fmGain); fmGain.connect(osc.frequency);
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
      osc.connect(gain); gain.connect(this.masterGain);
      osc.start(time); fm.start(time); osc.stop(time + 0.35); fm.stop(time + 0.35);
  }

  private synthesizeTraffic(time: number) {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, time);
      osc.frequency.linearRampToValueAtTime(60, time + 0.8);
      filter.type = 'lowpass'; filter.frequency.setValueAtTime(400, time);
      filter.frequency.linearRampToValueAtTime(200, time + 0.8);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.2, time + 0.2);
      gain.gain.linearRampToValueAtTime(0, time + 0.8);
      osc.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
      osc.start(time); osc.stop(time + 1.0);
  }

  private synthesizeNoiseBurst(time: number, filterType: BiquadFilterType, freq: number, duration: number, vol: number) {
      if (!this.ctx || !this.masterGain) return;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType; filter.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      noise.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
      noise.start(time);
  }

  private triggerKick(time: number, punch: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.masterGain);
    const startFreq = 150 + (punch * 100); 
    const endFreq = 45; 
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.08); 
    gain.gain.setValueAtTime(1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25 + (punch * 0.1));
    osc.start(time); osc.stop(time + 0.3);
  }

  private triggerHat(time: number, bright: number) {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 0.05; 
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass"; filter.frequency.value = 6000 + (bright * 6000); 
    const gain = this.ctx.createGain();
    noise.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
    gain.gain.setValueAtTime(0.3 + (bright * 0.2), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03); 
    noise.start(time);
  }

  private triggerBass(time: number, freq: number, settings: TrackData['bassSettings']) {
    if (!this.ctx || !this.masterGain) return;
    
    // --- DISTORTED BASS LOGIC ---
    if (this.bassDistortionActive) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth'; // Aggressive wave
        osc.frequency.value = freq;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass"; 
        filter.frequency.setValueAtTime(settings.filterFreq * 2.5, time); // Open up filter
        filter.frequency.exponentialRampToValueAtTime(settings.filterFreq, time + 0.3);
        filter.Q.value = 15; // High resonance for acid squelch

        const distGain = this.ctx.createGain();
        distGain.gain.value = 5.0; // Drive it hard

        const outGain = this.ctx.createGain();
        outGain.gain.setValueAtTime(0.6, time);
        outGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

        osc.connect(filter);
        filter.connect(distGain);
        
        // Connect to distortion node if initialized, otherwise direct
        if (this.distortionNode) {
             distGain.connect(this.distortionNode);
             this.distortionNode.connect(outGain);
        } else {
             distGain.connect(outGain);
        }
        outGain.connect(this.masterGain);

        osc.start(time); osc.stop(time + 0.4);
        return;
    }

    // --- NORMAL BASS LOGIC ---
    const osc = this.ctx.createOscillator();
    osc.type = settings.waveform; 
    osc.frequency.value = freq;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.setValueAtTime(settings.filterFreq, time);
    filter.frequency.linearRampToValueAtTime(settings.filterFreq * 0.8, time + 0.2);
    filter.Q.value = 2; 
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    osc.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
    osc.start(time); osc.stop(time + 0.4);
  }

  private triggerLead(time: number, freq: number, settings: TrackData['synthSettings']) {
    if (!this.ctx || !this.masterGain) return;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.2, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + settings.decay * 0.8 + 0.05);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.Q.value = settings.resonance * 0.5; 
    filter.frequency.setValueAtTime(settings.cutoff, time);
    filter.frequency.exponentialRampToValueAtTime(settings.cutoff * 0.5, time + 0.1);
    const osc1 = this.ctx.createOscillator();
    osc1.type = settings.waveform; osc1.frequency.value = freq;
    osc1.connect(filter);
    if (settings.waveform === 'sine' || settings.waveform === 'triangle') {
        const fmOsc = this.ctx.createOscillator();
        const fmGain = this.ctx.createGain();
        fmOsc.frequency.value = freq * 2; fmGain.gain.value = 200; 
        fmOsc.connect(fmGain); fmGain.connect(osc1.frequency);
        fmOsc.start(time); fmOsc.stop(time + 0.5);
    }
    filter.connect(gain);
    const delay = this.ctx.createDelay();
    delay.delayTime.value = 3/16; 
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.3;
    const delayGain = this.ctx.createGain();
    delayGain.gain.value = 0.3;
    gain.connect(this.masterGain);
    gain.connect(delay); delay.connect(delayGain); delayGain.connect(this.masterGain);
    delay.connect(feedback); feedback.connect(delay);
    osc1.start(time); osc1.stop(time + 1.0);
  }
}