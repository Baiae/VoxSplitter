import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Type, X, ChevronUp, ChevronDown, User } from 'lucide-react';
import { SpeakerSegment } from '../types';

interface TranscriptPanelProps {
  activeSegment: (SpeakerSegment & { color: string }) | null;
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  activeSegment,
  isActive,
  isOpen,
  onToggle,
}) => {
  return (
    <div className="absolute bottom-24 left-0 right-0 z-40 px-6 pointer-events-none">
      <div className="max-w-4xl mx-auto w-full flex flex-col items-end">
        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className={`pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-t-xl transition-all shadow-lg shadow-black/40 ${
            isOpen ? 'bg-slate-900 border border-slate-700 text-slate-400' : 'bg-emerald-600 text-white border-transparent'
          } hover:brightness-110`}
        >
          <Type size={16} />
          <span className="text-xs font-semibold uppercase tracking-wider">
            {isOpen ? 'Close' : 'View'} Transcript
          </span>
          {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>

        {/* Panel Content */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 20, height: 0 }}
              className="pointer-events-auto w-full bg-slate-900/98 backdrop-blur-2xl border border-slate-700 border-b-0 rounded-tl-xl rounded-tr-none p-6 shadow-2xl relative overflow-hidden ring-1 ring-white/10"
            >
              {/* Background gradient hint */}
              {activeSegment && (
                <div 
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{ background: `radial-gradient(circle at 0% 0%, ${activeSegment.color} 0%, transparent 70%)` }}
                />
              )}

              {activeSegment ? (
                <div className={`space-y-4 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-xl"
                        style={{ backgroundColor: activeSegment.color }}
                      >
                        {activeSegment.speaker.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-white">{activeSegment.speaker}</h4>
                            {!isActive && <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">Previous</span>}
                        </div>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-mono">
                          {activeSegment.start.toFixed(2)}s - {activeSegment.end.toFixed(2)}s
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative pl-6">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-full" style={{ backgroundColor: activeSegment.color }} />
                    <p className="text-xl leading-relaxed text-white font-medium italic">
                      {activeSegment.text ? `"${activeSegment.text}"` : (
                          <span className="text-slate-500 font-normal">[No transcription available for this segment]</span>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-slate-500 gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                    <Type size={24} className="opacity-40 animate-pulse" />
                  </div>
                  <p className="text-sm font-medium tracking-wide">Select an audio file and press play to see transcription</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
