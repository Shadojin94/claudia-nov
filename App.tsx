import React from 'react';
import { DateTime } from './components/DateTime';
import { WaveformCircle } from './components/WaveformCircle';
import { Controls } from './components/Controls';
import { AIResponse } from './components/AIResponse';
import { Timer } from './components/Timer';

export default function App() {
  return (
    <div className="min-h-screen bg-[#0a0e14] text-white flex justify-center items-center">
      <div className="w-full max-w-[500px] p-5 flex flex-col gap-5">
        <div className="flex justify-between items-center">
          <button className="w-10 h-10 flex items-center justify-center text-[#00c48c] text-2xl">
            -
          </button>
          <span className="text-xl font-bold">Claudia</span>
          <button className="w-10 h-10 flex items-center justify-center text-[#00c48c] text-2xl">
            +
          </button>
        </div>
        
        <DateTime />
        
        <div className="flex flex-col items-center gap-5">
          <WaveformCircle />
          <AIResponse />
          <Timer />
        </div>
        
        <Controls />
      </div>
    </div>
  );
}