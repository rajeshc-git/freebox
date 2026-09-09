import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Archive,
  ArrowLeft,
  Search,
  Grid,
  List,
  RefreshCw,
  Image as ImageIcon,
  Film,
  FileText,
  Music,
  Download,
  X,
  Play,
  Pause,
  Users,
  Radio,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Loader2,
  Mic,
  Volume2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { TelegramArchivedChat, TelegramChatMedia } from '../types';
import { api } from '../services/api';
import { sfx } from '../services/sound';

interface ArchivedChatsViewProps {
  onBackToDrive?: () => void;
  onChatOpenChange?: (isOpen: boolean) => void;
}

type TelegramTab = 'media' | 'files' | 'voice';

interface ChatStats {
  photos: number;
  videos: number;
  media: number;
  files: number;
  voice: number;
}

export const ArchivedChatsView: React.FC<ArchivedChatsViewProps> = ({ onChatOpenChange }) => {
  // State
  const [chats, setChats] = useState<TelegramArchivedChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<TelegramArchivedChat | null>(null);
  const [chatSearch, setChatSearch] = useState('');
  const [mediaSearch, setMediaSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TelegramTab>('media');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFullscreenMedia, setIsFullscreenMedia] = useState(false);

  const [chatStats, setChatStats] = useState<ChatStats | null>(null);

  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffsetId, setNextOffsetId] = useState<number | null>(null);

  const [mediaList, setMediaList] = useState<TelegramChatMedia[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Audio Playback State
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format timestamp helper
  const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  // Format seconds to mm:ss
  const formatDuration = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Audio Event Handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setAudioCurrentTime(audio.currentTime);
        setAudioProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setPlayingAudioId(null);
      setAudioProgress(0);
      setAudioCurrentTime(0);
    };

    const handleError = (e: any) => {
      console.warn('Audio playback error:', e);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  // Play / Pause Audio Item
  const handleTogglePlayAudio = (media: TelegramChatMedia, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    sfx.playClick();

    const audio = audioRef.current;
    if (!audio) return;

    const url = api.getChatMediaStreamUrl(media.chatId, media.id);

    if (playingAudioId === media.id) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play().catch(console.warn);
        setIsPlaying(true);
      }
    } else {
      setPlayingAudioId(media.id);
      audio.src = url;
      audio.currentTime = 0;
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Playback failed:', err);
          setIsPlaying(false);
        });
    }
  };

  // Fetch archived chats
  const fetchArchivedChats = useCallback(async () => {
    setLoadingChats(true);
    setErrorMsg(null);
    try {
      const data = await api.getArchivedChats();
      if (Array.isArray(data)) {
        setChats(data);
      } else {
        setChats([]);
      }
    } catch (err: any) {
      console.error('Failed to load archived chats:', err);
      setErrorMsg(err?.message || 'Failed to fetch archived chats from Telegram');
      setChats([]);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    fetchArchivedChats();
  }, [fetchArchivedChats]);

  // Fetch chat stats (counts for photos, videos, files, voice)
  const fetchChatStats = useCallback(async (chatId: string) => {
    try {
      const stats = await api.getChatStats(chatId);
      setChatStats(stats);
    } catch (err) {
      console.warn('Failed to fetch chat stats:', err);
    }
  }, []);

  const currentReqRef = useRef<number>(0);

  // Fetch media for selected chat
  const fetchChatMedia = useCallback(
    async (chatId: string, tab: TelegramTab, isAppend = false, offsetId?: number) => {
      const reqId = ++currentReqRef.current;

      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoadingMedia(true);
        setMediaList([]);
      }
      setErrorMsg(null);

      try {
        const res: any = await api.getChatMedia(chatId, tab, 100, offsetId);
        if (reqId !== currentReqRef.current) return;

        let items: TelegramChatMedia[] = [];

        if (Array.isArray(res)) {
          items = res;
        } else if (res && Array.isArray(res.media)) {
          items = res.media;
        }

        setMediaList((prev) => {
          if (!isAppend) return items;
          const existingIds = new Set(prev.map((m) => m.id));
          const newItems = items.filter((m) => !existingIds.has(m.id));
          return [...prev, ...newItems];
        });

        setHasMore(!!res?.hasMore);
        setNextOffsetId(res?.nextOffsetId ?? null);
      } catch (err: any) {
        if (reqId !== currentReqRef.current) return;
        console.error('Failed to load chat media:', err);
        setErrorMsg(err?.message || 'Failed to load media files from this chat');
        if (!isAppend) setMediaList([]);
      } finally {
        if (reqId === currentReqRef.current) {
          setLoadingMedia(false);
          setLoadingMore(false);
        }
      }
    },
    []
  );

  // When selectedChat changes, fetch stats & initial media
  useEffect(() => {
    if (selectedChat) {
      fetchChatStats(selectedChat.id);
      fetchChatMedia(selectedChat.id, activeTab, false);
    }
    // Stop audio when changing chat or tab
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setPlayingAudioId(null);
    }
  }, [selectedChat, activeTab, fetchChatStats, fetchChatMedia]);

  // Load next batch
  const handleLoadMore = useCallback(() => {
    if (!selectedChat || loadingMedia || loadingMore || !hasMore || !nextOffsetId) return;
    fetchChatMedia(selectedChat.id, activeTab, true, nextOffsetId);
  }, [selectedChat, loadingMedia, loadingMore, hasMore, nextOffsetId, activeTab, fetchChatMedia]);

  // Auto Infinite Scroll Handler
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 350) {
      if (hasMore && !loadingMore && !loadingMedia) {
        handleLoadMore();
      }
    }
  }, [hasMore, loadingMore, loadingMedia, handleLoadMore]);

  // Filtered chats (Defensive)
  const filteredChats = useMemo(() => {
    const list = Array.isArray(chats) ? chats : [];
    if (!chatSearch.trim()) return list;
    const q = chatSearch.toLowerCase();
    return list.filter((c) => c && c.title && c.title.toLowerCase().includes(q));
  }, [chats, chatSearch]);

  // Filtered media (Defensive)
  const filteredMedia = useMemo(() => {
    const list = Array.isArray(mediaList) ? mediaList : [];
    if (!mediaSearch.trim()) return list;
    const q = mediaSearch.toLowerCase();
    return list.filter((m) => m && (m.fileName || m.name || '').toLowerCase().includes(q));
  }, [mediaList, mediaSearch]);

  // Subtitle generator matching official Telegram format: "2177 photos, 142 videos"
  const statsSubtitle = useMemo(() => {
    if (!chatStats) {
      return `${mediaList.length} items loaded`;
    }
    if (activeTab === 'media') {
      const parts: string[] = [];
      if (chatStats.photos > 0)
        parts.push(`${chatStats.photos.toLocaleString()} photo${chatStats.photos > 1 ? 's' : ''}`);
      if (chatStats.videos > 0)
        parts.push(`${chatStats.videos.toLocaleString()} video${chatStats.videos > 1 ? 's' : ''}`);
      return parts.length > 0 ? parts.join(', ') : `${chatStats.media || mediaList.length} media items`;
    }
    if (activeTab === 'files') {
      return `${chatStats.files.toLocaleString()} file${chatStats.files > 1 ? 's' : ''}`;
    }
    if (activeTab === 'voice') {
      return `${chatStats.voice.toLocaleString()} voice message${chatStats.voice > 1 ? 's' : ''}`;
    }
    return `${mediaList.length} items`;
  }, [chatStats, activeTab, mediaList.length]);

  // Keyboard navigation for media preview & fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeMediaIndex !== null) {
          setActiveMediaIndex(null);
        } else if (isFullscreenMedia) {
          setIsFullscreenMedia(false);
        }
        return;
      }
      if (activeMediaIndex === null) return;
      if (e.key === 'ArrowLeft') {
        setActiveMediaIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'ArrowRight') {
        setActiveMediaIndex((prev) =>
          prev !== null && prev < filteredMedia.length - 1 ? prev + 1 : prev
        );
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMediaIndex, filteredMedia.length, isFullscreenMedia]);

  const activeMedia =
    activeMediaIndex !== null && filteredMedia[activeMediaIndex]
      ? filteredMedia[activeMediaIndex]
      : null;

  // Trigger file download
  const handleDownload = (media: TelegramChatMedia) => {
    sfx.playClick();
    const url = api.getChatMediaStreamUrl(media.chatId, media.id);
    const link = document.createElement('a');
    link.href = url;
    link.download = media.fileName || media.name || `telegram_${media.id}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className={`archived-chats-container ${isFullscreenMedia ? 'archived-view-fullscreen' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--bg-main, #f8fafc)',
        ...(isFullscreenMedia
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              width: '100vw',
              height: '100dvh',
            }
          : {}),
      }}
    >
      {/* Hidden Global Audio Element for Background/Inline Playback */}
      <audio ref={audioRef} preload="metadata" />

      {/* Top Header Bar */}
      <div
        className={`archived-header-bar ${selectedChat ? 'in-chat' : ''}`}
        style={{
          padding: '1.1rem 1.75rem',
          background: '#ffffff',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
        }}
      >
        <div className="archived-chat-header-left" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: '1 1 auto' }}>
          {selectedChat ? (
            <button
              onClick={() => {
                sfx.playClick();
                setSelectedChat(null);
                setIsFullscreenMedia(false);
                onChatOpenChange?.(false);
                setActiveMediaIndex(null);
                setMediaList([]);
                setChatStats(null);
                setErrorMsg(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#1e293b',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
              title="Back to archived chats"
            >
              <ArrowLeft size={16} />
              <span className="archived-back-text">Back</span>
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #2481cc 0%, #1765a3 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 2px 8px rgba(36, 129, 204, 0.25)',
                  flexShrink: 0,
                }}
              >
                <Archive size={20} />
              </div>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                Archived
              </h1>
            </div>
          )}

          {selectedChat && (
            <div className="archived-chat-info-block" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, overflow: 'hidden' }}>
              <div
                className="archived-chat-avatar"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: selectedChat.isChannel
                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                    : selectedChat.isGroup
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  flexShrink: 0,
                }}
              >
                {selectedChat.isChannel ? (
                  <Radio size={18} />
                ) : selectedChat.isGroup ? (
                  <Users size={18} />
                ) : (
                  <UserIcon size={18} />
                )}
              </div>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <h2 className="archived-chat-title-text" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedChat.title}
                </h2>
                <div
                  className="archived-chat-subtitle-text"
                  style={{
                    fontSize: '0.76rem',
                    color: '#64748b',
                    fontWeight: 600,
                    marginTop: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {statsSubtitle}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="archived-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {/* Search box */}
          <div
            className="archived-search-box"
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#f1f5f9',
              borderRadius: '10px',
              padding: '0.45rem 0.75rem',
              gap: '0.5rem',
              width: '210px',
            }}
          >
            <Search size={16} color="#64748b" />
            <input
              type="text"
              placeholder={selectedChat ? 'Search files...' : 'Search chats...'}
              value={selectedChat ? mediaSearch : chatSearch}
              onChange={(e) =>
                selectedChat ? setMediaSearch(e.target.value) : setChatSearch(e.target.value)
              }
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '0.85rem',
                color: '#1e293b',
                width: '100%',
              }}
            />
            {(selectedChat ? mediaSearch : chatSearch) && (
              <button
                onClick={() => (selectedChat ? setMediaSearch('') : setChatSearch(''))}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  display: 'flex',
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Grid / List switcher (when inside a chat) */}
          {selectedChat && (
            <div
              className="archived-view-switcher"
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#f1f5f9',
                borderRadius: '8px',
                padding: '2px',
              }}
            >
              <button
                onClick={() => {
                  sfx.playClick();
                  setViewMode('grid');
                }}
                style={{
                  border: 'none',
                  background: viewMode === 'grid' ? '#ffffff' : 'transparent',
                  color: viewMode === 'grid' ? '#0f172a' : '#64748b',
                  boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                }}
                title="Grid View"
              >
                <Grid size={16} />
              </button>
              <button
                onClick={() => {
                  sfx.playClick();
                  setViewMode('list');
                }}
                style={{
                  border: 'none',
                  background: viewMode === 'list' ? '#ffffff' : 'transparent',
                  color: viewMode === 'list' ? '#0f172a' : '#64748b',
                  boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                }}
                title="List View"
              >
                <List size={16} />
              </button>
            </div>
          )}

          {/* Fullscreen / Maximize Media View Toggle (Maximizes vertical screen height for 2x2 grid) */}
          {selectedChat && (
            <button
              onClick={() => {
                sfx.playClick();
                setIsFullscreenMedia((prev) => !prev);
              }}
              className="archived-fullscreen-toggle-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: isFullscreenMedia ? '1.5px solid #2481cc' : '1px solid #e2e8f0',
                background: isFullscreenMedia ? '#eef6fd' : '#ffffff',
                color: isFullscreenMedia ? '#2481cc' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
              title={isFullscreenMedia ? 'Exit Fullscreen Media' : 'Fullscreen Media View (Max Viewport)'}
            >
              {isFullscreenMedia ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}

          {/* Refresh button */}
          <button
            onClick={() => {
              sfx.playClick();
              if (selectedChat) {
                fetchChatStats(selectedChat.id);
                fetchChatMedia(selectedChat.id, activeTab, false);
              } else {
                fetchArchivedChats();
              }
            }}
            disabled={loadingChats || loadingMedia}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#64748b',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
            title="Refresh"
          >
            <RefreshCw
              size={16}
              style={{
                animation: loadingChats || loadingMedia ? 'spin 1s linear infinite' : 'none',
              }}
            />
          </button>
        </div>
      </div>

      {/* Official Telegram Pill Tabs: Media, Files, Voice */}
      {selectedChat && (
        <div
          className="archived-tabs-bar"
          style={{
            padding: '0.75rem 1.75rem',
            background: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="archived-tabs-pill-container"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#f1f5f9',
              borderRadius: '9999px',
              padding: '4px',
              gap: '4px',
            }}
          >
            {[
              { id: 'media' as TelegramTab, label: 'Media', count: chatStats?.media },
              { id: 'files' as TelegramTab, label: 'Files', count: chatStats?.files },
              { id: 'voice' as TelegramTab, label: 'Voice', count: chatStats?.voice },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className="archived-tab-btn"
                  onClick={() => {
                    sfx.playClick();
                    if (audioRef.current) {
                      audioRef.current.pause();
                      setIsPlaying(false);
                      setPlayingAudioId(null);
                    }
                    setActiveTab(tab.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 1.25rem',
                    borderRadius: '9999px',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    border: 'none',
                    background: isActive ? '#ffffff' : 'transparent',
                    color: isActive ? '#2481cc' : '#64748b',
                    boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '1px 6px',
                        borderRadius: '9999px',
                        background: isActive ? '#eef6fd' : '#e2e8f0',
                        color: isActive ? '#2481cc' : '#64748b',
                        fontWeight: 700,
                      }}
                    >
                      {tab.count.toLocaleString()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="archived-scroll-area"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem 1.75rem',
          position: 'relative',
        }}
      >
        {/* Error banner */}
        {errorMsg && (
          <div
            style={{
              padding: '1rem 1.25rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '14px',
              color: '#dc2626',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              fontSize: '0.88rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => {
                if (selectedChat) {
                  fetchChatStats(selectedChat.id);
                  fetchChatMedia(selectedChat.id, activeTab, false);
                } else {
                  fetchArchivedChats();
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* 1. ARCHIVED CHATS LIST / GRID (When no chat is selected) */}
        {!selectedChat && (
          <div>
            {loadingChats ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '1rem',
                }}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div
                    key={n}
                    style={{
                      height: '100px',
                      borderRadius: '16px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      padding: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                    }}
                  >
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '14px',
                        background: '#e2e8f0',
                      }}
                    />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div
                        style={{ height: '14px', width: '70%', background: '#e2e8f0', borderRadius: '4px' }}
                      />
                      <div
                        style={{ height: '10px', width: '40%', background: '#f1f5f9', borderRadius: '4px' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredChats.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '4rem 2rem',
                  background: '#ffffff',
                  borderRadius: '20px',
                  border: '1px dashed #cbd5e1',
                  maxWidth: '560px',
                  margin: '2rem auto',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '20px',
                    background: '#eef6fd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2481cc',
                    margin: '0 auto 1.25rem',
                  }}
                >
                  <Archive size={32} />
                </div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', color: '#0f172a', fontWeight: 700 }}>
                  No Archived Chats Found
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5 }}>
                  In your Telegram app, swipe left on any chat, channel, or group and select <strong>Archive</strong>.
                  All media files inside those archived conversations will automatically appear here!
                </p>
                <button
                  onClick={fetchArchivedChats}
                  style={{
                    marginTop: '1.5rem',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '12px',
                    background: '#2481cc',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(36, 129, 204, 0.25)',
                  }}
                >
                  Refresh Archive
                </button>
              </div>
            ) : (
              <div
                className="archived-chats-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                  gap: '1.25rem',
                }}
              >
                {filteredChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="archived-chat-card"
                    onClick={() => {
                      sfx.playClick();
                      setSelectedChat(chat);
                      onChatOpenChange?.(true);
                      setActiveTab('media');
                      setMediaSearch('');
                    }}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.06)';
                      e.currentTarget.style.borderColor = '#cbd5e1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.02)';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }}
                  >
                    {/* Chat avatar/icon */}
                    <div
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '16px',
                        background: chat.isChannel
                          ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                          : chat.isGroup
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                          : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        flexShrink: 0,
                        boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                      }}
                    >
                      {chat.isChannel ? (
                        <Radio size={24} />
                      ) : chat.isGroup ? (
                        <Users size={24} />
                      ) : (
                        <UserIcon size={24} />
                      )}
                    </div>

                    {/* Chat details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '0.96rem',
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {chat.title}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginTop: '0.35rem',
                          fontSize: '0.75rem',
                          color: '#64748b',
                        }}
                      >
                        <span
                          style={{
                            padding: '1px 6px',
                            borderRadius: '6px',
                            background: '#f1f5f9',
                            fontWeight: 600,
                          }}
                        >
                          {chat.isChannel ? 'Channel' : chat.isGroup ? 'Group' : 'User'}
                        </span>
                        {chat.date > 0 && <span>{formatDate(chat.date)}</span>}
                      </div>
                    </div>

                    <ChevronRight size={18} color="#94a3b8" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. CHAT MEDIA EXPLORER (When a chat is selected) */}
        {selectedChat && (
          <div>
            {/* Initial Loading Skeleton */}
            {loadingMedia ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '1rem',
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <div
                    key={n}
                    style={{
                      height: '180px',
                      borderRadius: '14px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ flex: 1, background: '#f1f5f9' }} />
                    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ height: '10px', width: '80%', background: '#e2e8f0', borderRadius: '4px' }} />
                      <div style={{ height: '8px', width: '40%', background: '#f1f5f9', borderRadius: '4px' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredMedia.length === 0 ? (
              /* Empty Media State */
              <div
                style={{
                  textAlign: 'center',
                  padding: '4rem 2rem',
                  background: '#ffffff',
                  borderRadius: '20px',
                  border: '1px dashed #cbd5e1',
                  maxWidth: '500px',
                  margin: '2rem auto',
                }}
              >
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '18px',
                    background: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    margin: '0 auto 1.25rem',
                  }}
                >
                  <Sparkles size={28} />
                </div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', color: '#0f172a', fontWeight: 700 }}>
                  No {activeTab} Found
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  No files found in the {activeTab} section for {selectedChat.title}.
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              /* GRID VIEW */
              <div
                className="archived-media-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                  gap: '1.25rem',
                }}
              >
                {filteredMedia.map((media, idx) => {
                  const isImage = media.type === 'image';
                  const isVideo = media.type === 'video';
                  const isAudio = media.type === 'audio';
                  const isCurrentPlaying = playingAudioId === media.id && isPlaying;
                  const fileName = media.fileName || media.name || `media_${media.id}`;
                  const streamUrl = api.getChatMediaStreamUrl(media.chatId, media.id);

                  return (
                    <div
                      key={media.id}
                      onClick={() => {
                        sfx.playClick();
                        setActiveMediaIndex(idx);
                      }}
                      style={{
                        background: '#ffffff',
                        border: isCurrentPlaying ? '1.5px solid #6366f1' : '1px solid #e2e8f0',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        boxShadow: isCurrentPlaying
                          ? '0 10px 25px rgba(99, 102, 241, 0.15)'
                          : '0 2px 6px rgba(0,0,0,0.02)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.06)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = isCurrentPlaying
                          ? '0 10px 25px rgba(99, 102, 241, 0.15)'
                          : '0 2px 6px rgba(0,0,0,0.02)';
                      }}
                    >
                      {/* Media Preview Box */}
                      <div
                        className="archived-media-preview-box"
                        style={{
                          height: '140px',
                          background: '#0f172a',
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {isImage ? (
                          <img
                            src={streamUrl}
                            alt={fileName}
                            loading="lazy"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        ) : isVideo ? (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                            }}
                          >
                            <div
                              style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.2)',
                                backdropFilter: 'blur(8px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                              }}
                            >
                              <Play size={20} fill="#ffffff" />
                            </div>
                            <span
                              style={{
                                position: 'absolute',
                                bottom: '8px',
                                right: '8px',
                                background: 'rgba(0,0,0,0.65)',
                                color: '#ffffff',
                                fontSize: '0.68rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 700,
                              }}
                            >
                              VIDEO
                            </span>
                          </div>
                        ) : isAudio ? (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: isCurrentPlaying
                                ? 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)'
                                : 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                              color: '#ffffff',
                              gap: '0.65rem',
                              padding: '1rem',
                            }}
                          >
                            {/* Interactive Play/Pause Button */}
                            <button
                              onClick={(e) => handleTogglePlayAudio(media, e)}
                              style={{
                                width: '46px',
                                height: '46px',
                                borderRadius: '50%',
                                background: '#ffffff',
                                border: 'none',
                                color: '#4f46e5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                transition: 'transform 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
                              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                            >
                              {isCurrentPlaying ? (
                                <Pause size={20} fill="#4f46e5" />
                              ) : (
                                <Play size={20} fill="#4f46e5" style={{ marginLeft: '2px' }} />
                              )}
                            </button>

                            {/* Soundwave animation when playing */}
                            {isCurrentPlaying ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '14px' }}>
                                {[1, 2, 3, 4, 5].map((b) => (
                                  <div
                                    key={b}
                                    style={{
                                      width: '3px',
                                      background: '#ffffff',
                                      borderRadius: '2px',
                                      height: '100%',
                                      animation: `pulse 0.6s ease-in-out infinite alternate ${b * 0.1}s`,
                                    }}
                                  />
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.02em' }}>
                                VOICE NOTE
                              </span>
                            )}
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                              color: '#ffffff',
                              gap: '0.5rem',
                            }}
                          >
                            <FileText size={32} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                              {fileName.split('.').pop()?.toUpperCase() || 'FILE'}
                            </span>
                          </div>
                        )}

                        {/* Download button on hover overlay */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(media);
                          }}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            width: '30px',
                            height: '30px',
                            borderRadius: '8px',
                            background: 'rgba(15, 23, 42, 0.75)',
                            backdropFilter: 'blur(4px)',
                            border: 'none',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          title="Download file"
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#2481cc')}
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)')
                          }
                        >
                          <Download size={14} />
                        </button>
                      </div>

                      {/* File Details Footer */}
                      <div style={{ padding: '0.85rem' }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '0.84rem',
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={fileName}
                        >
                          {fileName}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: '0.35rem',
                            fontSize: '0.72rem',
                            color: '#64748b',
                          }}
                        >
                          <span>
                            {media.size > 0
                              ? formatBytes(media.size)
                              : media.duration
                              ? formatDuration(media.duration)
                              : ''}
                          </span>
                          <span>{formatDate(media.date)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* LIST VIEW */
              <div
                className="archived-list-container"
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <div className="archived-list-table-inner" style={{ minWidth: '100%' }}>
                  <div
                    className="archived-list-header-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr 120px 120px 80px',
                      padding: '0.75rem 1.25rem',
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    <span>Type</span>
                    <span>Name</span>
                    <span>Size</span>
                    <span>Date</span>
                    <span style={{ textAlign: 'right' }}>Action</span>
                  </div>

                  {filteredMedia.map((media, idx) => {
                    const isImage = media.type === 'image';
                    const isVideo = media.type === 'video';
                    const isAudio = media.type === 'audio';
                    const isCurrentPlaying = playingAudioId === media.id && isPlaying;
                    const fileName = media.fileName || media.name || `media_${media.id}`;

                    return (
                      <div
                        key={media.id}
                        className="archived-list-data-row"
                        onClick={() => {
                          sfx.playClick();
                          setActiveMediaIndex(idx);
                        }}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '40px 1fr 120px 120px 80px',
                          padding: '0.75rem 1.25rem',
                          alignItems: 'center',
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                          background: isCurrentPlaying ? '#f5f3ff' : '#ffffff',
                        }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = isCurrentPlaying ? '#ede9fe' : '#f8fafc')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = isCurrentPlaying ? '#f5f3ff' : '#ffffff')
                      }
                    >
                      <div>
                        {isImage ? (
                          <ImageIcon size={18} color="#0284c7" />
                        ) : isVideo ? (
                          <Film size={18} color="#8b5cf6" />
                        ) : isAudio ? (
                          <button
                            onClick={(e) => handleTogglePlayAudio(media, e)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#6366f1',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0,
                            }}
                          >
                            {isCurrentPlaying ? (
                              <Pause size={18} fill="#6366f1" />
                            ) : (
                              <Play size={18} fill="#6366f1" />
                            )}
                          </button>
                        ) : (
                          <FileText size={18} color="#f59e0b" />
                        )}
                      </div>

                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '0.86rem',
                          color: isCurrentPlaying ? '#4f46e5' : '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          paddingRight: '1rem',
                        }}
                      >
                        {fileName}
                      </div>

                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {media.size > 0
                          ? formatBytes(media.size)
                          : media.duration
                          ? formatDuration(media.duration)
                          : '—'}
                      </div>

                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {formatDate(media.date)}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                        {isAudio && (
                          <button
                            onClick={(e) => handleTogglePlayAudio(media, e)}
                            style={{
                              padding: '6px',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              color: '#6366f1',
                              cursor: 'pointer',
                              display: 'flex',
                            }}
                            title="Play Voice"
                          >
                            {isCurrentPlaying ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(media);
                          }}
                          style={{
                            padding: '6px',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            background: '#ffffff',
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                          }}
                          title="Download"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            )}

            {/* Pagination / Infinite Scroll Loading Indicator */}
            {hasMore && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '2rem 0 1rem',
                }}
              >
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1.5rem',
                    borderRadius: '12px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    color: '#0f172a',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Loading more from Telegram...</span>
                    </>
                  ) : (
                    <span>Load More ({mediaList.length} loaded)</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. FULL-SCREEN RICH MEDIA PREVIEW MODAL */}
      {activeMedia && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={() => setActiveMediaIndex(null)}
        >
          {/* Modal Top Bar */}
          <div
            style={{
              padding: '1rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#ffffff',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '500px',
                }}
              >
                {activeMedia.fileName || activeMedia.name}
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'rgba(255,255,255,0.6)',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: 'rgba(255,255,255,0.1)',
                }}
              >
                {formatBytes(activeMedia.size)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => handleDownload(activeMedia)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 0.9rem',
                  borderRadius: '10px',
                  background: '#2481cc',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                <Download size={15} />
                <span>Download</span>
              </button>

              <button
                onClick={() => setActiveMediaIndex(null)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Modal Media Body */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Previous button */}
            {activeMediaIndex !== null && activeMediaIndex > 0 && (
              <button
                onClick={() => {
                  sfx.playClick();
                  setActiveMediaIndex(activeMediaIndex - 1);
                }}
                style={{
                  position: 'absolute',
                  left: '1.5rem',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  transition: 'background 0.2s',
                  zIndex: 10,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              >
                <ChevronLeft size={28} />
              </button>
            )}

            {/* Next button */}
            {activeMediaIndex !== null && activeMediaIndex < filteredMedia.length - 1 && (
              <button
                onClick={() => {
                  sfx.playClick();
                  setActiveMediaIndex(activeMediaIndex + 1);
                }}
                style={{
                  position: 'absolute',
                  right: '1.5rem',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  transition: 'background 0.2s',
                  zIndex: 10,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              >
                <ChevronRight size={28} />
              </button>
            )}

            {/* Media Content */}
            {activeMedia.type === 'image' ? (
              <img
                src={api.getChatMediaStreamUrl(activeMedia.chatId, activeMedia.id)}
                alt={activeMedia.fileName || activeMedia.name}
                style={{
                  maxWidth: '90%',
                  maxHeight: '85vh',
                  objectFit: 'contain',
                  borderRadius: '12px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                }}
              />
            ) : activeMedia.type === 'video' ? (
              <video
                src={api.getChatMediaStreamUrl(activeMedia.chatId, activeMedia.id)}
                controls
                autoPlay
                playsInline
                style={{
                  maxWidth: '90%',
                  maxHeight: '85vh',
                  borderRadius: '12px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                  outline: 'none',
                }}
              />
            ) : activeMedia.type === 'audio' ? (
              <div
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  padding: '2.5rem',
                  borderRadius: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1.5rem',
                  width: '440px',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                {/* Voice Avatar & Animated Waves */}
                <div
                  style={{
                    position: 'relative',
                    width: '84px',
                    height: '84px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
                  }}
                >
                  {playingAudioId === activeMedia.id && isPlaying ? (
                    <Volume2 size={40} />
                  ) : (
                    <Mic size={40} />
                  )}
                </div>

                <div style={{ textAlign: 'center', color: '#ffffff', width: '100%' }}>
                  <h4 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem' }}>
                    {activeMedia.fileName || activeMedia.name}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                    {formatBytes(activeMedia.size)} • {formatDate(activeMedia.date)}
                  </span>
                </div>

                {/* Big Interactive Audio Play / Pause Button with Scrubber */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                      onClick={() => handleTogglePlayAudio(activeMedia)}
                      style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        border: 'none',
                        color: '#4f46e5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
                        flexShrink: 0,
                      }}
                    >
                      {playingAudioId === activeMedia.id && isPlaying ? (
                        <Pause size={24} fill="#4f46e5" />
                      ) : (
                        <Play size={24} fill="#4f46e5" style={{ marginLeft: '2px' }} />
                      )}
                    </button>

                    {/* Progress slider */}
                    <div style={{ flex: 1 }}>
                      <div
                        onClick={(e) => {
                          if (playingAudioId === activeMedia.id && audioRef.current && audioDuration > 0) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const newPct = clickX / rect.width;
                            audioRef.current.currentTime = newPct * audioDuration;
                          }
                        }}
                        style={{
                          height: '8px',
                          background: 'rgba(255,255,255,0.2)',
                          borderRadius: '9999px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${playingAudioId === activeMedia.id ? audioProgress : 0}%`,
                            background: '#6366f1',
                            borderRadius: '9999px',
                            transition: 'width 0.1s linear',
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginTop: '0.4rem',
                          fontSize: '0.74rem',
                          color: 'rgba(255,255,255,0.6)',
                        }}
                      >
                        <span>
                          {playingAudioId === activeMedia.id ? formatDuration(audioCurrentTime) : '0:00'}
                        </span>
                        <span>
                          {playingAudioId === activeMedia.id && audioDuration > 0
                            ? formatDuration(audioDuration)
                            : '--:--'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  padding: '3rem',
                  borderRadius: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1.5rem',
                  width: '380px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '20px',
                    background: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                  }}
                >
                  <FileText size={36} />
                </div>
                <div style={{ color: '#ffffff' }}>
                  <h4 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem' }}>
                    {activeMedia.fileName || activeMedia.name}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                    {formatBytes(activeMedia.size)}
                  </span>
                </div>
                <button
                  onClick={() => handleDownload(activeMedia)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '12px',
                    background: '#2481cc',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Download size={18} />
                  <span>Download Document</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
