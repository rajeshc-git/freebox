import React, { useState, useEffect, useRef } from 'react';
import {
  Folder as FolderIcon,
  Star,
  Trash2,
  FileText,
  Grid,
  List,
  Search,
  Plus,
  Upload,
  Send,
  LogOut,
  Share2,
  Eye,
  Activity,
  Volume2,
  VolumeX,
  CheckSquare,
  Square,
  Download,
  Command,
  FolderUp,
  FolderPlus,
  Menu,
  X,
  ChevronRight,
  ArrowLeft,
  Move,
  CornerDownRight,
  FolderInput,
} from 'lucide-react';
import { User, Folder, DriveFile, StorageMetrics } from '../types';
import { sfx } from '../services/sound';
import { api } from '../services/api';
import { MoveModal } from './Modals';

interface DriveExplorerProps {
  user: User | null;
  folders: Folder[];
  files: DriveFile[];
  metrics: StorageMetrics | null;
  currentFolderId: string | null;
  currentNav: string;
  currentCategory: string;
  searchQuery: string;
  viewMode: 'grid' | 'list';
  soundEnabled: boolean;
  onNavigateFolder: (id: string | null) => void;
  onSelectNav: (nav: string) => void;
  onSelectCategory: (cat: string) => void;
  onSearchChange: (q: string) => void;
  onToggleViewMode: (mode: 'grid' | 'list') => void;
  onOpenUpload: () => void;
  onOpenFolderUpload: () => void;
  onOpenNewFolder: () => void;
  onOpenCommandPalette: () => void;
  onToggleSound: () => void;
  onPreviewFile: (file: DriveFile) => void;
  onShareFile: (file: DriveFile) => void;
  onToggleStar: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onMoveFiles: (fileIds: string[], targetFolderId: string | null) => void;
  onDropFolderItems: (items: { file: File; relativePath: string }[]) => void;
  onLogout: () => void;
}

