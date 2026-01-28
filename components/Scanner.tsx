import React, { useEffect, useState, useRef } from 'react';

interface ScannerProps {
  imageSrc: string;
  isScanning: boolean;
  isAnalyzing: boolean;
  onScanComplete?: () => void;
}

interface DetectionBox {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
}

const Scanner: React.FC<ScannerProps> = ({ imageSrc, isScanning, isAnalyzing, onScanComplete }) => {
  const [scanProgress, setScanProgress] = useState(0);
  const [boxes, setBoxes] = useState<DetectionBox[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Main Scan Line Animation
  useEffect(() => {
    let animationFrame: number;
    let startTime: number;
    const duration = 2000; 

    if (isScanning) {
      setScanProgress(0);
      startTime = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        setScanProgress(progress * 100);

        if (progress < 1) {
          animationFrame = requestAnimationFrame(animate);
        } else {
          if (onScanComplete) onScanComplete();
        }
      };
      
      animationFrame = requestAnimationFrame(animate);
    } else {
      setScanProgress(0);
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [isScanning, onScanComplete]);

  // Object & Creature Detection Simulation
  useEffect(() => {
    if (!isScanning && !isAnalyzing) {
        setBoxes([]);
        setColors([]);
        setLogs([]);
        return;
    }

    const interval = setInterval(() => {
        // Random Box
        const isCreature = Math.random() > 0.7;
        const newBox: DetectionBox = {
            id: Date.now(),
            x: Math.random() * 80,
            y: Math.random() * 80,
            w: 10 + Math.random() * 20,
            h: 10 + Math.random() * 20,
            label: isCreature ? 'CREATURE_LOCK' : (Math.random() > 0.6 ? 'SHAPE_DETECT' : 'CONTRAST_ZONE'),
            color: isCreature ? '#00eaff' : '#0033cc'
        };
        
        setBoxes(prev => [...prev.slice(-4), newBox]);

        // Random Log
        const logMessages = [
            "EXTRACTING_HUE_DATA...",
            "CALCULATING_LUMA_HISTOGRAM",
            "VECTORIZING_EDGES...",
            "MAPPING_TEXTURE_TO_OSC_1",
            "SCANNING_BIOLOGICAL_SIGNATURES",
            "SEARCHING_FAUNA_DATABASE...",
            "ISOLATING_VOCAL_PATTERNS",
            "DETECTING_CREATURE_MOVEMENT",
            "ANALYZING_FACIAL_TOPOGRAPHY",
            "IDENTIFYING_LIVING_ENTITIES"
        ];
        const newLog = logMessages[Math.floor(Math.random() * logMessages.length)];
        setLogs(prev => [...prev.slice(-6), `> ${newLog}`]);

    }, 300);

    return () => clearInterval(interval);
  }, [isScanning, isAnalyzing]);

  // Color Analysis Simulation
  useEffect(() => {
    if (!isScanning && !isAnalyzing) return;
    
    const interval = setInterval(() => {
         const hex = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
         setColors(prev => [...prev.slice(-5), hex]);
    }, 200);

    return () => clearInterval(interval);
  }, [isScanning, isAnalyzing]);


  return (
    <div className="relative w-full h-full bg-[#bfbfbf] overflow-hidden group border border-[#0033cc]">
      {/* Base Image */}
      <img 
        src={imageSrc} 
        alt="Analysis Target" 
        className={`w-full h-full object-cover transition-all duration-1000 ease-out ${
          isScanning || isAnalyzing ? 'opacity-60 grayscale contrast-125 mix-blend-multiply' : 'opacity-100 grayscale-[10%]'
        }`}
      />
      
      {/* High-tech Grid Overlay */}
      <div className={`absolute inset-0 bg-[linear-gradient(rgba(0,51,204,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,51,204,0.1)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none transition-opacity duration-500 ${isScanning || isAnalyzing ? 'opacity-100' : 'opacity-0'}`}></div>

      {/* Detection Boxes */}
      {(isScanning || isAnalyzing) && boxes.map(box => (
          <div 
            key={box.id}
            className="absolute border pointer-events-none animate-in fade-in zoom-in duration-300"
            style={{
                left: `${box.x}%`,
                top: `${box.y}%`,
                width: `${box.w}%`,
                height: `${box.h}%`,
                borderColor: box.color,
                borderWidth: '1px'
            }}
          >
              <div 
                className="absolute -top-4 left-0 text-[8px] font-mono px-1 font-bold"
                style={{ color: box.color, backgroundColor: 'rgba(255,255,255,0.8)' }}
              >
                  {box.label} [{(Math.random()).toFixed(2)}]
              </div>
              {/* Corner Anchors */}
              <div className="absolute -top-1 -left-1 w-2 h-2 border border-[#0033cc] bg-white"></div>
              <div className="absolute -bottom-1 -right-1 w-2 h-2 border border-[#0033cc] bg-white"></div>
              <div className="absolute -top-1 -right-1 w-2 h-2 border border-[#0033cc] bg-white"></div>
              <div className="absolute -bottom-1 -left-1 w-2 h-2 border border-[#0033cc] bg-white"></div>
          </div>
      ))}

      {/* The Scan Line */}
      {isScanning && (
        <>
            <div 
              className="absolute left-0 w-full h-[2px] bg-[#0033cc] z-10"
              style={{ top: `${scanProgress}%` }}
            >
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0033cc]/10 to-transparent pointer-events-none" style={{ top: `${scanProgress - 50}%` }}></div>
        </>
      )}

      {/* Analysis Data Overlay */}
      {(isScanning || isAnalyzing) && (
          <div className="absolute inset-4 pointer-events-none flex justify-between">
              {/* Left Column: Logs */}
              <div className="flex flex-col justify-end w-1/2 overflow-hidden">
                  <div className="flex flex-col gap-1 text-[9px] font-mono text-[#0033cc]" ref={logContainerRef}>
                      {logs.map((log, i) => (
                          <div key={i} className="animate-in fade-in slide-in-from-left-2 duration-200 truncate bg-white/50 px-1 inline-block self-start">
                              {log}
                          </div>
                      ))}
                  </div>
              </div>

              {/* Right Column: Colors & Stats */}
              <div className="flex flex-col items-end gap-2">
                  <div className="text-[10px] font-mono text-[#0033cc] mb-2 border-b border-[#0033cc] pb-1">
                      CHROMATIC_DATA
                  </div>
                  {colors.map((color, i) => (
                      <div key={i} className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                          <span className="text-[9px] font-mono text-[#0033cc] bg-white/50 px-1">{color}</span>
                          <div className="w-3 h-3 border border-[#0033cc]" style={{ backgroundColor: color }}></div>
                      </div>
                  ))}
                  {isAnalyzing && (
                      <div className="mt-4 flex flex-col items-end animate-pulse">
                         <div className="text-[9px] font-bold bg-[#0033cc] text-white px-2 py-1">PROCESSING</div>
                      </div>
                  )}
              </div>
          </div>
      )}
      
      {/* Static UI Overlay */}
      <div className="absolute inset-4 pointer-events-none border border-[#0033cc]/30 rounded-sm">
          {!isScanning && !isAnalyzing && (
             <div className="absolute bottom-2 left-2 text-[8px] font-mono text-[#0033cc] tracking-widest bg-white/50 px-1">
                 TARGET_ACQUIRED
             </div>
          )}
          {/* Schematic corners */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#0033cc]"></div>
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#0033cc]"></div>
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#0033cc]"></div>
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#0033cc]"></div>
      </div>
    </div>
  );
};

export default Scanner;