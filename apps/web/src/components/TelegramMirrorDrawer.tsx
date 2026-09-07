import React from 'react';
import { Bookmark, Search, X, Paperclip } from 'lucide-react';
import { DriveFile } from '../types';
import { api } from '../services/api';

interface TelegramMirrorDrawerProps {
  files: DriveFile[];
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (file: DriveFile) => void;
}

export const TelegramMirrorDrawer: React.FC<TelegramMirrorDrawerProps> = ({
  files,
  isOpen,
  onClose,
  onSelectFile,
}) => {
  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  };

  return (
    <aside className={`tg-inspector-drawer ${!isOpen ? 'collapsed' : ''}`}>
      {/* Header (Image 3 & 4 Match) */}
      <div style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#3390ec', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bookmark size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Saved Messages</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{files.length} messages</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--text-muted)' }}>
            <Search size={18} />
          </button>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages Area with Doodle Background (Image 3 Match) */}
      <div className="tg-chat-messages-area">
        <div className="tg-date-badge">{files.length > 0 ? new Date(files[0].createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'Today'}</div>

        {files.map((file) => (
          <div
            key={file.id}
            className="tg-msg-bubble"
            onClick={() => onSelectFile(file)}
            title="Click to preview file"
          >
            {file.type === 'image' && file.telegramMsgId > 0 ? (
              <img
                src={api.getFileStreamUrl(file.id)}
                alt="thumbnail"
                style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div
                style={{ width: 48, height: 48, borderRadius: 8, background: '#4fae4e', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}
              >
                <span>file</span>
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }}>
                {file.spoolHash}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#708b68', marginTop: '0.15rem' }}>
                <span>{formatSize(file.size)}</span>
                <span>·</span>
                <span>{new Date(file.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span style={{ color: '#4fae4e', marginLeft: 'auto', fontWeight: 700 }}>✓✓</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chat Footer Input */}
      <div style={{ background: '#fff', padding: '0.65rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <input
          type="text"
          placeholder="Spooling live to Saved Messages..."
          readOnly
          style={{ flex: 1, background: '#f1f5f9', border: 'none', borderRadius: 9999, padding: '0.55rem 0.95rem', fontSize: '0.88rem', outline: 'none' }}
        />
        <button style={{ background: 'transparent', border: 'none', color: 'var(--tg-blue)', cursor: 'pointer', padding: 4 }}>
          <Paperclip size={20} />
        </button>
      </div>
    </aside>
  );
};
