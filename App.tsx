import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FileUploader } from './components/FileUploader';
import { Timeline } from './components/Timeline';
import { geminiService } from './services/geminiService';
import { audioUtils } from './services/audioUtils';
import { useAudioController } from './hooks/useAudioController';
import { ProcessingState, AudioTrackConfig, SPEAKER_COLORS, DiarizationResult, ExportFormat, SpeakerSegment } from './types';
import { Play, Pause, RotateCcw, Download, Info, Github, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { TranscriptPanel } from './components/TranscriptPanel';

const App: React.FC = () => {
  const [processingState, setProcessingState] = useState<ProcessingState>({ status: 'IDLE' });
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [diarizationResult, setDiarizationResult] = useState<DiarizationResult | null>(null);
  const [tracks, setTracks] = useState<AudioTrackConfig[]>([]);
  
  // New state for progress and retry logic
  const [progress, setProgress] = useState(0);
  const [lastFile, setLastFile] = useState<File | null>(null);

  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(true);

  const [exportProgress, setExportProgress] = useState<number>(0);

  // Hook for audio engine
  const { isPlaying, currentTime, duration, play, pause, seek, volume, setVolume, getAudioBuffer } = useAudioController({
    audioUrl,
    segments: diarizationResult?.segments || [],
    tracks
  });

  const [lastActiveSegment, setLastActiveSegment] = useState<(SpeakerSegment & { color: string }) | null>(null);

  const activeSegmentResult = useMemo(() => {
    if (!tracks.length) return null;
    for (const track of tracks) {
      const segment = track.segments.find(s => currentTime >= s.start && currentTime <= s.end);
      if (segment) return { ...segment, color: track.color };
    }
    return null;
  }, [tracks, currentTime]);

  useEffect(() => {
    if (activeSegmentResult) {
      setLastActiveSegment(activeSegmentResult);
    }
  }, [activeSegmentResult]);

  const handleFileSelect = async (file: File) => {
    setLastFile(file);
    setProgress(0);
    setProcessingState({ status: 'UPLOADING' });
    
    // Create local URL for player immediately so user knows something is happening
    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    try {
      // 1. Preprocessing Stage (0-30%)
      setProgress(5);
      
      // Smart preprocessing: Only resamples if beneficial. Prevents expansion of MP3s and large file crashes.
      const { base64, mimeType } = await audioUtils.preprocessAudioForGemini(file);
      
      setProgress(30);
      setProcessingState({ status: 'ANALYZING', message: 'Uploading to Gemini & Diarizing...' });
      
      // 2. Analysis Stage (30-90% Simulated)
      // Note: For large files, the initial request upload takes the most time.
      const analysisInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            return 90; // Hold at 90 until response
          }
          // Slower increment as we get higher to simulate waiting
          const increment = prev > 70 ? 0.2 : 1;
          return prev + increment;
        });
      }, 500);
      
      try {
        const result = await geminiService.processAudio(base64, mimeType);
        console.log("Diarization Result:", result);
        
        clearInterval(analysisInterval);
        setProgress(100);
        
        // Generate tracks from speakers
        const uniqueSpeakers = Array.from(new Set(result.segments.map(s => s.speaker)));
        const newTracks: AudioTrackConfig[] = uniqueSpeakers.map((speaker, idx) => ({
          id: `track-${idx}`,
          name: speaker,
          color: SPEAKER_COLORS[idx % SPEAKER_COLORS.length],
          isMuted: false,
          isSolo: false,
          segments: result.segments.filter(s => s.speaker === speaker)
        }));
        
        setTracks(newTracks);
        setDiarizationResult(result);
        setProcessingState({ status: 'READY' });
        
      } catch (error) {
        clearInterval(analysisInterval);
        console.error(error);
        setProcessingState({ 
          status: 'ERROR', 
          message: error instanceof Error ? error.message : 'Failed to process audio. The file might be too large for the current model context.' 
        });
      }
      
    } catch (error) {
      console.error("Preprocessing Error:", error);
      setProcessingState({ 
        status: 'ERROR', 
        message: 'Failed to read audio file. It might be corrupt or the format is not supported.' 
      });
    }
  };

  const handleRetry = () => {
    if (lastFile) {
      handleFileSelect(lastFile);
    }
  };

  const toggleMute = (id: string) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, isMuted: !t.isMuted } : t));
  };

  const toggleSolo = (id: string) => {
    // If clicking a track that is already solo, clear all solos.
    // If clicking a new track, clear others and solo this one (exclusive solo).
    setTracks(prev => {
        const isCurrentlySolo = prev.find(t => t.id === id)?.isSolo;
        return prev.map(t => ({
            ...t,
            isSolo: isCurrentlySolo ? false : (t.id === id)
        }));
    });
  };

  const handleExportTrack = async (id: string, format: ExportFormat) => {
    const track = tracks.find(t => t.id === id);
    const buffer = getAudioBuffer();
    
    if (!track || !buffer) return;
    
    setIsExporting(id);
    setExportProgress(0);
    try {
       const blob = await audioUtils.isolateTrack(buffer, track.segments, format, (p) => {
         setExportProgress(p);
       });
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       
       const extension = format === 'm4a' 
          ? (blob.type.includes('webm') ? 'webm' : 'm4a')
          : format;
          
       a.download = `${track.name.replace(/\s+/g, '_')}_isolated.${extension}`;
       document.body.appendChild(a);
       a.click();
       document.body.removeChild(a);
       URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Export failed", e);
        alert("Failed to export track.");
    } finally {
        setIsExporting(null);
        setExportProgress(0);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms}`;
  };

  const reset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDiarizationResult(null);
    setTracks([]);
    setProgress(0);
    setProcessingState({ status: 'IDLE' });
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-emerald-500/20 shadow-lg">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 3v18M6 8v8M18 8v8M2 11v2M22 11v2" strokeLinecap="round" />
                </svg>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                VoxSplitter AI
            </h1>
        </div>
        <div className="flex items-center gap-4">
             {processingState.status === 'READY' && (
                <button 
                    onClick={reset}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                    <RotateCcw size={14} /> New Project
                </button>
             )}
             <a href="#" className="text-slate-500 hover:text-white transition-colors">
                <Github size={20} />
             </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {processingState.status === 'IDLE' || processingState.status === 'UPLOADING' || processingState.status === 'ANALYZING' || processingState.status === 'ERROR' ? (
           <div className="flex-1 flex items-center justify-center p-6">
             <div className="w-full max-w-2xl">
                <FileUploader 
                    onFileSelect={handleFileSelect} 
                    onError={(msg) => setProcessingState({ status: 'ERROR', message: msg })}
                    isProcessing={processingState.status === 'UPLOADING' || processingState.status === 'ANALYZING'} 
                />
                
                {/* Error State */}
                {processingState.status === 'ERROR' && (
                    <div className="mt-6 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                            <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={20} />
                            <div className="flex-1">
                                <h4 className="text-sm font-semibold text-red-400">Processing Failed</h4>
                                <p className="text-sm text-red-300/80 mt-1">{processingState.message}</p>
                            </div>
                        </div>
                        
                        <button 
                            onClick={handleRetry}
                            className="flex items-center gap-2 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-medium transition-all hover:ring-2 ring-slate-600 ring-offset-2 ring-offset-slate-950"
                        >
                            <RefreshCw size={16} />
                            Retry
                        </button>
                    </div>
                )}

                {/* Progress State */}
                {(processingState.status === 'UPLOADING' || processingState.status === 'ANALYZING') && (
                    <div className="mt-8 space-y-3 animate-in fade-in duration-700">
                        <div className="flex justify-between text-xs font-medium text-slate-400 uppercase tracking-wider">
                            <span>{processingState.status === 'UPLOADING' ? 'Preparing Audio' : 'Gemini AI Processing'}</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner">
                             <div 
                                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                style={{ width: `${progress}%` }} 
                             />
                        </div>
                        <p className="text-center text-xs text-slate-500 font-mono mt-2">
                            {processingState.status === 'UPLOADING' 
                                ? 'OPTIMIZING AUDIO PAYLOAD...' 
                                : 'IDENTIFYING SPEAKERS & SEGMENTS... (Large files may take 1-2 mins)'}
                        </p>
                    </div>
                )}
             </div>
           </div>
        ) : (
            <>
                {/* Timeline Area */}
                <Timeline 
                    duration={duration} 
                    currentTime={currentTime} 
                    tracks={tracks}
                    onToggleMute={toggleMute}
                    onToggleSolo={toggleSolo}
                    onSeek={seek}
                    onExport={handleExportTrack}
                    isExporting={isExporting}
                    exportProgress={exportProgress}
                />
                
                {/* Transcript Panel */}
                <TranscriptPanel 
                    activeSegment={lastActiveSegment} 
                    isActive={!!activeSegmentResult}
                    isOpen={isTranscriptOpen} 
                    onToggle={() => setIsTranscriptOpen(!isTranscriptOpen)} 
                />
                
                {/* Bottom Player Bar */}
                <div className="h-24 bg-slate-900 border-t border-slate-800 p-4 flex items-center justify-between z-50">
                    <div className="flex items-center gap-6 w-1/3">
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Total Time</span>
                            <span className="font-mono text-lg">{formatTime(currentTime)} <span className="text-slate-600">/ {formatTime(duration)}</span></span>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-6 w-1/3">
                        <button className="text-slate-400 hover:text-white transition-colors">
                            <RotateCcw size={20} onClick={() => seek(0)} />
                        </button>
                        <button 
                            onClick={isPlaying ? pause : play}
                            className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center text-slate-900 transition-transform active:scale-95 shadow-lg shadow-emerald-500/20"
                        >
                            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                        </button>
                    </div>

                    <div className="flex items-center justify-end gap-4 w-1/3">
                        <div className="flex items-center gap-2 group">
                             <span className="text-slate-400 group-hover:text-white transition-colors"><Info size={18}/></span>
                             <span className="text-xs text-slate-500 hidden xl:block">AI Diarization Powered</span>
                        </div>
                        <div className="w-32 bg-slate-800 rounded-full h-1.5 relative group cursor-pointer">
                            <div className="absolute inset-0 flex items-center" onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = e.clientX - rect.left;
                                setVolume(Math.max(0, Math.min(1, x / rect.width)));
                            }}>
                                <div className="h-full bg-slate-400 group-hover:bg-emerald-400 rounded-full" style={{ width: `${volume * 100}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            </>
        )}
      </main>
    </div>
  );
};

export default App;