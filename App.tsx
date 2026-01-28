import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Square, Download, RefreshCw, Zap, Disc, X, AudioWaveform, Radio, Music, Volume2, VolumeX, Camera } from 'lucide-react';
import Scanner from './components/Scanner';
import Visualizer from './components/Visualizer';
import LiveCameraOverlay from './components/LiveCameraOverlay';
import { AppState, TrackData } from './types';
import { analyzeImage } from './services/geminiService';
import { AudioEngine } from './services/audioEngine';

// Instantiate engine once outside component
const engine = new AudioEngine();

function App() {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [trackData, setTrackData] = useState<TrackData | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [isRecording, setIsRecording] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasCustomSound, setHasCustomSound] = useState(false);
  const [isFxMuted, setIsFxMuted] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customSoundInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    engine.onStep = (step) => setCurrentStep(step);
    return () => { engine.onStep = null; };
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === 'string') {
          setImageSrc(e.target.result);
          setState(AppState.IDLE);
          setTrackData(null);
          engine.stop();
          setErrorMsg(null);
          setIsCameraActive(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCustomSoundUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result instanceof ArrayBuffer) {
          await engine.loadCustomSample(e.target.result);
          setHasCustomSound(true);
          setIsFxMuted(false);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const toggleFxMute = () => {
      const newMuteState = !isFxMuted;
      setIsFxMuted(newMuteState);
      engine.muteCustomTrack(newMuteState);
  };

  const clearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageSrc(null);
    setTrackData(null);
    setState(AppState.IDLE);
    engine.stop();
    setIsCameraActive(false);
  };

  const startProcess = async () => {
    if (!imageSrc) return;
    await engine.init();
    setState(AppState.SCANNING);
  };

  const onScanComplete = async () => {
    if (!imageSrc) return;
    setState(AppState.ANALYZING);
    try {
      const data = await analyzeImage(imageSrc);
      setTrackData(data);
      engine.loadTrack(data);
      setState(AppState.PLAYING);
      engine.play();
    } catch (err) {
      console.error(err);
      setErrorMsg("Analysis failed. Please try a different image.");
      setState(AppState.ERROR);
    }
  };

  const togglePlay = () => {
    if (state === AppState.PLAYING) {
      engine.stop();
      setState(AppState.IDLE); 
    } else if (trackData) {
      engine.play();
      setState(AppState.PLAYING);
    }
  };

  const handleDownload = async () => {
    if (isRecording) {
      const blob = await engine.stopRecording();
      setIsRecording(false);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tech_scan_${Date.now()}.webm`;
      a.click();
    } else {
      setIsRecording(true);
      engine.startRecording();
    }
  };

  const handleReset = () => {
    setImageSrc(null);
    setTrackData(null);
    setState(AppState.IDLE);
    engine.stop();
    setIsCameraActive(false);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-[#bfbfbf] text-[#0033cc] relative overflow-hidden font-sans selection:bg-[#0033cc] selection:text-white">
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 pointer-events-none z-0 tech-grid"></div>
      <div className="fixed inset-0 pointer-events-none z-0 cross-pattern"></div>
      
      {/* Decorative Side Elements */}
      <div className="fixed top-20 left-4 bottom-20 w-[1px] bg-[#0033cc]/30 hidden lg:block"></div>
      <div className="fixed top-20 right-4 bottom-20 w-[1px] bg-[#0033cc]/30 hidden lg:block"></div>
      
      <div className="fixed top-1/2 left-2 -translate-y-1/2 v-text text-[9px] font-mono text-[#0033cc] hidden lg:block tracking-[0.3em]">
          RESEARCHER [X-90]
      </div>
      <div className="fixed top-1/2 right-2 -translate-y-1/2 v-text text-[9px] font-mono text-[#0033cc] hidden lg:block tracking-[0.3em]">
          NON-HUMAN ENTITIES
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 flex flex-col items-center min-h-screen max-w-md border-x border-[#0033cc]/10 bg-[#bfbfbf]/50 backdrop-blur-sm">
        
        {/* Header */}
        <header className="w-full flex justify-between items-start mb-8 pb-2 relative">
            <div className="absolute top-0 left-0 right-0 border-t border-dashed border-[#0033cc]/50 h-px"></div>
            <div className="absolute bottom-0 left-0 right-0 border-b border-dashed border-[#0033cc]/50 h-px"></div>
            
            <div className="py-2">
                <h1 className="text-xl font-bold tracking-tighter leading-none flex items-center gap-2 font-mono uppercase">
                   <div className="w-2 h-2 border border-[#0033cc]"></div>
                   TECHNO_SCAN
                </h1>
                <p className="text-[10px] font-mono text-[#0033cc]/60 tracking-[0.2em] mt-1 uppercase pl-4">VISUAL AUDIO</p>
            </div>
            <div className="mt-2 text-[9px] font-bold font-mono text-[#0033cc] border border-[#0033cc] px-2 py-1 bg-white/50">
                SYS.V.3.1
            </div>
        </header>

        {/* Live Camera Overlay */}
        {isCameraActive && (
            <LiveCameraOverlay 
                audioEngine={engine} 
                onClose={() => setIsCameraActive(false)} 
            />
        )}

        {/* Main Interface */}
        <main className="w-full flex-1 flex flex-col gap-6">
            
            {/* Upload Frame / Scanner Area */}
            <div className="w-full aspect-square relative border border-[#0033cc] bg-white/10 overflow-hidden group hover:shadow-[0_0_15px_rgba(0,51,204,0.1)] transition-all">
                {/* Decorative corners */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#0033cc]"></div>
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#0033cc]"></div>
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#0033cc]"></div>
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#0033cc]"></div>

                {!imageSrc ? (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
                    >
                        <div className="w-1/2 aspect-square border-2 border-dashed border-[#0033cc]/50 flex items-center justify-center mb-4 group-hover:border-[#0033cc] group-hover:bg-[#0033cc]/5 transition-all duration-300">
                            <div className="w-16 h-16 flex items-center justify-center border border-[#0033cc] rotate-45 bg-white/50 transition-transform duration-300 group-hover:scale-105">
                                <Upload size={24} className="text-[#0033cc] -rotate-45" />
                            </div>
                        </div>
                        <h3 className="text-sm font-bold tracking-widest uppercase text-[#0033cc]">LOAD VISUAL DATA</h3>
                        <p className="text-[9px] text-[#0033cc]/60 mt-2 font-mono">DRAG & DROP OR CLICK</p>
                    </div>
                ) : (
                    <>
                        <Scanner 
                          imageSrc={imageSrc} 
                          isScanning={state === AppState.SCANNING} 
                          isAnalyzing={state === AppState.ANALYZING}
                          onScanComplete={onScanComplete}
                        />
                        
                        {state === AppState.IDLE && !trackData && (
                             <button 
                                onClick={clearImage}
                                className="absolute top-0 right-0 p-2 bg-[#0033cc] text-white hover:bg-[#0033cc]/80 transition-all z-20"
                             >
                                <X size={14} />
                             </button>
                        )}
                    </>
                )}
            </div>
            
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
            <input type="file" ref={customSoundInputRef} onChange={handleCustomSoundUpload} accept="audio/*" className="hidden" />

            {errorMsg && (
                <div className="w-full p-2 border border-red-500 bg-red-100 text-red-600 text-[10px] font-mono uppercase">
                    Error: {errorMsg}
                </div>
            )}

            {/* Controls Section */}
            <div className={`flex flex-col gap-4 transition-all duration-700 ${!imageSrc ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                
                {/* Visualizer Area */}
                {trackData && (
                    <div className="w-full h-32 bg-[#bfbfbf] border border-[#0033cc] relative overflow-hidden">
                        <div className="absolute inset-0 tech-grid opacity-30 pointer-events-none"></div>
                        <Visualizer audioEngine={engine} isPlaying={state === AppState.PLAYING} />
                        <div className="absolute top-1 left-1 flex items-center gap-2 z-10 border border-[#0033cc] px-2 bg-[#bfbfbf]/90">
                             <AudioWaveform size={10} className="text-[#0033cc]" />
                             <span className="font-mono text-[9px] text-[#0033cc] tracking-wider font-bold uppercase">
                                {trackData.bpm} BPM // {trackData.key}
                             </span>
                        </div>
                    </div>
                )}

                {!trackData ? (
                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={() => customSoundInputRef.current?.click()}
                            disabled={state === AppState.SCANNING || state === AppState.ANALYZING}
                            className={`btn-tech w-full py-3 border ${hasCustomSound ? 'border-[#0033cc] bg-[#0033cc]/10' : 'border-[#0033cc]/30'} text-[10px] font-mono flex items-center justify-center gap-2 transition-all uppercase text-[#0033cc]`}
                        >
                            <Music size={12} />
                            {hasCustomSound ? 'Sample Loaded' : 'Insert Custom Audio Layer'}
                        </button>

                        <button 
                            onClick={startProcess}
                            disabled={state !== AppState.IDLE}
                            className="btn-tech w-full py-4 bg-[#0033cc] text-white font-bold text-xs tracking-[0.2em] hover:bg-[#0033cc]/90 disabled:opacity-50 flex items-center justify-center gap-3 transition-all uppercase"
                        >
                            {state === AppState.SCANNING || state === AppState.ANALYZING ? (
                                <span className="font-mono animate-pulse">Running Diagnostics...</span>
                            ) : (
                                <>
                                    <Zap size={14} /> Initiate Sequence
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-2">
                        <button 
                            onClick={togglePlay}
                            className="btn-tech col-span-2 h-12 bg-white border border-[#0033cc] text-[#0033cc] font-bold text-xs flex items-center justify-center gap-2 uppercase tracking-widest hover:bg-[#0033cc] hover:text-white transition-colors"
                        >
                            {state === AppState.PLAYING ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                            {state === AppState.PLAYING ? 'Term' : 'EXEC'}
                        </button>
                        
                        <button 
                            onClick={() => setIsCameraActive(!isCameraActive)}
                            className={`btn-tech col-span-1 h-12 border border-[#0033cc] flex flex-col items-center justify-center gap-1 transition-all ${
                                isCameraActive
                                ? 'bg-[#0033cc] text-white'
                                : 'bg-[#bfbfbf] text-[#0033cc] hover:bg-[#0033cc]/10'
                            }`}
                        >
                            <Camera size={14} />
                            <span className="text-[8px] font-mono font-bold uppercase">Bio_Cam</span>
                        </button>

                         <button 
                            onClick={hasCustomSound ? toggleFxMute : () => customSoundInputRef.current?.click()}
                            className="btn-tech col-span-1 h-12 border border-[#0033cc] flex flex-col items-center justify-center gap-1 transition-all bg-[#bfbfbf] text-[#0033cc] hover:bg-[#0033cc]/10"
                        >
                            {hasCustomSound ? (
                                isFxMuted ? <VolumeX size={14} /> : <Volume2 size={14} />
                            ) : (
                                <Music size={14} />
                            )}
                            <span className="text-[8px] font-mono font-bold uppercase">{hasCustomSound ? (isFxMuted ? 'FX_OFF' : 'FX_ON') : 'Load_FX'}</span>
                        </button>

                         <button 
                            onClick={handleDownload}
                            className={`btn-tech col-span-1 h-10 font-bold flex flex-col items-center justify-center gap-1 border border-[#0033cc] transition-all ${
                                isRecording 
                                ? 'bg-[#0033cc] text-white animate-pulse' 
                                : 'bg-[#bfbfbf] text-[#0033cc] hover:bg-[#0033cc]/10'
                            }`}
                        >
                            <Disc size={12} className={isRecording ? 'animate-spin' : ''} />
                            <span className="text-[8px] font-mono uppercase">Archive</span>
                        </button>

                        <button 
                            onClick={handleReset}
                            className="btn-tech col-span-3 h-10 bg-red-600 hover:bg-red-500 text-white flex items-center justify-center gap-2 transition-all border border-red-700 uppercase"
                        >
                            <RefreshCw size={12} />
                            <span className="text-[9px] font-bold font-mono tracking-widest uppercase">System Reset</span>
                        </button>
                    </div>
                )}
                
                {trackData && (
                     <div className="w-full border-t border-[#0033cc] pt-4 mt-2">
                        <div className="flex flex-col gap-2 mb-4">
                            <div className="flex justify-between items-center w-full">
                                <h3 className="text-[9px] font-bold text-[#0033cc] uppercase tracking-[0.2em]">Visual Signature</h3>
                                <span className="inline-block px-2 py-1 bg-[#0033cc] text-[8px] font-mono text-white uppercase font-bold">
                                    MOOD: {trackData.mood}
                                </span>
                            </div>
                            <p className="text-[10px] text-[#0033cc]/70 leading-tight font-mono uppercase border-l-2 border-[#0033cc] pl-2">
                                {trackData.visualSummary}
                            </p>
                            {trackData.soundEffect && trackData.soundEffect !== 'none' && (
                                <div className="flex items-center gap-1 mt-1">
                                    <Radio size={8} className="text-[#00eaff]" />
                                    <span className="text-[8px] font-mono text-[#0033cc] uppercase font-bold bg-[#00eaff]/20 px-1 border border-[#00eaff]/30">
                                        {trackData.soundEffect} layer active
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </main>
      </div>
    </div>
  );
}

export default App;
