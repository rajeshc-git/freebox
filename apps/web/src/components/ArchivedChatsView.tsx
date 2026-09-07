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
  Users,
  Radio,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { TelegramArchivedChat, TelegramChatMedia } from '../types';
import { api } from '../services/api';
import { sfx } from '../services/sound';

interface ArchivedChatsViewProps {
  onBackToDrive?: () => void;
}

type MediaCategory = 'all' | 'image' | 'video' | 'document' | 'audio';

export const ArchivedChatsView: React.FC<ArchivedChatsViewProps> = () => {
  // State
  const [chats, setChats] = useState<TelegramArchivedChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<TelegramArchivedChat | null>(null);
  const [chatSearch, setChatSearch] = useState('');
  const [mediaSearch, setMediaSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MediaCategory>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffsetId, setNextOffsetId] = useState<number | null>(null);

  const [mediaList, setMediaList] = useState<TelegramChatMedia[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Fetch media for selected chat (initial load or tab change)
  const fetchChatMedia = useCallback(
    async (chatId: string, category: MediaCategory, isAppend = false, offsetId?: number) => {
      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoadingMedia(true);
        setMediaList([]);
      }
      setErrorMsg(null);

      try {
        const res: any = await api.getChatMedia(chatId, category, 100, offsetId);
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

  // When selectedChat or categoryFilter changes, fetch first batch
  useEffect(() => {
    if (selectedChat) {
      fetchChatMedia(selectedChat.id, categoryFilter, false);
    }
  }, [selectedChat, categoryFilter, fetchChatMedia]);

  // Load next batch
  const handleLoadMore = useCallback(() => {
    if (!selectedChat || loadingMedia || loadingMore || !hasMore || !nextOffsetId) return;
    fetchChatMedia(selectedChat.id, categoryFilter, true, nextOffsetId);
  }, [selectedChat, loadingMedia, loadingMore, hasMore, nextOffsetId, categoryFilter, fetchChatMedia]);

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
    let result = list;
    if (categoryFilter !== 'all') {
      result = result.filter((m) => m && m.type === categoryFilter);
    }
    if (mediaSearch.trim()) {
      const q = mediaSearch.toLowerCase();
      result = result.filter(
        (m) => m && (m.fileName || m.name || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [mediaList, categoryFilter, mediaSearch]);

  // Category counts in current chat (Defensive)
  const categoryCounts = useMemo(() => {
    const counts = { all: 0, image: 0, video: 0, document: 0, audio: 0 };
    const list = Array.isArray(mediaList) ? mediaList : [];
    counts.all = list.length;
    list.forEach((m) => {
      if (m && counts[m.type] !== undefined) {
        counts[m.type]++;
      }
    });
    return counts;
  }, [mediaList]);

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
                  Browse & stream all photos, videos & docs from Telegram archive
                </p>
              </div>
            </div>
          )}

          {selectedChat && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
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
                  <Radio size={18} />
                ) : selectedChat.isGroup ? (
                  <Users size={18} />
                ) : (
                  <UserIcon size={18} />
                )}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  {selectedChat.title}
                </h2>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#64748b',
                    fontWeight: 500,
                  }}
                >
                  {selectedChat.isChannel
                    ? 'Channel'
                    : selectedChat.isGroup
                    ? 'Group'
                    : 'Direct Chat'}{' '}
                  • {loadingMedia ? 'Loading media...' : `${mediaList.length} media loaded${hasMore ? '+' : ''}`}
                </span>
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

          {/* Refresh button */}
          <button
            onClick={() => {
              sfx.playClick();
              if (selectedChat) {
                fetchChatMedia(selectedChat.id, categoryFilter, false);
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

      {/* Category Filter Tabs (When Inside a Chat) */}
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
            { id: 'all' as MediaCategory, label: 'All Media', icon: Layers, count: categoryCounts.all },
            { id: 'image' as MediaCategory, label: 'Photos', icon: ImageIcon, count: categoryCounts.image },
            { id: 'video' as MediaCategory, label: 'Videos', icon: Film, count: categoryCounts.video },
            { id: 'document' as MediaCategory, label: 'Documents', icon: FileText, count: categoryCounts.document },
            { id: 'audio' as MediaCategory, label: 'Audio', icon: Music, count: categoryCounts.audio },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  sfx.playClick();
                  setCategoryFilter(tab.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '9999px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: isActive ? '1px solid rgba(36, 129, 204, 0.3)' : '1px solid transparent',
                  background: isActive ? '#eef6fd' : '#f8fafc',
                  color: isActive ? '#2481cc' : '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '1px 6px',
                      borderRadius: '9999px',
                      background: isActive ? '#2481cc' : '#e2e8f0',
                      color: isActive ? '#ffffff' : '#64748b',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
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
                  fetchChatMedia(selectedChat.id, categoryFilter, false);
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
                      setCategoryFilter('all');
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
                  No {categoryFilter !== 'all' ? categoryFilter : ''} Media Found
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  No media files found in this category for {selectedChat.title}.
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              /* GRID VIEW */
              <div
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
                        border: '1px solid #e2e8f0',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
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
                      {/* Media Preview Box */}
                      <div
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
                              background: '#1e293b',
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
                                background: 'rgba(0,0,0,0.6)',
                                color: '#ffffff',
                                fontSize: '0.68rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 600,
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
                              background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                              color: '#ffffff',
                              gap: '0.5rem',
                            }}
                          >
                            <Music size={32} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>AUDIO</span>
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
                            <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>
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
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)')}
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
                          <span>{formatBytes(media.size)}</span>
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
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                }}
              >
                <div
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
                  const fileName = media.fileName || media.name || `media_${media.id}`;

                  return (
                    <div
                      key={media.id}
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
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                    >
                      <div>
                        {isImage ? (
                          <ImageIcon size={18} color="#0284c7" />
                        ) : isVideo ? (
                          <Film size={18} color="#8b5cf6" />
                        ) : isAudio ? (
                          <Music size={18} color="#10b981" />
                        ) : (
                          <FileText size={18} color="#f59e0b" />
                        )}
                      </div>

                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '0.86rem',
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          paddingRight: '1rem',
                        }}
                      >
                        {fileName}
                      </div>

                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {formatBytes(media.size)}
                      </div>

                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {formatDate(media.date)}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                      <span>Loading more media from Telegram...</span>
                    </>
                  ) : (
                    <span>Load More Media ({mediaList.length} loaded)</span>
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
                    background: '#6366f1',
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
