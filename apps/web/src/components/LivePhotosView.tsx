import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Upload,
  Download,
  Share2,
  Maximize2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Info,
  CheckCircle,
  HelpCircle,
  X,
  Smartphone,
} from 'lucide-react';
import { DriveFile } from '../types';
import { api } from '../services/api';
import { sfx } from '../services/sound';

interface LivePhotoPair {
  id: string;
  baseName: string;
  photoFile: DriveFile;
  videoFile: DriveFile;
  createdAt: string;
  size: number;
}

interface LivePhotosViewProps {
  files: DriveFile[];
  onUploadPair: (files: File[]) => void;
  onPreviewFile?: (file: DriveFile) => void;
  onShareFile?: (file: DriveFile) => void;
}

// Declare Apple LivePhotosKit global
declare global {
  interface Window {
    LivePhotosKit?: any;
  }
}

export const LivePhotosView: React.FC<LivePhotosViewProps> = ({
  files,
  onUploadPair,
  onShareFile,
}) => {
  const [pairs, setPairs] = useState<LivePhotoPair[]>([]);
  const [selectedPair, setSelectedPair] = useState<LivePhotoPair | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [lpkLoaded, setLpkLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load Apple LivePhotosKit JS dynamically if not already in document
  useEffect(() => {
    if (window.LivePhotosKit) {
      setLpkLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.apple-livephotoskit.com/lpk/1/livephotoskit.js';
    script.async = true;
    script.onload = () => setLpkLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Automatic Pair Matching Engine
  useEffect(() => {
    const images: DriveFile[] = [];
    const videos: DriveFile[] = [];

    files.forEach((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      if (['heic', 'jpg', 'jpeg', 'png'].includes(ext) || f.mimeType.startsWith('image/')) {
        images.push(f);
      } else if (['mov', 'mp4'].includes(ext) || f.mimeType.startsWith('video/')) {
        videos.push(f);
      }
    });

    const getBase = (filename: string) => {
      const lastDot = filename.lastIndexOf('.');
      return lastDot > 0 ? filename.substring(0, lastDot).toLowerCase() : filename.toLowerCase();
    };

    const matchedPairs: LivePhotoPair[] = [];
    const usedVideoIds = new Set<string>();

    images.forEach((img) => {
      const imgBase = getBase(img.name);
      // Find companion video with matching base name (e.g. IMG_1234.HEIC + IMG_1234.MOV)
      const matchingVideo = videos.find(
        (v) => !usedVideoIds.has(v.id) && getBase(v.name) === imgBase
      );

      if (matchingVideo) {
        usedVideoIds.add(matchingVideo.id);
        matchedPairs.push({
          id: `${img.id}_${matchingVideo.id}`,
          baseName: img.name.substring(0, img.name.lastIndexOf('.')) || img.name,
          photoFile: img,
          videoFile: matchingVideo,
          createdAt: img.createdAt,
          size: img.size + matchingVideo.size,
        });
      }
    });

    setPairs(matchedPairs);
  }, [files]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadPair(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem', background: '#f8fafc' }}>
      {/* Studio Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
          borderRadius: 20,
          padding: '1.75rem 2rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        <div style={{ maxWidth: 580 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#eff6ff',
                color: 'var(--tg-blue)',
                padding: '0.25rem 0.65rem',
                borderRadius: 9999,
                fontSize: '0.78rem',
                fontWeight: 700,
                border: '1px solid rgba(36,129,204,0.2)',
              }}
            >
              <Sparkles size={13} />
              Apple LivePhotosKit JS
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              • {pairs.length} Live Photo{pairs.length === 1 ? '' : 's'} Active
            </span>
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem 0' }}>
            iPhone Live Photos Studio
          </h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>
            Upload and experience Apple Live Photos with interactive motion playback, sound, and original dual-file backup.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setShowHowTo(!showHowTo)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '0.65rem 1.1rem',
              borderRadius: 12,
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease',
            }}
          >
            <HelpCircle size={16} color="var(--tg-blue)" />
            How to Upload from iPhone
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'var(--tg-blue)',
              border: 'none',
              color: '#ffffff',
              padding: '0.65rem 1.25rem',
              borderRadius: 12,
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(36,129,204,0.3)',
              transition: 'all 0.15s ease',
            }}
          >
            <Upload size={16} />
            Upload Live Photo Pair (.HEIC + .MOV)
          </button>

          <input
            type="file"
            multiple
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".heic,.jpg,.jpeg,.png,.mov,.mp4"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onUploadPair(Array.from(e.target.files));
              }
            }}
          />
        </div>
      </div>

      {/* How to Upload Instructions Banner */}
      {showHowTo && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 16,
            border: '1.5px solid #e0f2fe',
            padding: '1.5rem',
            marginBottom: '2rem',
            boxShadow: '0 8px 24px rgba(36,129,204,0.08)',
            animation: 'popIn 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Smartphone size={20} color="var(--tg-blue)" />
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                How to Export Live Photos from iPhone
              </h4>
            </div>
            <button
              onClick={() => setShowHowTo(false)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--tg-blue)', marginBottom: '0.3rem' }}>
                STEP 1 • Export from iPhone
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.45 }}>
                Open <strong>Photos</strong> on iPhone ➔ Tap <strong>Share</strong> ➔ Choose <strong>"Export Unmodified Original"</strong> ➔ Save to <strong>Files</strong>.
              </p>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--tg-blue)', marginBottom: '0.3rem' }}>
                STEP 2 • Select Both Files
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.45 }}>
                In FreeBox, tap <strong>Upload</strong> and select both files together (e.g. <code>IMG_0001.HEIC</code> and <code>IMG_0001.MOV</code>).
              </p>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#10b981', marginBottom: '0.3rem' }}>
                STEP 3 • Instant Live Playback
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.45 }}>
                FreeBox pairs them automatically using Apple LivePhotosKit JS. Hover or hold to play motion + audio!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dropzone & Live Photos Gallery */}
      {pairs.length === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          style={{
            background: isDragOver ? '#eff6ff' : '#ffffff',
            border: isDragOver ? '2px dashed var(--tg-blue)' : '2px dashed #cbd5e1',
            borderRadius: 20,
            padding: '4rem 2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
            transition: 'all 0.2s ease',
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: '#e0f2fe',
              color: 'var(--tg-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
            }}
          >
            <Sparkles size={34} />
          </div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
            No Live Photos Paired Yet
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.92rem', maxWidth: 440, lineHeight: 1.5, marginBottom: '1.5rem' }}>
            Drag and drop paired <code>.HEIC</code> and <code>.MOV</code> files here, or export unmodified originals from your iPhone.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'var(--tg-blue)',
              color: '#fff',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(36,129,204,0.25)',
            }}
          >
            Select Live Photo Files
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {pairs.map((pair) => (
            <LivePhotoCard
              key={pair.id}
              pair={pair}
              onOpenLightbox={() => setSelectedPair(pair)}
              onShare={() => onShareFile?.(pair.photoFile)}
            />
          ))}
        </div>
      )}

      {/* Expanded Live Photo Lightbox Player */}
      {selectedPair && (
        <LivePhotoLightbox
          pair={selectedPair}
          onClose={() => setSelectedPair(null)}
          onShare={() => onShareFile?.(selectedPair.photoFile)}
        />
      )}
    </div>
  );
};

