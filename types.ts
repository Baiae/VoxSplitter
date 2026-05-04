export interface SpeakerSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export interface DiarizationResult {
  segments: SpeakerSegment[];
}

export interface ProcessingState {
  status: 'IDLE' | 'UPLOADING' | 'ANALYZING' | 'READY' | 'ERROR';
  message?: string;
}

export interface AudioTrackConfig {
  id: string;
  name: string;
  color: string;
  isMuted: boolean;
  isSolo: boolean;
  segments: SpeakerSegment[];
}

export type ExportFormat = 'wav' | 'mp3' | 'm4a';

export const SPEAKER_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#8b5cf6', // violet-500
];
