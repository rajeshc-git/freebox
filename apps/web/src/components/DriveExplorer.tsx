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
  Pencil,
  RotateCcw,
  ChevronDown,
  Sparkles,
  Archive,
  Cloud,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  Image as ImageIcon,
  Film,
  Music,
  Info,
  Database,
} from 'lucide-react';
import { User, Folder, DriveFile, StorageMetrics } from '../types';
import { sfx } from '../services/sound';
import { api } from '../services/api';
import { MoveModal, DeleteFileModal, DeleteBatchFilesModal, EmptyTrashModal } from './Modals';
import { LivePhotosView, LivePhotoPair } from './LivePhotosView';
import { ArchivedChatsView } from './ArchivedChatsView';
import { SmartImage } from './SmartImage';


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
  onRestoreFile?: (fileId: string) => void;
  onRestoreBatch?: (fileIds: string[]) => void;
  onEmptyTrash?: () => void;
  onDeletePermanent?: (fileId: string) => void;
  onDeleteBatchPermanent?: (fileIds: string[]) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onDeleteLivePhotoPair: (pair: LivePhotoPair) => void;
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
  onRestoreFile,
  onRestoreBatch,
  onEmptyTrash,
  onDeletePermanent,
  onDeleteBatchPermanent,
  onRenameFolder,
  onDeleteFolder,
  onDeleteLivePhotoPair,
  onMoveFiles,
  onDropFolderItems,
  onLogout,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragTargetFolderId, setDragTargetFolderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [draggingFileId, setDraggingFileId] = useState<string | null>(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [filesForMove, setFilesForMove] = useState<DriveFile[]>([]);
  const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isEmptyTrashOpen, setIsEmptyTrashOpen] = useState(false);
  const [isMobileAddMenuOpen, setIsMobileAddMenuOpen] = useState(false);
  const [isStoragePopupOpen, setIsStoragePopupOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const storagePopupRef = useRef<HTMLDivElement>(null);
  const userProfileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setIsMobileAddMenuOpen(false);
      }
    }
    if (isMobileAddMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [isMobileAddMenuOpen]);

  useEffect(() => {
    function handleClickOutsideStorage(event: MouseEvent | TouchEvent) {
      if (
        storagePopupRef.current &&
        !storagePopupRef.current.contains(event.target as Node) &&
        userProfileRef.current &&
        !userProfileRef.current.contains(event.target as Node)
      ) {
        setIsStoragePopupOpen(false);
      }
    }
    if (isStoragePopupOpen) {
      document.addEventListener('mousedown', handleClickOutsideStorage);
      document.addEventListener('touchstart', handleClickOutsideStorage);
      return () => {
        document.removeEventListener('mousedown', handleClickOutsideStorage);
        document.removeEventListener('touchstart', handleClickOutsideStorage);
      };
    }
  }, [isStoragePopupOpen]);

  const longPressTimerRef = useRef<any>(null);
  const isLongPressRef = useRef(false);

  const handleFolderTouchStart = (fldId: string) => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      sfx.playClick();
      setSelectedFolderIds((prev) => (prev.includes(fldId) ? prev.filter((id) => id !== fldId) : [...prev, fldId]));
    }, 450);
  };

  const handleFolderTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const toggleSelectFolder = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    sfx.playClick();
    setSelectedFolderIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  };

  const currentFolder = folders.find((f) => f.id === currentFolderId);
  const currentFolders = folders.filter((f) => (f.parentId || null) === (currentFolderId || null));

  // Compute Live Photo pairs count
  const pairedLivePhotoBaseNames = React.useMemo(() => {
    const images = new Set<string>();
    const videos = new Set<string>();
    files.forEach((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      const lastDot = f.name.lastIndexOf('.');
      const base = lastDot > 0 ? f.name.substring(0, lastDot).toLowerCase() : f.name.toLowerCase();
      if (['heic', 'jpg', 'jpeg', 'png'].includes(ext) || f.mimeType.startsWith('image/')) images.add(base);
      if (['mov', 'mp4'].includes(ext) || f.mimeType.startsWith('video/')) videos.add(base);
    });
    const pairs = new Set<string>();
    images.forEach((b) => {
      if (videos.has(b)) pairs.add(b);
    });
    return pairs;
  }, [files]);

  const livePhotosCount = pairedLivePhotoBaseNames.size;

  // Storage Stats Breakdown for Telegram Cloud consumption popup
  const storageStats = React.useMemo(() => {
    const activeFiles = files.filter((f) => !f.isTrashed);
    const trashedFiles = files.filter((f) => f.isTrashed);

    const activeBytes = activeFiles.reduce((sum, f) => sum + (f.size || 0), 0);
    const trashBytes = trashedFiles.reduce((sum, f) => sum + (f.size || 0), 0);
    const totalBytes = metrics?.totalBytes ?? activeBytes;
    const totalFilesCount = metrics?.totalFiles ?? activeFiles.length;

    const images = activeFiles.filter((f) => f.type === 'image');
    const videos = activeFiles.filter((f) => f.type === 'video');
    const docs = activeFiles.filter((f) => f.type === 'document');
    const audio = activeFiles.filter((f) => f.type === 'audio');
    const archives = activeFiles.filter((f) => f.type === 'archive');

    const imageBytes = images.reduce((sum, f) => sum + (f.size || 0), 0);
    const videoBytes = videos.reduce((sum, f) => sum + (f.size || 0), 0);
    const docBytes = docs.reduce((sum, f) => sum + (f.size || 0), 0);
    const audioBytes = audio.reduce((sum, f) => sum + (f.size || 0), 0);
    const archiveBytes = archives.reduce((sum, f) => sum + (f.size || 0), 0);

    return {
      totalBytes,
      totalFilesCount,
      activeBytes,
      trashBytes,
      trashCount: metrics?.trashCount ?? trashedFiles.length,
      imageCount: metrics?.categories?.images ?? images.length,
      imageBytes,
      videoCount: metrics?.categories?.videos ?? videos.length,
      videoBytes,
      docCount: metrics?.categories?.documents ?? docs.length,
      docBytes,
      audioCount: metrics?.categories?.audio ?? audio.length,
      audioBytes,
      archiveCount: metrics?.categories?.archives ?? archives.length,
      archiveBytes,
      starredCount: metrics?.categories?.starred ?? activeFiles.filter((f) => f.starred).length,
    };
  }, [files, metrics]);

  // Matched Live Photo Pairs (for Live Photos Studio)
  const livePhotoPairs: LivePhotoPair[] = React.useMemo(() => {
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

    const matched: LivePhotoPair[] = [];
    const usedVideoIds = new Set<string>();

    images.forEach((img) => {
      const imgBase = getBase(img.name);
      const matchingVideo = videos.find(
        (v) => !usedVideoIds.has(v.id) && getBase(v.name) === imgBase
      );

      if (matchingVideo) {
        usedVideoIds.add(matchingVideo.id);
        matched.push({
          id: `${img.id}_${matchingVideo.id}`,
          baseName: img.name.substring(0, img.name.lastIndexOf('.')) || img.name,
          photoFile: img,
          videoFile: matchingVideo,
          createdAt: img.createdAt,
          size: img.size + matchingVideo.size,
        });
      }
    });

    return matched;
  }, [files]);

  const toggleSelectLivePhotoPair = (pair: LivePhotoPair) => {
    sfx.playClick();
    const ids = [pair.photoFile.id, pair.videoFile.id];
    const isPairSelected = selectedIds.includes(pair.photoFile.id) || selectedIds.includes(pair.videoFile.id);
    if (isPairSelected) {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedIds((prev) => [...prev, ...ids]);
    }
  };

  const isAllLivePhotosSelected = React.useMemo(() => {
    if (livePhotoPairs.length === 0) return false;
    return livePhotoPairs.every((p) => selectedIds.includes(p.photoFile.id) || selectedIds.includes(p.videoFile.id));
  }, [livePhotoPairs, selectedIds]);

  // Files displayed in current explorer view:
  // - In 'live_photo' view, all files are passed to LivePhotosView
  // - In normal folders & My Files, paired Live Photo .HEIC & .MOV are hidden from normal list so they only render inside Live Photos
  // - If a standalone .HEIC or standalone .MOV is uploaded without a pair, it shows normally in My Files!
  const displayedFiles = React.useMemo(() => {
    if (currentCategory === 'live_photo') return files;

    return files.filter((f) => {
      const lastDot = f.name.lastIndexOf('.');
      const base = lastDot > 0 ? f.name.substring(0, lastDot).toLowerCase() : f.name.toLowerCase();
      return !pairedLivePhotoBaseNames.has(base);
    });
  }, [files, currentCategory, pairedLivePhotoBaseNames]);

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

      // Delete / Backspace -> delete selected files or folders
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          sfx.playClick();
          setIsBatchDeleteOpen(true);
        } else if (selectedFolderIds.length > 0) {
          e.preventDefault();
          sfx.playClick();
          selectedFolderIds.forEach((id) => {
            const f = folders.find((fl) => fl.id === id);
            if (f) onDeleteFolder(f);
          });
          setSelectedFolderIds([]);
        }
      }

      // Cmd+A / Ctrl+A -> Select All
      if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        sfx.playClick();
        if (currentCategory === 'live_photo') {
          const allLiveIds = livePhotoPairs.flatMap((p) => [p.photoFile.id, p.videoFile.id]);
          setSelectedIds(allLiveIds);
        } else {
          setSelectedIds(files.map((f) => f.id));
        }
      }

      // Escape -> Clear selection
      if (e.key === 'Escape') {
        setSelectedIds([]);
        setSelectedFolderIds([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, selectedFolderIds, files, folders, livePhotoPairs, currentCategory, onPreviewFile, onDeleteFile, onDeleteFolder]);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sfx.playClick();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const selectAll = () => {
    sfx.playClick();
    if (currentCategory === 'live_photo') {
      if (isAllLivePhotosSelected) {
        setSelectedIds([]);
      } else {
        const allLiveIds = livePhotoPairs.flatMap((p) => [p.photoFile.id, p.videoFile.id]);
        setSelectedIds(allLiveIds);
      }
      return;
    }

    if (selectedIds.length === displayedFiles.length && displayedFiles.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayedFiles.map((f) => f.id));
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

        <ul style={{ padding: '0.5rem 0.75rem 0.25rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', listStyle: 'none' }}>
          {[
            { id: 'all', label: 'My Files', icon: FolderIcon, count: metrics?.totalFiles ?? displayedFiles.length },
            { id: 'starred', label: 'Starred', icon: Star, count: metrics?.categories?.starred ?? 0 },
            { id: 'trash', label: 'Trash', icon: Trash2, count: metrics?.trashCount ?? 0 },
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
                padding: '0.6rem 0.85rem',
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
            padding: '0.65rem 1.25rem 0.35rem 1.25rem',
            fontSize: '0.72rem',
            fontWeight: 800,
            letterSpacing: '0.06em',
            color: 'var(--text-light)',
            textTransform: 'uppercase',
          }}
        >
          CATEGORIES
        </div>

        <ul style={{ padding: '0 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', listStyle: 'none' }}>
          {[
            { id: 'image', label: 'Photos', count: metrics?.categories?.images ?? 0 },
            { id: 'video', label: 'Videos', count: metrics?.categories?.videos ?? 0 },
            { id: 'document', label: 'Documents', count: metrics?.categories?.documents ?? 0 },
            { id: 'audio', label: 'Audio', count: metrics?.categories?.audio ?? 0 },
            { id: 'archive', label: 'Archives', count: metrics?.categories?.archives ?? 0 },
            { id: 'live_photo', label: 'Live Photos', count: metrics?.livePhotosCount ?? metrics?.categories?.live_photo ?? livePhotosCount, isLive: true },
            { id: 'others', label: 'Others', isArchive: true },
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
                padding: '0.55rem 0.85rem',
                borderRadius: 12,
                fontSize: '0.88rem',
                fontWeight: 500,
                color: currentCategory === cat.id ? 'var(--tg-blue)' : 'var(--text-muted)',
                background: currentCategory === cat.id ? '#eef6fd' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{cat.label}</span>
                {cat.isLive && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      background: currentCategory === cat.id ? 'var(--tg-blue)' : 'rgba(36,129,204,0.12)',
                      color: currentCategory === cat.id ? '#fff' : 'var(--tg-blue)',
                      padding: '0.1rem 0.35rem',
                      borderRadius: 4,
                    }}
                  >
                    LIVE
                  </span>
                )}
                {cat.isArchive && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      background: currentCategory === cat.id ? 'var(--tg-blue)' : 'rgba(36,129,204,0.12)',
                      color: currentCategory === cat.id ? '#fff' : 'var(--tg-blue)',
                      padding: '0.1rem 0.35rem',
                      borderRadius: 4,
                    }}
                  >
                    CHATS
                  </span>
                )}
              </div>
              {cat.count !== undefined && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>{cat.count}</span>
              )}
            </li>
          ))}
        </ul>

        {/* User Footer with Telegram Storage Consumption Popup */}
        <div
          ref={userProfileRef}
          style={{
            position: 'relative',
            marginTop: 'auto',
            padding: '0.85rem 1rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isStoragePopupOpen ? '#f8fafc' : 'transparent',
            transition: 'background 0.15s ease',
          }}
        >
          {/* Telegram Storage Consumption Popup */}
          {isStoragePopupOpen && (
            <div
              ref={storagePopupRef}
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 10px)',
                left: '0.5rem',
                right: '0.5rem',
                background: '#ffffff',
                borderRadius: 16,
                boxShadow: '0 16px 36px -4px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.08)',
                padding: '1rem',
                zIndex: 999,
                animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      background: 'rgba(36, 129, 204, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--tg-blue)',
                    }}
                  >
                    <Cloud size={15} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.1 }}>
                      Telegram Storage
                    </div>
                    <div style={{ fontSize: '0.66rem', color: 'var(--text-light)' }}>
                      MTProto Cloud Spool
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    sfx.playClick();
                    setIsStoragePopupOpen(false);
                  }}
                  title="Close"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-light)',
                    padding: '0.2rem',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-main)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-light)')}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Total Storage Highlight Box */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                  border: '1px solid #bae6fd',
                  borderRadius: 12,
                  padding: '0.75rem 0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Total Consumed
                  </span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      background: '#dcfce7',
                      color: '#15803d',
                      padding: '0.15rem 0.45rem',
                      borderRadius: 9999,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
                    Unlimited
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                  <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0c4a6e', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                    {formatSize(storageStats.totalBytes)}
                  </span>
                </div>

                <div style={{ fontSize: '0.7rem', color: '#0284c7', lineHeight: 1.3 }}>
                  Stored across {storageStats.totalFilesCount} {storageStats.totalFilesCount === 1 ? 'file' : 'files'} in Telegram Cloud
                </div>

                {/* Storage Segmented Bar */}
                <div
                  style={{
                    height: 6,
                    borderRadius: 9999,
                    background: 'rgba(255,255,255,0.7)',
                    overflow: 'hidden',
                    display: 'flex',
                    gap: 1.5,
                    marginTop: '0.25rem',
                  }}
                >
                  {storageStats.totalBytes > 0 ? (
                    <>
                      {storageStats.imageBytes > 0 && (
                        <div
                          style={{
                            width: `${(storageStats.imageBytes / storageStats.totalBytes) * 100}%`,
                            background: '#0284c7',
                          }}
                          title={`Photos: ${formatSize(storageStats.imageBytes)}`}
                        />
                      )}
                      {storageStats.videoBytes > 0 && (
                        <div
                          style={{
                            width: `${(storageStats.videoBytes / storageStats.totalBytes) * 100}%`,
                            background: '#8b5cf6',
                          }}
                          title={`Videos: ${formatSize(storageStats.videoBytes)}`}
                        />
                      )}
                      {storageStats.docBytes > 0 && (
                        <div
                          style={{
                            width: `${(storageStats.docBytes / storageStats.totalBytes) * 100}%`,
                            background: '#10b981',
                          }}
                          title={`Documents: ${formatSize(storageStats.docBytes)}`}
                        />
                      )}
                      {storageStats.audioBytes > 0 && (
                        <div
                          style={{
                            width: `${(storageStats.audioBytes / storageStats.totalBytes) * 100}%`,
                            background: '#f59e0b',
                          }}
                          title={`Audio: ${formatSize(storageStats.audioBytes)}`}
                        />
                      )}
                      {storageStats.archiveBytes > 0 && (
                        <div
                          style={{
                            width: `${(storageStats.archiveBytes / storageStats.totalBytes) * 100}%`,
                            background: '#ec4899',
                          }}
                          title={`Archives: ${formatSize(storageStats.archiveBytes)}`}
                        />
                      )}
                    </>
                  ) : (
                    <div style={{ width: '100%', background: '#cbd5e1' }} />
                  )}
                </div>
              </div>

              {/* Categories Breakdown List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Storage by Category
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {[
                    { label: 'Photos', icon: ImageIcon, color: '#0284c7', count: storageStats.imageCount, size: storageStats.imageBytes, catId: 'images' },
                    { label: 'Videos', icon: Film, color: '#8b5cf6', count: storageStats.videoCount, size: storageStats.videoBytes, catId: 'videos' },
                    { label: 'Documents', icon: FileText, color: '#10b981', count: storageStats.docCount, size: storageStats.docBytes, catId: 'documents' },
                    { label: 'Audio', icon: Music, color: '#f59e0b', count: storageStats.audioCount, size: storageStats.audioBytes, catId: 'audio' },
                    { label: 'Archives', icon: Archive, color: '#ec4899', count: storageStats.archiveCount, size: storageStats.archiveBytes, catId: 'archives' },
                  ].map((cat) => (
                    <div
                      key={cat.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        sfx.playClick();
                        onSelectCategory(cat.catId);
                        setIsStoragePopupOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.3rem 0.45rem',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: '0.74rem',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      title={`View ${cat.label}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{cat.label}</span>
                        <span style={{ color: 'var(--text-light)', fontSize: '0.68rem' }}>({cat.count})</span>
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        {formatSize(cat.size)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Footer */}
              <div
                style={{
                  paddingTop: '0.5rem',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.68rem',
                  color: 'var(--text-light)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <ShieldCheck size={13} color="#16a34a" />
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>Telegram Encrypted</span>
                </div>
                <div style={{ fontWeight: 500 }}>
                  {user?.phone || '+91 FreeBox'}
                </div>
              </div>
            </div>
          )}

          {/* User Profile / Avatar Button (Clickable to open popup) */}
          <div
            onClick={() => {
              sfx.playClick();
              setIsStoragePopupOpen((prev) => !prev);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              cursor: 'pointer',
              flex: 1,
              minWidth: 0,
              padding: '0.25rem 0.35rem',
              borderRadius: 10,
              transition: 'background 0.15s ease, transform 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Click to view Telegram storage usage"
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: isStoragePopupOpen
                  ? 'linear-gradient(135deg, #0088cc 0%, #00a2ed 100%)'
                  : 'var(--tg-blue)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.84rem',
                boxShadow: isStoragePopupOpen
                  ? '0 0 0 2.5px rgba(36, 129, 204, 0.4), 0 2px 8px rgba(36, 129, 204, 0.3)'
                  : '0 2px 6px rgba(36, 129, 204, 0.25)',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
            >
              {user?.avatar || 'FD'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: 'var(--text-main)',
                }}
              >
                {user?.name || 'Telegram User'}
              </div>
              <div
                style={{
                  fontSize: '0.71rem',
                  color: 'var(--text-light)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--tg-blue)' }}>
                  {formatSize(storageStats.totalBytes)}
                </span>
                <span>•</span>
                <span>{user?.phone || 'Telegram Cloud'}</span>
              </div>
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
              flexShrink: 0,
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
          className="main-top-header"
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
          <div className="search-bar-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, maxWidth: 520, minWidth: 0 }}>
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
                flexShrink: 0,
              }}
            >
              <Menu size={18} />
            </button>

            {/* Global Search Bar */}
            <div
              style={{
                position: 'relative',
                flex: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Search size={16} color="var(--text-light)" style={{ position: 'absolute', left: '0.85rem', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search files or Telegram spool hash... (⌘K)"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="global-search-input"
                style={{
                  width: '100%',
                  minWidth: 0,
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
          <div className="header-action-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
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

            {currentNav === 'trash' ? (
              <button
                onClick={() => {
                  sfx.playClick();
                  setIsEmptyTrashOpen(true);
                }}
                disabled={files.length === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  background: files.length > 0 ? '#ef4444' : '#f1f5f9',
                  color: files.length > 0 ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  padding: '0.55rem 1.15rem',
                  borderRadius: 9999,
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: files.length > 0 ? 'pointer' : 'not-allowed',
                  boxShadow: files.length > 0 ? '0 2px 10px rgba(239, 68, 68, 0.25)' : 'none',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={15} />
                <span>Empty Trash</span>
              </button>
            ) : (
              <>
                {/* Upload File Button (Desktop) */}
                <button className="btn-action-primary hide-on-mobile" onClick={() => { sfx.playClick(); onOpenUpload(); }} style={{ flexShrink: 0 }}>
                  <Upload size={15} />
                  <span>Upload File</span>
                </button>

                {/* Bulk Upload Folder Button (Desktop) */}
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

                {/* New Folder Button (Desktop) */}
                <button className="btn-action-secondary hide-on-mobile" onClick={() => { sfx.playClick(); onOpenNewFolder(); }} style={{ flexShrink: 0 }}>
                  <Plus size={15} />
                  <span>New Folder</span>
                </button>

                {/* Mobile Unified "+ Add" Dropdown Menu */}
                <div ref={addMenuRef} className="show-on-mobile-flex" style={{ position: 'relative' }}>
                  <button
                    onClick={() => {
                      sfx.playClick();
                      setIsMobileAddMenuOpen((prev) => !prev);
                    }}
                    className="btn-action-primary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.5rem 0.85rem',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      borderRadius: 9999,
                      flexShrink: 0,
                    }}
                    aria-expanded={isMobileAddMenuOpen}
                  >
                    <Plus size={16} />
                    <span>Add</span>
                    <ChevronDown size={14} style={{ transform: isMobileAddMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s ease' }} />
                  </button>

                  {isMobileAddMenuOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        background: 'rgba(255, 255, 255, 0.98)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: '1px solid rgba(226, 232, 240, 0.9)',
                        borderRadius: 14,
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15), 0 2px 6px rgba(0, 0, 0, 0.05)',
                        padding: '0.45rem',
                        minWidth: 195,
                        zIndex: 100,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                      }}
                    >
                      <button
                        onClick={() => {
                          setIsMobileAddMenuOpen(false);
                          sfx.playClick();
                          onOpenUpload();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.6rem 0.85rem',
                          border: 'none',
                          background: 'transparent',
                          borderRadius: 10,
                          fontSize: '0.86rem',
                          fontWeight: 600,
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                        }}
                        className="menu-item-hover"
                      >
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#eff6ff', color: 'var(--tg-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Upload size={15} />
                        </div>
                        <span>Upload File</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsMobileAddMenuOpen(false);
                          sfx.playClick();
                          onOpenFolderUpload();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.6rem 0.85rem',
                          border: 'none',
                          background: 'transparent',
                          borderRadius: 10,
                          fontSize: '0.86rem',
                          fontWeight: 600,
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                        }}
                        className="menu-item-hover"
                      >
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FolderUp size={15} />
                        </div>
                        <span>Upload Folder</span>
                      </button>

                      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0.2rem 0' }} />

                      <button
                        onClick={() => {
                          setIsMobileAddMenuOpen(false);
                          sfx.playClick();
                          onOpenNewFolder();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.6rem 0.85rem',
                          border: 'none',
                          background: 'transparent',
                          borderRadius: 10,
                          fontSize: '0.86rem',
                          fontWeight: 600,
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                        }}
                        className="menu-item-hover"
                      >
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FolderPlus size={15} />
                        </div>
                        <span>New Folder</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* View Mode Toggle (Desktop) */}
            <div className="hide-on-mobile" style={{ display: 'flex', background: '#f1f5f9', padding: '0.2rem', borderRadius: 9999 }}>
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

            {/* View Mode Toggle (Mobile Single Button Toggle) */}
            <button
              className="show-on-mobile-flex"
              onClick={() => {
                sfx.playClick();
                onToggleViewMode(viewMode === 'grid' ? 'list' : 'grid');
              }}
              title={`Switch to ${viewMode === 'grid' ? 'List' : 'Grid'} view`}
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
                color: 'var(--text-muted)',
                flexShrink: 0,
              }}
            >
              {viewMode === 'grid' ? <List size={16} /> : <Grid size={16} />}
            </button>
          </div>
        </header>

        {/* Breadcrumbs & Filters Subbar */}
        {currentNav === 'trash' ? (
          <div
            className="explorer-subbar"
            style={{
              padding: '0.75rem 1.75rem',
              borderBottom: '1px solid var(--border-subtle)',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: '#fef2f2',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trash2 size={16} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                  Trash
                </h3>
                <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b' }}>
                  {displayedFiles.length} {displayedFiles.length === 1 ? 'item' : 'items'}
                  <span className="hide-on-mobile"> • Restore items or empty trash to permanently delete from Telegram</span>
                </p>
              </div>
            </div>

            {/* Select All on Mobile / Desktop */}
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
              {selectedIds.length === displayedFiles.length && displayedFiles.length > 0 ? (
                <CheckSquare size={16} color="var(--tg-blue)" />
              ) : (
                <Square size={16} />
              )}
              <span>Select All</span>
            </button>
          </div>
        ) : (
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
              {currentCategory === 'others' ? (
                /* Others / Archived Chats Breadcrumb */
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem', flexWrap: 'wrap', minWidth: 0 }}>
                  <span
                    onClick={() => {
                      sfx.playClick();
                      onNavigateFolder(null);
                      onSelectCategory('all');
                    }}
                    style={{
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: 500,
                      padding: '0.2rem 0.55rem',
                      borderRadius: 8,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    My Files
                  </span>
                  <ChevronRight size={14} color="var(--text-light)" />
                  <span
                    style={{
                      color: 'var(--tg-blue)',
                      cursor: 'default',
                      fontWeight: 700,
                      padding: '0.2rem 0.55rem',
                      borderRadius: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Archive size={14} /> Others (Archived Chats)
                  </span>
                </div>
              ) : currentCategory === 'live_photo' ? (
                /* Live Photos Breadcrumb */
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem', flexWrap: 'wrap', minWidth: 0 }}>
                  <span
                    onClick={() => {
                      sfx.playClick();
                      onNavigateFolder(null);
                      onSelectCategory('all');
                    }}
                    style={{
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: 500,
                      padding: '0.2rem 0.55rem',
                      borderRadius: 8,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    My Files
                  </span>
                  <ChevronRight size={14} color="var(--text-light)" />
                  <span
                    style={{
                      color: 'var(--tg-blue)',
                      cursor: 'default',
                      fontWeight: 700,
                      padding: '0.2rem 0.55rem',
                      borderRadius: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Sparkles size={14} /> Live Photos ✨
                  </span>
                </div>
              ) : (
                /* Standard Folder Breadcrumb */
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
              )}

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
                  {(currentCategory === 'live_photo' ? isAllLivePhotosSelected : selectedIds.length === displayedFiles.length && displayedFiles.length > 0) ? (
                    <CheckSquare size={16} color="var(--tg-blue)" />
                  ) : (
                    <Square size={16} />
                  )}
                  <span>Select All</span>
                </button>
              </div>
            </div>

            {/* Desktop Right Strip: Select All (Desktop) + Category Scroll (Hidden on mobile since hamburger drawer has all categories) */}
            <div className="explorer-subbar-right hide-on-mobile">
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
                {(currentCategory === 'live_photo' ? isAllLivePhotosSelected : selectedIds.length === displayedFiles.length && displayedFiles.length > 0) ? (
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
                  { id: 'live_photo', label: 'Live Photos ✨' },
                  { id: 'others', label: 'Others 📦' },
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
        )}

        {/* If Others is selected, render the dedicated Archived Chats & Media Explorer */}
        {currentCategory === 'others' ? (
          <ArchivedChatsView />
        ) : currentCategory === 'live_photo' ? (
          <LivePhotosView
            files={files}
            selectedIds={selectedIds}
            onToggleSelectPair={toggleSelectLivePhotoPair}
            onUploadPair={(fls) => onDropFolderItems(fls.map((f) => ({ file: f, relativePath: f.name })))}
            onPreviewFile={onPreviewFile}
            onShareFile={onShareFile}
            onDeletePair={onDeleteLivePhotoPair}
          />
        ) : (
          /* Scrollable File & Folder Area */
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
          {currentFolders.length > 0 && currentCategory === 'all' && !searchQuery && currentNav !== 'trash' && viewMode === 'grid' && (
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {currentFolders.map((fld) => {
                  const isHoverTarget = dragTargetFolderId === fld.id;
                  const isFolderSelected = selectedFolderIds.includes(fld.id);
                  return (
                    <div
                      key={fld.id}
                      onClick={() => {
                        if (isLongPressRef.current) return;
                        if (selectedFolderIds.length > 0) {
                          toggleSelectFolder(fld.id);
                          return;
                        }
                        sfx.playClick();
                        onNavigateFolder(fld.id);
                      }}
                      onTouchStart={() => handleFolderTouchStart(fld.id)}
                      onTouchEnd={handleFolderTouchEnd}
                      onTouchMove={handleFolderTouchEnd}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragTargetFolderId(fld.id);
                      }}
                      onDragLeave={() => setDragTargetFolderId(null)}
                      onDrop={(e) => handleDropOnFolder(e, fld.id)}
                      style={{
                        position: 'relative',
                        background: isFolderSelected ? '#eff6ff' : isHoverTarget ? '#f0fdf4' : '#fff',
                        border: isFolderSelected ? '2px solid var(--tg-blue)' : isHoverTarget ? '2px solid #10b981' : '1px solid var(--border-subtle)',
                        borderRadius: 16,
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transform: isHoverTarget ? 'scale(1.03)' : isFolderSelected ? 'scale(0.99)' : 'scale(1)',
                        boxShadow: isFolderSelected ? '0 8px 25px rgba(36,129,204,0.18)' : 'var(--shadow-sm)',
                        transition: 'all 0.18s ease',
                        minHeight: 112,
                      }}
                    >
                      {/* Folder Checkbox Button in Top-Right Corner */}
                      <button
                        onClick={(e) => toggleSelectFolder(fld.id, e)}
                        title={isFolderSelected ? 'Deselect folder' : 'Select folder'}
                        style={{
                          position: 'absolute',
                          top: '0.65rem',
                          right: '0.65rem',
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: isFolderSelected ? 'var(--tg-blue)' : '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 2,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isFolderSelected ? <CheckSquare size={18} color="var(--tg-blue)" /> : <Square size={18} color="#94a3b8" />}
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', paddingRight: '1.5rem' }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: `${fld.color || '#3b82f6'}15`,
                            color: fld.color || '#3b82f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <FolderIcon size={24} fill={fld.color || '#3b82f6'} />
                        </div>
                        <div style={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
                          <h4
                            style={{
                              fontSize: '0.92rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: '#0f172a',
                            }}
                            title={fld.name}
                          >
                            {fld.name}
                          </h4>
                          <p style={{ fontSize: '0.74rem', color: isHoverTarget ? 'var(--tg-blue)' : 'var(--text-light)', marginTop: 2 }}>
                            {isHoverTarget ? 'Drop to move here' : 'Folder'}
                          </p>
                        </div>
                      </div>

                      {/* Folder Bottom Row: Clean Metadata */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '0.75rem',
                          paddingTop: '0.45rem',
                          borderTop: '1px solid #f8fafc',
                          fontSize: '0.75rem',
                          color: 'var(--text-light)',
                        }}
                      >
                        <span>{fld._count?.files !== undefined ? `${fld._count.files} items` : 'Folder'}</span>
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
              <span>{currentNav === 'trash' ? `Trash Items (${displayedFiles.length})` : `Files (${displayedFiles.length})`}</span>
            </div>

            {displayedFiles.length === 0 ? (
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
                {currentNav === 'trash' ? (
                  <>
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        background: '#f8fafc',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.25rem',
                      }}
                    >
                      <Trash2 size={32} />
                    </div>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                      Trash is Empty
                    </h4>
                    <p style={{ fontSize: '0.88rem' }}>
                      Items moved to trash will appear here. You can restore them or empty trash anytime.
                    </p>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              /* Grid View */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
                {displayedFiles.map((file) => {
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
                          <SmartImage
                            src={api.getFileStreamUrl(file.id)}
                            alt={file.name}
                            filename={file.name}
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
                          title={isSelected ? 'Deselect file' : 'Select file'}
                          style={{
                            position: 'absolute',
                            top: '0.65rem',
                            right: '0.65rem',
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            color: isSelected ? 'var(--tg-blue)' : '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 2,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isSelected ? (
                            <CheckSquare size={18} color="var(--tg-blue)" />
                          ) : (
                            <Square size={18} color="#94a3b8" />
                          )}
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
                            {currentNav === 'trash' ? (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    sfx.playComplete();
                                    onRestoreFile?.(file.id);
                                  }}
                                  style={{
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    color: 'var(--tg-blue)',
                                    borderRadius: 6,
                                    padding: '0.2rem 0.5rem',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                  title="Restore to My Files"
                                >
                                  <RotateCcw size={12} /> Restore
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    sfx.playClick();
                                    setFileToDelete(file);
                                  }}
                                  style={{
                                    background: '#fef2f2',
                                    border: '1px solid #fee2e2',
                                    color: '#ef4444',
                                    borderRadius: 6,
                                    padding: '0.2rem 0.5rem',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                  title="Delete Forever from Telegram"
                                >
                                  <Trash2 size={12} /> Delete
                                </button>
                              </>
                            ) : (
                              <>
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    sfx.playClick();
                                    setFileToDelete(file);
                                  }}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                                  title="Delete"
                                >
                                  <Trash2 size={14} color="#ef4444" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List View */
              <div
                className="list-table-container"
                style={{
                  background: '#fff',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 16,
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  width: '100%',
                }}
              >
                <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse' }}>
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
                          {selectedIds.length === displayedFiles.length && displayedFiles.length > 0 ? (
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
                    {currentFolders.length > 0 && currentCategory === 'all' && !searchQuery && currentNav !== 'trash' && currentFolders.map((fld) => {
                      const isFolderSelected = selectedFolderIds.includes(fld.id);
                      return (
                        <tr
                          key={`folder-${fld.id}`}
                          onClick={() => {
                            if (isLongPressRef.current) return;
                            if (selectedFolderIds.length > 0) {
                              toggleSelectFolder(fld.id);
                              return;
                            }
                            sfx.playClick();
                            onNavigateFolder(fld.id);
                          }}
                          onTouchStart={() => handleFolderTouchStart(fld.id)}
                          onTouchEnd={handleFolderTouchEnd}
                          onTouchMove={handleFolderTouchEnd}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            background: isFolderSelected ? '#f0f7ff' : '#fafcff',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = isFolderSelected ? '#e0f2fe' : '#eff6ff')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = isFolderSelected ? '#f0f7ff' : '#fafcff')}
                        >
                          <td style={{ padding: '0.85rem 1.25rem', width: 40 }}>
                            <button
                              onClick={(e) => toggleSelectFolder(fld.id, e)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                            >
                              {isFolderSelected ? <CheckSquare size={16} color="var(--tg-blue)" /> : <Square size={16} />}
                            </button>
                          </td>
                          <td style={{ padding: '0.85rem 1.25rem', fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              <FolderIcon size={18} color={fld.color || '#3b82f6'} fill={fld.color || '#3b82f6'} />
                              <span>{fld.name}</span>
                            </div>
                          </td>
                          <td className="hide-on-mobile" style={{ padding: '0.85rem 1.25rem', color: 'var(--text-light)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                            folder_{fld.id.slice(0, 8)}
                          </td>
                          <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-light)', fontSize: '0.82rem' }}>
                            {fld._count?.files !== undefined ? `${fld._count.files} items` : '—'}
                          </td>
                          <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateFolder(fld.id);
                              }}
                              style={{
                                background: '#f1f5f9',
                                border: 'none',
                                borderRadius: 6,
                                padding: '0.28rem 0.65rem',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                color: '#334155',
                              }}
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {displayedFiles.map((file) => {
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
                              {currentNav === 'trash' ? (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      sfx.playComplete();
                                      onRestoreFile?.(file.id);
                                    }}
                                    style={{
                                      background: '#eff6ff',
                                      border: '1px solid #bfdbfe',
                                      color: 'var(--tg-blue)',
                                      borderRadius: 6,
                                      padding: '0.25rem 0.65rem',
                                      fontSize: '0.78rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                    title="Restore file"
                                  >
                                    <RotateCcw size={14} /> Restore
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      sfx.playClick();
                                      setFileToDelete(file);
                                    }}
                                    style={{
                                      background: '#fef2f2',
                                      border: '1px solid #fee2e2',
                                      color: '#ef4444',
                                      borderRadius: 6,
                                      padding: '0.25rem 0.65rem',
                                      fontSize: '0.78rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                    title="Delete forever"
                                  >
                                    <Trash2 size={14} /> Delete
                                  </button>
                                </>
                              ) : (
                                <>
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      sfx.playClick();
                                      setFileToDelete(file);
                                    }}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                                    title="Delete"
                                  >
                                    <Trash2 size={16} color="#ef4444" />
                                  </button>
                                </>
                              )}
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

        {/* Floating Batch Actions Bar (100% Light Theme with Smooth Spring Enter/Exit Animation) */}
        {(() => {
          const hasSelection = selectedIds.length > 0 || selectedFolderIds.length > 0;
          const isOnlyFoldersSelected = selectedFolderIds.length > 0 && selectedIds.length === 0;
          const singleSelectedFolder = isOnlyFoldersSelected && selectedFolderIds.length === 1
            ? folders.find((f) => f.id === selectedFolderIds[0])
            : null;

          return (
            <div
              className="floating-batch-bar"
              style={{
                position: 'fixed',
                bottom: '1.5rem',
                left: '50%',
                transform: hasSelection ? 'translateX(-50%) translateY(0) scale(1)' : 'translateX(-50%) translateY(28px) scale(0.95)',
                opacity: hasSelection ? 1 : 0,
                pointerEvents: hasSelection ? 'auto' : 'none',
                visibility: hasSelection ? 'visible' : 'hidden',
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
                {isOnlyFoldersSelected
                  ? singleSelectedFolder
                    ? `Folder "${singleSelectedFolder.name}" selected`
                    : `${selectedFolderIds.length} folders selected`
                  : `${selectedIds.length} ${selectedIds.length === 1 ? 'file' : 'files'}${selectedFolderIds.length > 0 ? ` & ${selectedFolderIds.length} ${selectedFolderIds.length === 1 ? 'folder' : 'folders'}` : ''} selected`}
              </span>

              {isOnlyFoldersSelected ? (
                <div className="batch-actions-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {singleSelectedFolder && (
                    <button
                      onClick={() => {
                        sfx.playClick();
                        onRenameFolder(singleSelectedFolder);
                        setSelectedFolderIds([]);
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
                      <Pencil size={14} /> Rename
                    </button>
                  )}

                  <button
                    onClick={() => {
                      sfx.playClick();
                      selectedFolderIds.forEach((id) => {
                        const f = folders.find((fl) => fl.id === id);
                        if (f) onDeleteFolder(f);
                      });
                      setSelectedFolderIds([]);
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
                    <Trash2 size={14} /> {selectedFolderIds.length > 1 ? `Delete Folders (${selectedFolderIds.length})` : 'Delete Folder'}
                  </button>

                  <button
                    onClick={() => setSelectedFolderIds([])}
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
              ) : currentNav === 'trash' ? (
                <div className="batch-actions-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {/* Restore Batch Button */}
                  <button
                    onClick={() => {
                      sfx.playComplete();
                      onRestoreBatch?.(selectedIds);
                      setSelectedIds([]);
                      setSelectedFolderIds([]);
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
                    <RotateCcw size={14} /> Restore ({selectedIds.length})
                  </button>

                  {/* Delete Forever Button */}
                  <button
                    onClick={() => {
                      sfx.playClick();
                      setIsBatchDeleteOpen(true);
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
                    <Trash2 size={14} /> Delete Forever ({selectedIds.length})
                  </button>

                  {/* Clear Selection */}
                  <button
                    onClick={() => {
                      setSelectedIds([]);
                      setSelectedFolderIds([]);
                    }}
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
              ) : (
                <div className="batch-actions-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
                      setSelectedFolderIds([]);
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
                      if (selectedIds.length > 0) {
                        setIsBatchDeleteOpen(true);
                      }
                      if (selectedFolderIds.length > 0) {
                        selectedFolderIds.forEach((id) => {
                          const f = folders.find((fl) => fl.id === id);
                          if (f) onDeleteFolder(f);
                        });
                        setSelectedFolderIds([]);
                      }
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
                    onClick={() => {
                      setSelectedIds([]);
                      setSelectedFolderIds([]);
                    }}
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
              )}
            </div>
          );
        })()}
      </div>
      )}

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

        {/* Delete Single File Modal */}
        <DeleteFileModal
          isOpen={Boolean(fileToDelete)}
          file={fileToDelete}
          isPermanent={currentNav === 'trash'}
          onClose={() => setFileToDelete(null)}
          onConfirm={(id) => {
            if (currentNav === 'trash') {
              if (onDeletePermanent) {
                onDeletePermanent(id);
              } else {
                onDeleteFile(id);
              }
            } else {
              onDeleteFile(id);
            }
            setFileToDelete(null);
          }}
        />

        {/* Delete Batch Files Modal */}
        <DeleteBatchFilesModal
          isOpen={isBatchDeleteOpen}
          count={selectedIds.length}
          isPermanent={currentNav === 'trash'}
          onClose={() => setIsBatchDeleteOpen(false)}
          onConfirm={() => {
            if (currentNav === 'trash') {
              if (onDeleteBatchPermanent) {
                onDeleteBatchPermanent(selectedIds);
              } else {
                selectedIds.forEach((id) => onDeleteFile(id));
              }
            } else {
              selectedIds.forEach((id) => onDeleteFile(id));
            }
            setSelectedIds([]);
            setIsBatchDeleteOpen(false);
          }}
        />

        {/* Empty Trash Modal */}
        <EmptyTrashModal
          isOpen={isEmptyTrashOpen}
          count={files.length}
          onClose={() => setIsEmptyTrashOpen(false)}
          onConfirm={() => {
            onEmptyTrash?.();
            setSelectedIds([]);
            setIsEmptyTrashOpen(false);
          }}
        />
      </main>
    </div>
  );
};