// Subcomponent: Live Photo Grid Card
const LivePhotoCard: React.FC<{
  pair: LivePhotoPair;
  onOpenLightbox: () => void;
  onShare: () => void;
}> = ({ pair, onOpenLightbox, onShare }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startPlayback = () => {
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div
      onMouseEnter={startPlayback}
      onMouseLeave={stopPlayback}
      onClick={onOpenLightbox}
      style={{
        background: '#ffffff',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        boxShadow: isPlaying ? '0 12px 28px rgba(36,129,204,0.18)' : '0 2px 8px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        transition: 'all 0.22s ease',
        transform: isPlaying ? 'translateY(-3px)' : 'none',
        position: 'relative',
      }}
    >
      {/* Media Visual Area */}
      <div style={{ position: 'relative', width: '100%', height: 260, background: '#0f172a' }}>
        {/* Still Photo Base */}
        <img
          src={api.getFileStreamUrl(pair.photoFile.id)}
          alt={pair.baseName}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: isPlaying ? 'none' : 'block',
          }}
        />

        {/* Live Video Companion Overlay */}
        <video
          ref={videoRef}
          src={api.getFileStreamUrl(pair.videoFile.id)}
          muted={isMuted}
          playsInline
          loop
          preload="auto"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: isPlaying ? 'block' : 'none',
          }}
        />

        {/* Apple LIVE Badge */}
        <div
          style={{
            position: 'absolute',
            top: '0.75rem',
            left: '0.75rem',
            background: isPlaying ? 'rgba(36,129,204,0.92)' : 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff',
            padding: '0.25rem 0.55rem',
            borderRadius: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: '0.72rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            transition: 'background 0.2s ease',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isPlaying ? '#38bdf8' : '#ffffff',
              display: 'inline-block',
              animation: isPlaying ? 'pulse 1s infinite' : 'none',
            }}
          />
          LIVE
        </div>

        {/* Hover Hint Overlay */}
        {!isPlaying && (
          <div
            style={{
              position: 'absolute',
              bottom: '0.75rem',
              right: '0.75rem',
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(6px)',
              color: '#ffffff',
              padding: '0.25rem 0.6rem',
              borderRadius: 6,
              fontSize: '0.7rem',
              fontWeight: 600,
            }}
          >
            Hover to Play
          </div>
        )}
      </div>

      {/* Card Info Footer */}
      <div style={{ padding: '0.85rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {pair.baseName}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
            {(pair.size / (1024 * 1024)).toFixed(1)} MB
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8' }}>
          <span>.HEIC + .MOV Paired</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: '#ecfdf5', color: '#059669', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 700, fontSize: '0.68rem' }}>
              Telegram DC4
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Subcomponent: Live Photo Lightbox
const LivePhotoLightbox: React.FC<{
  pair: LivePhotoPair;
  onClose: () => void;
  onShare: () => void;
}> = ({ pair, onClose, onShare }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSpeedChange = (spd: number) => {
    setSpeed(spd);
    if (videoRef.current) videoRef.current.playbackRate = spd;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(12px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {/* Top Controls */}
      <div
        style={{
          position: 'absolute',
          top: '1.5rem',
          left: '2rem',
          right: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#fff' }}>
          <div
            style={{
              background: 'var(--tg-blue)',
              color: '#fff',
              padding: '0.3rem 0.75rem',
              borderRadius: 9999,
              fontSize: '0.8rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
            Apple Live Photo
          </div>
          <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>{pair.baseName}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <a
            href={api.getFileDownloadUrl(pair.photoFile.id)}
            download={pair.photoFile.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              padding: '0.5rem 0.9rem',
              borderRadius: 10,
              fontSize: '0.82rem',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            <Download size={14} /> Download .HEIC
          </a>

          <a
            href={api.getFileDownloadUrl(pair.videoFile.id)}
            download={pair.videoFile.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              padding: '0.5rem 0.9rem',
              borderRadius: 10,
              fontSize: '0.82rem',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            <Download size={14} /> Download .MOV
          </a>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              width: 38,
              height: 38,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Video/Photo Stage */}
      <div style={{ position: 'relative', maxWidth: '85vw', maxHeight: '75vh', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <video
          ref={videoRef}
          src={api.getFileStreamUrl(pair.videoFile.id)}
          autoPlay
          loop
          playsInline
          muted={isMuted}
          style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }}
        />
      </div>

      {/* Bottom Floating Playbar Controls */}
      <div
        style={{
          marginTop: '1.5rem',
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(16px)',
          borderRadius: 9999,
          padding: '0.5rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <button
          onClick={togglePlay}
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>

        <button
          onClick={() => setIsMuted(!isMuted)}
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        {/* Speed multipliers */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.2)', padding: 3, borderRadius: 9999 }}>
          {[0.5, 1, 1.5, 2].map((spd) => (
            <button
              key={spd}
              onClick={() => handleSpeedChange(spd)}
              style={{
                background: speed === spd ? 'var(--tg-blue)' : 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.2rem 0.5rem',
                borderRadius: 9999,
                cursor: 'pointer',
              }}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
