import React, { useState } from 'react';
import { X, Film, UploadCloud, Link as LinkIcon, Check, Play, HardDrive, Sparkles, AlertCircle } from 'lucide-react';
import { SAMPLE_MOVIES } from '../data/movies';
import { MovieItem } from '../types';

interface MovieSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMovie: (movie: {
    title: string;
    url: string;
    duration: number;
    type: 'video/mp4' | 'video/webm' | 'stream' | 'local';
    sourceName?: string;
  }) => void;
  currentMovieUrl?: string;
}

export const MovieSelectorModal: React.FC<MovieSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectMovie,
  currentMovieUrl,
}) => {
  const [tab, setTab] = useState<'catalog' | 'local' | 'url'>('catalog');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [localFileError, setLocalFileError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSelectPreload = (item: MovieItem) => {
    onSelectMovie({
      title: item.title,
      url: item.url,
      duration: item.duration,
      type: item.type,
      sourceName: `${item.resolution} • ${item.genre}`,
    });
    onClose();
  };

  const handleCustomUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    onSelectMovie({
      title: customTitle.trim() || 'Custom Video Stream',
      url: customUrl.trim(),
      duration: 0,
      type: 'stream',
      sourceName: 'Web Video Stream',
    });
    onClose();
  };

  const handleFileChosen = (file: File) => {
    setLocalFileError(null);
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|webm|mkv|mov|avi)$/i)) {
      setLocalFileError('Please select a valid video file (.mp4, .webm, .mkv, .mov)');
      return;
    }

    try {
      const blobUrl = URL.createObjectURL(file);
      const title = file.name.replace(/\.[^/.]+$/, '');
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);

      onSelectMovie({
        title: title,
        url: blobUrl,
        duration: 0,
        type: 'local',
        sourceName: `Local File (${fileSizeMB} MB) • Offline Zero-Upload`,
      });
      onClose();
    } catch (err) {
      setLocalFileError('Could not read the selected video file.');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileChosen(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChosen(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700/80 p-6 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Broadcast Movie Source</h3>
              <p className="text-xs text-slate-400">
                Choose a local video file from your PC, or an open-cinema movie stream
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center space-x-1 p-1 bg-slate-950 rounded-xl my-4 border border-slate-800 shrink-0">
          <button
            onClick={() => setTab('catalog')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 text-xs font-medium rounded-lg transition ${
              tab === 'catalog'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Open Cinema Catalog</span>
          </button>
          <button
            onClick={() => setTab('local')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 text-xs font-medium rounded-lg transition ${
              tab === 'local'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Local Movie File (Offline)</span>
          </button>
          <button
            onClick={() => setTab('url')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 text-xs font-medium rounded-lg transition ${
              tab === 'url'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Direct Stream URL</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
          {/* TAB 1: Catalog */}
          {tab === 'catalog' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SAMPLE_MOVIES.map((movie) => {
                const isCurrent = currentMovieUrl === movie.url;
                return (
                  <div
                    key={movie.id}
                    onClick={() => handleSelectPreload(movie)}
                    className={`group relative rounded-xl overflow-hidden border p-3 cursor-pointer transition flex flex-col justify-between ${
                      isCurrent
                        ? 'border-red-500 bg-red-950/20'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="relative aspect-video rounded-lg overflow-hidden mb-2 bg-slate-900">
                      <img
                        src={movie.thumbnail}
                        alt={movie.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px]">
                        <span className="bg-red-600/90 text-white font-semibold px-2 py-0.5 rounded text-[10px]">
                          {movie.resolution}
                        </span>
                        <span className="text-slate-300 bg-black/60 px-1.5 py-0.5 rounded">
                          {Math.floor(movie.duration / 60)} min
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm text-white group-hover:text-red-400 transition">
                          {movie.title}
                        </h4>
                        {isCurrent && <Check className="w-4 h-4 text-red-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                        {movie.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                      <span>{movie.genre}</span>
                      <span className="text-red-400 font-medium flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                        <Play className="w-3 h-3 fill-current" />
                        <span>Broadcast This</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: Local File Upload */}
          {tab === 'local' && (
            <div className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition ${
                  dragActive
                    ? 'border-red-500 bg-red-950/20'
                    : 'border-slate-700 bg-slate-950/40 hover:border-slate-600'
                }`}
              >
                <input
                  type="file"
                  id="local-movie-file-input"
                  accept="video/*,.mp4,.webm,.mkv,.mov"
                  onChange={handleFileInputChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="p-4 rounded-full bg-slate-800 text-red-400 mb-3 group-hover:scale-110 transition">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h4 className="text-base font-semibold text-white">
                  Drop any local movie file here
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Supports MP4, WebM, MKV. The movie stays entirely on your local PC — streamed without uploading to any cloud server!
                </p>

                <div className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold shadow-md pointer-events-none">
                  Select File from Computer
                </div>
              </div>

              {localFileError && (
                <div className="flex items-center space-x-2 text-xs text-red-400 bg-red-950/30 border border-red-800/50 p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{localFileError}</span>
                </div>
              )}

              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-indigo-400 font-medium">
                  <HardDrive className="w-4 h-4" />
                  <span>How Local Offline Broadcasting Works:</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  In this web viewer, local files stream through browser blob buffers. In the Windows .NET 8 application, the embedded Kestrel server serves the movie file from your drive via HTTP 206 Byte-Range streaming and on-the-fly FFmpeg container remuxing.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: Custom URL */}
          {tab === 'url' && (
            <form onSubmit={handleCustomUrlSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Movie / Video Stream URL (Direct .mp4, .webm, or HLS)
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/videos/mymovie.mp4"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Movie Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Inception 2010"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold shadow-md transition"
                >
                  Load Stream into Cinema
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
