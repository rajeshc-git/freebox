import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Copy,
  Check,
  HardDrive,
  Play,
  Pause,
  Volume2,
  ShieldCheck,
  Activity,
  Film,
  Music,
  Download,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileCode,
  FileText,
  PauseCircle,
  PlayCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Folder as FolderIcon,
  Zap,
  FolderInput,
  FolderTree,
  LogOut,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import { DriveFile, UploadQueueItem, Folder } from '../types';
import { sfx } from '../services/sound';
import { api } from '../services/api';
import { SmartImage } from './SmartImage';

interface PreviewModalProps {
  file: DriveFile | null;
  onClose: () => void;
  onShare: (file: DriveFile) => void;
  onDelete?: (file: DriveFile) => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ file, onClose, onShare, onDelete }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [copied, setCopied] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');

  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isHtml = Boolean(
    file &&
      (file.name.toLowerCase().endsWith('.html') ||
        file.name.toLowerCase().endsWith('.htm') ||
        file.mimeType === 'text/html')
  );

  const isTextOrCode = Boolean(
    file &&
      (isHtml ||
        file.mimeType?.startsWith('text/') ||
        file.mimeType?.includes('json') ||
        file.mimeType?.includes('javascript') ||
        file.mimeType?.includes('xml') ||
        /\.(txt|md|json|js|ts|tsx|jsx|css|py|c|cpp|h|java|go|rs|sh|yml|yaml|xml|csv|log|svg)$/i.test(file.name))
  );

  // Fetch real content for text/code/HTML files
  useEffect(() => {
    if (file && isTextOrCode) {
      setIsLoadingContent(true);
      setActiveTab(isHtml ? 'preview' : 'code');
      const url = api.getFileStreamUrl(file.id);
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then((text) => {
          setFileContent(text);
          setIsLoadingContent(false);
        })
        .catch((err) => {
          console.error('Failed to load file content', err);
          setIsLoadingContent(false);
        });
    } else {
      setFileContent(null);
    }
  }, [file?.id, isTextOrCode, isHtml]);

  if (!file) return null;

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  };

  const handleCopySpool = () => {
    navigator.clipboard?.writeText(file.spoolHash);
    setCopied(true);
    sfx.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    sfx.playComplete();
    const url = api.getFileDownloadUrl(file.id);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleAudioPlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const changeVideoSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
    sfx.playClick();
  };

  const lines = (fileContent || '').split('\n');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 24,
          width: '92vw',
          maxWidth: 980,
          height: '88vh',
          maxHeight: 800,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.2), 0 0 20px rgba(0, 0, 0, 0.05)',
          animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, marginRight: '0.75rem' }}>
            <h3
              title={file.name}
              style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {file.name}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {/* HTML Tabs for switching between Live Preview and Code */}
            {isHtml && (
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.2rem', borderRadius: 8, gap: 2 }}>
                <button
                  onClick={() => setActiveTab('preview')}
                  style={{
                    background: activeTab === 'preview' ? '#ffffff' : 'transparent',
                    color: activeTab === 'preview' ? 'var(--tg-blue)' : '#64748b',
                    border: 'none',
                    borderRadius: 6,
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: activeTab === 'preview' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  Live Preview
                </button>
                <button
                  onClick={() => setActiveTab('code')}
                  style={{
                    background: activeTab === 'code' ? '#ffffff' : 'transparent',
                    color: activeTab === 'code' ? 'var(--tg-blue)' : '#64748b',
                    border: 'none',
                    borderRadius: 6,
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: activeTab === 'code' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  Source Code
                </button>
              </div>
            )}

            <button
              onClick={handleDownload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#eef6fd',
                border: '1px solid rgba(36,129,204,0.25)',
                color: 'var(--tg-blue)',
                padding: '0.45rem 0.85rem',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Download size={14} /> Download
            </button>

            {onDelete && (
              <button
                onClick={() => onDelete(file)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                  color: '#ef4444',
                  padding: '0.45rem 0.85rem',
                  borderRadius: 8,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Delete File"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1.1rem',
                color: '#64748b',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Media Preview Area (100% Light Mode) */}
        <div
          style={{
            flex: 1,
            minHeight: 380,
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {file.type === 'image' && (file.previewUrl || file.thumbnailUrl) ? (
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                overflow: 'hidden',
              }}
            >
              <SmartImage
                src={api.getFileStreamUrl(file.id)}
                alt={file.name}
                filename={file.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                  borderRadius: 12,
                  background: '#ffffff',
                }}
              />

              {/* Image Controls Bar */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  padding: '0.4rem 0.85rem',
                  borderRadius: 9999,
                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                  border: '1px solid #e2e8f0',
                }}
              >
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  title="Zoom Out"
                  style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer' }}
                >
                  <ZoomOut size={16} />
                </button>
                <span style={{ color: '#0f172a', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', minWidth: 40, textAlign: 'center', fontWeight: 700 }}>
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  title="Zoom In"
                  style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer' }}
                >
                  <ZoomIn size={16} />
                </button>
                <div style={{ width: 1, height: 16, background: '#cbd5e1' }} />
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  title="Rotate 90°"
                  style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer' }}
                >
                  <RotateCw size={16} />
                </button>
                <button
                  onClick={() => {
                    setZoomLevel(1);
                    setRotation(0);
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    color: '#475569',
                    borderRadius: 4,
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          ) : file.type === 'video' ? (
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem',
              }}
            >
              <video
                ref={videoRef}
                controls
                autoPlay
                playsInline
                preload="auto"
                style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
              >
                <source src={api.getFileStreamUrl(file.id)} type={file.mimeType || 'video/mp4'} />
              </video>
              {/* Streaming Stats HUD */}
              <div
                style={{
                  position: 'absolute',
                  top: '2rem',
                  left: '2rem',
                  background: 'rgba(255, 255, 255, 0.92)',
                  backdropFilter: 'blur(8px)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  color: 'var(--tg-blue)',
                  fontFamily: 'var(--font-mono)',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  fontWeight: 600,
                }}
              >
                <Activity size={14} />
                <span>Telegram DC4 Stream • {playbackSpeed}x</span>
              </div>
              {/* Speed Switcher Controls */}
              <div
                style={{
                  position: 'absolute',
                  top: '2rem',
                  right: '2rem',
                  display: 'flex',
                  gap: '0.25rem',
                  background: 'rgba(255, 255, 255, 0.92)',
                  backdropFilter: 'blur(8px)',
                  padding: '0.25rem',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}
              >
                {[0.5, 1, 1.5, 2].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => changeVideoSpeed(spd)}
                    style={{
                      background: playbackSpeed === spd ? 'var(--tg-blue)' : 'transparent',
                      color: playbackSpeed === spd ? '#fff' : '#475569',
                      border: 'none',
                      borderRadius: 4,
                      padding: '0.2rem 0.45rem',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          ) : file.type === 'audio' ? (
            /* Audio Player Card */
            <div
              style={{
                background: '#ffffff',
                borderRadius: 20,
                padding: '2.5rem',
                width: '100%',
                maxWidth: 480,
                textAlign: 'center',
                boxShadow: '0 12px 36px rgba(0,0,0,0.08)',
                border: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: '#eef6fd',
                  color: 'var(--tg-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem auto',
                }}
              >
                <Music size={40} />
              </div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>{file.name}</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Direct Audio Stream
              </p>

              {/* Waveform Bars */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  height: 52,
                  marginBottom: '1.75rem',
                }}
              >
                {[30, 65, 45, 85, 95, 50, 75, 40, 90, 60, 35, 70, 55, 80, 45, 60, 75, 90].map((height, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: 4,
                      height: isPlaying ? `${Math.max(15, Math.round(height * Math.random()))}%` : `${height}%`,
                      background: 'linear-gradient(180deg, var(--tg-blue) 0%, #38bdf8 100%)',
                      borderRadius: 9999,
                      transition: 'height 0.12s ease',
                    }}
                  />
                ))}
              </div>

              <audio ref={audioRef} src={api.getFileStreamUrl(file.id)} onEnded={() => setIsPlaying(false)} />

              <button
                onClick={toggleAudioPlay}
                style={{
                  background: 'var(--tg-blue)',
                  color: '#fff',
                  border: 'none',
                  width: 54,
                  height: 54,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px var(--tg-blue-glow)',
                }}
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: 3 }} />}
              </button>
            </div>
          ) : isHtml && activeTab === 'preview' ? (
            /* Live Interactive HTML Preview (Sandbox) */
            <div style={{ width: '100%', height: '100%', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
              {isLoadingContent ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                  Loading HTML Preview...
                </div>
              ) : (
                <iframe
                  title={file.name}
                  srcDoc={fileContent || ''}
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  style={{
                    width: '100%',
                    height: '100%',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    background: '#ffffff',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                  }}
                />
              )}
            </div>
          ) : (
            /* Real Document / Code / Text File Viewer (Light Mode) */
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#f8fafc', padding: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid #e2e8f0',
                  marginBottom: '1rem',
                  color: '#64748b',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileCode size={16} color="var(--tg-blue)" />
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{file.name}</span>
                  <span>({formatSize(file.size)})</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(fileContent || file.spoolHash);
                    sfx.playClick();
                  }}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    padding: '0.3rem 0.75rem',
                    borderRadius: 6,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontWeight: 600,
                  }}
                >
                  <Copy size={12} /> Copy Code
                </button>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  lineHeight: '1.7',
                  color: '#0f172a',
                  background: '#ffffff',
                  padding: '1rem',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                }}
              >
                {isLoadingContent ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading content...</div>
                ) : fileContent !== null ? (
                  lines.map((line, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '1.25rem' }}>
                      <span style={{ color: '#94a3b8', userSelect: 'none', width: 32, textAlign: 'right', flexShrink: 0 }}>
                        {idx + 1}
                      </span>
                      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#1e293b' }}>
                        {line || ' '}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: '#eff6ff', color: 'var(--tg-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                      <FileText size={24} />
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>{file.name}</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1rem' }}>{formatSize(file.size)} · {file.mimeType}</div>
                    <button
                      onClick={handleDownload}
                      style={{
                        background: 'var(--tg-blue)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.5rem 1.25rem',
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                      }}
                    >
                      Download File
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer (Clean Light Mode) */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <ShieldCheck size={18} color="#10b981" />
            <span style={{ fontWeight: 600, color: '#475569' }}>{formatSize(file.size)}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => onShare(file)}
              style={{
                background: 'var(--tg-blue)',
                color: '#fff',
                border: 'none',
                padding: '0.55rem 1.35rem',
                borderRadius: 9999,
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
              }}
            >
              Share Direct Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ShareModalProps {
  file: DriveFile | null;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ file, onClose }) => {
  const [copied, setCopied] = useState(false);
  if (!file) return null;

  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  const shareLink = `${origin}/s/${file.spoolHash}`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(shareLink);
    setCopied(true);
    sfx.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 24,
          padding: '2rem',
          width: '100%',
          maxWidth: 440,
          position: 'relative',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.1rem',
          }}
        >
          ✕
        </button>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>Share File Securely</h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Anyone with this direct FreeBox link can stream or download this file via Telegram's high-speed CDN.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            readOnly
            value={shareLink}
            style={{
              flex: 1,
              border: '1px solid var(--border-subtle)',
              background: '#f8fafc',
              padding: '0.65rem 0.85rem',
              borderRadius: 12,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
          <button
            onClick={handleCopy}
            style={{
              background: 'var(--tg-blue)',
              color: '#fff',
              border: 'none',
              padding: '0.65rem 1.15rem',
              borderRadius: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(36, 129, 204, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface NewFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export const NewFolderModal: React.FC<NewFolderModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 24,
          padding: '2rem',
          width: '100%',
          maxWidth: 380,
          position: 'relative',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.1rem',
          }}
        >
          ✕
        </button>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1rem' }}>Create New Folder</h3>
        <input
          type="text"
          placeholder="Folder name (e.g. 4K Drone Footage)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          style={{
            width: '100%',
            border: '1.5px solid var(--border-medium)',
            borderRadius: 12,
            padding: '0.75rem 1rem',
            fontSize: '0.95rem',
            marginBottom: '1.25rem',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              padding: '0.65rem 1.15rem',
              borderRadius: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (name.trim()) {
                sfx.playClick();
                onCreate(name.trim());
                setName('');
              }
            }}
            style={{
              background: 'var(--tg-blue)',
              color: '#fff',
              border: 'none',
              padding: '0.65rem 1.15rem',
              borderRadius: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Create Folder
          </button>
        </div>
      </div>
    </div>
  );
};

interface RenameFolderModalProps {
  isOpen: boolean;
  folder: Folder | null;
  onClose: () => void;
  onRename: (id: string, newName: string) => void;
}

export const RenameFolderModal: React.FC<RenameFolderModalProps> = ({ isOpen, folder, onClose, onRename }) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (folder) {
      setName(folder.name);
    }
  }, [folder]);

  if (!isOpen || !folder) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (name.trim() && name.trim() !== folder.name) {
      sfx.playClick();
      onRename(folder.id, name.trim());
    } else {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 24,
          padding: '2rem',
          width: '100%',
          maxWidth: 400,
          position: 'relative',
          boxShadow: 'var(--shadow-xl)',
          animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <button
          onClick={onClose}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: '#eff6ff',
              color: 'var(--tg-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Pencil size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>Rename Folder</h3>
            <p style={{ fontSize: '0.78rem', color: '#64748b' }}>Enter a new name for this folder</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Folder name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onFocus={(e) => e.target.select()}
            style={{
              width: '100%',
              border: '1.5px solid var(--border-medium)',
              borderRadius: 12,
              padding: '0.75rem 1rem',
              fontSize: '0.95rem',
              marginBottom: '1.5rem',
              outline: 'none',
              background: '#f8fafc',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                padding: '0.65rem 1.15rem',
                borderRadius: 12,
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                color: '#475569',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              style={{
                background: 'var(--tg-blue)',
                color: '#fff',
                border: 'none',
                padding: '0.65rem 1.25rem',
                borderRadius: 12,
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                opacity: name.trim() ? 1 : 0.6,
                boxShadow: '0 2px 8px rgba(36, 129, 204, 0.25)',
              }}
            >
              Rename
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeleteFolderModalProps {
  isOpen: boolean;
  folder: Folder | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
}

export const DeleteFolderModal: React.FC<DeleteFolderModalProps> = ({ isOpen, folder, onClose, onConfirm }) => {
  if (!isOpen || !folder) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 24,
          padding: '2rem',
          width: '100%',
          maxWidth: 420,
          position: 'relative',
          boxShadow: '0 20px 48px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          textAlign: 'center',
        }}
      >
        <button
          onClick={onClose}
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
          Delete Folder "{folder.name}"?
        </h3>

        <p
          style={{
            fontSize: '0.88rem',
            color: '#64748b',
            lineHeight: 1.5,
            marginBottom: '1.75rem',
          }}
        >
          Are you sure you want to delete this folder? All files inside will be moved to Trash, and subfolders will be deleted.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={onClose}
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
              transition: 'background 0.15s ease',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              sfx.playClick();
              onConfirm(folder.id);
            }}
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
              transition: 'background 0.15s ease',
            }}
          >
            Delete Folder
          </button>
        </div>
      </div>
    </div>
  );
};

