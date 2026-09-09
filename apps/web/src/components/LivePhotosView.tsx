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
  CheckSquare,
  Square,
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
  selectedIds?: string[];
  onToggleSelectPair?: (pair: LivePhotoPair) => void;
  onUploadPair: (files: File[]) => void;
  onPreviewFile?: (file: DriveFile) => void;
  onShareFile?: (file: DriveFile) => void;
  onDeletePair?: (pair: LivePhotoPair) => void;
}

export const LivePhotosView: React.FC<LivePhotosViewProps> = ({
  files,
  selectedIds = [],
  onToggleSelectPair,
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
        padding: '1.25rem',
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
          borderRadius: 20,
          padding: '1.25rem 1.5rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Header Title Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                flexShrink: 0,
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                Live Photos Studio
              </h2>
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
              gap: '0.45rem',
              background: 'var(--tg-blue)',
              color: '#ffffff',
              border: 'none',
              padding: '0.6rem 1.15rem',
              borderRadius: 9999,
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(36,129,204,0.25)',
              flexShrink: 0,
            }}
          >
            <Upload size={15} />
            <span className="hide-text-on-mobile">Upload Live Photo</span>
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
              gap: '0.5rem',
              background: activeTab === 'gallery' ? '#ffffff' : 'transparent',
              color: activeTab === 'gallery' ? 'var(--tg-blue)' : '#64748b',
              border: 'none',
              borderRadius: 10,
              padding: '0.6rem 0.85rem',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: activeTab === 'gallery' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <ImageIcon size={16} />
            <span className="hide-on-mobile">Live Photos Gallery ({pairs.length})</span>
            <span className="show-on-mobile-inline">Live Photos</span>
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
              gap: '0.5rem',
              background: activeTab === 'upload_guide' ? '#ffffff' : 'transparent',
              color: activeTab === 'upload_guide' ? 'var(--tg-blue)' : '#64748b',
              border: 'none',
              borderRadius: 10,
              padding: '0.6rem 0.85rem',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: activeTab === 'upload_guide' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Smartphone size={16} />
            <span className="hide-on-mobile">Upload & iPhone Guide</span>
            <span className="show-on-mobile-inline">Upload</span>
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
                borderRadius: 20,
                padding: '3.5rem 1.5rem',
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
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  background: '#eff6ff',
                  color: 'var(--tg-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.25rem',
                }}
              >
                <Sparkles size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>
                No Live Photos Paired Yet
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.88rem', maxWidth: 420, lineHeight: 1.5, marginBottom: '1.5rem' }}>
                Upload matching <code>.HEIC</code> (photo) + <code>.MOV</code> (motion video) files from your iPhone to experience live interactive previews.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
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
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 10px rgba(36,129,204,0.25)',
                  }}
                >
                  <Upload size={16} /> Upload Live Photos
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
                    padding: '0.7rem 1.3rem',
                    borderRadius: 12,
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Smartphone size={16} /> View iPhone Guide
                </button>
              </div>
            </div>
          ) : (
            /* Spacious Grid: Big preview cards on desktop (300px+), responsive 2-column on mobile (160px) */
            <div
              className="live-photos-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {pairs.map((pair) => {
                const isSelected = selectedIds.includes(pair.photoFile.id) || selectedIds.includes(pair.videoFile.id);
                return (
                  <LivePhotoCard
                    key={pair.id}
                    pair={pair}
                    isSelected={isSelected}
                    onToggleSelect={() => onToggleSelectPair?.(pair)}
                    onOpenLightbox={() => setSelectedPair(pair)}
                    onShare={() => onShareFile?.(pair.photoFile)}
                    onDelete={() => setPairToDelete(pair)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Upload Zone & iPhone Guide */}
      {activeTab === 'upload_guide' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
              borderRadius: 20,
              padding: '2.5rem 1.5rem',
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
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: '#e0f2fe',
                color: 'var(--tg-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <Upload size={28} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>
              Drop .HEIC + .MOV Files Here
            </h3>

            <p style={{ color: '#64748b', fontSize: '0.88rem', maxWidth: 420, lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Select both the still photo (<code>.HEIC</code>) and companion video (<code>.MOV</code>) together from your computer or iPhone.
            </p>

            {/* Pair Badges Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.5rem' }}>
              <span
                style={{
                  background: '#f1f5f9',
                  color: '#0f172a',
                  padding: '0.35rem 0.85rem',
                  borderRadius: 8,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ImageIcon size={14} color="var(--tg-blue)" /> .HEIC Photo
              </span>
              <span style={{ color: '#94a3b8', fontWeight: 800 }}>+</span>
              <span
                style={{
                  background: '#f1f5f9',
                  color: '#0f172a',
                  padding: '0.35rem 0.85rem',
                  borderRadius: 8,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Film size={14} color="#8b5cf6" /> .MOV Video
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
                padding: '0.75rem 1.6rem',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(36,129,204,0.25)',
              }}
            >
              Select Files to Upload
            </button>
          </div>

          {/* iPhone Export Guide Cards */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 20,
              border: '1px solid #e2e8f0',
              padding: '1.5rem',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <Smartphone size={22} color="var(--tg-blue)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                How to Export Live Photos on iPhone
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Step 1 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem',
                  background: '#f8fafc',
                  padding: '1rem 1.15rem',
                  borderRadius: 14,
                  border: '1px solid #f1f5f9',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#eff6ff',
                    color: 'var(--tg-blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  1
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: 3 }}>
                    Open Photos & Tap Share
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45 }}>
                    Open the <strong>Photos</strong> app on your iPhone, select your Live Photo, and tap the <strong>Share</strong> (📤) button.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem',
                  background: '#f8fafc',
                  padding: '1rem 1.15rem',
                  borderRadius: 14,
                  border: '1px solid #f1f5f9',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#eff6ff',
                    color: 'var(--tg-blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  2
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: 3 }}>
                    Export Unmodified Original
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45 }}>
                    Scroll down in the share sheet and tap <strong>"Export Unmodified Original"</strong> ➔ Save to <strong>Files</strong>. This preserves both <code>.HEIC</code> and <code>.MOV</code>.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem',
                  background: '#f8fafc',
                  padding: '1rem 1.15rem',
                  borderRadius: 14,
                  border: '1px solid #f1f5f9',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#ecfdf5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  3
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: 3 }}>
                    Upload & Play in FreeBox
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45 }}>
                    Tap <strong>Select Files to Upload</strong> and select both files together. FreeBox will automatically pair them with instant Apple Live motion and sound!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Live Photo Lightbox Player (Ultra-Clean, Apple Style) */}
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

