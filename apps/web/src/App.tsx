import React, { useState, useEffect, useRef } from 'react';
import { LandingPage } from './components/LandingPage';
import { OtpModal } from './components/OtpModal';
import { DriveExplorer } from './components/DriveExplorer';
import { PreviewModal, ShareModal, NewFolderModal, RenameFolderModal, DeleteFolderModal, DeleteFileModal, TorrentQueueManager, LogoutConfirmModal } from './components/Modals';
import { PublicShareView } from './components/PublicShareView';
import { CommandPalette } from './components/CommandPalette';
import { api } from './services/api';
import { sfx } from './services/sound';
import { User, Folder, DriveFile, StorageMetrics, Country, UploadQueueItem } from './types';

export const App: React.FC = () => {
  // Public Shared Link Routing Detection
  const [sharedSpoolHash, setSharedSpoolHash] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/s/')) {
      return window.location.pathname.substring(3);
    }
    return null;
  });

  // User Session Persistence via localStorage (supports freebox with fallback to freedisk)
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('freebox_user') || localStorage.getItem('freedisk_user');
      if (saved) {
        return JSON.parse(saved);
      }
      return null;
    } catch {
      return null;
    }
  });

  const [view, setView] = useState<'landing' | 'explorer' | 'public_share'>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/s/')) {
      return 'public_share';
    }
    try {
      const saved = localStorage.getItem('freebox_user') || localStorage.getItem('freedisk_user');
      if (saved) {
        return 'explorer';
      }
      return 'landing';
    } catch {
      return 'landing';
    }
  });

  // Browser back/forward navigation support
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname.startsWith('/s/')) {
        setSharedSpoolHash(window.location.pathname.substring(3));
        setView('public_share');
      } else {
        setSharedSpoolHash(null);
        setView(user ? 'explorer' : 'landing');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]);

  // Real Telegram OTP State
  const [isOtpOpen, setIsOtpOpen] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [targetPhone, setTargetPhone] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [requires2FAPassword, setRequires2FAPassword] = useState(false);

  // Explorer State
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [metrics, setMetrics] = useState<StorageMetrics | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentNav, setCurrentNav] = useState('all');
  const [currentCategory, setCurrentCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Upload & Modals State
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isUploadDrawerOpen, setIsUploadDrawerOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [shareFile, setShareFile] = useState<DriveFile | null>(null);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState<Folder | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [fileToDeleteFromPreview, setFileToDeleteFromPreview] = useState<DriveFile | null>(null);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  // References
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const activeWorkersRef = useRef<Set<string>>(new Set());

  const currentFolderIdRef = useRef(currentFolderId);
  const currentNavRef = useRef(currentNav);
  const currentCategoryRef = useRef(currentCategory);
  const searchQueryRef = useRef(searchQuery);

  useEffect(() => {
    currentFolderIdRef.current = currentFolderId;
    currentNavRef.current = currentNav;
    currentCategoryRef.current = currentCategory;
    searchQueryRef.current = searchQuery;
  }, [currentFolderId, currentNav, currentCategory, searchQuery]);

  // Load Data
  const loadDriveData = async (
    folderId = currentFolderIdRef.current,
    category = currentCategoryRef.current,
    search = searchQueryRef.current,
    nav = currentNavRef.current
  ) => {
    try {
      const [fetchedFolders, fetchedFiles, fetchedMetrics] = await Promise.all([
        api.getFolders(),
        api.getFiles({ folderId, category, search, nav }),
        api.getStorageMetrics(),
      ]);
      setFolders(fetchedFolders);
      setFiles(fetchedFiles);
      setMetrics(fetchedMetrics);
    } catch (err) {
      console.error('Failed to load drive data', err);
    }
  };

  useEffect(() => {
    if (view === 'explorer') {
      loadDriveData(currentFolderId, currentCategory, searchQuery, currentNav);
    }
  }, [view, currentFolderId, currentNav, currentCategory, searchQuery]);

  // Global Keyboard Shortcuts (Cmd+K)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Multi-Threaded Parallel Upload Worker Scheduler (Concurrency: 3)
  const CONCURRENCY_LIMIT = 3;

  useEffect(() => {
    const queuedItems = uploadQueue.filter((item) => item.state === 'queued');
    const availableSlots = CONCURRENCY_LIMIT - activeWorkersRef.current.size;

    if (availableSlots > 0 && queuedItems.length > 0) {
      const itemsToStart = queuedItems.slice(0, availableSlots);
      for (const item of itemsToStart) {
        processUploadItem(item);
      }
    }
  }, [uploadQueue]);

  const processUploadItem = async (item: UploadQueueItem) => {
    if (activeWorkersRef.current.has(item.id)) return;
    activeWorkersRef.current.add(item.id);

    const startTime = Date.now();

    setUploadQueue((prev) =>
      prev.map((q) =>
        q.id === item.id
          ? {
              ...q,
              state: 'uploading',
              status: 'Connecting to Telegram...',
              speedMBs: 0,
            }
          : q
      )
    );

    try {
      // Upload actual file bytes to Telegram via server
      const { promise, abort } = api.uploadFile(
        item.file,
        item.folderId,
        (progress) => {
          const elapsed = (Date.now() - startTime) / 1000;
          const bytesUploaded = (progress / 100) * item.size;
          const speedMBs = elapsed > 0 ? bytesUploaded / (1024 * 1024) / elapsed : 0;
          const remainingBytes = item.size - bytesUploaded;
          const etaSeconds = speedMBs > 0 ? Math.max(1, Math.round(remainingBytes / (speedMBs * 1024 * 1024))) : 0;

          setUploadQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? {
                    ...q,
                    progress,
                    speedMBs: Math.round(speedMBs * 10) / 10,
                    etaSeconds,
                    status: `Uploading to Telegram • ${speedMBs.toFixed(1)} MB/s`,
                  }
                : q
            )
          );
        },
      );

      const uploadedFile = await promise;

      // Realtime UI state update without page refresh
      if (uploadedFile) {
        setFiles((prev) => {
          const belongsInCurrent = (uploadedFile.folderId || null) === (currentFolderIdRef.current || null);
          if (belongsInCurrent && !prev.some((f) => f.id === uploadedFile.id)) {
            return [uploadedFile, ...prev];
          }
          return prev;
        });
      }

      // Mark completed
      setUploadQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                progress: 100,
                state: 'completed',
                speedMBs: 0,
                etaSeconds: 0,
                status: 'Uploaded to Telegram ✓✓',
              }
            : q
        )
      );

      sfx.playTelegramPop();
      await loadDriveData();
    } catch (err: any) {
      console.error('Upload error', err);
      setUploadQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, state: 'error', status: err.message || 'Upload failed' } : q))
      );
    } finally {
      activeWorkersRef.current.delete(item.id);
    }
  };

  // Real Telegram MTProto Auth Handlers
  const handleStartLogin = async (phone: string, country: Country) => {
    const cleanDigits = phone.replace(/\D/g, '');
    const fullPhone = `${country.code}${cleanDigits}`;
    setTargetPhone(fullPhone);
    setOtpError(null);
    setRequires2FAPassword(false);
    setIsSendingOtp(true);
    sfx.playClick();

    try {
      await api.sendCode(fullPhone);
      setIsSendingOtp(false);
      setIsOtpOpen(true);
    } catch (err: any) {
      setIsSendingOtp(false);
      alert(err.message || 'Failed to send Telegram verification code. Please check your phone number.');
    }
  };

  const handleVerifyOtp = async (code: string, password?: string) => {
    setIsVerifying(true);
    setOtpError(null);

    try {
      const res = await api.verifyCode(targetPhone, code, password);

      if (res.requiresPassword) {
        setRequires2FAPassword(true);
        setIsVerifying(false);
        return;
      }

      setUser(res.user);
      try {
        localStorage.setItem('freebox_user', JSON.stringify(res.user));
        // Save JWT token for authenticated API calls (file upload/stream)
        if (res.token) {
          localStorage.setItem('freebox_token', res.token);
        }
      } catch (e) {
        console.error(e);
      }

      sfx.playComplete();
      setIsOtpOpen(false);
      setIsVerifying(false);

      // Clean up URL hash if user navigated to #features or #faq
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname);
      }

      setView('explorer');
    } catch (err: any) {
      setIsVerifying(false);
      setOtpError(err.message || 'Invalid verification code. Please check your Telegram app.');
      sfx.playClick();
    }
  };

  const handleResendOtp = async () => {
    setOtpError(null);
    setIsSendingOtp(true);
    try {
      await api.sendCode(targetPhone);
      setTimeout(() => {
        setIsSendingOtp(false);
      }, 400);
    } catch (err: any) {
      setIsSendingOtp(false);
      setOtpError(err.message || 'Could not resend code. Please wait.');
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('freebox_user');
      localStorage.removeItem('freebox_token');
      localStorage.removeItem('freedisk_user');
      localStorage.removeItem('freedisk_token');
    } catch (e) {
      console.error(e);
    }
    setUser(null);
    setView('landing');
  };

  const toggleSound = () => {
    sfx.enabled = !soundEnabled;
    setSoundEnabled(!soundEnabled);
  };

  // Helper: Enqueue list of files
  const enqueueFiles = (filesList: { file: File; relativePath?: string; folderId?: string | null; folderName?: string }[]) => {
    if (filesList.length === 0) return;

    sfx.playClick();

    const newItems: UploadQueueItem[] = filesList.map((item) => {
      const f = item.file;
      const ext = f.name.split('.').pop() || 'bin';
      return {
        id: Math.random().toString(36).substring(2),
        file: f,
        name: f.name,
        size: f.size,
        type: f.type.startsWith('image/')
          ? 'image'
          : f.type.startsWith('video/')
          ? 'video'
          : f.type.startsWith('audio/')
          ? 'audio'
          : 'document',
        mimeType: f.type || 'application/octet-stream',
        spoolHash: `spool_${Math.random().toString(16).substring(2, 8)}...${Math.random().toString(16).substring(2, 6)}.${ext}`,
        progress: 0,
        status: 'Queued for seeding...',
        chunksTotal: Math.max(3, Math.ceil(f.size / (512 * 1024))),
        chunksDone: 0,
        folderId: item.folderId !== undefined ? item.folderId : currentFolderId,
        folderName: item.folderName,
        state: 'queued',
        speedMBs: 0,
        etaSeconds: 0,
      };
    });

    setUploadQueue((prev) => [...prev, ...newItems]);
    setIsUploadDrawerOpen(true);
  };

  // File Upload from Standard File Input
  const handleFileUpload = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const items = Array.from(filesList).map((f) => ({ file: f }));
    enqueueFiles(items);
  };

  // Bulk Folder Upload from WebkitDirectory input
  const handleFolderUpload = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;

    // Cache of path -> created folder ID
    const pathFolderCache = new Map<string, string>();

    const itemsToQueue: { file: File; folderId: string | null; folderName: string }[] = [];

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const relPath = file.webkitRelativePath || file.name;
      const parts = relPath.split('/').filter(Boolean);

      let targetFolderId = currentFolderId;
      let targetFolderName = '';

      if (parts.length > 1) {
        // Exclude file name from folder path
        const folderParts = parts.slice(0, -1);
        let accumulatedPath = '';
        let parentId = currentFolderId;

        for (const segment of folderParts) {
          accumulatedPath = accumulatedPath ? `${accumulatedPath}/${segment}` : segment;

          if (pathFolderCache.has(accumulatedPath)) {
            parentId = pathFolderCache.get(accumulatedPath)!;
          } else {
            // Create folder in FreeBox
            try {
              const newFolder = await api.createFolder(segment, parentId);
              pathFolderCache.set(accumulatedPath, newFolder.id);
              parentId = newFolder.id;
            } catch (err) {
              console.error('Failed to create folder in hierarchy', err);
            }
          }
        }
        targetFolderId = parentId;
        targetFolderName = folderParts[folderParts.length - 1];
      }

      itemsToQueue.push({ file, folderId: targetFolderId, folderName: targetFolderName });
    }

    // Refresh folders list so created folders show immediately
    await loadDriveData();
    enqueueFiles(itemsToQueue);
  };

  // Bulk Folder Drop with Recursive Directory Traversal
  const handleDropFolderItems = async (items: { file: File; relativePath: string }[]) => {
    const pathFolderCache = new Map<string, string>();
    const itemsToQueue: { file: File; folderId: string | null; folderName: string }[] = [];

    for (const item of items) {
      const relPath = item.relativePath || item.file.name;
      const parts = relPath.split('/').filter(Boolean);

      let targetFolderId = currentFolderId;
      let targetFolderName = '';

      if (parts.length > 1) {
        const folderParts = parts.slice(0, -1);
        let accumulatedPath = '';
        let parentId = currentFolderId;

        for (const segment of folderParts) {
          accumulatedPath = accumulatedPath ? `${accumulatedPath}/${segment}` : segment;

          if (pathFolderCache.has(accumulatedPath)) {
            parentId = pathFolderCache.get(accumulatedPath)!;
          } else {
            try {
              const newFolder = await api.createFolder(segment, parentId);
              pathFolderCache.set(accumulatedPath, newFolder.id);
              parentId = newFolder.id;
            } catch (err) {
              console.error('Failed to create folder during drop', err);
            }
          }
        }
        targetFolderId = parentId;
        targetFolderName = folderParts[folderParts.length - 1];
      }

      itemsToQueue.push({ file: item.file, folderId: targetFolderId, folderName: targetFolderName });
    }

    await loadDriveData();
    enqueueFiles(itemsToQueue);
  };

  // Queue Control Handlers
  const handlePauseItem = (id: string) => {
    activeWorkersRef.current.delete(id);
    setUploadQueue((prev) =>
      prev.map((q) => (q.id === id ? { ...q, state: 'paused', status: 'Paused', speedMBs: 0 } : q))
    );
  };

  const handleResumeItem = (id: string) => {
    setUploadQueue((prev) =>
      prev.map((q) => (q.id === id ? { ...q, state: 'queued', status: 'Queued' } : q))
    );
  };

  const handleCancelItem = (id: string) => {
    activeWorkersRef.current.delete(id);
    setUploadQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const handlePauseAll = () => {
    activeWorkersRef.current.clear();
    setUploadQueue((prev) =>
      prev.map((q) =>
        q.progress < 100 ? { ...q, state: 'paused', status: 'Paused', speedMBs: 0 } : q
      )
    );
  };

  const handleResumeAll = () => {
    setUploadQueue((prev) =>
      prev.map((q) =>
        q.state === 'paused' ? { ...q, state: 'queued', status: 'Queued' } : q
      )
    );
  };

  const handleClearCompleted = () => {
    setUploadQueue((prev) => prev.filter((q) => q.progress < 100));
  };

  // Move Files into Folder
  const handleMoveFiles = async (fileIds: string[], targetFolderId: string | null) => {
    // Optimistic UI update: Remove moved files from current view immediately
    setFiles((prev) => prev.filter((f) => !fileIds.includes(f.id)));
    sfx.playTelegramPop();

    try {
      await api.moveFiles(fileIds, targetFolderId);
      await loadDriveData();
    } catch (err) {
      console.error('Failed to move files', err);
      await loadDriveData();
    }
  };

  const handleCreateFolder = async (name: string) => {
    await api.createFolder(name, currentFolderId);
    setIsNewFolderOpen(false);
    sfx.playComplete();
    loadDriveData();
  };

  const handleRenameFolder = async (id: string, name: string) => {
    try {
      await api.renameFolder(id, name);
      setFolderToRename(null);
      sfx.playComplete();
      await loadDriveData();
    } catch (err) {
      console.error('Failed to rename folder', err);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      await api.deleteFolder(id);
      setFolderToDelete(null);
      sfx.playComplete();
      if (currentFolderId === id) {
        setCurrentFolderId(null);
      }
      await loadDriveData();
    } catch (err) {
      console.error('Failed to delete folder', err);
    }
  };

  const handleToggleStar = async (id: string) => {
    await api.toggleStar(id);
    loadDriveData();
  };

  const handleDeleteFile = async (id: string, permanent: boolean = false) => {
    try {
      await api.deleteFile(id, permanent);
      sfx.playComplete();
      await loadDriveData();
    } catch (err) {
      console.error('Failed to delete file', err);
      await loadDriveData();
    }
  };

  const handleRestoreFile = async (id: string) => {
    try {
      await api.restoreFile(id);
      sfx.playComplete();
      await loadDriveData();
    } catch (err) {
      console.error('Failed to restore file', err);
      await loadDriveData();
    }
  };

  const handleRestoreBatch = async (ids: string[]) => {
    try {
      await api.restoreFiles(ids);
      sfx.playComplete();
      await loadDriveData();
    } catch (err) {
      console.error('Failed to restore batch files', err);
      await loadDriveData();
    }
  };

  const handleEmptyTrash = async () => {
    try {
      await api.emptyTrash();
      sfx.playComplete();
      await loadDriveData();
    } catch (err) {
      console.error('Failed to empty trash', err);
      await loadDriveData();
    }
  };

  const handleDeletePermanent = async (id: string) => {
    try {
      await api.deleteFile(id, true);
      sfx.playComplete();
      await loadDriveData();
    } catch (err) {
      console.error('Failed to delete file permanently', err);
      await loadDriveData();
    }
  };

  const handleDeleteBatchPermanent = async (ids: string[]) => {
    try {
      await api.deleteFiles(ids, true);
      sfx.playComplete();
      await loadDriveData();
    } catch (err) {
      console.error('Failed to delete batch permanently', err);
      await loadDriveData();
    }
  };

  const handleDeleteLivePhotoPair = async (pair: any) => {
    try {
      await Promise.all([
        api.deleteFile(pair.photoFile.id, true),
        api.deleteFile(pair.videoFile.id, true),
      ]);
      sfx.playComplete();
      await loadDriveData();
    } catch (err) {
      console.error('Failed to delete live photo pair', err);
      await loadDriveData();
    }
  };

  return (
    <div>
      {view === 'public_share' && sharedSpoolHash ? (
        <PublicShareView
          spoolHash={sharedSpoolHash}
          onGoHome={() => {
            window.history.pushState({}, '', '/');
            setSharedSpoolHash(null);
            setView(user ? 'explorer' : 'landing');
          }}
        />
      ) : view === 'landing' ? (
        <LandingPage onStartLogin={handleStartLogin} isSendingOtp={isSendingOtp} />
      ) : (
        <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
          <DriveExplorer
            user={user}
            folders={folders}
            files={files}
            metrics={metrics}
            currentFolderId={currentFolderId}
            currentNav={currentNav}
            currentCategory={currentCategory}
            searchQuery={searchQuery}
            viewMode={viewMode}
            soundEnabled={soundEnabled}
            onNavigateFolder={(id) => setCurrentFolderId(id)}
            onSelectNav={(n) => {
              setCurrentNav(n);
              setCurrentCategory('all');
            }}
            onSelectCategory={(c) => {
              setCurrentCategory(c);
              setCurrentNav('all');
            }}
            onSearchChange={setSearchQuery}
            onToggleViewMode={setViewMode}
            onOpenUpload={() => fileInputRef.current?.click()}
            onOpenFolderUpload={() => folderInputRef.current?.click()}
            onOpenNewFolder={() => setIsNewFolderOpen(true)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onToggleSound={toggleSound}
            onPreviewFile={setPreviewFile}
            onShareFile={setShareFile}
            onToggleStar={handleToggleStar}
            onDeleteFile={handleDeleteFile}
            onRestoreFile={handleRestoreFile}
            onRestoreBatch={handleRestoreBatch}
            onEmptyTrash={handleEmptyTrash}
            onDeletePermanent={handleDeletePermanent}
            onDeleteBatchPermanent={handleDeleteBatchPermanent}
            onRenameFolder={setFolderToRename}
            onDeleteFolder={setFolderToDelete}
            onDeleteLivePhotoPair={handleDeleteLivePhotoPair}
            onMoveFiles={handleMoveFiles}
            onDropFolderItems={handleDropFolderItems}
            onLogout={() => setIsLogoutOpen(true)}
          />
        </div>
      )}

      {/* Hidden Standard File Input */}
      <input
        type="file"
        multiple
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* Hidden Bulk Folder Input (webkitdirectory) */}
      <input
        type="file"
        multiple
        // @ts-ignore
        webkitdirectory=""
        directory=""
        ref={folderInputRef}
        style={{ display: 'none' }}
        onChange={(e) => handleFolderUpload(e.target.files)}
      />

      {/* Interactive Command Palette (Cmd+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        files={files}
        folders={folders}
        onSelectFile={setPreviewFile}
        onNavigateFolder={(id) => setCurrentFolderId(id)}
        onOpenUpload={() => fileInputRef.current?.click()}
        onOpenNewFolder={() => setIsNewFolderOpen(true)}
        onToggleViewMode={() => setViewMode((prev) => (prev === 'grid' ? 'list' : 'grid'))}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
      />

      {/* Preview Modal with Image Zoom, Video Speed, Audio Visualizer & Code Preview */}
      <PreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onShare={(f) => {
          setPreviewFile(null);
          setShareFile(f);
        }}
        onDelete={(f) => {
          setPreviewFile(null);
          setFileToDeleteFromPreview(f);
        }}
      />

      {/* Delete File from Preview Confirmation Modal */}
      <DeleteFileModal
        isOpen={Boolean(fileToDeleteFromPreview)}
        file={fileToDeleteFromPreview}
        onClose={() => setFileToDeleteFromPreview(null)}
        onConfirm={(id) => {
          handleDeleteFile(id);
          setFileToDeleteFromPreview(null);
        }}
      />

      {/* Share Direct Link Modal */}
      <ShareModal file={shareFile} onClose={() => setShareFile(null)} />

      {/* New Folder Modal */}
      <NewFolderModal
        isOpen={isNewFolderOpen}
        onClose={() => setIsNewFolderOpen(false)}
        onCreate={handleCreateFolder}
      />

      {/* Rename Folder Modal */}
      <RenameFolderModal
        isOpen={Boolean(folderToRename)}
        folder={folderToRename}
        onClose={() => setFolderToRename(null)}
        onRename={handleRenameFolder}
      />

      {/* Delete Folder Modal */}
      <DeleteFolderModal
        isOpen={Boolean(folderToDelete)}
        folder={folderToDelete}
        onClose={() => setFolderToDelete(null)}
        onConfirm={handleDeleteFolder}
      />

      {/* Torrent-Style Realtime Transfer Queue Dock */}
      <TorrentQueueManager
        queue={uploadQueue}
        isOpen={isUploadDrawerOpen}
        onClose={() => setIsUploadDrawerOpen(false)}
        onPauseItem={handlePauseItem}
        onResumeItem={handleResumeItem}
        onCancelItem={handleCancelItem}
        onClearCompleted={handleClearCompleted}
        onPauseAll={handlePauseAll}
        onResumeAll={handleResumeAll}
      />

      {/* Real Telegram MTProto OTP Modal */}
      {isOtpOpen && (
        <OtpModal
          phone={targetPhone}
          isVerifying={isVerifying}
          error={otpError}
          requiresPassword={requires2FAPassword}
          onClose={() => setIsOtpOpen(false)}
          onVerify={handleVerifyOtp}
          onResend={handleResendOtp}
        />
      )}

      {/* Reconfirmation Modal for Logout */}
      <LogoutConfirmModal
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={() => {
          setIsLogoutOpen(false);
          handleLogout();
        }}
      />
    </div>
  );
};
