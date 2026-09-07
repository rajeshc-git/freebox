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
} from 'lucide-react';
import { TelegramArchivedChat, TelegramChatMedia } from '../types';
import { api } from '../services/api';
import { sfx } from '../services/sound';

interface ArchivedChatsViewProps {
  onBackToDrive?: () => void;
}

type TelegramMediaTab = 'media' | 'files' | 'voice';

export const ArchivedChatsView: React.FC<ArchivedChatsViewProps> = () => {
  // State
  const [chats, setChats] = useState<TelegramArchivedChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<TelegramArchivedChat | null>(null);
  const [chatSearch, setChatSearch] = useState('');
  const [mediaSearch, setMediaSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TelegramMediaTab>('media');

  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffsetId, setNextOffsetId] = useState<number | null>(null);

  const [chatStats, setChatStats] = useState<{
    photos: number;
    videos: number;
    media: number;
    files: number;
    voice: number;
  } | null>(null);

  const [mediaList, setMediaList] = useState<TelegramChatMedia[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Audio player state for voice tab
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
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

  const formatDateTime = (timestamp: number) => {
    if (!timestamp) return '';
    const d = new Date(timestamp * 1000);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} at ${timeStr}`;
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

  // Fetch chat stats (photos, videos, files, voice counts)
  const fetchStats = useCallback(async (chatId: string) => {
    try {
      const stats = await api.getChatStats(chatId);
      setChatStats(stats);
    } catch (err) {
      console.error('Failed to load chat stats:', err);
    }
  }, []);

  // Fetch media for selected chat
  const fetchChatMedia = useCallback(
    async (chatId: string, tab: TelegramMediaTab, isAppend = false, offsetId?: number) => {
      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoadingMedia(true);
        setMediaList([]);
      }
      setErrorMsg(null);

      try {
        const res: any = await api.getChatMedia(chatId, tab, 100, offsetId);
        let items: TelegramChatMedia[] = [];

        if (Array.isArray(res)) {
          items = res;
        } else if (res && Array.isArray(res.media)) {
          items = res.media;
        }

        setMediaList((prev) => {
          if (!isAppend) return items;
          // Deduplicate by message ID
          const existingIds = new Set(prev.map((m) => m.id));
          const newItems = items.filter((m) => !existingIds.has(m.id));
          return [...prev, ...newItems];
        });

        setHasMore(!!res?.hasMore);
        setNextOffsetId(res?.nextOffsetId ?? null);
      } catch (err: any) {
        console.error('Failed to load chat media:', err);
        setErrorMsg(err?.message || 'Failed to load media files from this chat');
        if (!isAppend) setMediaList([]);
      } finally {
        setLoadingMedia(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // When selectedChat changes, fetch stats and first media batch
  useEffect(() => {
    if (selectedChat) {
      fetchStats(selectedChat.id);
      fetchChatMedia(selectedChat.id, activeTab, false);
    } else {
      setChatStats(null);
    }
  }, [selectedChat, activeTab, fetchStats, fetchChatMedia]);

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
    if (scrollHeight - scrollTop - clientHeight < 400) {
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

  // Filtered media by search query
  const filteredMedia = useMemo(() => {
    const list = Array.isArray(mediaList) ? mediaList : [];
    if (!mediaSearch.trim()) return list;
    const q = mediaSearch.toLowerCase();
    return list.filter((m) => m && (m.fileName || m.name || '').toLowerCase().includes(q));
  }, [mediaList, mediaSearch]);

  // Header Subtitle Summary string matching Telegram UI
  const headerSubtitle = useMemo(() => {
    if (!selectedChat) return '';
    if (!chatStats) return `${mediaList.length} items loaded`;

    if (activeTab === 'media') {
      if (chatStats.photos > 0 && chatStats.videos > 0) {
        return `${chatStats.photos.toLocaleString()} photos, ${chatStats.videos.toLocaleString()} videos`;
      }
      if (chatStats.photos > 0) return `${chatStats.photos.toLocaleString()} photos`;
      if (chatStats.videos > 0) return `${chatStats.videos.toLocaleString()} videos`;
      return `${chatStats.media.toLocaleString()} media items`;
    }

    if (activeTab === 'files') {
      return `${chatStats.files.toLocaleString()} files`;
    }

    if (activeTab === 'voice') {
      return `${chatStats.voice.toLocaleString()} voice messages`;
    }

    return `${mediaList.length} items`;
  }, [selectedChat, chatStats, activeTab, mediaList.length]);

  // Handle voice note inline play/pause
  const handleToggleVoice = (media: TelegramChatMedia) => {
    sfx.playClick();
    if (playingAudioId === media.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingAudioId(null);
    } else {
      const url = api.getChatMediaStreamUrl(media.chatId, media.id);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(console.error);
      }
      setPlayingAudioId(media.id);
    }
  };

  // Keyboard navigation for media preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeMediaIndex === null) return;
      if (e.key === 'Escape') {
        setActiveMediaIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setActiveMediaIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'ArrowRight') {
        setActiveMediaIndex((prev) =>
          prev !== null && prev < filteredMedia.length - 1 ? prev + 1 : prev
        );
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMediaIndex, filteredMedia.length]);

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
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--bg-main, #f8fafc)',
      }}
    >
      {/* Hidden audio element for inline voice playback */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingAudioId(null)}
        onError={() => setPlayingAudioId(null)}
        style={{ display: 'none' }}
      />

      {/* Top Header Bar */}
      <div
        style={{
          padding: '1.15rem 1.75rem',
          background: '#ffffff',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {selectedChat ? (
            <button
              onClick={() => {
                sfx.playClick();
                setSelectedChat(null);
                setActiveMediaIndex(null);
                setMediaList([]);
                setChatStats(null);
                setErrorMsg(null);
                setPlayingAudioId(null);
                if (audioRef.current) audioRef.current.pause();
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
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
            >
              <ArrowLeft size={16} />
              <span>Back to Archived Chats</span>
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #2481cc 0%, #1765a3 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(36, 129, 204, 0.25)',
                }}
              >
                <Archive size={22} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#0f172a' }}>
                  Archived Chats & Channels
                </h1>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                  Browse & stream all media, files & voice from your Telegram archive
                </p>
              </div>
            </div>
          )}

          {selectedChat && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '11px',
                  background: selectedChat.isChannel
                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                    : selectedChat.isGroup
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                }}
              >
                {selectedChat.isChannel ? (
                  <Radio size={19} />
                ) : selectedChat.isGroup ? (
                  <Users size={19} />
                ) : (
                  <UserIcon size={19} />
                )}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: '#0f172a' }}>
                  {selectedChat.title}
                </h2>
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: '#64748b',
                    fontWeight: 500,
                    marginTop: 1,
                  }}
                >
                  {headerSubtitle}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Search box */}
          <div
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
              placeholder={selectedChat ? 'Search...' : 'Search chats...'}
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

          {/* Refresh button */}
          <button
            onClick={() => {
              sfx.playClick();
              if (selectedChat) {
                fetchStats(selectedChat.id);
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

      {/* Official Telegram 3 Categories Subbar: Media | Files | Voice */}
      {selectedChat && (
        <div
          style={{
            padding: '0.65rem 1.75rem',
            background: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            overflowX: 'auto',
          }}
        >
          {[
            {
              id: 'media' as TelegramMediaTab,
              label: 'Media',
            },
            {
              id: 'files' as TelegramMediaTab,
              label: 'Files',
            },
            {
              id: 'voice' as TelegramMediaTab,
              label: 'Voice',
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  sfx.playClick();
                  setActiveTab(tab.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.45rem 1.35rem',
                  borderRadius: '9999px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  border: 'none',
                  background: isActive ? '#e8f2fd' : 'transparent',
                  color: isActive ? '#2481cc' : '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: activeTab === 'media' && selectedChat ? '0.75rem 1.75rem' : '1.5rem 1.75rem',
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
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                  gap: '1.25rem',
                }}
              >
                {filteredChats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => {
                      sfx.playClick();
                      setSelectedChat(chat);
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
                  gridTemplateColumns: activeTab === 'media' ? 'repeat(auto-fill, minmax(130px, 1fr))' : '1fr',
                  gap: activeTab === 'media' ? '4px' : '0.75rem',
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <div
                    key={n}
                    style={{
                      height: activeTab === 'media' ? '130px' : '64px',
                      borderRadius: activeTab === 'media' ? '4px' : '12px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      animation: 'pulse 1.5s infinite',
                    }}
                  />
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
                  No {activeTab} found
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  No {activeTab} files found in {selectedChat.title}.
                </p>
              </div>
            ) : activeTab === 'media' ? (
              /* ================= TAB 1: MEDIA (Photos & Videos Seamless Grid) ================= */
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '4px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                {filteredMedia.map((media, idx) => {
                  const isVideo = media.type === 'video';
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
                        aspectRatio: '1 / 1',
                        background: '#0f172a',
                        position: 'relative',
                        cursor: 'pointer',
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={streamUrl}
                        alt={fileName}
                        loading="lazy"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.2s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      />

                      {/* Video indicator */}
                      {isVideo && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '6px',
                            left: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: 'rgba(0,0,0,0.65)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            color: '#ffffff',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                          }}
                        >
                          <Play size={10} fill="#ffffff" />
                          <span>Video</span>
                        </div>
                      )}

                      {/* Hover Download button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(media);
                        }}
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          background: 'rgba(15, 23, 42, 0.75)',
                          border: 'none',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          opacity: 0.85,
                          transition: 'all 0.15s ease',
                        }}
                        title="Download"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.background = '#2481cc';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0.85';
                          e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)';
                        }}
                      >
                        <Download size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : activeTab === 'files' ? (
              /* ================= TAB 2: FILES (Telegram Files List with Thumbnail) ================= */
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                }}
              >
                {filteredMedia.map((media, idx) => {
                  const fileName = media.fileName || media.name || `file_${media.id}`;
                  const ext = fileName.split('.').pop()?.toLowerCase() || '';
                  const isImg = ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) || media.mimeType.startsWith('image/');
                  const streamUrl = api.getChatMediaStreamUrl(media.chatId, media.id);

                  return (
                    <div
                      key={media.id}
                      onClick={() => {
                        sfx.playClick();
                        setActiveMediaIndex(idx);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.85rem 1.25rem',
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', minWidth: 0, flex: 1 }}>
                        {/* Square Thumbnail or Document Icon */}
                        <div
                          style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            background: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isImg ? (
                            <img
                              src={streamUrl}
                              alt={fileName}
                              loading="lazy"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                background: '#e0f2fe',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#0284c7',
                              }}
                            >
                              <FileText size={22} />
                            </div>
                          )}
                        </div>

                        {/* File Details */}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: '0.9rem',
                              color: '#0f172a',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {fileName}
                          </div>
                          <div
                            style={{
                              fontSize: '0.76rem',
                              color: '#64748b',
                              marginTop: 2,
                            }}
                          >
                            {formatBytes(media.size)} · {formatDateTime(media.date)}
                          </div>
                        </div>
                      </div>

                      {/* Download button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(media);
                        }}
                        style={{
                          padding: '0.45rem',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          color: '#64748b',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        title="Download"
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ================= TAB 3: VOICE (Telegram Voice Notes List) ================= */
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                }}
              >
                {filteredMedia.map((media) => {
                  const isPlaying = playingAudioId === media.id;

                  return (
                    <div
                      key={media.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.85rem 1.25rem',
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flex: 1, minWidth: 0 }}>
                        {/* Circular Blue Play Button */}
                        <button
                          onClick={() => handleToggleVoice(media)}
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '50%',
                            background: '#2481cc',
                            border: 'none',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                            boxShadow: '0 2px 8px rgba(36, 129, 204, 0.3)',
                            transition: 'transform 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                        >
                          {isPlaying ? <Pause size={18} fill="#ffffff" /> : <Play size={18} fill="#ffffff" style={{ marginLeft: 2 }} />}
                        </button>

                        {/* Title and duration */}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: '0.9rem',
                              color: '#0f172a',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            Voice message
                          </div>
                          <div
                            style={{
                              fontSize: '0.76rem',
                              color: isPlaying ? '#2481cc' : '#64748b',
                              fontWeight: isPlaying ? 600 : 500,
                              marginTop: 2,
                            }}
                          >
                            {isPlaying ? 'Playing...' : formatBytes(media.size)}
                          </div>
                        </div>
                      </div>

                      {/* Date & Download */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                          {formatDate(media.date)}
                        </span>
                        <button
                          onClick={() => handleDownload(media)}
                          style={{
                            padding: '0.45rem',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            background: '#ffffff',
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                          }}
                          title="Download audio"
                        >
                          <Download size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination / Infinite Scroll Loading Indicator or Load More Button */}
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
                      <span>Loading more {activeTab}...</span>
                    </>
                  ) : (
                    <span>Load More {activeTab.toUpperCase()} ({mediaList.length} loaded)</span>
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
                  width: '420px',
                }}
              >
                <div
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    background: '#2481cc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                  }}
                >
                  <Music size={36} />
                </div>
                <div style={{ textAlign: 'center', color: '#ffffff' }}>
                  <h4 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem' }}>
                    {activeMedia.fileName || activeMedia.name}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                    {formatBytes(activeMedia.size)}
                  </span>
                </div>
                <audio
                  src={api.getChatMediaStreamUrl(activeMedia.chatId, activeMedia.id)}
                  controls
                  autoPlay
                  style={{ width: '100%' }}
                />
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
