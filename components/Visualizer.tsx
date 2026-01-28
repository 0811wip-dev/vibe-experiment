import React, { useEffect, useRef } from 'react';
import { AudioEngine } from '../services/audioEngine';

interface VisualizerProps {
  audioEngine: AudioEngine;
  isPlaying: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ audioEngine, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;

    const render = () => {
      const analyser = audioEngine.getAnalyser();
      if (!analyser) {
         animationFrame = requestAnimationFrame(render);
         return;
      }

      // Use fftSize for time domain to get more detail across the width
      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!isPlaying) {
         // Draw a flat line if not playing
         ctx.beginPath();
         ctx.moveTo(0, canvas.height / 2);
         ctx.lineTo(canvas.width, canvas.height / 2);
         ctx.strokeStyle = 'rgba(0, 51, 204, 0.2)'; // Faint blue
         ctx.lineWidth = 1;
         ctx.stroke();
      } else {
        // Draw Waveform - Sharp Blue Ink Style
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#0033cc';
        
        ctx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * canvas.height) / 2;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }

      // Draw Grid Lines (Oscilloscope style)
      ctx.strokeStyle = 'rgba(0, 51, 204, 0.1)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      // Horizontal
      ctx.moveTo(0, canvas.height/2); ctx.lineTo(canvas.width, canvas.height/2);
      ctx.moveTo(0, canvas.height/4); ctx.lineTo(canvas.width, canvas.height/4);
      ctx.moveTo(0, canvas.height*0.75); ctx.lineTo(canvas.width, canvas.height*0.75);
      // Vertical
      for(let i=0; i<10; i++) {
          ctx.moveTo(i * (canvas.width/10), 0);
          ctx.lineTo(i * (canvas.width/10), canvas.height);
      }
      ctx.stroke();

      animationFrame = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrame);
  }, [audioEngine, isPlaying]);

  return (
    <canvas 
      ref={canvasRef} 
      width={800} 
      height={200} 
      className="w-full h-full"
    />
  );
};

export default Visualizer;