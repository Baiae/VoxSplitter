import { useEffect, useRef, useState, useCallback } from 'react';
import { SpeakerSegment, AudioTrackConfig } from '../types';

interface UseAudioControllerProps {
  audioUrl: string | null;
  segments: SpeakerSegment[];
  tracks: AudioTrackConfig[];
}

export const useAudioController = ({ audioUrl, segments, tracks }: UseAudioControllerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  // Initialize Audio Context and load buffer
  useEffect(() => {
    if (!audioUrl) return;

    const initAudio = async () => {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;

      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      
      audioBufferRef.current = decodedBuffer;
      setDuration(decodedBuffer.duration);
      
      const gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);
      gainNodeRef.current = gainNode;
    };

    initAudio();

    return () => {
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
    };
  }, [audioUrl]);

  // Handle Playback Loop (Time updates)
  const updateTime = useCallback(() => {
    if (!audioContextRef.current || !isPlaying) return;

    const now = audioContextRef.current.currentTime;
    const elapsed = now - startTimeRef.current;
    const actualTime = pauseTimeRef.current + elapsed;

    if (actualTime >= duration) {
      setIsPlaying(false);
      setCurrentTime(duration);
      stop();
      return;
    }

    setCurrentTime(actualTime);
    applyTrackIsolation(actualTime);
    rafRef.current = requestAnimationFrame(updateTime);
  }, [isPlaying, duration, tracks]); // Dependencies matter for the closure

  // Start/Resume
  const play = async () => {
    if (!audioContextRef.current || !audioBufferRef.current) return;

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    
    // Connect source -> gain -> destination
    source.connect(gainNodeRef.current!);
    
    const offset = currentTime;
    source.start(0, offset);
    
    startTimeRef.current = audioContextRef.current.currentTime;
    pauseTimeRef.current = offset;
    sourceNodeRef.current = source;
    
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(updateTime);
  };

  const pause = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    setIsPlaying(false);
  };

  const stop = () => {
    pause();
    setCurrentTime(0);
    pauseTimeRef.current = 0;
  };

  const seek = (time: number) => {
    const wasPlaying = isPlaying;
    if (wasPlaying) pause();
    setCurrentTime(time);
    pauseTimeRef.current = time;
    if (wasPlaying) play();
  };

  // The Magic: Apply Track Isolation / Muting Logic
  // This is called every frame to update the gain node based on who is speaking
  const applyTrackIsolation = (time: number) => {
    if (!gainNodeRef.current) return;

    // Check if any track is soloed
    const soloedTrack = tracks.find(t => t.isSolo);
    
    let targetGain = 1;

    if (soloedTrack) {
      // If we have a solo track, we only play if the time falls within one of its segments
      const isActive = soloedTrack.segments.some(s => time >= s.start && time <= s.end);
      targetGain = isActive ? 1 : 0.05; // 0.05 bleed-through for natural feel, or 0 for hard cut
    } else {
      // If no solo, we check muted tracks
      // If the current time belongs ONLY to muted speakers, we silence
      // This logic is tricky with overlaps. Simplified:
      
      // Find which speaker is active right now
      const activeSegment = segments.find(s => time >= s.start && time <= s.end);
      
      if (activeSegment) {
        const trackForSpeaker = tracks.find(t => t.name === activeSegment.speaker);
        if (trackForSpeaker && trackForSpeaker.isMuted) {
          targetGain = 0;
        }
      }
    }

    // Apply master volume as well
    targetGain *= volume;

    // Smooth transition to avoid clicking
    gainNodeRef.current.gain.setTargetAtTime(targetGain, audioContextRef.current!.currentTime, 0.02);
  };

  // Re-run isolation check if tracks change state while paused/playing
  useEffect(() => {
     if (audioContextRef.current && !isPlaying) {
         // Apply immediately if paused so seeking works with mute
         // We can't really "apply" to a stopped node, but we can set the param for next start
         // Actually, setTargetAtTime requires running context context time. 
     }
  }, [tracks, isPlaying]);

  const getAudioBuffer = useCallback(() => audioBufferRef.current, []);

  return {
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    seek,
    volume,
    setVolume,
    getAudioBuffer
  };
};