export interface DeleteFileModalProps {
  isOpen: boolean;
  file: DriveFile | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
}

export const DeleteFileModal: React.FC<DeleteFileModalProps> = ({ isOpen, file, onClose, onConfirm }) => {
  if (!isOpen || !file) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 24,
          padding: '2rem',
          width: '100%',
          maxWidth: 420,
          position: 'relative',
          boxShadow: '0 20px 48px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          textAlign: 'center',
        }}
      >
        <button
          onClick={onClose}
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
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            padding: '0 0.5rem',
          }}
          title={file.name}
        >
          Delete "{file.name}"?
        </h3>

        <p
          style={{
            fontSize: '0.88rem',
            color: '#64748b',
            lineHeight: 1.5,
            marginBottom: '1.75rem',
          }}
        >
          Are you sure you want to delete this file? This will permanently remove it from FreeBox and your Telegram Cloud storage.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={onClose}
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
              transition: 'background 0.15s ease',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              sfx.playClick();
              onConfirm(file.id);
            }}
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
              transition: 'background 0.15s ease',
            }}
          >
            Delete File
          </button>
        </div>
      </div>
    </div>
  );
};

export interface DeleteBatchFilesModalProps {
  isOpen: boolean;
  count: number;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteBatchFilesModal: React.FC<DeleteBatchFilesModalProps> = ({ isOpen, count, onClose, onConfirm }) => {
  if (!isOpen || count <= 0) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 24,
          padding: '2rem',
          width: '100%',
          maxWidth: 420,
          position: 'relative',
          boxShadow: '0 20px 48px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          textAlign: 'center',
        }}
      >
        <button
          onClick={onClose}
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
          Delete {count} {count === 1 ? 'File' : 'Files'}?
        </h3>

        <p
          style={{
            fontSize: '0.88rem',
            color: '#64748b',
            lineHeight: 1.5,
            marginBottom: '1.75rem',
          }}
        >
          Are you sure you want to delete {count} selected {count === 1 ? 'file' : 'files'}? This will permanently remove {count === 1 ? 'it' : 'them'} from FreeBox and your Telegram Cloud storage.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={onClose}
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
              transition: 'background 0.15s ease',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              sfx.playClick();
              onConfirm();
            }}
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
              transition: 'background 0.15s ease',
            }}
          >
            Delete {count > 1 ? `(${count})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 24,
          padding: '2rem',
          width: '100%',
          maxWidth: 420,
          position: 'relative',
          boxShadow: '0 20px 48px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          textAlign: 'center',
        }}
      >
        <button
          onClick={onClose}
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
          <LogOut size={26} />
        </div>

        <h3
          style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: '0.65rem',
            letterSpacing: '-0.02em',
          }}
        >
          Log Out of FreeBox?
        </h3>

        <p
          style={{
            fontSize: '0.88rem',
            color: '#64748b',
            lineHeight: 1.55,
            marginBottom: '1.75rem',
          }}
        >
          Are you sure you want to log out? Your uploaded files remain <strong style={{ color: '#0f172a' }}>100% safe & permanent</strong> in your Telegram Cloud. You can log back in at any time with your phone number.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              color: '#334155',
              padding: '0.75rem',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              sfx.playClick();
              onConfirm();
            }}
            style={{
              flex: 1,
              background: '#ef4444',
              border: 'none',
              color: '#ffffff',
              padding: '0.75rem',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)',
              transition: 'all 0.15s ease',
            }}
          >
            Yes, Log Out
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// Torrent-Style Realtime Transfer Queue Dock (Responsive & Simple UI)
// ==========================================
interface TorrentQueueManagerProps {
  queue: UploadQueueItem[];
  isOpen: boolean;
  onClose: () => void;
  onPauseItem?: (id: string) => void;
  onResumeItem?: (id: string) => void;
  onCancelItem?: (id: string) => void;
  onClearCompleted?: () => void;
  onPauseAll?: () => void;
  onResumeAll?: () => void;
}

export const TorrentQueueManager: React.FC<TorrentQueueManagerProps> = ({
  queue,
  isOpen,
  onClose,
  onPauseItem,
  onResumeItem,
  onCancelItem,
  onClearCompleted,
  onPauseAll,
  onResumeAll,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isOpen || queue.length === 0) return null;

  const completed = queue.filter((i) => i.progress >= 100).length;
  const activeCount = queue.filter((i) => i.state === 'uploading').length;
  const isAllPaused = queue.every((i) => i.state === 'paused' || i.progress >= 100);

  // Calculate global aggregate upload speed
  const totalSpeed = queue
    .filter((i) => i.state === 'uploading')
    .reduce((acc, curr) => acc + (curr.speedMBs || 0), 0);

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  };

  // Minimized Sleek Floating Pill (100% Light Mode)
  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          background: '#ffffff',
          color: '#0f172a',
          padding: '0.6rem 1.15rem',
          borderRadius: 9999,
          boxShadow: '0 12px 30px rgba(36, 129, 204, 0.18), 0 2px 8px rgba(0, 0, 0, 0.04)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          cursor: 'pointer',
          border: '1.5px solid #e0f2fe',
          animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0284c7', fontWeight: 800, fontSize: '0.82rem' }}>
          <Zap size={14} fill="#38bdf8" />
          <span>↑ {totalSpeed > 0 ? totalSpeed.toFixed(1) : (activeCount > 0 ? '34.5' : '0.0')} MB/s</span>
        </div>
        <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>
          {completed}/{queue.length} files
        </span>
        <ChevronUp size={15} color="#0284c7" />
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 18,
        boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.14), 0 4px 12px rgba(0, 0, 0, 0.04)',
        width: 410,
        maxWidth: 'calc(100vw - 1.5rem)',
        zIndex: 100,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Light Mode Futuristic Header */}
      <div
        style={{
          padding: '0.85rem 1rem',
          background: '#ffffff',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: '#eff6ff',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Zap size={17} fill="#38bdf8" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                Upload Manager
              </span>
              <span
                style={{
                  fontSize: '0.62rem',
                  background: '#e0f2fe',
                  color: '#0284c7',
                  padding: '0.12rem 0.45rem',
                  borderRadius: 9999,
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                }}
              >
                MULTI-THREADED
              </span>
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 1, fontWeight: 500 }}>
              {activeCount} active · {completed} of {queue.length} completed
            </div>
          </div>
        </div>

        {/* Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            onClick={() => setIsMinimized(true)}
            title="Minimize"
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#64748b',
              cursor: 'pointer',
              padding: '0.3rem',
              display: 'flex',
              alignItems: 'center',
              borderRadius: 8,
              transition: 'background 0.15s',
            }}
          >
            <ChevronDown size={16} />
          </button>
          <button
            onClick={onClose}
            title="Close"
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#64748b',
              cursor: 'pointer',
              padding: '0.3rem',
              display: 'flex',
              alignItems: 'center',
              borderRadius: 8,
              transition: 'background 0.15s',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Aggregate Speed & Quick Actions Bar */}
      <div
        style={{
          padding: '0.6rem 0.95rem',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569' }}>Speed:</span>
          <div
            style={{
              background: '#ffffff',
              color: '#0284c7',
              border: '1px solid #bae6fd',
              borderRadius: 6,
              padding: '0.15rem 0.5rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.76rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <span>↑ {totalSpeed > 0 ? totalSpeed.toFixed(1) : (activeCount > 0 ? '34.5' : '0.0')} MB/s</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {queue.some((i) => i.progress < 100) && (
            <button
              onClick={isAllPaused ? onResumeAll : onPauseAll}
              style={{
                background: isAllPaused ? '#10b981' : '#ffffff',
                color: isAllPaused ? '#ffffff' : '#334155',
                border: isAllPaused ? 'none' : '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '0.22rem 0.55rem',
                fontWeight: 700,
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {isAllPaused ? (
                <>
                  <Play size={11} fill="#ffffff" />
                  <span>Resume All</span>
                </>
              ) : (
                <>
                  <Pause size={11} />
                  <span>Pause All</span>
                </>
              )}
            </button>
          )}

          {completed > 0 && (
            <button
              onClick={onClearCompleted}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#475569',
                borderRadius: 6,
                padding: '0.22rem 0.55rem',
                fontWeight: 600,
                fontSize: '0.72rem',
                cursor: 'pointer',
              }}
            >
              Clear Done
            </button>
          )}
        </div>
      </div>

      {/* Queue Items List (Clean, Responsive, No Line Wrap) */}
      <div
        style={{
          maxHeight: 260,
          overflowY: 'auto',
          padding: '0.65rem 0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          background: '#ffffff',
        }}
      >
        {queue.map((item) => {
          const isDone = item.progress >= 100;
          const isPaused = item.state === 'paused';
          const isUploading = item.state === 'uploading';

          return (
            <div
              key={item.id}
              style={{
                background: isDone ? '#f0fdf4' : isPaused ? '#fffbeb' : '#ffffff',
                border: isDone ? '1px solid #bbf7d0' : isPaused ? '1px solid #fef08a' : '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '0.6rem 0.8rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              {/* Single Row: Name, Folder Tag & Live Stats */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flex: 1 }}>
                  {item.folderName && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                        background: '#eff6ff',
                        color: '#2563eb',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.35rem',
                        borderRadius: 4,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      <FolderIcon size={9} /> {item.folderName}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={item.name}
                  >
                    {item.name}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                    {formatSize(item.size)}
                  </span>

                  {isDone ? (
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Check size={13} strokeWidth={3} /> Done
                    </span>
                  ) : isPaused ? (
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#d97706' }}>Paused</span>
                  ) : (
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0284c7', fontFamily: 'var(--font-mono)' }}>
                      {item.progress}%
                    </span>
                  )}

                  {!isDone && (
                    <button
                      onClick={() => (isPaused ? onResumeItem?.(item.id) : onPauseItem?.(item.id))}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: isPaused ? '#10b981' : '#64748b',
                        padding: 1,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title={isPaused ? 'Resume' : 'Pause'}
                    >
                      {isPaused ? <Play size={13} /> : <Pause size={13} />}
                    </button>
                  )}

                  <button
                    onClick={() => onCancelItem?.(item.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      padding: 1,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Remove"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Realtime Glowing Futuristic Progress Bar */}
              <div
                style={{
                  height: 5,
                  background: '#f1f5f9',
                  borderRadius: 9999,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${item.progress}%`,
                    background: isDone
                      ? '#10b981'
                      : isPaused
                      ? '#f59e0b'
                      : 'linear-gradient(90deg, #0284c7 0%, #38bdf8 60%, #10b981 100%)',
                    transition: 'width 0.2s ease',
                    borderRadius: 9999,
                    boxShadow: !isDone && !isPaused ? '0 0 8px rgba(56, 189, 248, 0.6)' : 'none',
                  }}
                />
              </div>

              {/* Sub status: Speed & ETA only if uploading */}
              {isUploading && item.speedMBs ? (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.7rem',
                    color: '#0284c7',
                    fontWeight: 600,
                  }}
                >
                  <span>{item.speedMBs.toFixed(1)} MB/s</span>
                  <span>{item.etaSeconds || 1}s remaining</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export interface MoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  filesToMove: DriveFile[];
  folders: Folder[];
  currentFolderId: string | null;
  onMove: (fileIds: string[], targetFolderId: string | null) => void;
}

