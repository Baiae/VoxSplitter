import React, { useCallback } from 'react';
import { Upload, Music, FileAudio } from 'lucide-react';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  onError: (message: string) => void;
  isProcessing: boolean;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, onError, isProcessing }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (isProcessing) return;
      
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('audio/')) {
        if (file.size > MAX_FILE_SIZE) {
          onError("File is too large. Maximum supported size is 100MB.");
          return;
        }
        onFileSelect(file);
      }
    },
    [onFileSelect, onError, isProcessing]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > MAX_FILE_SIZE) {
        onError("File is too large. Maximum supported size is 100MB.");
        return;
      }
      onFileSelect(file);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`relative w-full h-96 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all duration-300 ease-in-out group
        ${isProcessing 
          ? 'border-slate-700 bg-slate-900/50 opacity-50 cursor-not-allowed' 
          : 'border-slate-600 bg-slate-800/30 hover:border-emerald-500 hover:bg-slate-800/50 cursor-pointer'
        }`}
    >
      <input
        type="file"
        accept="audio/*"
        onChange={handleChange}
        disabled={isProcessing}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      
      <div className="flex flex-col items-center gap-6 p-8 text-center pointer-events-none">
        <div className={`p-6 rounded-full bg-slate-800 shadow-xl transition-transform duration-500 ${isProcessing ? 'scale-95' : 'group-hover:scale-110'}`}>
           {isProcessing ? (
             <div className="animate-spin text-emerald-500">
               <Upload size={48} />
             </div>
           ) : (
             <Music size={48} className="text-emerald-400" />
           )}
        </div>
        
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-white">
            {isProcessing ? "Analyzing Audio..." : "Upload Podcast"}
          </h3>
          <p className="text-slate-400 max-w-sm">
            {isProcessing 
              ? "Gemini is identifying speakers and separating audio tracks." 
              : "Drag & drop an MP3, WAV, or M4A file here, or click to browse."}
          </p>
        </div>

        {!isProcessing && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-500 bg-slate-900 rounded-full border border-slate-700">
            <FileAudio size={14} />
            <span>Supports MP3, WAV, AAC, M4A (Max 100MB)</span>
          </div>
        )}
      </div>
    </div>
  );
};