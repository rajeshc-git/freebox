import React, { useState, useEffect, useRef } from 'react';
import { Search, Folder, File, Upload, Plus, Send, Grid, List, Volume2, VolumeX, Trash2, ArrowRight } from 'lucide-react';
import { DriveFile, Folder as FolderType } from '../types';
import { sfx } from '../services/sound';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  files: DriveFile[];
  folders: FolderType[];
  onSelectFile: (file: DriveFile) => void;
  onNavigateFolder: (id: string | null) => void;
  onOpenUpload: () => void;
  onOpenNewFolder: () => void;
  onToggleViewMode: (mode: 'grid' | 'list') => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  files,
  folders,
  onSelectFile,
  onNavigateFolder,
  onOpenUpload,
  onOpenNewFolder,
  onToggleViewMode,
  soundEnabled,
  onToggleSound,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredFiles = files.filter(
    (f) => f.name.toLowerCase().includes(query.toLowerCase()) || f.spoolHash.toLowerCase().includes(query.toLowerCase())
  );

  const filteredFolders = folders.filter((fld) => fld.name.toLowerCase().includes(query.toLowerCase()));

  const actions = [
    { id: 'upload', title: 'Upload New File to Telegram Cloud', icon: Upload, run: onOpenUpload },
    { id: 'new-folder', title: 'Create New Folder', icon: Plus, run: onOpenNewFolder },
    { id: 'grid-view', title: 'Switch to Grid View', icon: Grid, run: () => onToggleViewMode('grid') },
    { id: 'list-view', title: 'Switch to List View', icon: List, run: () => onToggleViewMode('list') },
    { id: 'sound', title: soundEnabled ? 'Mute Futuristic Sound FX' : 'Enable Futuristic Sound FX', icon: soundEnabled ? VolumeX : Volume2, run: onToggleSound },
  ].filter((a) => a.title.toLowerCase().includes(query.toLowerCase()));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          borderRadius: 20,
          width: '100%',
          maxWidth: 620,
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
          animation: 'palettePop 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Search Input Bar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', gap: '0.75rem' }}>
          <Search size={20} color="var(--tg-blue)" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search files, folders, or run quick actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '1.05rem',
              fontWeight: 500,
              color: 'var(--text-main)',
            }}
          />
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: 6, color: 'var(--text-light)' }}>
            ESC
          </span>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: 380, overflowY: 'auto', padding: '0.75rem' }}>
          {/* Quick Actions */}
          {actions.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-light)', padding: '0.25rem 0.6rem', textTransform: 'uppercase' }}>
                Quick Actions
              </div>
              {actions.map((act) => (
                <div
                  key={act.id}
                  onClick={() => { sfx.playClick(); act.run(); onClose(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.75rem',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: 'var(--text-main)',
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <act.icon size={16} color="var(--tg-blue)" />
                    <span>{act.title}</span>
                  </div>
                  <ArrowRight size={14} color="var(--text-light)" />
                </div>
              ))}
            </div>
          )}

          {/* Folders */}
          {filteredFolders.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-light)', padding: '0.25rem 0.6rem', textTransform: 'uppercase' }}>
                Folders
              </div>
              {filteredFolders.map((fld) => (
                <div
                  key={fld.id}
                  onClick={() => { sfx.playClick(); onNavigateFolder(fld.id); onClose(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.65rem 0.75rem',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: 'var(--text-main)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Folder size={16} color={fld.color} />
                  <span style={{ fontWeight: 600 }}>{fld.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Files */}
          {filteredFiles.length > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-light)', padding: '0.25rem 0.6rem', textTransform: 'uppercase' }}>
                Files ({filteredFiles.length})
              </div>
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={() => { sfx.playClick(); onSelectFile(file); onClose(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.75rem',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <File size={16} color="var(--tg-blue)" />
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{file.name}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-light)' }}>
                    {file.spoolHash}
                  </span>
                </div>
              ))}
            </div>
          )}

          {actions.length === 0 && filteredFolders.length === 0 && filteredFiles.length === 0 && (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.9rem' }}>
              No matching files or actions found for "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
