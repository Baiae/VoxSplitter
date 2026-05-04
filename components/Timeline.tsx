import React, { useRef, useEffect } from 'react';
import { TrackRow } from './TrackRow';
import { AudioTrackConfig } from '../types';

interface TimelineProps {
  duration: number;
  currentTime: number;
  tracks: AudioTrackConfig[];
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  onSeek: (time: number) => void;
  onExport: (id: string, format: 'wav' | 'mp3' | 'm4a') => void;
  isExporting: string | null;
  exportProgress: number;
}

export const Timeline: React.FC<TimelineProps> = ({
  duration,
  currentTime,
  tracks,
  onToggleMute,
  onToggleSolo,
  onSeek,
  onExport,
  isExporting,
  exportProgress,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const PIXELS_PER_SECOND = 50;
  const totalWidth = Math.max(duration * PIXELS_PER_SECOND, 1);

  // Auto-scroll timeline to follow playhead (optional, but nice)
  useEffect(() => {
    if (!containerRef.current) return;
    const playheadPos = currentTime * PIXELS_PER_SECOND;
    const center = containerRef.current.clientWidth / 2;
    
    // Only scroll if playhead is past center
    if (playheadPos > center) {
        containerRef.current.scrollLeft = playheadPos - center;
    } else {
        containerRef.current.scrollLeft = 0;
    }
  }, [currentTime]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
    // We need to account for the scroll offset of the container which isn't available directly on the click target if it's the wrapper
    // Actually, simpler logic:
    // The click is on the track area which scrolls.
    // Let's attach the click handler to the scrolling container or the inner width div.
  };

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
     const rect = e.currentTarget.getBoundingClientRect();
     const clickX = e.clientX - rect.left; // relative to visible area
     // Add scroll offset
     const scrollLeft = containerRef.current?.scrollLeft || 0;
     const totalX = clickX + scrollLeft;
     const time = Math.max(0, Math.min(totalX / PIXELS_PER_SECOND, duration));
     onSeek(time);
  };

  return (
    <div className="flex flex-col flex-1 bg-slate-950 border-t border-slate-800 overflow-hidden relative">
      {/* Time Ruler */}
      <div className="flex flex-shrink-0 border-b border-slate-800 bg-slate-900 z-20">
        <div className="w-64 border-r border-slate-800 bg-slate-900 p-3 flex items-center">
            <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Tracks</span>
        </div>
        <div 
            className="flex-1 overflow-hidden relative h-10 cursor-pointer" 
            ref={containerRef}
            onClick={handleRulerClick}
        >
            <div className="absolute top-0 bottom-0" style={{ width: `${totalWidth}px` }}>
                {/* Time markers */}
                {Array.from({ length: Math.ceil(duration / 5) }).map((_, i) => (
                    <div 
                        key={i} 
                        className="absolute top-0 bottom-0 border-l border-slate-700/50 pl-1"
                        style={{ left: `${i * 5 * PIXELS_PER_SECOND}px` }}
                    >
                        <span className="text-[10px] text-slate-500 select-none">
                            {new Date(i * 5 * 1000).toISOString().substr(14, 5)}
                        </span>
                    </div>
                ))}
                
                {/* Global Playhead */}
                <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-emerald-500 z-30 shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-none"
                    style={{ left: `${currentTime * PIXELS_PER_SECOND}px` }}
                >
                    <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-emerald-500 transform rotate-45" />
                </div>
            </div>
        </div>
      </div>

      {/* Tracks Container */}
      <div 
        className="flex-1 overflow-y-auto custom-scrollbar"
        onScroll={(e) => {
            // Sync horizontal scroll with ruler
            if (containerRef.current) {
                containerRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
        }}
      >
        <div style={{ width: `${totalWidth + 256 + 40}px` /* Adding padding for sidebar and safety */ }}>
            <div className="flex flex-col min-w-full">
                {tracks.map(track => (
                <div key={track.id} className="flex min-w-full">
                    <div className="flex-1">
                        {/* We pass the scrolling logic down via the ruler, 
                            so here we just render the track at full width 
                            but we need to ensure the sidebar stays fixed? 
                            
                            Actually, the layout above `TrackRow` puts the sidebar INSIDE the scrollable area.
                            Let's fix that. We want sidebars fixed on the left.
                        */}
                        {/* 
                            Correct approach:
                            The TrackRow renders flex: sidebar + timeline. 
                            The parent container handles horizontal scroll.
                            Wait, if we scroll horizontally, the sidebar moves away.
                            
                            Fix: Split Timeline component into Left Panel (controls) and Right Panel (timeline) 
                            scrolling independently but synced vertically.
                            For simplicity in this restricted output format, let's keep the sidebar sticky.
                        */}
                        <div className="sticky left-0 z-10">
                             {/* This is complex to style with simple flex inside TrackRow.
                                 Let's allow the whole row to scroll, but position sticky the controls.
                             */}
                             <TrackRow 
                                track={track} 
                                duration={duration}
                                currentTime={currentTime}
                                onToggleMute={onToggleMute}
                                onToggleSolo={onToggleSolo}
                                onExport={onExport}
                                pixelsPerSecond={PIXELS_PER_SECOND}
                                isExporting={isExporting === track.id}
                                exportProgress={isExporting === track.id ? exportProgress : 0}
                             />
                        </div>
                    </div>
                </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};
