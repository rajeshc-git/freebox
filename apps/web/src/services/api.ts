import { User, Folder, DriveFile, StorageMetrics, TelegramArchivedChat, TelegramChatMedia } from '../types';

const API_BASE = '/api';

/**
 * Get the JWT auth token from localStorage.
 */
function getAuthToken(): string | null {
  try {
    const saved = localStorage.getItem('freebox_token') || localStorage.getItem('freedisk_token');
    return saved || null;
  } catch {
    return null;
  }
}

/**
 * Get auth headers with Bearer token.
 */
function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export const api = {
  // Real Telegram MTProto Auth
  async sendCode(phone: string): Promise<{ success: boolean; phone: string }> {
    const res = await fetch(`${API_BASE}/auth/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to send verification code from Telegram');
    }
    return data;
  },

  async verifyCode(
    phone: string,
    code: string,
    password?: string
  ): Promise<{ token: string; user: User; requiresPassword?: boolean }> {
    const res = await fetch(`${API_BASE}/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Verification failed. Please check the code in Telegram.');
    }
    return data;
  },

  // Folders
  async getFolders(parentId?: string | null): Promise<Folder[]> {
    const url = parentId !== undefined ? `${API_BASE}/drive/folders?parentId=${parentId || 'root'}` : `${API_BASE}/drive/folders`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  },

  async createFolder(name: string, parentId?: string | null, color = '#3b82f6'): Promise<Folder> {
    const res = await fetch(`${API_BASE}/drive/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId: parentId || null, color }),
    });
    return res.json();
  },

  async renameFolder(id: string, name: string): Promise<Folder> {
    const res = await fetch(`${API_BASE}/drive/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to rename folder');
    return res.json();
  },

  async deleteFolder(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/drive/folders/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete folder');
  },

  // Files
  async getFiles(params: {
    folderId?: string | null;
    category?: string;
    search?: string;
    nav?: string;
  }): Promise<DriveFile[]> {
    const query = new URLSearchParams();
    if (params.folderId !== undefined && params.folderId !== null) {
      query.set('folderId', params.folderId);
    } else {
      query.set('folderId', 'root');
    }
    if (params.category && params.category !== 'all') query.set('category', params.category);
    if (params.search) query.set('search', params.search);
    if (params.nav) query.set('nav', params.nav);

    const res = await fetch(`${API_BASE}/drive/files?${query.toString()}`);
    if (!res.ok) return [];
    return res.json();
  },

  /**
   * Upload a file to Telegram Saved Messages via the server.
   * Sends actual file bytes as multipart/form-data.
   * Returns a promise and calls onProgress with percentage (0-100).
   */
  uploadFile(
    file: File,
    folderId?: string | null,
    onProgress?: (progress: number) => void,
  ): { promise: Promise<DriveFile>; abort: () => void } {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) {
      formData.append('folderId', folderId);
    }

    let rejectFn: (reason: any) => void;

    const promise = new Promise<DriveFile>((resolve, reject) => {
      rejectFn = reject;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error('Invalid server response'));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.message || `Upload failed (${xhr.status})`));
          } catch {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.onabort = () => reject(new Error('Upload cancelled'));

      xhr.open('POST', `${API_BASE}/drive/files/upload`);

      // Set auth header
      const token = getAuthToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.send(formData);
    });

    return {
      promise,
      abort: () => xhr.abort(),
    };
  },

  /**
   * Get the URL to stream/preview a file from Telegram.
   */
  getFileStreamUrl(fileId: string): string {
    const token = getAuthToken();
    return `${API_BASE}/drive/files/${fileId}/stream${token ? `?token=${token}` : ''}`;
  },

  /**
   * Get the URL to download a file from Telegram.
   */
  getFileDownloadUrl(fileId: string): string {
    const token = getAuthToken();
    return `${API_BASE}/drive/files/${fileId}/download${token ? `?token=${token}` : ''}`;
  },

  /**
   * Get the URL to download multiple files bundled in a zip archive.
   */
  getBatchDownloadUrl(fileIds: string[]): string {
    const token = getAuthToken();
    const idsQuery = encodeURIComponent(fileIds.join(','));
    return `${API_BASE}/drive/files/batch/download?ids=${idsQuery}${token ? `&token=${token}` : ''}`;
  },


  async toggleStar(fileId: string): Promise<DriveFile> {
    const res = await fetch(`${API_BASE}/drive/files/${fileId}/star`, {
      method: 'PATCH',
    });
    return res.json();
  },

  async moveFile(fileId: string, folderId: string | null): Promise<DriveFile> {
    const res = await fetch(`${API_BASE}/drive/files/${fileId}/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId }),
    });
    return res.json();
  },

  async moveFiles(ids: string[], folderId: string | null): Promise<void> {
    await fetch(`${API_BASE}/drive/files/batch/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, folderId }),
    });
  },

  async deleteFile(fileId: string, permanent = false): Promise<void> {
    await fetch(`${API_BASE}/drive/files/${fileId}?permanent=${permanent}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  },

  async deleteFiles(fileIds: string[], permanent = false): Promise<void> {
    if (!fileIds.length) return;
    await fetch(`${API_BASE}/drive/trash/delete-batch`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ ids: fileIds }),
    });
  },

  async restoreFile(fileId: string): Promise<void> {
    await fetch(`${API_BASE}/drive/files/${fileId}/restore`, {
      method: 'POST',
      headers: authHeaders(),
    });
  },

  async restoreFiles(fileIds: string[]): Promise<void> {
    if (!fileIds.length) return;
    await fetch(`${API_BASE}/drive/trash/restore-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ ids: fileIds }),
    });
  },

  async emptyTrash(): Promise<void> {
    await fetch(`${API_BASE}/drive/trash/empty`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  },

  async getStorageMetrics(): Promise<StorageMetrics> {
    const res = await fetch(`${API_BASE}/drive/storage-metrics`);
    if (!res.ok) {
      return {
        totalFiles: 0,
        totalBytes: 0,
        quota: 'UNLIMITED',
        isUnlimited: true,
        provider: 'Telegram MTProto Cloud',
        categories: { images: 0, videos: 0, documents: 0, audio: 0, archives: 0, starred: 0 },
      };
    }
    return res.json();
  },

  // Telegram Saved Messages
  async getTelegramSavedMessages() {
    const res = await fetch(`${API_BASE}/telegram/saved-messages`);
    if (!res.ok) return { totalMessages: 0, messages: [] };
    return res.json();
  },

  // Telegram Archived Chats & Media
  async getArchivedChats(): Promise<TelegramArchivedChat[]> {
    const res = await fetch(`${API_BASE}/telegram/archived-chats`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to fetch archived chats');
    }
    return res.json();
  },

  async getChatMedia(
    chatId: string,
    category?: string,
    limit = 100,
    offsetId?: number
  ): Promise<{ media: TelegramChatMedia[]; count: number; totalCount?: number; hasMore: boolean; nextOffsetId?: number | null }> {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (limit) params.set('limit', limit.toString());
    if (offsetId) params.set('offsetId', offsetId.toString());

    const res = await fetch(`${API_BASE}/telegram/chats/${chatId}/media?${params.toString()}`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to fetch chat media');
    }
    return res.json();
  },

  async getChatStats(
    chatId: string
  ): Promise<{ photos: number; videos: number; media: number; files: number; voice: number }> {
    const res = await fetch(`${API_BASE}/telegram/chats/${chatId}/stats`, {
      headers: authHeaders(),
    });
    if (!res.ok) return { photos: 0, videos: 0, media: 0, files: 0, voice: 0 };
    return res.json();
  },

  getChatMediaStreamUrl(chatId: string, messageId: number): string {
    const token = getAuthToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${API_BASE}/telegram/chats/${chatId}/media/${messageId}/stream${tokenParam}`;
  },
};