// Subcomponent: Live Photo Grid Card (Big on Desktop, Clean on Mobile)
const LivePhotoCard: React.FC<{
  pair: LivePhotoPair;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onOpenLightbox: () => void;
  onShare: () => void;
  onDelete: () => void;
}> = ({ pair, isSelected = false, onToggleSelect, onOpenLightbox, onShare, onDelete }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPressHolding, setIsPressHolding] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const isPressHoldingRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastHoldEndedRef = useRef<number>(0);

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

  // Touch handlers for mobile/tablet press-and-hold (Native iPhone Style)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isPressHoldingRef.current = false;

    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
    }

    // Short hold delay (~150ms) to distinguish deliberate press-and-hold from scroll/tap
    holdTimerRef.current = window.setTimeout(() => {
      isPressHoldingRef.current = true;
      setIsPressHolding(true);
      startPlayback();
      try {
        if (navigator.vibrate) navigator.vibrate(25);
      } catch (_) {}
    }, 150);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);

    // If user moves finger > 10px (e.g. scrolling the page), cancel the hold
    if (dx > 10 || dy > 10) {
      if (holdTimerRef.current) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (isPressHoldingRef.current) {
        isPressHoldingRef.current = false;
        setIsPressHolding(false);
        stopPlayback();
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (isPressHoldingRef.current) {
      // User was pressing and holding to preview Live Photo:
      lastHoldEndedRef.current = Date.now();
      isPressHoldingRef.current = false;
      setIsPressHolding(false);
      stopPlayback();
      if (e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchCancel = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isPressHoldingRef.current) {
      isPressHoldingRef.current = false;
      setIsPressHolding(false);
      stopPlayback();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // If click was immediately preceded by a touch press-and-hold release, ignore it so lightbox doesn't pop up
    if (Date.now() - lastHoldEndedRef.current < 400) {
      e.stopPropagation();
      return;
    }
    onOpenLightbox();
  };

  return (
    <div
      onMouseEnter={startPlayback}
      onMouseLeave={stopPlayback}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onClick={handleClick}
      style={{
        background: '#ffffff',
        borderRadius: 18,
        overflow: 'hidden',
        border: isSelected ? '2px solid var(--tg-blue)' : isPressHolding ? '2px solid #38bdf8' : '1px solid #e2e8f0',
        boxShadow: isSelected
          ? '0 0 0 3px var(--tg-blue-glow)'
          : isPressHolding
          ? '0 0 0 3px rgba(56, 189, 248, 0.4), 0 16px 36px rgba(36,129,204,0.3)'
          : isPlaying
          ? '0 12px 32px rgba(36,129,204,0.22)'
          : '0 2px 8px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: isPressHolding ? 'scale(0.985)' : isPlaying ? 'translateY(-2px)' : 'none',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: 'pan-y',
      }}
    >
      {/* Media Visual Stage */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4 / 3',
          minHeight: 220,
          background: '#0f172a',
          overflow: 'hidden',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
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
            pointerEvents: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
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
            pointerEvents: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        />

        {/* Live Badge */}
        <div
          onClick={togglePlayback}
          style={{
            position: 'absolute',
            top: '0.65rem',
            left: '0.65rem',
            background: isPlaying ? 'rgba(36,129,204,0.92)' : 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff',
            padding: '0.25rem 0.6rem',
            borderRadius: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: '0.72rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            zIndex: 2,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isPlaying ? '#38bdf8' : '#ffffff',
              display: 'inline-block',
              animation: isPlaying ? 'pulse 1s infinite' : 'none',
            }}
          />
          LIVE
        </div>

        {/* Top-Right Quick Action Buttons (Checkbox, Full Screen & Delete) */}
        <div
          style={{
            position: 'absolute',
            top: '0.65rem',
            right: '0.65rem',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            zIndex: 2,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Checkbox button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              sfx.playClick();
              onToggleSelect?.();
            }}
            title={isSelected ? 'Deselect Live Photo' : 'Select Live Photo'}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: isSelected ? 'var(--tg-blue)' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            {isSelected ? <CheckSquare size={18} color="var(--tg-blue)" /> : <Square size={18} color="#94a3b8" />}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              sfx.playClick();
              onOpenLightbox();
            }}
            title="Open Fullscreen"
            style={{
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(6px)',
              border: 'none',
              borderRadius: 8,
              padding: '0.4rem',
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--tg-blue)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#334155')}
          >
            <Maximize2 size={13} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete Live Photo Pair"
            style={{
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(6px)',
              border: 'none',
              borderRadius: 8,
              padding: '0.4rem',
              color: '#ef4444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              transition: 'all 0.15s ease',
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Play indicator overlay */}
        {!isPlaying && (
          <div
            style={{
              position: 'absolute',
              bottom: '0.65rem',
              right: '0.65rem',
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
              color: '#ffffff',
              padding: '0.2rem 0.5rem',
              borderRadius: 6,
              fontSize: '0.68rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Play size={10} /> Live
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: '0.92rem',
            color: '#0f172a',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={pair.baseName}
        >
          {pair.baseName}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
          <span>{(pair.size / (1024 * 1024)).toFixed(1)} MB</span>
          <span style={{ color: '#059669', fontWeight: 700, background: '#ecfdf5', padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.68rem' }}>
            .HEIC + .MOV
          </span>
        </div>
      </div>
    </div>
  );
};

// Subcomponent: Live Photo Fullscreen Lightbox (Ultra-Clean Apple Style)
const LivePhotoLightbox: React.FC<{
  pair: LivePhotoPair;
  onClose: () => void;
  onShare: () => void;
  onDelete: () => void;
}> = ({ pair, onClose, onShare, onDelete }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isPressHolding, setIsPressHolding] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const isPressHoldingRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastHoldEndedRef = useRef<number>(0);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const startPlayback = () => {
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const pausePlayback = () => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  // Touch screen press-and-hold for Lightbox
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isPressHoldingRef.current = false;

    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
    }

    holdTimerRef.current = window.setTimeout(() => {
      isPressHoldingRef.current = true;
      setIsPressHolding(true);
      startPlayback();
      try {
        if (navigator.vibrate) navigator.vibrate(20);
      } catch (_) {}
    }, 120);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);

    if (dx > 12 || dy > 12) {
      if (holdTimerRef.current) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (isPressHoldingRef.current) {
        isPressHoldingRef.current = false;
        setIsPressHolding(false);
        pausePlayback();
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (isPressHoldingRef.current) {
      lastHoldEndedRef.current = Date.now();
      isPressHoldingRef.current = false;
      setIsPressHolding(false);
      pausePlayback();
      if (e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchCancel = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isPressHoldingRef.current) {
      isPressHoldingRef.current = false;
      setIsPressHolding(false);
      pausePlayback();
    }
  };

  const handleStageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (Date.now() - lastHoldEndedRef.current < 400) return;
    togglePlay();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(16px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem',
        animation: 'fadeIn 0.2s ease',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 960,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, color: '#fff' }}>
          <div
            style={{
              background: isPlaying ? 'var(--tg-blue)' : 'rgba(255,255,255,0.2)',
              color: '#fff',
              padding: '0.25rem 0.65rem',
              borderRadius: 9999,
              fontSize: '0.75rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              flexShrink: 0,
              transition: 'background 0.2s ease',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#fff',
                display: 'inline-block',
                animation: isPlaying ? 'pulse 1s infinite' : 'none',
              }}
            />
            LIVE
          </div>
          <span
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {pair.baseName}
          </span>
        </div>

        {/* Header Actions: Audio Toggle, Downloads, Delete & Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {/* Sound Toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: 'none',
              color: '#fff',
              padding: '0.45rem 0.75rem',
              borderRadius: 10,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontWeight: 600,
            }}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            <span className="hide-text-on-mobile">{isMuted ? 'Muted' : 'Sound'}</span>
          </button>

          <a
            href={api.getFileDownloadUrl(pair.photoFile.id)}
            download={pair.photoFile.name}
            title="Download .HEIC Photo"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(255,255,255,0.18)',
              color: '#fff',
              padding: '0.45rem 0.75rem',
              borderRadius: 10,
              fontSize: '0.8rem',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            <Download size={14} />
            <span className="hide-text-on-mobile">.HEIC</span>
          </a>

          <a
            href={api.getFileDownloadUrl(pair.videoFile.id)}
            download={pair.videoFile.name}
            title="Download .MOV Video"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(255,255,255,0.18)',
              color: '#fff',
              padding: '0.45rem 0.75rem',
              borderRadius: 10,
              fontSize: '0.8rem',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            <Download size={14} />
            <span className="hide-text-on-mobile">.MOV</span>
          </a>

          <button
            onClick={onDelete}
            title="Delete Live Photo"
            style={{
              background: 'rgba(239, 68, 68, 0.35)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              color: '#fca5a5',
              padding: '0.45rem 0.75rem',
              borderRadius: 10,
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <Trash2 size={14} />
            <span className="hide-text-on-mobile">Delete</span>
          </button>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.25)',
              border: 'none',
              color: '#fff',
              width: 36,
              height: 36,
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

      {/* Main Live Photo Stage */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onClick={handleStageClick}
        style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '78vh',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: isPressHolding
            ? '0 0 0 4px rgba(56, 189, 248, 0.5), 0 30px 80px rgba(0,0,0,0.85)'
            : '0 25px 70px rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          transform: isPressHolding ? 'scale(0.99)' : 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          touchAction: 'none',
        }}
      >
        <video
          ref={videoRef}
          src={api.getFileStreamUrl(pair.videoFile.id)}
          autoPlay
          loop
          playsInline
          muted={isMuted}
          style={{
            maxWidth: '100%',
            maxHeight: '78vh',
            objectFit: 'contain',
            pointerEvents: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        />

        {/* Live Indicator overlay when active */}
        {isPressHolding && (
          <div
            style={{
              position: 'absolute',
              top: '1rem',
              left: '1rem',
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(8px)',
              color: '#38bdf8',
              padding: '0.35rem 0.75rem',
              borderRadius: 9999,
              fontSize: '0.75rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              animation: 'pulse 1s infinite',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#38bdf8' }} />
            PLAYING LIVE
          </div>
        )}
      </div>

      {/* Minimal Footer Info Hint */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          color: 'rgba(255,255,255,0.75)',
          fontSize: '0.8rem',
          fontWeight: 500,
          letterSpacing: '0.02em',
          textAlign: 'center',
        }}
      >
        <span className="hide-on-mobile">Click to pause / resume motion</span>
        <span className="show-on-mobile-inline">Press & hold photo to play • Tap to pause / resume</span>
      </div>
    </div>
  );
};

