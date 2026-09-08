import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramClientService } from '../telegram/telegram-client.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import archiver = require('archiver');
import { Request, Response } from 'express';

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramClient: TelegramClientService,
  ) {}

  async getFolders(parentId?: string) {
    const where: any = {};
    if (parentId !== undefined && parentId !== 'all') {
      where.parentId = parentId === 'root' || parentId === 'null' || !parentId ? null : parentId;
    }

    return this.prisma.folder.findMany({
      where,
      include: {
        _count: {
          select: { files: true, children: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFolder(name: string, parentId?: string, color = '#3b82f6') {
    return this.prisma.folder.create({
      data: {
        name,
        parentId: parentId === 'root' || parentId === 'null' || !parentId ? null : parentId,
        color,
      },
    });
  }

  async renameFolder(id: string, name: string) {
    const folder = await this.prisma.folder.findUnique({ where: { id } });
    if (!folder) throw new NotFoundException('Folder not found');

    return this.prisma.folder.update({
      where: { id },
      data: { name: name.trim() },
    });
  }

  async deleteFolder(id: string) {
    const folder = await this.prisma.folder.findUnique({ where: { id } });
    if (!folder) throw new NotFoundException('Folder not found');

    // Soft delete files in this folder by moving them to trash
    await this.prisma.file.updateMany({
      where: { folderId: id },
      data: { isTrashed: true },
    });

    // Delete subfolders recursively
    const children = await this.prisma.folder.findMany({ where: { parentId: id } });
    for (const child of children) {
      await this.deleteFolder(child.id);
    }

    return this.prisma.folder.delete({
      where: { id },
    });
  }

  async getFiles(query: {
    folderId?: string;
    category?: string;
    search?: string;
    nav?: string; // 'all' | 'recent' | 'starred' | 'trash'
  }) {
    const where: any = {};

    if (query.nav === 'trash') {
      where.isTrashed = true;
    } else {
      where.isTrashed = false;

      if (query.nav === 'starred') {
        where.starred = true;
      } else if (query.nav === 'recent') {
        // order by desc below without folder constraint
      } else {
        // In regular explorer navigation, if not performing a global search:
        if (!query.search) {
          const targetFolderId =
            query.folderId === 'root' || query.folderId === 'null' || !query.folderId
              ? null
              : query.folderId;
          where.folderId = targetFolderId;
        }
      }
    }

    if (query.category && query.category !== 'all') {
      if (query.category === 'live_photo') {
        where.type = { in: ['image', 'video'] };
        delete where.folderId;
      } else {
        where.type = query.category;
      }
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { spoolHash: { contains: query.search } },
      ];
    }

    const files = await this.prisma.file.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Exclude paired Live Photo files (.heic/.jpg + .mov/.mp4) from normal categories and My Files
    let finalFiles = files;
    if (query.category !== 'live_photo' && query.nav !== 'trash') {
      const allMedia = await this.prisma.file.findMany({
        where: { isTrashed: false, type: { in: ['image', 'video'] } },
        select: { name: true, mimeType: true },
      });
      const images = new Set<string>();
      const videos = new Set<string>();
      allMedia.forEach((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        const lastDot = f.name.lastIndexOf('.');
        const base = lastDot > 0 ? f.name.substring(0, lastDot).toLowerCase() : f.name.toLowerCase();
        if (['heic', 'jpg', 'jpeg', 'png'].includes(ext) || f.mimeType?.startsWith('image/')) images.add(base);
        if (['mov', 'mp4'].includes(ext) || f.mimeType?.startsWith('video/')) videos.add(base);
      });
      const pairedBaseNames = new Set<string>();
      images.forEach((b) => {
        if (videos.has(b)) pairedBaseNames.add(b);
      });

      if (pairedBaseNames.size > 0) {
        finalFiles = files.filter((f) => {
          const lastDot = f.name.lastIndexOf('.');
          const base = lastDot > 0 ? f.name.substring(0, lastDot).toLowerCase() : f.name.toLowerCase();
          return !pairedBaseNames.has(base);
        });
      }
    }

    // Add stream URLs for files that have a real telegramMsgId
    return finalFiles.map(f => ({
      ...f,
      previewUrl: f.telegramMsgId > 0 ? `/api/drive/files/${f.id}/stream` : null,
      thumbnailUrl: f.telegramMsgId > 0 ? `/api/drive/files/${f.id}/stream` : null,
    }));
  }

  /**
   * Upload a file to Telegram Saved Messages and create a record in the database.
   * Accepts filePath (for disk-spooled zero-RAM upload) or Buffer.
   */
  async uploadFileToTelegram(
    userPhone: string,
    fileSource:
      | {
          filePath?: string;
          fileBuffer?: Buffer;
          fileName: string;
          mimeType: string;
          fileSize: number;
        }
      | Buffer,
    fileNameParam?: string,
    mimeTypeParam?: string,
    fileSizeParam?: number,
    folderId?: string,
  ) {
    let fileName = '';
    let mimeType = '';
    let fileSize = 0;
    let filePath: string | undefined;

    if (Buffer.isBuffer(fileSource)) {
      fileName = fileNameParam || 'file';
      mimeType = mimeTypeParam || 'application/octet-stream';
      fileSize = fileSizeParam || fileSource.length;
    } else {
      fileName = fileSource.fileName;
      mimeType = fileSource.mimeType;
      fileSize = fileSource.fileSize;
      filePath = fileSource.filePath;
    }

    const spoolHash = this.generateSpoolHash(fileName);
    const type = this.detectType(fileName, mimeType);

    this.logger.log(`Uploading "${fileName}" (${fileSize} bytes) to Telegram for ${userPhone}...`);

    try {
      // Upload to Telegram Saved Messages using disk-spooled file
      const message = await this.telegramClient.uploadFile(
        userPhone,
        fileSource,
        fileName,
        mimeType,
        fileSize,
      );

      // Extract file metadata from Telegram response
      const fileInfo = this.telegramClient.extractFileInfo(message);

      // Create file record in database with real Telegram references
      const file = await this.prisma.file.create({
        data: {
          name: fileName,
          spoolHash,
          size: fileSize,
          mimeType,
          type,
          folderId: folderId || null,
          telegramMsgId: message.id,
          telegramFileId: fileInfo?.fileId || null,
          telegramAccessHash: fileInfo?.accessHash || null,
          telegramStatus: 'read',
          storageProvider: 'telegram',
        },
      });

      this.logger.log(`File "${fileName}" uploaded successfully. Telegram msgId=${message.id}, DB id=${file.id}`);

      return {
        ...file,
        previewUrl: `/api/drive/files/${file.id}/stream`,
        thumbnailUrl: `/api/drive/files/${file.id}/stream`,
      };
    } finally {
      // Automatically clean up temporary disk spool file
      if (filePath) {
        fs.promises.unlink(filePath).catch((err) => {
          this.logger.warn(`Failed to clean up temp upload file "${filePath}": ${err.message}`);
        });
      }
    }
  }

  /**
   * Stream/download a file from Telegram Saved Messages directly to Express HTTP response.
   */
  async streamFile(
    fileId: string,
    userPhone: string,
    req: Request,
    res: Response,
    isDownload = false,
  ): Promise<void> {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');

    if (file.telegramMsgId <= 0) {
      throw new NotFoundException('File has no Telegram reference. It may have been uploaded before Telegram integration.');
    }

    await this.telegramClient.streamMessageMedia(userPhone, file.telegramMsgId, req, res, {
      customFileName: file.name,
      customMimeType: file.mimeType,
      isDownload,
      isPublic: false,
    });
  }

  /**
   * Get public file info by spoolHash.
   */
  async getPublicFileBySpool(spoolHash: string) {
    const decoded = decodeURIComponent(spoolHash);
    let file = await this.prisma.file.findUnique({
      where: { spoolHash: decoded },
      select: {
        id: true,
        name: true,
        size: true,
        mimeType: true,
        type: true,
        spoolHash: true,
        createdAt: true,
        telegramMsgId: true,
      },
    });

    if (!file && decoded !== spoolHash) {
      file = await this.prisma.file.findUnique({
        where: { spoolHash },
        select: {
          id: true,
          name: true,
          size: true,
          mimeType: true,
          type: true,
          spoolHash: true,
          createdAt: true,
          telegramMsgId: true,
        },
      });
    }

    if (!file) throw new NotFoundException('Shared file not found');
    return file;
  }

  /**
   * Stream a public file from Telegram directly to Express HTTP response.
   */
  async streamPublicFile(
    spoolHash: string,
    req: Request,
    res: Response,
    isDownload = false,
  ): Promise<void> {
    const decoded = decodeURIComponent(spoolHash);
    let file = await this.prisma.file.findUnique({
      where: { spoolHash: decoded },
      include: { user: true },
    });

    if (!file && decoded !== spoolHash) {
      file = await this.prisma.file.findUnique({
        where: { spoolHash },
        include: { user: true },
      });
    }

    if (!file) throw new NotFoundException('Shared file not found');

    if (file.telegramMsgId <= 0) {
      throw new NotFoundException('File has no Telegram reference');
    }

    let phone = file.user?.phone;
    if (!phone) {
      const activeUser = await this.prisma.user.findFirst();
      phone = activeUser?.phone;
    }

    if (!phone) {
      throw new NotFoundException('No active storage session available to stream media');
    }

    await this.telegramClient.streamMessageMedia(phone, file.telegramMsgId, req, res, {
      customFileName: file.name,
      customMimeType: file.mimeType,
      isDownload,
      isPublic: true,
    });
  }

  async moveFile(id: string, folderId: string | null) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('File not found');

    const targetFolderId = folderId === 'root' || !folderId ? null : folderId;
    return this.prisma.file.update({
      where: { id },
      data: { folderId: targetFolderId },
    });
  }

  async moveFiles(ids: string[], folderId: string | null) {
    const targetFolderId = folderId === 'root' || !folderId ? null : folderId;
    return this.prisma.file.updateMany({
      where: { id: { in: ids } },
      data: { folderId: targetFolderId },
    });
  }

  async toggleStar(id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('File not found');

    return this.prisma.file.update({
      where: { id },
      data: { starred: !file.starred },
    });
  }

  async deleteFile(id: string, permanent = false, userPhone?: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('File not found');

    if (permanent) {
      // Also delete from Telegram if we have a valid message ID
      if (userPhone && file.telegramMsgId > 0) {
        try {
          await this.telegramClient.deleteMessage(userPhone, file.telegramMsgId);
          this.logger.log(`Deleted Telegram message #${file.telegramMsgId} for file "${file.name}"`);
        } catch (err) {
          this.logger.warn(`Could not delete Telegram message #${file.telegramMsgId}: ${err.message}`);
        }
      }
      return this.prisma.file.delete({ where: { id } });
    }

    return this.prisma.file.update({
      where: { id },
      data: { isTrashed: true },
    });
  }

  async restoreFile(id: string) {
    return this.prisma.file.update({
      where: { id },
      data: { isTrashed: false },
    });
  }

  async emptyTrash(userPhone?: string) {
    const trashedFiles = await this.prisma.file.findMany({
      where: { isTrashed: true },
    });

    if (userPhone && trashedFiles.length > 0) {
      const msgIds = trashedFiles
        .map((f) => f.telegramMsgId)
        .filter((id) => id > 0);

      if (msgIds.length > 0) {
        try {
          await this.telegramClient.deleteMessages(userPhone, msgIds);
          this.logger.log(`Emptied trash: deleted ${msgIds.length} Telegram messages for ${userPhone}`);
        } catch (err) {
          this.logger.warn(`Could not delete Telegram messages during empty trash: ${err.message}`);
        }
      }
    }

    return this.prisma.file.deleteMany({
      where: { isTrashed: true },
    });
  }

  async deleteFilesBatch(ids: string[], permanent = false, userPhone?: string) {
    if (!ids.length) return { count: 0 };

    if (permanent) {
      const files = await this.prisma.file.findMany({
        where: { id: { in: ids } },
      });

      if (userPhone && files.length > 0) {
        const msgIds = files.map((f) => f.telegramMsgId).filter((id) => id > 0);
        if (msgIds.length > 0) {
          try {
            await this.telegramClient.deleteMessages(userPhone, msgIds);
          } catch (err) {
            this.logger.warn(`Could not delete Telegram messages during batch delete: ${err.message}`);
          }
        }
      }

      return this.prisma.file.deleteMany({
        where: { id: { in: ids } },
      });
    }

    return this.prisma.file.updateMany({
      where: { id: { in: ids } },
      data: { isTrashed: true },
    });
  }

  async restoreFilesBatch(ids: string[]) {
    if (!ids.length) return { count: 0 };
    return this.prisma.file.updateMany({
      where: { id: { in: ids } },
      data: { isTrashed: false },
    });
  }

  async getStorageMetrics() {
    const totalFiles = await this.prisma.file.count({ where: { isTrashed: false } });
    const trashCount = await this.prisma.file.count({ where: { isTrashed: true } });
    const files = await this.prisma.file.findMany({
      where: { isTrashed: false },
      select: { name: true, mimeType: true, size: true, type: true, starred: true },
    });

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

    const images = new Set<string>();
    const videos = new Set<string>();
    files.forEach((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      const lastDot = f.name.lastIndexOf('.');
      const base = lastDot > 0 ? f.name.substring(0, lastDot).toLowerCase() : f.name.toLowerCase();
      if (['heic', 'jpg', 'jpeg', 'png'].includes(ext) || f.mimeType?.startsWith('image/')) images.add(base);
      if (['mov', 'mp4'].includes(ext) || f.mimeType?.startsWith('video/')) videos.add(base);
    });

    const pairedBaseNames = new Set<string>();
    images.forEach((b) => {
      if (videos.has(b)) pairedBaseNames.add(b);
    });
    const livePhotosCount = pairedBaseNames.size;

    const nonLiveFiles = files.filter((f) => {
      const lastDot = f.name.lastIndexOf('.');
      const base = lastDot > 0 ? f.name.substring(0, lastDot).toLowerCase() : f.name.toLowerCase();
      return !pairedBaseNames.has(base);
    });

    return {
      totalFiles: nonLiveFiles.length,
      totalBytes,
      trashCount,
      livePhotosCount,
      quota: 'UNLIMITED',
      isUnlimited: true,
      provider: 'Telegram MTProto Cloud',
      categories: {
        images: nonLiveFiles.filter(f => f.type === 'image').length,
        videos: nonLiveFiles.filter(f => f.type === 'video').length,
        documents: nonLiveFiles.filter(f => f.type === 'document').length,
        audio: nonLiveFiles.filter(f => f.type === 'audio').length,
        archives: nonLiveFiles.filter(f => f.type === 'archive').length,
        starred: nonLiveFiles.filter(f => f.starred).length,
        trash: trashCount,
        live_photo: livePhotosCount,
      },
    };
  }

  async downloadBatchZip(ids: string[], userPhone: string, res: Response) {
    const files = await this.prisma.file.findMany({
      where: { id: { in: ids }, isTrashed: false },
    });

    if (!files.length) {
      throw new NotFoundException('No valid files found for batch download');
    }

    const zipFilename = `FreeBox_Batch_${new Date().toISOString().slice(0, 10)}.zip`;

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(zipFilename)}"`,
      'Cache-Control': 'no-cache',
    });

    const archive = new archiver.ZipArchive({
      zlib: { level: 6 },
    });

    archive.on('error', (err: any) => {
      this.logger.error('ZIP archive stream error', err);
      if (!res.headersSent) {
        res.status(500).send({ message: 'Failed to create zip archive' });
      }
    });

    archive.pipe(res);

    const nameCountMap = new Map<string, number>();

    for (const file of files) {
      if (file.telegramMsgId > 0) {
        try {
          const buffer = await this.telegramClient.downloadMedia(userPhone, file.telegramMsgId);
          let entryName = file.name;
          const count = nameCountMap.get(file.name) || 0;
          if (count > 0) {
            const dotIdx = file.name.lastIndexOf('.');
            if (dotIdx > 0) {
              entryName = `${file.name.slice(0, dotIdx)} (${count})${file.name.slice(dotIdx)}`;
            } else {
              entryName = `${file.name} (${count})`;
            }
          }
          nameCountMap.set(file.name, count + 1);

          archive.append(buffer, { name: entryName });
        } catch (downloadErr) {
          this.logger.warn(`Failed to download file ${file.id} for zip: ${downloadErr}`);
        }
      }
    }

    await archive.finalize();
  }

  private generateSpoolHash(originalName: string): string {
    const ext = originalName.includes('.') ? originalName.split('.').pop() : 'bin';
    const randUuid = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    const randHash = crypto.randomBytes(8).toString('hex');
    return `spool_${randUuid.substring(0, 7)}...${randUuid.substring(7, 11)}_${randHash}.${ext}`;
  }

  private detectType(name: string, mime: string): string {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'svg'].includes(ext) || mime.startsWith('image/')) return 'image';
    if (['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(ext) || mime.startsWith('video/')) return 'video';
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'txt'].includes(ext)) return 'document';
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext) || mime.startsWith('audio/')) return 'audio';
    return 'archive';
  }
}
