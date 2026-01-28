import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { FilesetResolver, HandLandmarker, FaceLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { AudioEngine } from '../services/audioEngine';

interface LiveCameraOverlayProps {
  onClose: () => void;
  audioEngine: AudioEngine;
}

const LiveCameraOverlay: React.FC<LiveCameraOverlayProps> = ({ onClose, audioEngine }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lastEffect, setLastEffect] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("LOADING VISION MODELS...");
  const [activeGesture, setActiveGesture] = useState<boolean>(false);
  const lastGestureTime = useRef<number>(0);
  const wristHistory = useRef<number[]>([]);
  const wasBlinking = useRef<boolean>(false);
  
  // Facial Expressions State
  const [faceExpression, setFaceExpression] = useState<string>("");

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let faceLandmarker: FaceLandmarker | null = null;
    let animationFrameId: number;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: true
        });
        
        setStatus("STARTING CAMERA...");
        startCamera();
      } catch (error) {
        console.error("MediaPipe Error:", error);
        setStatus("VISION MODEL FAILED");
      }
    };

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480, facingMode: "user" }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener('loadeddata', () => {
             setStatus("MULTIMODAL TRACKING ACTIVE");
             predictWebcam();
          });
        }
      } catch (err) {
        console.error("Camera Error:", err);
        setStatus("CAMERA BLOCKED");
      }
    };

    const predictWebcam = () => {
      if (!videoRef.current || !canvasRef.current || !handLandmarker || !faceLandmarker) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (video.videoWidth > 0 && video.videoHeight > 0) {
          const startTimeMs = performance.now();
          
          const handResults = handLandmarker.detectForVideo(video, startTimeMs);
          const faceResults = faceLandmarker.detectForVideo(video, startTimeMs);

          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const drawingUtils = new DrawingUtils(ctx);

          // --- HAND TRACKING ---
          if (handResults.landmarks) {
            for (const landmarks of handResults.landmarks) {
              drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
                color: "#0033cc",
                lineWidth: 2
              });
              drawingUtils.drawLandmarks(landmarks, {
                color: "#00eaff",
                lineWidth: 1,
                radius: 3
              });
              detectHandGesture(landmarks);
            }
          }

          // --- FACE TRACKING ---
          if (faceResults.faceLandmarks) {
             for (const landmarks of faceResults.faceLandmarks) {
                 drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "rgba(0, 51, 204, 0.2)", lineWidth: 0.5 });
                 drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#0033cc", lineWidth: 1 });
                 drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: "#0033cc", lineWidth: 1 });
                 drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#0033cc", lineWidth: 1 });
                 drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: "#0033cc", lineWidth: 1 });
                 drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: "#00eaff", lineWidth: 1 });
             }
          }
          
          if (faceResults.faceBlendshapes && faceResults.faceBlendshapes.length > 0) {
              analyzeFaceExpression(faceResults.faceBlendshapes[0].categories);
          }

          ctx.restore();
      }
      
      animationFrameId = window.requestAnimationFrame(predictWebcam);
    };

    const analyzeFaceExpression = (categories: any[]) => {
        const getScore = (name: string) => categories.find((c: any) => c.categoryName === name)?.score || 0;
        
        const jawOpen = getScore('jawOpen');
        const mouthSmile = (getScore('mouthSmileLeft') + getScore('mouthSmileRight')) / 2;
        // Blink detection: average of both eyes
        const eyeBlink = (getScore('eyeBlinkLeft') + getScore('eyeBlinkRight')) / 2;

        let detected = [];

        const volume = Math.min(1.0, 0.5 + (jawOpen * 2));
        audioEngine.setVolume(volume);
        if (jawOpen > 0.2) detected.push(`VOL ${(volume*100).toFixed(0)}%`);

        const speedMod = 1.0 + (mouthSmile * 0.5); 
        audioEngine.setTempoModifier(speedMod);
        if (mouthSmile > 0.3) detected.push(`SPEED ${speedMod.toFixed(1)}x`);

        const isBlinking = eyeBlink > 0.4; 
        
        // Trigger cowbell once per blink start
        if (isBlinking && !wasBlinking.current) {
            audioEngine.triggerCowbell();
        }
        wasBlinking.current = isBlinking;
        
        // Disable acid bass distortion (formerly linked to blink)
        audioEngine.setBassDistortion(false);

        if (isBlinking) detected.push("COWBELL 808");

        setFaceExpression(detected.join(" | "));
    };

    const detectHandGesture = (landmarks: any[]) => {
      const distance = (p1: any, p2: any) => {
         return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
      };

      const isFingerOpen = (tipIdx: number, pipIdx: number) => landmarks[tipIdx].y < landmarks[pipIdx].y;
      
      const indexOpen = isFingerOpen(8, 6);
      const middleOpen = isFingerOpen(12, 10);
      const ringOpen = isFingerOpen(16, 14);
      const pinkyOpen = isFingerOpen(20, 18);
      
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      
      const wrist = landmarks[0];
      wristHistory.current.push(wrist.x);
      if (wristHistory.current.length > 5) wristHistory.current.shift();
      const velocity = wristHistory.current.length > 1 
         ? Math.abs(wristHistory.current[wristHistory.current.length-1] - wristHistory.current[0]) 
         : 0;

      let gesture = null;

      if (distance(thumbTip, indexTip) < 0.05) {
          gesture = 'distortion';
      }
      else if (!indexOpen && !middleOpen && !ringOpen && !pinkyOpen) {
          gesture = 'filter';
      }
      else if (indexOpen && middleOpen && ringOpen && pinkyOpen) {
          if (velocity > 0.08) { 
             gesture = 'reverb'; 
          } else {
             gesture = 'delay';
          }
      }

      if (gesture && Date.now() - lastGestureTime.current > 300) {
          audioEngine.triggerGestureFX(gesture);
          setLastEffect(gesture.toUpperCase());
          setActiveGesture(true);
          setTimeout(() => setActiveGesture(false), 300);
          lastGestureTime.current = Date.now();
      }
    };

    setupMediaPipe();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
         const stream = videoRef.current.srcObject as MediaStream;
         stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [audioEngine]);

  return (
    <div className="absolute top-4 right-4 w-64 bg-[#bfbfbf] border border-[#0033cc] shadow-2xl z-50 animate-in fade-in zoom-in duration-300">
      <div className="relative aspect-video bg-[#bfbfbf]">
        {/* Video Layer */}
        <video 
            ref={videoRef} 
            className={`w-full h-full object-cover transform scale-x-[-1] filter grayscale contrast-125 transition-opacity mix-blend-multiply ${activeGesture ? 'opacity-80' : 'opacity-40'}`} 
            autoPlay
            playsInline
            muted 
        />
        
        {/* Skeleton Canvas Layer */}
        <canvas 
            ref={canvasRef} 
            className="absolute inset-0 w-full h-full transform scale-x-[-1]" 
        />
        
        {/* UI Overlay */}
        <div className="absolute inset-0 border border-[#0033cc] pointer-events-none m-1"></div>
        <div className="absolute top-2 left-2 flex items-center gap-1">
             <div className="w-2 h-2 bg-[#0033cc] animate-pulse"></div>
             <span className="text-[8px] font-mono text-[#0033cc] tracking-widest font-bold">BIOMETRIC_SYS</span>
        </div>

        <div className="absolute bottom-0 w-full bg-[#bfbfbf]/90 px-2 py-1 border-t border-[#0033cc]">
             <div className="flex justify-between items-center">
                 <span className="text-[8px] font-mono text-[#0033cc]">{status}</span>
                 {lastEffect && (
                     <span className={`text-[10px] font-bold font-mono uppercase ${activeGesture ? 'text-[#00eaff]' : 'text-[#0033cc]/60'}`}>
                         {activeGesture ? `>> ${lastEffect} <<` : lastEffect}
                     </span>
                 )}
             </div>
        </div>
        
        {faceExpression && (
             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <span className="bg-[#0033cc] text-white text-[10px] font-mono px-2 py-1 shadow-lg">
                      {faceExpression}
                  </span>
             </div>
        )}

        {activeGesture && (
            <div className="absolute inset-0 border-2 border-[#00eaff] animate-pulse pointer-events-none"></div>
        )}
      </div>

      <div className="p-2 flex flex-col gap-1 bg-[#bfbfbf] border-t border-[#0033cc]">
           <div className="flex justify-between items-start">
               <div className="text-[8px] text-[#0033cc] leading-tight font-mono grid grid-cols-2 gap-x-2 w-full pr-4 font-bold">
                   <span>WAVE = REVERB</span>
                   <span>FIST = FILTER</span>
                   <span>MOUTH = VOLUME</span>
                   <span>SMILE = SPEED</span>
                   <span>BLINK = COWBELL</span>
               </div>
               <button onClick={onClose} className="p-1 hover:bg-[#0033cc]/10 text-[#0033cc] transition-colors">
                   <X size={12} />
               </button>
           </div>
      </div>
    </div>
  );
};

export default LiveCameraOverlay;