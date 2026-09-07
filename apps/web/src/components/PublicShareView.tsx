import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Copy, 
  Check, 
  HardDrive, 
  ShieldCheck, 
  Zap, 
  FileText, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Music, 
  Archive, 
  ExternalLink,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';

interface PublicFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  type: string;
  spoolHash: string;
  createdAt: string;
  streamUrl: string;
  downloadUrl: string;
}

interface PublicShareViewProps {
  spoolHash: string;
  onGoHome: () => void;
}

export const PublicShareView: React.FC<PublicShareViewProps> = ({ spoolHash, onGoHome }) => {
  const [file, setFile] = useState<PublicFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchPublicInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/drive/public/share/${encodeURIComponent(spoolHash)}`);
        if (!res.ok) {
          throw new Error('Shared file could not be found or has expired.');
        }
        const data = await res.json();
        if (isMounted) {
          setFile(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load file preview.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (spoolHash) {
      fetchPublicInfo();
    }
    return () => {
      isMounted = false;
    };
  }, [spoolHash]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const streamUrl = `/api/drive/public/stream/${encodeURIComponent(spoolHash)}`;
  const downloadUrl = `/api/drive/public/download/${encodeURIComponent(spoolHash)}`;

  const getFileIcon = () => {
    if (!file) return <FileText size={32} color="#2481cc" />;
    switch (file.type) {
      case 'image':
        return <ImageIcon size={32} color="#10b981" />;
      case 'video':
        return <VideoIcon size={32} color="#8b5cf6" />;
      case 'audio':
        return <Music size={32} color="#f59e0b" />;
      case 'archive':
        return <Archive size={32} color="#ec4899" />;
      default:
        return <FileText size={32} color="#2481cc" />;
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#1e293b',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Navigation */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '0.85rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          onClick={onGoHome}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #2481cc 0%, #0088cc 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(36, 129, 204, 0.25)',
            }}
          >
            <HardDrive size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em', color: '#0f172a' }}>
              FreeBox <span style={{ color: '#2481cc', fontWeight: 600, fontSize: '0.85rem' }}>Cloud</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap size={10} color="#10b981" /> High-Speed Telegram CDN
            </div>
          </div>
        </div>

        <button
          onClick={onGoHome}
          style={{
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            color: '#334155',
            padding: '0.5rem 1rem',
            borderRadius: 10,
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e2e8f0';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f1f5f9';
          }}
        >
          <ArrowLeft size={16} /> FreeBox App
        </button>
      </header>

      {/* Main Content View */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1rem',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 780,
            background: '#ffffff',
            borderRadius: 24,
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  border: '3px solid #e2e8f0',
                  borderTopColor: '#2481cc',
                  borderRadius: '50%',
                  margin: '0 auto 1.5rem',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.35rem' }}>
                Connecting to Telegram CDN...
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Streaming file buffer directly from Telegram MTProto network
              </p>
            </div>
          ) : error || !file ? (
            <div style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: '#fef2f2',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                }}
              >
                <AlertCircle size={28} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                File Not Available
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#64748b', maxWidth: 420, margin: '0 auto 1.5rem' }}>
                {error || 'The requested file could not be loaded or the share link has expired.'}
              </p>
              <button
                onClick={onGoHome}
                style={{
                  background: '#2481cc',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.65rem 1.5rem',
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Go to FreeBox Home
              </button>
            </div>
          ) : (
            <div>
              {/* Card Header */}
              <div
                style={{
                  padding: '1.5rem 1.75rem',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {getFileIcon()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      margin: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={file.name}
                  >
                    {file.name}
                  </h2>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontSize: '0.8rem',
                      color: '#64748b',
                      marginTop: 4,
                    }}
                  >
                    <span style={{ fontWeight: 600, color: '#334155' }}>{formatBytes(file.size)}</span>
                    <span>•</span>
                    <span style={{ textTransform: 'uppercase' }}>{file.mimeType || file.type}</span>
                  </div>
                </div>
              </div>

              {/* Preview Body */}
              <div
                style={{
                  background: '#f8fafc',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 280,
                  maxHeight: 560,
                  overflow: 'hidden',
                  position: 'relative',
                  padding: '1rem',
                }}
              >
                {file.type === 'image' || file.mimeType.startsWith('image/') ? (
                  <img
                    src={streamUrl}
                    alt={file.name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: 520,
                      objectFit: 'contain',
                      borderRadius: 12,
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
                    }}
                  />
                ) : file.type === 'video' || file.mimeType.startsWith('video/') ? (
                  <video
                    controls
                    autoPlay={false}
                    src={streamUrl}
                    style={{
                      width: '100%',
                      maxHeight: 520,
                      borderRadius: 12,
                      background: '#000',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                    }}
                  />
                ) : file.type === 'audio' || file.mimeType.startsWith('audio/') ? (
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 480,
                      background: '#ffffff',
                      padding: '2rem',
                      borderRadius: 16,
                      border: '1px solid #e2e8f0',
                      textAlign: 'center',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    }}
                  >
                    <Music size={48} color="#2481cc" style={{ margin: '0 auto 1rem' }} />
                    <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '1rem', color: '#0f172a' }}>
                      {file.name}
                    </div>
                    <audio controls src={streamUrl} style={{ width: '100%' }} />
                  </div>
                ) : file.mimeType === 'text/html' || file.name.endsWith('.html') ? (
                  <iframe
                    src={streamUrl}
                    title={file.name}
                    style={{
                      width: '100%',
                      height: 480,
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      background: '#fff',
                    }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '2.5rem' }}>
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 20,
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                      }}
                    >
                      {getFileIcon()}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem', color: '#0f172a', marginBottom: '0.25rem' }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      No inline preview available for this format. Download below to view.
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons & Info Footer */}
              <div style={{ padding: '1.5rem 1.75rem' }}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <a
                    href={downloadUrl}
                    download={file.name}
                    style={{
                      flex: 1,
                      minWidth: 180,
                      background: '#2481cc',
                      color: '#ffffff',
                      textDecoration: 'none',
                      padding: '0.85rem 1.25rem',
                      borderRadius: 14,
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 4px 14px rgba(36, 129, 204, 0.3)',
                      transition: 'all 0.15s ease',
                      cursor: 'pointer',
                    }}
                  >
                    <Download size={18} />
                    Download File ({formatBytes(file.size)})
                  </a>

                  <button
                    onClick={handleCopyLink}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#334155',
                      padding: '0.85rem 1.25rem',
                      borderRadius: 14,
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {copied ? <Check size={18} color="#10b981" /> : <Copy size={18} />}
                    {copied ? 'Link Copied!' : 'Copy Link'}
                  </button>

                  <a
                    href={streamUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      color: '#64748b',
                      padding: '0.85rem 1rem',
                      borderRadius: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                    title="Open Direct Stream URL"
                  >
                    <ExternalLink size={18} />
                  </a>
                </div>

                {/* CDN Security Badge */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.8rem',
                    color: '#64748b',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={16} color="#10b981" />
                    <span>Hosted on Telegram MTProto Cloud • Direct High-Speed CDN</span>
                  </div>
                  <span style={{ fontWeight: 600, color: '#10b981' }}>Active</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
