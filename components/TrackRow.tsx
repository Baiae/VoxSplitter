import React, { useState } from 'react';
import { Volume2, VolumeX, Mic, Headphones, Download, ChevronRight, Loader2 } from 'lucide-react';
import { AudioTrackConfig, ExportFormat } from '../types';

interface TrackRowProps {
  track: AudioTrackConfig;
  duration: number;
  currentTime: number;
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  onExport: (id: string, format: ExportFormat) => void;
  pixelsPerSecond: number;
  isExporting?: boolean;
  exportProgress?: number;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  duration,
  currentTime,
  onToggleMute,
  onToggleSolo,
  onExport,
  pixelsPerSecond,
  isExporting,
  exportProgress = 0,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const width = duration * pixelsPerSecond;

  const handleExportClick = (format: ExportFormat) => {
    onExport(track.id, format);
    setShowExportMenu(false);
  };

  return (
    <div className="flex items-center gap-4 bg-slate-900/50 border-b border-slate-800 p-2 hover:bg-slate-800/50 transition-colors">
      {/* Track Controls (Left Sidebar) */}
      <div className="w-64 flex-shrink-0 flex items-center justify-between px-4 py-3 bg-slate-900 rounded-xl border border-slate-800 shadow-xl relative">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg shrink-0"
            style={{ backgroundColor: track.color }}
          >
            <Mic size={18} />
          </div>
          <div className="overflow-hidden">
            <h4 className="font-semibold text-sm text-white truncate w-24" title={track.name}>
              {track.name}
            </h4>
            <span className="text-xs text-slate-500">{track.segments.length} segments</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleMute(track.id)}
            className={`p-2 rounded-lg transition-all ${
              track.isMuted 
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
            title="Mute Track"
          >
            {track.isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button
            onClick={() => onToggleSolo(track.id)}
            className={`p-2 rounded-lg transition-all ${
              track.isSolo
                ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
             title="Solo Track"
          >
            <Headphones size={16} />
          </button>
          
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all relative overflow-hidden ${
                showExportMenu 
                  ? 'bg-emerald-500 text-slate-900 shadow-emerald-500/20 shadow-lg' 
                  : isExporting
                    ? 'text-emerald-400 bg-emerald-500/10 cursor-not-allowed'
                    : 'text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-800'
              }`}
              title="Export Options"
            >
              {isExporting ? (
                 <div className="relative w-4 h-4 flex items-center justify-center">
                   <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle
                        cx="8" cy="8" r="7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="opacity-20"
                      />
                      <circle
                        cx="8" cy="8" r="7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray={44}
                        strokeDashoffset={44 - (44 * exportProgress) / 100}
                        className="transition-all duration-300"
                        strokeLinecap="round"
                      />
                   </svg>
                   <span className="text-[6px] font-bold mt-0.5">{Math.round(exportProgress)}</span>
                 </div>
              ) : <Download size={16} />}
              {!isExporting && <span className="text-[10px] font-bold uppercase tracking-tight">Export</span>}
            </button>

            {showExportMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowExportMenu(false)} 
                />
                <div className="absolute top-0 left-full ml-2 w-36 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200">
                  <div className="p-1.5 flex flex-col gap-1">
                    <button 
                      onClick={() => handleExportClick('wav')}
                      className="px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg flex items-center justify-between transition-colors"
                    >
                      Lossless WAV <ChevronRight size={12} className="text-slate-500" />
                    </button>
                    <button 
                      onClick={() => handleExportClick('mp3')}
                      className="px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg flex items-center justify-between transition-colors"
                    >
                      MP3 (128kbps) <ChevronRight size={12} className="text-slate-500" />
                    </button>
                    <button 
                      onClick={() => handleExportClick('m4a')}
                      className="px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg flex items-center justify-between transition-colors"
                    >
                      M4A (AAC) <ChevronRight size={12} className="text-slate-500" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Timeline Visualization */}
      <div className="flex-1 overflow-hidden relative h-20 bg-slate-950/30 rounded-lg shadow-inner">
        {/* Segments */}
        <div 
          className="relative h-full"
          style={{ width: `${width}px` }}
        >
          {track.segments.map((seg, idx) => (
            <div
              key={idx}
              className={`absolute top-2 bottom-2 rounded-md shadow-sm border border-white/10 overflow-hidden group transition-opacity duration-200
                ${(track.isMuted || (track.isSolo === false && document.querySelectorAll('[data-solo="true"]').length > 0)) ? 'opacity-30 grayscale' : 'opacity-100'}
              `}
              style={{
                left: `${seg.start * pixelsPerSecond}px`,
                width: `${(seg.end - seg.start) * pixelsPerSecond}px`,
                backgroundColor: track.color,
              }}
              title={seg.text}
            >
               {/* Text Preview inside block */}
               <div className="p-1 text-[10px] text-white/90 font-medium truncate w-full select-none">
                 {seg.text}
               </div>
            </div>
          ))}
          
          {/* Playhead Indicator (Ghost) for this track */}
           <div 
            className="absolute top-0 bottom-0 w-px bg-white/20 pointer-events-none z-10"
            style={{ left: `${currentTime * pixelsPerSecond}px` }}
          />
        </div>
      </div>
    </div>
  );
};
