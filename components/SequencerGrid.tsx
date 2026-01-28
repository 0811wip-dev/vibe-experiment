import React from 'react';
import { TrackData } from '../types';

interface SequencerGridProps {
  data: TrackData;
  currentStep: number;
  hasCustomSound?: boolean;
  isCustomMuted?: boolean;
}

interface GridTrack {
  name: string;
  steps: boolean[];
  isSfx?: boolean;
  isUser?: boolean;
}

const SequencerGrid: React.FC<SequencerGridProps> = ({ data, currentStep, hasCustomSound, isCustomMuted }) => {
  const tracks: GridTrack[] = [
    { name: 'KICK', steps: data.sequences.kick },
    { name: 'HIHAT', steps: data.sequences.hat },
    { name: 'BASS', steps: data.sequences.bass.map(n => !!n) },
    { name: 'LEAD', steps: data.sequences.lead.map(n => !!n) },
    { name: 'SFX', steps: data.sequences.sfx || Array(16).fill(false), isSfx: true },
  ];

  if (hasCustomSound) {
    tracks.push({
      name: 'USER',
      steps: data.sequences.custom || Array(16).fill(false),
      isUser: true
    });
  }

  return (
    <div className="w-full max-w-md mx-auto mt-4 font-mono text-[10px]">
      {tracks.map((track) => (
        <div key={track.name} className={`flex items-center gap-3 mb-2 transition-opacity duration-300 ${track.isUser && isCustomMuted ? 'opacity-40 grayscale' : 'opacity-100'}`}>
          <div className={`w-12 text-right tracking-wider font-bold ${track.isSfx ? 'text-[#00eaff]' : track.isUser ? 'text-[#0033cc]' : 'text-[#0033cc]/70'}`}>
             {track.name.substring(0, 4)}
          </div>
          <div className="flex-1 grid grid-cols-16 gap-[2px]">
            {track.steps.map((isActive, idx) => (
              <div
                key={idx}
                className={`
                  aspect-[1/1.5] transition-all duration-75 border
                  ${isActive 
                    ? (track.isSfx ? 'bg-[#00eaff] border-[#00eaff]' : 'bg-[#0033cc] border-[#0033cc]') 
                    : 'bg-transparent border-[#0033cc]/30'}
                  
                  ${currentStep === idx 
                    ? 'border-[#0033cc] bg-[#0033cc]/20' 
                    : ''}
                `}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SequencerGrid;