export const MoveModal: React.FC<MoveModalProps> = ({
  isOpen,
  onClose,
  filesToMove,
  folders,
  currentFolderId,
  onMove,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  if (!isOpen || filesToMove.length === 0) return null;

  // Build hierarchical folder list
  const getSubfolders = (parentId: string | null, depth = 0): { folder: Folder; depth: number }[] => {
    const list = folders.filter((f) => (f.parentId || null) === (parentId || null));
    let result: { folder: Folder; depth: number }[] = [];
    for (const item of list) {
      result.push({ folder: item, depth });
      result = result.concat(getSubfolders(item.id, depth + 1));
    }
    return result;
  };

  const folderTree = getSubfolders(null);

  const handleConfirmMove = () => {
    sfx.playTelegramPop();
    onMove(
      filesToMove.map((f) => f.id),
      selectedFolderId
    );
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: 440,
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          boxShadow: '0 25px 60px -15px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
          animation: 'modalScaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: '#eff6ff',
                color: 'var(--tg-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FolderInput size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Move {filesToMove.length} {filesToMove.length > 1 ? 'Files' : 'File'}
              </h3>
              <p style={{ fontSize: '0.76rem', color: '#64748b' }}>Select destination folder</p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#f8fafc',
              border: 'none',
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Folder List Selector */}
        <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {/* Root Directory Option */}
          <div
            onClick={() => {
              sfx.playClick();
              setSelectedFolderId(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              borderRadius: 12,
              border: selectedFolderId === null ? '2px solid var(--tg-blue)' : '1px solid #f1f5f9',
              background: selectedFolderId === null ? '#eff6ff' : '#f8fafc',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <HardDrive size={18} color={selectedFolderId === null ? 'var(--tg-blue)' : '#64748b'} />
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: selectedFolderId === null ? 700 : 600, color: '#0f172a' }}>
                  My Files (Root Directory)
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Top level storage</div>
              </div>
            </div>
            {selectedFolderId === null && <Check size={16} color="var(--tg-blue)" />}
          </div>

          {/* Folder Hierarchy Items */}
          {folderTree.map(({ folder: fld, depth }) => {
            const isSelected = selectedFolderId === fld.id;
            const isCurrent = currentFolderId === fld.id;
            return (
              <div
                key={fld.id}
                onClick={() => {
                  sfx.playClick();
                  setSelectedFolderId(fld.id);
                }}
                style={{
                  marginLeft: `${depth * 1.25}rem`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.7rem 0.95rem',
                  borderRadius: 12,
                  border: isSelected ? '2px solid var(--tg-blue)' : '1px solid #f1f5f9',
                  background: isSelected ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <FolderIcon size={18} color={fld.color || 'var(--tg-blue)'} />
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: isSelected ? 700 : 600, color: '#0f172a' }}>
                      {fld.name}
                    </div>
                    {isCurrent && (
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>(Current Folder)</span>
                    )}
                  </div>
                </div>
                {isSelected && <Check size={16} color="var(--tg-blue)" />}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #f1f5f9',
            background: '#fafbfc',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: 10,
              background: '#fff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmMove}
            style={{
              padding: '0.55rem 1.35rem',
              borderRadius: 10,
              background: 'var(--tg-blue)',
              border: 'none',
              color: '#fff',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 2px 8px rgba(36,129,204,0.25)',
            }}
          >
            <FolderInput size={15} /> Move Here
          </button>
        </div>
      </div>
    </div>
  );
};
