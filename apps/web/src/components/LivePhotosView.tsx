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
  Layers,
  Image as ImageIcon,
  Film,
  FileCheck,
  Zap,
  Trash2,
} from 'lucide-react';
import { DriveFile } from '../types';
import { api } from '../services/api';
import { sfx } from '../services/sound';
import { SmartImage } from './SmartImage';

export interface LivePhotoPair {
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
  onDeletePair?: (pair: LivePhotoPair) => void;
}

export const LivePhotosView: React.FC<LivePhotosViewProps> = ({
  files,
  onUploadPair,
  onShareFile,
  onDeletePair,
}) => {
  const [activeTab, setActiveTab] = useState<'gallery' | 'upload_guide'>('gallery');
  const [pairs, setPairs] = useState<LivePhotoPair[]>([]);
  const [selectedPair, setSelectedPair] = useState<LivePhotoPair | null>(null);
  const [pairToDelete, setPairToDelete] = useState<LivePhotoPair | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Automatic Pair Matching Engine (.HEIC / .JPG + .MOV / .MP4 with identical base names)
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
      sfx.playTelegramPop();
      onUploadPair(Array.from(e.dataTransfer.files));
      setActiveTab('gallery');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      sfx.playTelegramPop();
      onUploadPair(Array.from(e.target.files));
      setActiveTab('gallery');
    }
  };

  const handleConfirmDelete = () => {
    if (pairToDelete) {
      sfx.playClick();
      if (selectedPair?.id === pairToDelete.id) {
        setSelectedPair(null);
      }
      onDeletePair?.(pairToDelete);
      setPairToDelete(null);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1rem',
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Hidden Multi-file Input */}
      <input
        type="file"
        multiple
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".heic,.jpg,.jpeg,.png,.mov,.mp4"
        onChange={handleFileChange}
      />

      {/* Top Header & Navigation Tabs */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 18,
          padding: '1rem 1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* Header Title Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
                flexShrink: 0,
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                Live Photos
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#64748b' }}>
                <span>Apple LivePhotosKit JS</span>
                <span>•</span>
                <span style={{ color: 'var(--tg-blue)', fontWeight: 700 }}>
                  {pairs.length} {pairs.length === 1 ? 'Pair' : 'Pairs'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action: Upload */}
          <button
            onClick={() => {
              sfx.playClick();
              fileInputRef.current?.click();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'var(--tg-blue)',
              color: '#ffffff',
              border: 'none',
              padding: '0.55rem 0.95rem',
              borderRadius: 9999,
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(36,129,204,0.25)',
              flexShrink: 0,
            }}
          >
            <Upload size={14} />
            <span className="hide-text-on-mobile">Upload Pair</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            background: '#f1f5f9',
            padding: '0.25rem',
            borderRadius: 12,
            gap: '0.35rem',
          }}
        >
          <button
            onClick={() => {
              sfx.playClick();
              setActiveTab('gallery');
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              background: activeTab === 'gallery' ? '#ffffff' : 'transparent',
              color: activeTab === 'gallery' ? 'var(--tg-blue)' : '#64748b',
              border: 'none',
              borderRadius: 10,
              padding: '0.55rem 0.75rem',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: activeTab === 'gallery' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <ImageIcon size={15} />
            <span>Live Photos ({pairs.length})</span>
          </button>

          <button
            onClick={() => {
              sfx.playClick();
              setActiveTab('upload_guide');
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              background: activeTab === 'upload_guide' ? '#ffffff' : 'transparent',
              color: activeTab === 'upload_guide' ? 'var(--tg-blue)' : '#64748b',
              border: 'none',
              borderRadius: 10,
              padding: '0.55rem 0.75rem',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: activeTab === 'upload_guide' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Smartphone size={15} />
            <span>Upload & iPhone Guide</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Live Photos Gallery */}
      {activeTab === 'gallery' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {pairs.length === 0 ? (
            /* Empty State */
            <div
              style={{
                background: '#ffffff',
                border: '1.5px dashed #cbd5e1',
                borderRadius: 18,
                padding: '3rem 1.5rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                margin: 'auto 0',
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  background: '#eff6ff',
                  color: 'var(--tg-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                }}
              >
                <Sparkles size={28} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                No Live Photos Paired Yet
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.84rem', maxWidth: 360, lineHeight: 1.45, marginBottom: '1.25rem' }}>
                Upload matching <code>.HEIC</code> (photo) + <code>.MOV</code> (motion video) files from your iPhone to experience live previews.
              </p>
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    sfx.playClick();
                    fileInputRef.current?.click();
                  }}
                  style={{
                    background: 'var(--tg-blue)',
                    color: '#fff',
                    border: 'none',
                    padding: '0.65rem 1.25rem',
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 8px rgba(36,129,204,0.25)',
                  }}
                >
                  <Upload size={15} /> Upload Files
                </button>
                <button
                  onClick={() => {
                    sfx.playClick();
                    setActiveTab('upload_guide');
                  }}
                  style={{
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    padding: '0.65rem 1.15rem',
                    borderRadius: 12,
                    fontWeight: 600,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Smartphone size={15} /> View iPhone Guide
                </button>
              </div>
            </div>
          ) : (
            /* Responsive Grid: 2 columns on small screens, auto-fill on desktop */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '0.85rem',
              }}
            >
              {pairs.map((pair) => (
                <LivePhotoCard
                  key={pair.id}
                  pair={pair}
                  onOpenLightbox={() => setSelectedPair(pair)}
                  onShare={() => onShareFile?.(pair.photoFile)}
                  onDelete={() => setPairToDelete(pair)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Upload Zone & iPhone Guide */}
      {activeTab === 'upload_guide' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Drag & Drop Upload Zone */}
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
              borderRadius: 18,
              padding: '2.25rem 1.25rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              transition: 'all 0.18s ease',
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                background: '#e0f2fe',
                color: 'var(--tg-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <Upload size={26} />
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
              Drop .HEIC + .MOV Files Here
            </h3>

            <p style={{ color: '#64748b', fontSize: '0.82rem', maxWidth: 380, lineHeight: 1.45, marginBottom: '1.25rem' }}>
              Select both the still photo (<code>.HEIC</code>) and companion video (<code>.MOV</code>) together.
            </p>

            {/* Pair Badges Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <span
                style={{
                  background: '#f1f5f9',
                  color: '#0f172a',
                  padding: '0.25rem 0.65rem',
                  borderRadius: 6,
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <ImageIcon size={12} color="var(--tg-blue)" /> .HEIC Photo
              </span>
              <span style={{ color: '#94a3b8', fontWeight: 800 }}>+</span>
              <span
                style={{
                  background: '#f1f5f9',
                  color: '#0f172a',
                  padding: '0.25rem 0.65rem',
                  borderRadius: 6,
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Film size={12} color="#8b5cf6" /> .MOV Video
              </span>
            </div>

            <button
              onClick={() => {
                sfx.playClick();
                fileInputRef.current?.click();
              }}
              style={{
                background: 'var(--tg-blue)',
                color: '#fff',
                border: 'none',
                padding: '0.7rem 1.4rem',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(36,129,204,0.25)',
              }}
            >
              Select Files to Upload
            </button>
          </div>

          {/* iPhone Export Guide Cards */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 18,
              border: '1px solid #e2e8f0',
              padding: '1.25rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Smartphone size={18} color="var(--tg-blue)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                How to Export Live Photos on iPhone
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Step 1 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  background: '#f8fafc',
                  padding: '0.85rem 1rem',
                  borderRadius: 12,
                  border: '1px solid #f1f5f9',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: '#eff6ff',
                    color: 'var(--tg-blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  1
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a', marginBottom: 2 }}>
                    Open Photos & Tap Share
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                    Open the <strong>Photos</strong> app on your iPhone, select your Live Photo, and tap the <strong>Share</strong> (📤) button.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  background: '#f8fafc',
                  padding: '0.85rem 1rem',
                  borderRadius: 12,
                  border: '1px solid #f1f5f9',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: '#eff6ff',
                    color: 'var(--tg-blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  2
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a', marginBottom: 2 }}>
                    Export Unmodified Original
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                    Scroll down in the share sheet and tap <strong>"Export Unmodified Original"</strong> ➔ Save to <strong>Files</strong>. This preserves both <code>.HEIC</code> and <code>.MOV</code>.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  background: '#f8fafc',
                  padding: '0.85rem 1rem',
                  borderRadius: 12,
                  border: '1px solid #f1f5f9',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: '#ecfdf5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  3
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a', marginBottom: 2 }}>
                    Upload & Play in FreeBox
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                    Tap <strong>Select Files to Upload</strong> and select both files together. FreeBox will automatically pair them with instant Apple Live motion and sound!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Live Photo Lightbox Player (Ultra-Mobile Friendly) */}
      {selectedPair && (
        <LivePhotoLightbox
          pair={selectedPair}
          onClose={() => setSelectedPair(null)}
          onShare={() => onShareFile?.(selectedPair.photoFile)}
          onDelete={() => setPairToDelete(selectedPair)}
        />
      )}

      {/* Delete Live Photo Confirmation Modal */}
      {pairToDelete && (
        <div
          className="modal-backdrop"
          onClick={() => setPairToDelete(null)}
          style={{ zIndex: 10000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: 24,
              padding: '2rem',
              width: '100%',
              maxWidth: 420,
              position: 'relative',
              boxShadow: '0 20px 48px -12px rgba(0, 0, 0, 0.25)',
              animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              textAlign: 'center',
            }}
          >
            <button
              onClick={() => setPairToDelete(null)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.1rem',
                color: '#64748b',
              }}
            >
              ✕
            </button>

            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                background: '#fef2f2',
                border: '1px solid #fee2e2',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}
            >
              <Trash2 size={26} />
            </div>

            <h3
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#0f172a',
                marginBottom: '0.5rem',
              }}
            >
              Delete Live Photo "{pairToDelete.baseName}"?
            </h3>

            <p
              style={{
                fontSize: '0.88rem',
                color: '#64748b',
                lineHeight: 1.5,
                marginBottom: '1.75rem',
              }}
            >
              This will delete both the <strong>.HEIC</strong> photo and <strong>.MOV</strong> companion video from FreeBox and Telegram cloud.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => setPairToDelete(null)}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  borderRadius: 12,
                  background: '#f1f5f9',
                  border: 'none',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  borderRadius: 12,
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
                }}
              >
                Delete Both
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Subcomponent: Live Photo Grid Card (Optimized for Mobile with Delete)
const LivePhotoCard: React.FC<{
  pair: LivePhotoPair;
  onOpenLightbox: () => void;
  onShare: () => void;
  onDelete: () => void;
}> = ({ pair, onOpenLightbox, onShare, onDelete }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startPlayback = (e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const stopPlayback = (e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const togglePlayback = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  return (
    <div
      onMouseEnter={startPlayback}
      onMouseLeave={stopPlayback}
      onClick={onOpenLightbox}
      style={{
        background: '#ffffff',
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        boxShadow: isPlaying ? '0 8px 24px rgba(36,129,204,0.18)' : '0 2px 6px rgba(0,0,0,0.03)',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        transform: isPlaying ? 'scale(1.02)' : 'none',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Media Visual Stage */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          maxHeight: 220,
          background: '#0f172a',
          overflow: 'hidden',
        }}
      >
        {/* Still Photo Layer */}
        <SmartImage
          src={api.getFileStreamUrl(pair.photoFile.id)}
          alt={pair.baseName}
          filename={pair.photoFile.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: isPlaying ? 'none' : 'block',
          }}
        />

        {/* Companion Video Layer */}
        <video
          ref={videoRef}
          src={api.getFileStreamUrl(pair.videoFile.id)}
          muted
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

        {/* Live Badge */}
        <div
          onClick={togglePlayback}
          style={{
            position: 'absolute',
            top: '0.5rem',
            left: '0.5rem',
            background: isPlaying ? 'rgba(36,129,204,0.92)' : 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(6px)',
            color: '#ffffff',
            padding: '0.2rem 0.45rem',
            borderRadius: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.65rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            zIndex: 2,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: isPlaying ? '#38bdf8' : '#ffffff',
              display: 'inline-block',
              animation: isPlaying ? 'pulse 1s infinite' : 'none',
            }}
          />
          LIVE
        </div>

        {/* Delete Quick Action Button on Card */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete Live Photo"
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(4px)',
            border: 'none',
            borderRadius: 6,
            padding: '0.3rem',
            color: '#ef4444',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            zIndex: 2,
            transition: 'all 0.15s ease',
          }}
        >
          <Trash2 size={13} />
        </button>

        {/* Play indicator overlay on mobile */}
        {!isPlaying && (
          <div
            style={{
              position: 'absolute',
              bottom: '0.5rem',
              right: '0.5rem',
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              color: '#ffffff',
              padding: '0.2rem 0.4rem',
              borderRadius: 4,
              fontSize: '0.65rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Play size={9} /> Live
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div style={{ padding: '0.65rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: '0.82rem',
            color: '#0f172a',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={pair.baseName}
        >
          {pair.baseName}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8' }}>
          <span>{(pair.size / (1024 * 1024)).toFixed(1)} MB</span>
          <span style={{ color: '#059669', fontWeight: 600 }}>.HEIC+.MOV</span>
        </div>
      </div>
    </div>
  );
};

// Subcomponent: Live Photo Lightbox (Ultra Mobile Responsive with Delete)
const LivePhotoLightbox: React.FC<{
  pair: LivePhotoPair;
  onClose: () => void;
  onShare: () => void;
  onDelete: () => void;
}> = ({ pair, onClose, onShare, onDelete }) => {
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
        background: 'rgba(0,0,0,0.9)',
        backdropFilter: 'blur(12px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, color: '#fff' }}>
          <div
            style={{
              background: 'var(--tg-blue)',
              color: '#fff',
              padding: '0.2rem 0.5rem',
              borderRadius: 9999,
              fontSize: '0.72rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
            LIVE
          </div>
          <span
            style={{
              fontSize: '0.92rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {pair.baseName}
          </span>
        </div>

        {/* Actions: Download, Delete & Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
          <a
            href={api.getFileDownloadUrl(pair.photoFile.id)}
            download={pair.photoFile.name}
            title="Download .HEIC"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              padding: '0.4rem 0.65rem',
              borderRadius: 8,
              fontSize: '0.75rem',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            <Download size={13} />
            <span className="hide-text-on-mobile">.HEIC</span>
          </a>

          <a
            href={api.getFileDownloadUrl(pair.videoFile.id)}
            download={pair.videoFile.name}
            title="Download .MOV"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              padding: '0.4rem 0.65rem',
              borderRadius: 8,
              fontSize: '0.75rem',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            <Download size={13} />
            <span className="hide-text-on-mobile">.MOV</span>
          </a>

          <button
            onClick={onDelete}
            title="Delete Live Photo Pair"
            style={{
              background: 'rgba(239, 68, 68, 0.3)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              color: '#fca5a5',
              padding: '0.4rem 0.65rem',
              borderRadius: 8,
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <Trash2 size={13} />
            <span className="hide-text-on-mobile">Delete</span>
          </button>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              width: 34,
              height: 34,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Video Presentation Stage */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          maxWidth: '92vw',
          maxHeight: '68vh',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <video
          ref={videoRef}
          src={api.getFileStreamUrl(pair.videoFile.id)}
          autoPlay
          loop
          playsInline
          muted={isMuted}
          style={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain' }}
        />
      </div>

      {/* Bottom Floating Controls */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(16px)',
          borderRadius: 9999,
          padding: '0.4rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <button
          onClick={togglePlay}
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          {isPlaying ? <Pause size={17} /> : <Play size={17} />}
        </button>

        <button
          onClick={() => setIsMuted(!isMuted)}
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>

        <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.25)', padding: 2, borderRadius: 9999 }}>
          {[0.5, 1, 1.5, 2].map((spd) => (
            <button
              key={spd}
              onClick={() => handleSpeedChange(spd)}
              style={{
                background: speed === spd ? 'var(--tg-blue)' : 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '0.15rem 0.4rem',
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