export const DriveExplorer: React.FC<DriveExplorerProps> = ({
  user,
  folders,
  files,
  metrics,
  currentFolderId,
  currentNav,
  currentCategory,
  searchQuery,
  viewMode,
  soundEnabled,
  onNavigateFolder,
  onSelectNav,
  onSelectCategory,
  onSearchChange,
  onToggleViewMode,
  onOpenUpload,
  onOpenFolderUpload,
  onOpenNewFolder,
  onOpenCommandPalette,
  onToggleSound,
  onPreviewFile,
  onShareFile,
  onToggleStar,
  onDeleteFile,
  onMoveFiles,
  onDropFolderItems,
  onLogout,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragTargetFolderId, setDragTargetFolderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [draggingFileId, setDraggingFileId] = useState<string | null>(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [filesForMove, setFilesForMove] = useState<DriveFile[]>([]);

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  };

  const currentFolder = folders.find((f) => f.id === currentFolderId);
  const currentFolders = folders.filter((f) => (f.parentId || null) === (currentFolderId || null));

  // Compute folder ancestry path for breadcrumbs
  const getFolderPath = (folderId: string | null): Folder[] => {
    if (!folderId) return [];
    const path: Folder[] = [];
    let curr = folders.find((f) => f.id === folderId);
    let depth = 0;
    while (curr && depth < 20) {
      path.unshift(curr);
      curr = curr.parentId ? folders.find((f) => f.id === curr!.parentId) : undefined;
      depth++;
    }
    return path;
  };
  const folderPath = getFolderPath(currentFolderId);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing inside input / textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      // Space -> QuickLook preview of first selected file
      if (e.code === 'Space') {
        e.preventDefault();
        if (selectedIds.length > 0) {
          const fileToPreview = files.find((f) => f.id === selectedIds[0]);
          if (fileToPreview) onPreviewFile(fileToPreview);
        } else if (files.length > 0) {
          onPreviewFile(files[0]);
        }
      }

      // Delete / Backspace -> delete selected files
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          sfx.playClick();
          selectedIds.forEach((id) => onDeleteFile(id));
          setSelectedIds([]);
        }
      }

      // Cmd+A / Ctrl+A -> Select All
      if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        sfx.playClick();
        setSelectedIds(files.map((f) => f.id));
      }

      // Escape -> Clear selection
      if (e.key === 'Escape') {
        setSelectedIds([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, files, onPreviewFile, onDeleteFile]);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sfx.playClick();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const selectAll = () => {
    sfx.playClick();
    if (selectedIds.length === files.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(files.map((f) => f.id));
    }
  };

  // Drag and drop scanning for dropped folders/files
  const handleContainerDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    // If an internal file was being dragged, do not treat as external upload
    if (draggingFileId) {
      setDraggingFileId(null);
      return;
    }

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    const fileEntries: { file: File; relativePath: string }[] = [];

    const traverseEntry = async (entry: any, path = '') => {
      if (entry.isFile) {
        const file: File = await new Promise((resolve) => entry.file(resolve));
        fileEntries.push({ file, relativePath: path + file.name });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const readEntries = async (): Promise<any[]> => {
          return new Promise((resolve) => {
            dirReader.readEntries((entries: any[]) => resolve(entries));
          });
        };
        let entries: any[] = [];
        let batch: any[] = [];
        do {
          batch = await readEntries();
          entries = entries.concat(batch);
        } while (batch.length > 0);

        for (const child of entries) {
          await traverseEntry(child, `${path}${entry.name}/`);
        }
      }
    };

    const promises: Promise<void>[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry) promises.push(traverseEntry(entry));
      } else {
        const file = item.getAsFile();
        if (file) fileEntries.push({ file, relativePath: file.name });
      }
    }

    await Promise.all(promises);

    if (fileEntries.length > 0) {
      onDropFolderItems(fileEntries);
    }
  };

  // Drop internal file into a folder card
  const handleDropOnFolder = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTargetFolderId(null);

    const draggedId = e.dataTransfer.getData('text/plain') || draggingFileId;
    if (!draggedId) return;

    const idsToMove = selectedIds.includes(draggedId) ? selectedIds : [draggedId];
    sfx.playTelegramPop();
    onMoveFiles(idsToMove, targetFolderId);
    setSelectedIds([]);
    setDraggingFileId(null);
  };

  return (
    <div className="app-wrapper" style={{ position: 'relative', display: 'flex', width: '100%', height: '100vh', overflow: 'hidden' }}>
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 90,
          }}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`app-sidebar ${isMobileSidebarOpen ? 'mobile-open' : ''}`}
        style={{
          width: 260,
          background: '#ffffff',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 95,
        }}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            className="brand-logo"
            onClick={() => {
              sfx.playClick();
              onNavigateFolder(null);
            }}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <img src="/freebox-logo.svg" alt="FreeBox" style={{ width: 32, height: 32 }} />
            <span className="brand-name" style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-main)' }}>
              FreeBox
            </span>
          </div>

          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="mobile-close-btn"
            style={{
              display: 'none',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-light)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <ul style={{ padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', listStyle: 'none' }}>
          {[
            { id: 'all', label: 'My Files', icon: FolderIcon, count: files.length },
            { id: 'starred', label: 'Starred', icon: Star, count: files.filter((f) => f.starred).length },
            { id: 'trash', label: 'Trash', icon: Trash2, count: 0 },
          ].map((item) => (
            <li
              key={item.id}
              onClick={() => {
                sfx.playClick();
                onSelectNav(item.id);
                setIsMobileSidebarOpen(false);
              }}
              onDragOver={(e) => {
                if (item.id === 'all') {
                  e.preventDefault();
                  setDragTargetFolderId('sidebar-all');
                }
              }}
              onDragLeave={() => {
                if (item.id === 'all' && dragTargetFolderId === 'sidebar-all') {
                  setDragTargetFolderId(null);
                }
              }}
              onDrop={(e) => {
                if (item.id === 'all') {
                  handleDropOnFolder(e, null);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                borderRadius: 12,
                fontSize: '0.92rem',
                fontWeight: currentNav === item.id || dragTargetFolderId === 'sidebar-all' ? 700 : 600,
                color: dragTargetFolderId === 'sidebar-all' ? '#2563eb' : currentNav === item.id ? 'var(--tg-blue)' : 'var(--text-muted)',
                background: dragTargetFolderId === 'sidebar-all' ? '#dbeafe' : currentNav === item.id ? '#eef6fd' : 'transparent',
                border: dragTargetFolderId === 'sidebar-all' ? '1.5px dashed var(--tg-blue)' : '1.5px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <item.icon size={18} />
                <span>{item.label}</span>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  background: currentNav === item.id ? 'rgba(36,129,204,0.15)' : 'rgba(0,0,0,0.05)',
                  color: currentNav === item.id ? 'var(--tg-blue)' : 'var(--text-muted)',
                  padding: '0.1rem 0.5rem',
                  borderRadius: 9999,
                }}
              >
                {item.count}
              </span>
            </li>
          ))}
        </ul>

        <div
          style={{
            padding: '1.25rem 1.25rem 0.5rem 1.25rem',
            fontSize: '0.72rem',
            fontWeight: 800,
            letterSpacing: '0.06em',
            color: 'var(--text-light)',
            textTransform: 'uppercase',
          }}
        >
          CATEGORIES
        </div>

        <ul style={{ padding: '0 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', listStyle: 'none' }}>
          {[
            { id: 'image', label: 'Photos', count: metrics?.categories?.images || 0 },
            { id: 'video', label: 'Videos', count: metrics?.categories?.videos || 0 },
            { id: 'document', label: 'Documents', count: metrics?.categories?.documents || 0 },
            { id: 'audio', label: 'Audio', count: metrics?.categories?.audio || 0 },
            { id: 'archive', label: 'Archives', count: metrics?.categories?.archives || 0 },
          ].map((cat) => (
            <li
              key={cat.id}
              onClick={() => {
                sfx.playClick();
                onSelectCategory(cat.id);
                setIsMobileSidebarOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.6rem 0.85rem',
                borderRadius: 12,
                fontSize: '0.88rem',
                fontWeight: 500,
                color: currentCategory === cat.id ? 'var(--tg-blue)' : 'var(--text-muted)',
                background: currentCategory === cat.id ? '#eef6fd' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <span>{cat.label}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>{cat.count}</span>
            </li>
          ))}
        </ul>

        {/* User Footer */}
        <div
          style={{
            marginTop: 'auto',
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'var(--tg-blue)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.82rem',
              }}
            >
              {user?.avatar || 'FD'}
            </div>
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>{user?.name || 'Telegram User'}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>{user?.phone || '+91 FreeBox'}</div>
            </div>
          </div>
          <button
            onClick={() => {
              sfx.playClick();
              onLogout();
            }}
            title="Logout"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-light)',
              padding: '0.35rem',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.background = '#fee2e2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-light)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fafbfc', overflow: 'hidden' }}>
        {/* Top Header */}
        <header
          style={{
            padding: '0.85rem 1.75rem',
            background: '#fff',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, maxWidth: 520 }}>
            {/* Mobile Sidebar Toggle */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="mobile-hamburger-btn"
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: 8,
                padding: '0.5rem',
                cursor: 'pointer',
                display: 'none',
              }}
            >
              <Menu size={18} />
            </button>

            {/* Global Search Bar */}
            <div
              style={{
                position: 'relative',
                flex: 1,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Search size={16} color="var(--text-light)" style={{ position: 'absolute', left: '0.85rem' }} />
              <input
                type="text"
                placeholder="Search files or Telegram spool hash... (⌘K)"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                style={{
                  width: '100%',
                  background: '#f1f5f9',
                  border: '1px solid transparent',
                  borderRadius: 9999,
                  padding: '0.55rem 1rem 0.55rem 2.4rem',
                  fontSize: '0.88rem',
                  outline: 'none',
                  transition: 'all 0.18s ease',
                }}
              />
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {/* Cmd+K shortcut button */}
            <button
              onClick={onOpenCommandPalette}
              title="Command Palette (Cmd+K)"
              className="hide-on-mobile"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: '#f1f5f9',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                padding: '0.45rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <Command size={13} />
              <span>⌘K</span>
            </button>

            {/* Sound Toggle */}
            <button
              onClick={() => {
                onToggleSound();
                sfx.playClick();
              }}
              title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: soundEnabled ? 'var(--tg-blue)' : 'var(--text-light)',
                flexShrink: 0,
              }}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            {/* Upload File Button */}
            <button className="btn-action-primary" onClick={() => { sfx.playClick(); onOpenUpload(); }} style={{ flexShrink: 0 }}>
              <Upload size={15} />
              <span>Upload File</span>
            </button>

            {/* Bulk Upload Folder Button */}
            <button
              onClick={() => { sfx.playClick(); onOpenFolderUpload(); }}
              className="hide-on-mobile"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                padding: '0.55rem 1rem',
                borderRadius: 9999,
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
              title="Upload entire directory with subfolders"
            >
              <FolderUp size={15} />
              <span>Upload Folder</span>
            </button>

            {/* New Folder Button */}
            <button className="btn-action-secondary hide-on-mobile" onClick={() => { sfx.playClick(); onOpenNewFolder(); }} style={{ flexShrink: 0 }}>
              <Plus size={15} />
              <span>New Folder</span>
            </button>


            {/* View Mode Toggle */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.2rem', borderRadius: 9999 }}>
              <button
                onClick={() => { sfx.playClick(); onToggleViewMode('grid'); }}
                style={{
                  background: viewMode === 'grid' ? '#fff' : 'transparent',
                  border: 'none',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 9999,
                  color: viewMode === 'grid' ? 'var(--tg-blue)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <Grid size={15} />
              </button>
              <button
                onClick={() => { sfx.playClick(); onToggleViewMode('list'); }}
                style={{
                  background: viewMode === 'list' ? '#fff' : 'transparent',
                  border: 'none',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 9999,
                  color: viewMode === 'list' ? 'var(--tg-blue)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </header>

        {/* Breadcrumbs & Filters Subbar */}
        <div
          className="explorer-subbar"
          style={{
            padding: '0.75rem 1.75rem',
            borderBottom: '1px solid var(--border-subtle)',
            background: '#fff',
          }}
        >
          {/* Top Row on Mobile / Left on Desktop: Breadcrumb path with Select All on Mobile */}
          <div className="explorer-subbar-top">
            {/* Breadcrumb path with Back Arrow and Drag Target */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem', flexWrap: 'wrap', minWidth: 0 }}>
              {currentFolderId && (
                <button
                  onClick={() => {
                    sfx.playClick();
                    onNavigateFolder(currentFolder?.parentId || null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragTargetFolderId('breadcrumb-back-arrow');
                  }}
                  onDragLeave={() => {
                    if (dragTargetFolderId === 'breadcrumb-back-arrow') setDragTargetFolderId(null);
                  }}
                  onDrop={(e) => handleDropOnFolder(e, currentFolder?.parentId || null)}
                  title="Back to parent folder (or drop files here to move out)"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: dragTargetFolderId === 'breadcrumb-back-arrow' ? '1.5px dashed var(--tg-blue)' : '1px solid var(--border-medium)',
                    background: dragTargetFolderId === 'breadcrumb-back-arrow' ? '#eff6ff' : '#fff',
                    color: dragTargetFolderId === 'breadcrumb-back-arrow' ? 'var(--tg-blue)' : 'var(--text-main)',
                    cursor: 'pointer',
                    marginRight: '0.25rem',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ArrowLeft size={16} />
                </button>
              )}

              <span
                onClick={() => {
                  sfx.playClick();
                  onNavigateFolder(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (currentFolderId) setDragTargetFolderId('breadcrumb-root');
                }}
                onDragLeave={() => {
                  if (dragTargetFolderId === 'breadcrumb-root') setDragTargetFolderId(null);
                }}
                onDrop={(e) => handleDropOnFolder(e, null)}
                style={{
                  color: dragTargetFolderId === 'breadcrumb-root' ? '#2563eb' : !currentFolderId ? 'var(--text-main)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: !currentFolderId || dragTargetFolderId === 'breadcrumb-root' ? 700 : 500,
                  background: dragTargetFolderId === 'breadcrumb-root' ? '#eff6ff' : 'transparent',
                  padding: '0.2rem 0.55rem',
                  borderRadius: 8,
                  border: dragTargetFolderId === 'breadcrumb-root' ? '1.5px dashed var(--tg-blue)' : '1.5px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                My Files {dragTargetFolderId === 'breadcrumb-root' && '← Drop to Move Here'}
              </span>

              {folderPath.map((item, index) => {
                const isLast = index === folderPath.length - 1;
                const isDragTarget = dragTargetFolderId === `breadcrumb-${item.id}`;
                return (
                  <React.Fragment key={item.id}>
                    <ChevronRight size={14} color="var(--text-light)" />
                    <span
                      onClick={() => {
                        if (!isLast) {
                          sfx.playClick();
                          onNavigateFolder(item.id);
                        }
                      }}
                      onDragOver={(e) => {
                        if (!isLast) {
                          e.preventDefault();
                          setDragTargetFolderId(`breadcrumb-${item.id}`);
                        }
                      }}
                      onDragLeave={() => {
                        if (isDragTarget) setDragTargetFolderId(null);
                      }}
                      onDrop={(e) => {
                        if (!isLast) handleDropOnFolder(e, item.id);
                      }}
                      style={{
                        color: isDragTarget ? '#2563eb' : isLast ? 'var(--tg-blue)' : 'var(--text-muted)',
                        cursor: isLast ? 'default' : 'pointer',
                        fontWeight: isLast ? 700 : 500,
                        background: isDragTarget ? '#eff6ff' : 'transparent',
                        padding: '0.2rem 0.55rem',
                        borderRadius: 8,
                        border: isDragTarget ? '1.5px dashed var(--tg-blue)' : '1.5px solid transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {item.name}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Select All on Mobile (Top Right) */}
            <div className="hide-on-desktop">
              <button
                onClick={selectAll}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {selectedIds.length === files.length && files.length > 0 ? (
                  <CheckSquare size={16} color="var(--tg-blue)" />
                ) : (
                  <Square size={16} />
                )}
                <span>Select All</span>
              </button>
            </div>
          </div>

          {/* Desktop Right / Mobile Bottom Full-Width Strip: Select All (Desktop) + Category Scroll */}
          <div className="explorer-subbar-right">
            <button
              onClick={selectAll}
              className="hide-on-mobile"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'transparent',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {selectedIds.length === files.length && files.length > 0 ? (
                <CheckSquare size={16} color="var(--tg-blue)" />
              ) : (
                <Square size={16} />
              )}
              <span>Select All</span>
            </button>

            <div className="explorer-category-scroll">
              {[
                { id: 'all', label: 'All' },
                { id: 'image', label: 'Photos' },
                { id: 'video', label: 'Videos' },
                { id: 'document', label: 'Documents' },
                { id: 'audio', label: 'Audio' },
                { id: 'archive', label: 'Archives' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    sfx.playClick();
                    onSelectCategory(cat.id);
                  }}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.32rem 0.75rem',
                    borderRadius: 9999,
                    background: currentCategory === cat.id ? '#eef6fd' : '#f1f5f9',
                    color: currentCategory === cat.id ? 'var(--tg-blue)' : 'var(--text-muted)',
                    border: currentCategory === cat.id ? '1px solid rgba(36,129,204,0.25)' : '1px solid transparent',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable File & Folder Area */}
        <div
          style={{ flex: 1, overflowY: 'auto', padding: '1.75rem', position: 'relative' }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!draggingFileId) setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleContainerDrop}
        >
          {/* Drag & Drop Overlay for External Bulk Uploads */}
          {isDragOver && !draggingFileId && (
            <div
              style={{
                position: 'absolute',
                inset: '1rem',
                background: 'rgba(237,246,253,0.95)',
                border: '2.5px dashed var(--tg-blue)',
                borderRadius: 24,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                zIndex: 50,
                backdropFilter: 'blur(4px)',
                boxShadow: '0 20px 50px rgba(36,129,204,0.2)',
              }}
            >
              <div
                style={{
                  width: 68,
                  height: 68,
                  background: '#fff',
                  color: 'var(--tg-blue)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                <FolderUp size={34} />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--tg-blue)' }}>
                Drop Folders or Files to Spool into FreeBox
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                Nested folder hierarchies are automatically recreated with multi-threaded chunk spooling.
              </p>
            </div>
          )}

          {/* Folders Section in Grid View */}
          {currentFolders.length > 0 && currentCategory === 'all' && !searchQuery && viewMode === 'grid' && (
            <div style={{ marginBottom: '2rem' }}>
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--text-light)',
                  textTransform: 'uppercase',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>Folders ({currentFolders.length})</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '1rem' }}>
                {currentFolders.map((fld) => {
                  const isHoverTarget = dragTargetFolderId === fld.id;
                  return (
                    <div
                      key={fld.id}
                      onClick={() => {
                        sfx.playClick();
                        onNavigateFolder(fld.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragTargetFolderId(fld.id);
                      }}
                      onDragLeave={() => setDragTargetFolderId(null)}
                      onDrop={(e) => handleDropOnFolder(e, fld.id)}
                      style={{
                        background: isHoverTarget ? '#eff6ff' : '#fff',
                        border: isHoverTarget ? '2px solid var(--tg-blue)' : '1px solid var(--border-subtle)',
                        borderRadius: 14,
                        padding: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.85rem',
                        cursor: 'pointer',
                        transform: isHoverTarget ? 'scale(1.03)' : 'scale(1)',
                        boxShadow: isHoverTarget ? '0 8px 25px rgba(36,129,204,0.2)' : 'var(--shadow-sm)',
                        transition: 'all 0.18s ease',
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: `${fld.color}15`,
                          color: fld.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <FolderIcon size={24} />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <h4
                          style={{
                            fontSize: '0.92rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {fld.name}
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: isHoverTarget ? 'var(--tg-blue)' : 'var(--text-light)' }}>
                          {isHoverTarget ? 'Drop to move here' : 'Folder'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Files Section */}
          <div>
            <div
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'var(--text-light)',
                textTransform: 'uppercase',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Files ({files.length})</span>
            </div>

            {files.length === 0 ? (
              <div
                style={{
                  background: '#fff',
                  border: '1px dashed var(--border-medium)',
                  borderRadius: 20,
                  padding: '4rem 2rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <Upload size={48} color="var(--text-light)" style={{ margin: '0 auto 1rem auto' }} />
                <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  No files in this folder
                </h4>
                <p style={{ fontSize: '0.88rem', marginBottom: '1.5rem' }}>
                  Upload files or folders, or drag & drop items directly here.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                  <button className="btn-action-primary" onClick={onOpenUpload}>
                    <Upload size={14} /> Upload File
                  </button>
                  <button
                    onClick={onOpenFolderUpload}
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      padding: '0.55rem 1rem',
                      borderRadius: 9999,
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    <FolderUp size={14} /> Upload Folder
                  </button>
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              /* Grid View */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
                {files.map((file) => {
                  const isSelected = selectedIds.includes(file.id);
                  return (
                    <div
                      key={file.id}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', file.id);
                        setDraggingFileId(file.id);
                      }}
                      onDragEnd={() => setDraggingFileId(null)}
                      style={{
                        background: '#fff',
                        border: isSelected ? '2px solid var(--tg-blue)' : '1px solid var(--border-subtle)',
                        borderRadius: 16,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        boxShadow: isSelected ? '0 0 0 3px var(--tg-blue-glow)' : 'var(--shadow-sm)',
                        transition: 'all 0.18s ease',
                        cursor: 'grab',
                      }}
                    >
                      <div
                        onClick={() => {
                          sfx.playClick();
                          onPreviewFile(file);
                        }}
                        style={{
                          height: 140,
                          background: '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                      >
                        {file.type === 'image' && file.telegramMsgId > 0 ? (
                          <img
                            src={api.getFileStreamUrl(file.id)}
                            alt={file.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <FileText size={42} color="var(--tg-blue)" />
                        )}

                        <span
                          style={{
                            position: 'absolute',
                            top: '0.6rem',
                            left: '0.6rem',
                            background: 'rgba(15,23,42,0.7)',
                            color: '#fff',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.45rem',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                          }}
                        >
                          {file.type}
                        </span>

                        {/* Checkbox button */}
                        <button
                          onClick={(e) => toggleSelect(file.id, e)}
                          style={{
                            position: 'absolute',
                            top: '0.6rem',
                            right: '0.6rem',
                            background: isSelected ? 'var(--tg-blue)' : 'rgba(255,255,255,0.9)',
                            border: 'none',
                            borderRadius: '50%',
                            width: 28,
                            height: 28,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: isSelected ? '#fff' : 'var(--text-muted)',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                          }}
                        >
                          {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </div>

                      <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div
                          onClick={() => {
                            sfx.playClick();
                            onPreviewFile(file);
                          }}
                          style={{
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: 'pointer',
                          }}
                          title={file.name}
                        >
                          {file.name}
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.7rem',
                            color: 'var(--text-light)',
                            background: '#f8fafc',
                            padding: '0.15rem 0.4rem',
                            borderRadius: 4,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {file.spoolHash}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: '0.4rem',
                            fontSize: '0.75rem',
                            color: 'var(--text-light)',
                          }}
                        >
                          <span>{formatSize(file.size)}</span>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              onClick={() => {
                                sfx.playClick();
                                onToggleStar(file.id);
                              }}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                              title="Star"
                            >
                              <Star size={14} color={file.starred ? '#f59e0b' : '#94a3b8'} fill={file.starred ? '#f59e0b' : 'none'} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                sfx.playClick();
                                setFilesForMove([file]);
                                setIsMoveModalOpen(true);
                              }}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                              title="Move to Folder"
                            >
                              <FolderInput size={14} color="#94a3b8" />
                            </button>
                            <button
                              onClick={() => {
                                sfx.playClick();
                                onShareFile(file);
                              }}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                              title="Share"
                            >
                              <Share2 size={14} color="#94a3b8" />
                            </button>
                            <button
                              onClick={() => {
                                sfx.playClick();
                                onDeleteFile(file.id);
                              }}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                              title="Delete"
                            >
                              <Trash2 size={14} color="#ef4444" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List View */
              <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr
                      style={{
                        background: '#f8fafc',
                        borderBottom: '1px solid var(--border-subtle)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: 'var(--text-light)',
                        textAlign: 'left',
                      }}
                    >
                      <th style={{ padding: '0.85rem 1.25rem', width: 40 }}>
                        <button onClick={selectAll} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                          {selectedIds.length === files.length && files.length > 0 ? (
                            <CheckSquare size={16} color="var(--tg-blue)" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </th>
                      <th style={{ padding: '0.85rem 1.25rem' }}>Name</th>
                      <th className="hide-on-mobile" style={{ padding: '0.85rem 1.25rem' }}>Spool ID</th>
                      <th style={{ padding: '0.85rem 1.25rem' }}>Size</th>
                      <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Folders in List View (Google Drive / iCloud style) */}
                    {currentFolders.length > 0 && currentCategory === 'all' && !searchQuery && currentFolders.map((fld) => (
                      <tr
                        key={`folder-${fld.id}`}
                        onClick={() => {
                          sfx.playClick();
                          onNavigateFolder(fld.id);
                        }}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          background: '#fafcff',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#fafcff')}
                      >
                        <td style={{ padding: '0.85rem 1.25rem', width: 40 }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              background: `${fld.color || '#3b82f6'}15`,
                              color: fld.color || 'var(--tg-blue)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <FolderIcon size={16} />
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ color: '#0f172a' }}>{fld.name}</span>
                          </div>
                        </td>
                        <td className="hide-on-mobile" style={{ padding: '0.85rem 1.25rem', fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 500 }}>
                          Folder
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                          —
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                sfx.playClick();
                                onNavigateFolder(fld.id);
                              }}
                              style={{
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: 'var(--tg-blue)',
                                borderRadius: 6,
                                padding: '0.25rem 0.65rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Open
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {files.map((file) => {
                      const isSelected = selectedIds.includes(file.id);
                      return (
                        <tr
                          key={file.id}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', file.id);
                            setDraggingFileId(file.id);
                          }}
                          onDragEnd={() => setDraggingFileId(null)}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            fontSize: '0.88rem',
                            background: isSelected ? '#f0f7ff' : 'transparent',
                            cursor: 'grab',
                          }}
                        >
                          <td style={{ padding: '0.85rem 1.25rem', width: 40 }}>
                            <button
                              onClick={(e) => toggleSelect(file.id, e)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                            >
                              {isSelected ? <CheckSquare size={16} color="var(--tg-blue)" /> : <Square size={16} />}
                            </button>
                          </td>
                          <td
                            style={{ padding: '0.85rem 1.25rem', fontWeight: 600, cursor: 'pointer' }}
                            onClick={() => {
                              sfx.playClick();
                              onPreviewFile(file);
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', maxWidth: 360, overflow: 'hidden' }}>
                              <FileText size={18} color="var(--tg-blue)" style={{ flexShrink: 0 }} />
                              <span
                                title={file.name}
                                style={{
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {file.name}
                              </span>
                            </div>
                          </td>
                          <td className="hide-on-mobile" style={{ padding: '0.85rem 1.25rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-light)' }}>
                            {file.spoolHash}
                          </td>
                          <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                            {formatSize(file.size)}
                          </td>
                          <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => {
                                  sfx.playClick();
                                  onPreviewFile(file);
                                }}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                                title="Preview"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sfx.playClick();
                                  setFilesForMove([file]);
                                  setIsMoveModalOpen(true);
                                }}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                                title="Move to Folder"
                              >
                                <FolderInput size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  sfx.playClick();
                                  onShareFile(file);
                                }}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                                title="Share"
                              >
                                <Share2 size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  sfx.playClick();
                                  onDeleteFile(file.id);
                                }}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                                title="Delete"
                              >
                                <Trash2 size={16} color="#ef4444" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Floating Batch Actions Bar (100% Light Theme with Smooth Spring Enter/Exit Animation) */}
        <div
          style={{
            position: 'absolute',
            bottom: '1.5rem',
            left: '50%',
            transform: selectedIds.length > 0 ? 'translateX(-50%) translateY(0) scale(1)' : 'translateX(-50%) translateY(28px) scale(0.95)',
            opacity: selectedIds.length > 0 ? 1 : 0,
            pointerEvents: selectedIds.length > 0 ? 'auto' : 'none',
            visibility: selectedIds.length > 0 ? 'visible' : 'hidden',
            transition: 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
            background: '#ffffff',
            color: '#0f172a',
            border: '1px solid #e2e8f0',
            padding: '0.65rem 1.25rem',
            borderRadius: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            boxShadow: '0 12px 36px -4px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(0,0,0,0.03)',
            zIndex: 100,
            fontSize: '0.86rem',
            fontWeight: 600,
            maxWidth: '92vw',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#0f172a', fontWeight: 700, paddingRight: '0.25rem' }}>
            {selectedIds.length} {selectedIds.length === 1 ? 'file' : 'files'} selected
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Move Button */}
            <button
              onClick={() => {
                sfx.playClick();
                const selectedFiles = files.filter((f) => selectedIds.includes(f.id));
                setFilesForMove(selectedFiles);
                setIsMoveModalOpen(true);
              }}
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: 'var(--tg-blue)',
                padding: '0.42rem 0.85rem',
                borderRadius: 9999,
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
            >
              <FolderInput size={14} /> Move
            </button>

            {/* Download / Download Batch Button */}
            <button
              onClick={() => {
                sfx.playComplete();
                if (selectedIds.length === 1) {
                  const file = files.find((f) => f.id === selectedIds[0]);
                  if (file) {
                    const a = document.createElement('a');
                    a.href = api.getFileDownloadUrl(file.id);
                    a.download = file.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }
                } else if (selectedIds.length > 1) {
                  const a = document.createElement('a');
                  a.href = api.getBatchDownloadUrl(selectedIds);
                  a.download = `FreeBox_Batch_${new Date().toISOString().slice(0, 10)}.zip`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }
                setSelectedIds([]);
              }}
              style={{
                background: 'var(--tg-blue)',
                border: 'none',
                color: '#fff',
                padding: '0.42rem 0.95rem',
                borderRadius: 9999,
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 2px 8px rgba(36,129,204,0.25)',
                transition: 'all 0.15s ease',
              }}
            >
              <Download size={14} /> {selectedIds.length > 1 ? `Download Batch (${selectedIds.length})` : 'Download'}
            </button>

            {/* Delete Button */}
            <button
              onClick={() => {
                sfx.playClick();
                selectedIds.forEach((id) => onDeleteFile(id));
                setSelectedIds([]);
              }}
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#ef4444',
                padding: '0.42rem 0.85rem',
                borderRadius: 9999,
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
            >
              <Trash2 size={14} /> Delete
            </button>

            {/* Clear Selection */}
            <button
              onClick={() => setSelectedIds([])}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: '0.2rem 0.4rem',
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Move to Folder Modal */}
        <MoveModal
          isOpen={isMoveModalOpen}
          onClose={() => {
            setIsMoveModalOpen(false);
            setFilesForMove([]);
          }}
          filesToMove={filesForMove}
          folders={folders}
          currentFolderId={currentFolderId}
          onMove={(ids, targetId) => {
            onMoveFiles(ids, targetId);
            setSelectedIds([]);
          }}
        />
      </main>
    </div>
  );
};
