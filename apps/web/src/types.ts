export interface User {
  id: string;
  phone: string;
  name: string;
  avatar: string;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  createdAt?: string;
  _count?: {
    files: number;
    children: number;
  };
}

export interface DriveFile {
  id: string;
  name: string;
  spoolHash: string;
  size: number;
  mimeType: string;
  type: 'image' | 'video' | 'document' | 'audio' | 'archive';
  folderId: string | null;
  userId?: string | null;
  telegramMsgId: number;
  telegramStatus: string;
  starred: boolean;
  isTrashed: boolean;
  storageProvider: string;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
}

export interface StorageMetrics {
  totalFiles: number;
  totalBytes: number;
  trashCount?: number;
  livePhotosCount?: number;
  quota: string;
  isUnlimited: boolean;
  provider: string;
  categories: {
    images: number;
    videos: number;
    documents: number;
    audio: number;
    archives: number;
    starred: number;
    trash?: number;
    live_photo?: number;
  };
}

export interface Country {
  code: string;
  name: string;
  flag: string;
}

export interface UploadQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  mimeType: string;
  spoolHash: string;
  progress: number;
  status: string;
  chunksTotal: number;
  chunksDone: number;
  folderId?: string | null;
  folderName?: string;
  state?: 'queued' | 'uploading' | 'paused' | 'completed' | 'error';
  speedMBs?: number;
  etaSeconds?: number;
  bytesUploaded?: number;
}

export interface TelegramArchivedChat {
  id: string;
  title: string;
  isChannel: boolean;
  isGroup: boolean;
  isUser: boolean;
  unreadCount: number;
  folderId: number;
  date: number;
}

export interface TelegramChatMedia {
  id: number;
  chatId: string;
  type: 'image' | 'video' | 'document' | 'audio';
  mimeType: string;
  fileName: string;
  name?: string;
  size: number;
  date: number;
  streamUrl?: string;
  telegramMsgId?: number;
}

