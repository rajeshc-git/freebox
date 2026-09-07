import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  ChevronDown,
  Check,
  X,
  HardDrive,
  Zap,
  Lock,
  Sparkles,
  Search,
  Heart,
  Share2,
  ExternalLink,
} from 'lucide-react';
import { Country } from '../types';
import { sfx } from '../services/sound';

interface LandingPageProps {
  onStartLogin: (phone: string, country: Country) => void;
  isSendingOtp?: boolean;
}

export const fullCountryList: Country[] = [
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+1', name: 'United States', flag: '🇺🇸' },
  { code: '+1', name: 'Canada', flag: '🇨🇦' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+380', name: 'Ukraine', flag: '🇺🇦' },
  { code: '+52', name: 'Mexico', flag: '🇲🇽' },
  { code: '+54', name: 'Argentina', flag: '🇦🇷' },
  { code: '+57', name: 'Colombia', flag: '🇨🇴' },
  { code: '+972', name: 'Israel', flag: '🇮🇱' },
  { code: '+64', name: 'New Zealand', flag: '🇳🇿' },
  { code: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: '+33', name: 'France', flag: '🇫🇷' },
  { code: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: '+82', name: 'South Korea', flag: '🇰🇷' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: '+971', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+55', name: 'Brazil', flag: '🇧🇷' },
  { code: '+34', name: 'Spain', flag: '🇪🇸' },
  { code: '+39', name: 'Italy', flag: '🇮🇹' },
  { code: '+31', name: 'Netherlands', flag: '🇳🇱' },
  { code: '+41', name: 'Switzerland', flag: '🇨🇭' },
  { code: '+46', name: 'Sweden', flag: '🇸🇪' },
  { code: '+47', name: 'Norway', flag: '🇳🇴' },
  { code: '+45', name: 'Denmark', flag: '🇩🇰' },
  { code: '+358', name: 'Finland', flag: '🇫🇮' },
  { code: '+48', name: 'Poland', flag: '🇵🇱' },
  { code: '+90', name: 'Turkey', flag: '🇹🇷' },
  { code: '+20', name: 'Egypt', flag: '🇪🇬' },
  { code: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: '+234', name: 'Nigeria', flag: '🇳🇬' },
  { code: '+254', name: 'Kenya', flag: '🇰🇪' },
  { code: '+62', name: 'Indonesia', flag: '🇮🇩' },
  { code: '+60', name: 'Malaysia', flag: '🇲🇾' },
  { code: '+63', name: 'Philippines', flag: '🇵🇭' },
  { code: '+66', name: 'Thailand', flag: '🇹🇭' },
  { code: '+84', name: 'Vietnam', flag: '🇻🇳' },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰' },
  { code: '+880', name: 'Bangladesh', flag: '🇧🇩' },
  { code: '+94', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: '+977', name: 'Nepal', flag: '🇳🇵' },
  { code: '+7', name: 'Kazakhstan / Russia', flag: '🇰🇿' },
  { code: '+353', name: 'Ireland', flag: '🇮🇪' },
  { code: '+351', name: 'Portugal', flag: '🇵🇹' },
  { code: '+30', name: 'Greece', flag: '🇬🇷' },
  { code: '+43', name: 'Austria', flag: '🇦🇹' },
  { code: '+32', name: 'Belgium', flag: '🇧🇪' },
  { code: '+420', name: 'Czech Republic', flag: '🇨🇿' },
  { code: '+36', name: 'Hungary', flag: '🇭🇺' },
  { code: '+40', name: 'Romania', flag: '🇷🇴' },
  { code: '+56', name: 'Chile', flag: '🇨🇱' },
  { code: '+51', name: 'Peru', flag: '🇵🇪' },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onStartLogin, isSendingOtp }) => {
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(fullCountryList[0]);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [activeFaq, setActiveFaq] = useState<number | null>(1);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCountries = fullCountryList.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.includes(countrySearch)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim()) {
      onStartLogin(phone.trim(), selectedCountry);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      {/* Navigation */}
      <header className="landing-nav">
        <div className="nav-container">
          <div className="brand-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/freebox-logo.svg" alt="FreeBox" />
            <span className="brand-name">FreeBox</span>
          </div>

          <ul className="nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#comparison">Compare</a></li>
            <li><a href="#faq">FAQ</a></li>
            <li><a href="#about">About</a></li>
          </ul>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="btn-pill-light">
              <Sparkles size={14} />
              ₹0 Forever
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section" id="hero">
        <div>
          <div className="hero-pill-badge">
            <span className="dot"></span>
            Next-Generation Personal Cloud • Updated Sep 2026
          </div>
          <h1 className="hero-title">Unlimited Cloud Storage, Without the Limits</h1>
          <p className="hero-subtext">
            Store your photos, 4K videos, documents, and archives without storage limits, subscription plans, or monthly fees.
          </p>
          <div className="hero-cta-group">
            <a href="#features" className="btn-cta-explore">Explore Features</a>
            <a href="#comparison" className="btn-cta-pricing">Compare Providers</a>
          </div>
        </div>

        {/* Sign in to FreeDisk Card */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="signin-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.45rem', fontWeight: 700 }}>Sign in to FreeBox</h2>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Connect securely with your Telegram account.</p>
              </div>
              <img src="/freebox-logo.svg" alt="FreeBox" style={{ width: 32, height: 32 }} />
            </div>

            <form onSubmit={handleSubmit}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', marginBottom: '0.5rem' }}>
                PHONE NUMBER
              </label>

              <div className="phone-input-group" style={{ position: 'relative' }} ref={dropdownRef}>
                <button
                  type="button"
                  className="country-select-btn"
                  onClick={() => {
                    setIsCountryOpen(!isCountryOpen);
                    setCountrySearch('');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '1.15rem' }}>{selectedCountry.flag}</span>
                  <span style={{ fontWeight: 600 }}>{selectedCountry.code}</span>
                  <ChevronDown size={14} />
                </button>

                <input
                  type="tel"
                  className="phone-number-input"
                  placeholder={selectedCountry.code === '+91' ? '10-digit mobile number' : 'Mobile number'}
                  value={phone}
                  maxLength={selectedCountry.code === '+91' ? 10 : 15}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, '');
                    const maxLen = selectedCountry.code === '+91' ? 10 : 15;
                    setPhone(digitsOnly.slice(0, maxLen));
                  }}
                  required
                />

                {/* Searchable Country Picker Dropdown */}
                {isCountryOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      width: 'min(320px, calc(100vw - 3.5rem))',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 16,
                      boxShadow: '0 16px 36px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.06)',
                      padding: '0.65rem',
                      zIndex: 100,
                      animation: 'popIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    {/* Search Input */}
                    <div style={{ marginBottom: '0.5rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          background: '#f8fafc',
                          border: '1.5px solid var(--tg-blue)',
                          borderRadius: 10,
                          padding: '0.45rem 0.75rem',
                        }}
                      >
                        <Search size={14} color="#64748b" />
                        <input
                          type="text"
                          placeholder="Search country or code..."
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          autoFocus
                          style={{
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontSize: '0.85rem',
                            width: '100%',
                            color: '#0f172a',
                          }}
                        />
                        {countrySearch && (
                          <button
                            type="button"
                            onClick={() => setCountrySearch('')}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Scrollable Countries List */}
                    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {filteredCountries.length === 0 ? (
                        <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.82rem', color: '#94a3b8' }}>
                          No country found
                        </div>
                      ) : (
                        filteredCountries.map((c) => (
                          <div
                            key={`${c.name}-${c.code}`}
                            onClick={() => {
                              setSelectedCountry(c);
                              setIsCountryOpen(false);
                              // Re-trim phone if switching to India
                              if (c.code === '+91' && phone.length > 10) {
                                setPhone(phone.slice(0, 10));
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.5rem 0.75rem',
                              borderRadius: 8,
                              cursor: 'pointer',
                              fontSize: '0.88rem',
                              background: selectedCountry.name === c.name ? '#f1f5f9' : 'transparent',
                              transition: 'background 0.12s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = selectedCountry.name === c.name ? '#f1f5f9' : 'transparent')
                            }
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              <span style={{ fontSize: '1.2rem' }}>{c.flag}</span>
                              <span style={{ fontWeight: 500, color: '#0f172a' }}>{c.name}</span>
                            </div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#64748b' }}>
                              {c.code}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn-continue-drive"
                disabled={isSendingOtp}
                style={{
                  opacity: isSendingOtp ? 0.75 : 1,
                  cursor: isSendingOtp ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {isSendingOtp && (
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border: '2px solid rgba(255,255,255,0.4)',
                      borderTopColor: '#ffffff',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.6s linear infinite',
                    }}
                  />
                )}
                {isSendingOtp ? 'Sending OTP Code...' : 'Continue to Drive →'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <Shield size={16} color="#10b981" />
                <span>Zero storage subscription - No credit card required</span>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features-grid" id="features">
        <div className="feature-card">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eff6ff', color: 'var(--tg-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <HardDrive size={22} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Zero Subscription Limits</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
            No monthly subscription bills, no tiered GB storage plans, and no sudden renewal price jumps.
          </p>
        </div>

        <div className="feature-card">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <Zap size={22} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>High-Speed Transfers</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
            Direct chunked uploads and instantaneous browser streaming playback powered by Telegram's global CDN.
          </p>
        </div>

        <div className="feature-card">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f5f3ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <Lock size={22} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Private by Design</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
            Stored exclusively inside your personal Telegram account space with zero third-party profiling or data mining.
          </p>
        </div>

        <div className="feature-card">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', fontWeight: 800, fontSize: '1.15rem' }}>
            ₹0
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Zero Storage Fees</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
            No monthly billing, no surprise invoices, and no tier upgrades required.
          </p>
        </div>
      </section>

      {/* Comparison Table with Horizontal Scroll on Mobile */}
      <section className="comparison-section" id="comparison">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 800, marginBottom: '0.75rem' }}>
            How FreeBox Compares to Leading Cloud Providers
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem' }}>
            Compare storage limits, subscription fees, and features across consumer cloud drives.
          </p>
        </div>

        {/* Horizontal Scrollable Container for Mobile Responsiveness */}
        <div
          style={{
            width: '100%',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            borderRadius: 16,
            border: '1px solid var(--border-subtle)',
            background: '#ffffff',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <table className="comparison-table" style={{ minWidth: 720, margin: 0, border: 'none' }}>
            <thead>
              <tr>
                <th>Service</th>
                <th>Free Storage</th>
                <th>Monthly Price</th>
                <th>Max File Size</th>
                <th>4K Video Stream</th>
                <th>No Data Profiling</th>
              </tr>
            </thead>
            <tbody>
              <tr className="row-freebox">
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--tg-blue)', fontWeight: 700, fontSize: '1.05rem' }}>
                    <span>FreeBox</span>
                    <span className="badge-best">BEST</span>
                  </div>
                </td>
                <td style={{ color: 'var(--tg-blue)', fontWeight: 700 }}>Unlimited</td>
                <td style={{ color: 'var(--tg-blue)', fontWeight: 700 }}>₹0 / forever</td>
                <td style={{ color: 'var(--tg-blue)', fontWeight: 700 }}>2 GB (4 GB Prem)</td>
                <td><Check size={18} color="#10b981" strokeWidth={3} /></td>
                <td><Check size={18} color="#10b981" strokeWidth={3} /></td>
              </tr>
              <tr>
                <td><strong>Google Drive</strong></td>
                <td>15 GB shared</td>
                <td>₹130/mo after 15 GB</td>
                <td>Varies</td>
                <td><Check size={18} color="#10b981" strokeWidth={3} /></td>
                <td><X size={18} color="#ef4444" strokeWidth={3} /></td>
              </tr>
              <tr>
                <td><strong>Dropbox</strong></td>
                <td>2 GB</td>
                <td>₹820/mo after 2 GB</td>
                <td>2 GB</td>
                <td><X size={18} color="#ef4444" strokeWidth={3} /></td>
                <td><X size={18} color="#ef4444" strokeWidth={3} /></td>
              </tr>
              <tr>
                <td><strong>Microsoft OneDrive</strong></td>
                <td>5 GB</td>
                <td>₹150/mo after 5 GB</td>
                <td>Varies</td>
                <td><X size={18} color="#ef4444" strokeWidth={3} /></td>
                <td><X size={18} color="#ef4444" strokeWidth={3} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ Section */}
      <section style={{ maxWidth: 900, margin: '0 auto 6rem auto', padding: '0 2rem' }} id="faq">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: '#eef6fd', color: 'var(--tg-blue)', padding: '0.35rem 0.9rem', borderRadius: 9999, fontSize: '0.82rem', fontWeight: 600, marginBottom: '1rem' }}>
            Frequently Asked Questions
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 800 }}>Top Questions About FreeBox</h2>
          <p style={{ color: 'var(--text-muted)' }}>Quick answers to the most common questions.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            {
              id: 0,
              q: 'Is FreeBox truly unlimited cloud storage?',
              a: 'Yes! FreeBox connects directly to Telegram\'s distributed MTProto cloud infrastructure. Telegram provides personal accounts with virtually unlimited capacity in Saved Messages with files up to 2 GB each (4 GB with Telegram Premium).'
            },
            {
              id: 1,
              q: 'How much does FreeBox cost? Is it really ₹0 free forever?',
              a: 'FreeBox is completely free with ₹0 monthly subscription fees. There are no hidden fees, paid tiers, or credit card requirements. Since files reside safely within your own Telegram account ecosystem, zero third-party hosting markup is passed to you.'
            },
            {
              id: 2,
              q: 'What is the maximum file size I can upload to FreeBox?',
              a: 'You can upload single files up to 2 GB each for standard accounts, or up to 4 GB with Telegram Premium. FreeBox automates chunked spooling so you can safely store 4K video, disk images, and large archives.'
            },
            {
              id: 3,
              q: 'How does authentication work? Is it secure?',
              a: 'Authentication occurs directly via Telegram\'s official public login API. You enter your mobile phone number, and official Telegram sends a 5-digit verification code directly to your authorized Telegram app. FreeBox never sees or stores your personal passwords or private chats.'
            },
            {
              id: 4,
              q: 'Can I upload entire folders and multiple files at once?',
              a: 'Yes! FreeBox supports recursive folder drag-and-drop and bulk directory uploads via the "Upload Folder" button. All nested subdirectories are automatically recreated in your drive with multi-threaded parallel chunk transfers.'
            },
          ].map((item) => (
            <div key={item.id} style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
              <button
                onClick={() => setActiveFaq(activeFaq === item.id ? null : item.id)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', background: 'transparent', border: 'none', fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700, color: activeFaq === item.id ? 'var(--tg-blue)' : 'var(--text-main)', textAlign: 'left', cursor: 'pointer' }}
              >
                <span>{item.q}</span>
                <ChevronDown size={20} style={{ transform: activeFaq === item.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }} />
              </button>
              {activeFaq === item.id && (
                <div style={{ padding: '0 1.5rem 1.25rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* About & Creator Section (Responsive & Single-line Name) */}
      <section id="about" style={{ maxWidth: 960, margin: '0 auto 6rem auto', padding: '0 1.5rem' }}>
        <div
          style={{
            maxWidth: 880,
            margin: '0 auto',
            background: '#ffffff',
            border: '1px solid var(--border-subtle)',
            borderRadius: 24,
            padding: '1.75rem 2rem',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.5rem',
            flexWrap: 'wrap',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.15rem', flex: '1 1 300px', minWidth: 0 }}>
            {/* GitHub Octocat Icon Box */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: '#18181b',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            </div>

            <div style={{ minWidth: 0 }}>
              {/* Green Badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#059669',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '0.12rem 0.5rem',
                  borderRadius: 9999,
                  marginBottom: '0.25rem',
                }}
              >
                <span>💖</span>
                <span>Independent Developer Project</span>
              </div>

              {/* Single-line Name Heading */}
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(0.82rem, 2.8vw, 1.05rem)',
                  fontWeight: 800,
                  color: '#0f172a',
                  margin: '0 0 0.2rem 0',
                  whiteSpace: 'nowrap',
                }}
              >
                Built by Rajesh Choudhury
              </h3>

              {/* Concise, non-verbose description */}
              <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4, margin: 0 }}>
                Free unlimited cloud storage. Star on GitHub!
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="about-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a
              href="https://github.com/rajeshc-git"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#18181b',
                color: '#ffffff',
                border: 'none',
                borderRadius: 9999,
                padding: '0.65rem 1.25rem',
                fontWeight: 600,
                fontSize: '0.86rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(24,24,27,0.15)',
                cursor: 'pointer',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
              <span>Follow on GitHub</span>
            </a>

            <button
              onClick={() => {
                sfx.playClick();
                setShowSupportModal(true);
              }}
              style={{
                background: '#ffffff',
                color: '#0f172a',
                border: '1.5px solid var(--border-medium)',
                borderRadius: 9999,
                padding: '0.75rem 1.35rem',
                fontWeight: 600,
                fontSize: '0.88rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.55rem',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <span style={{ color: '#f43f5e' }}>💖</span>
              <span>Support Developer</span>
            </button>
          </div>
        </div>
      </section>

      {/* Support Developer Modal */}
      {showSupportModal && (
        <div className="modal-backdrop" onClick={() => setShowSupportModal(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 24,
              padding: '2rem',
              width: '92vw',
              maxWidth: 480,
              position: 'relative',
              boxShadow: 'var(--shadow-xl)',
              animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <button
              onClick={() => setShowSupportModal(false)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.2rem',
                color: 'var(--text-light)',
              }}
            >
              ✕
            </button>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  background: '#fef2f2',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem auto',
                }}
              >
                <Heart size={32} fill="#ef4444" />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                Support Rajesh Choudhury
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                FreeBox is built and maintained independently with 100% free access for users across India and the globe.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <a
                href="https://github.com/rajeshc-git"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#18181b',
                  color: '#fff',
                  padding: '0.85rem 1.25rem',
                  borderRadius: 14,
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    />
                  </svg>
                  <span>Follow & Star on GitHub</span>
                </div>
                <ExternalLink size={16} />
              </a>

              <button
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.origin);
                  setShareCopied(true);
                  sfx.playClick();
                  setTimeout(() => setShareCopied(false), 2000);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#f8fafc',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  padding: '0.85rem 1.25rem',
                  borderRadius: 14,
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Share2 size={18} color="var(--tg-blue)" />
                  <span>{shareCopied ? 'Link Copied to Clipboard!' : 'Share FreeBox with Friends'}</span>
                </div>
                {shareCopied && <Check size={16} color="#10b981" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer (Clean & Proprietary - Zero Tech Stack Disclosure) */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '2.75rem 2rem', background: '#ffffff' }}>
        <div
          style={{
            maxWidth: 1240,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <img src="/freebox-logo.svg" alt="FreeBox" style={{ width: 32, height: 32 }} />
            <div>
              <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                FreeBox
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-light)', marginLeft: '0.85rem' }}>
                © 2026 FreeBox Cloud. All rights reserved.
              </span>
            </div>
          </div>

          <div
            className="landing-footer-author"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.92rem',
              color: 'var(--text-muted)',
              background: '#f8fafc',
              border: '1px solid var(--border-subtle)',
              padding: '0.5rem 1.15rem',
              borderRadius: 9999,
            }}
          >
            <span>
              Built with ❤️ in India by{' '}
              <a
                href="https://github.com/rajeshc-git"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-main)', textDecoration: 'underline', fontWeight: 700 }}
              >
                Rajesh Choudhury
              </a>{' '}
              🇮🇳
            </span>
          </div>

          <div className="landing-footer-links" style={{ display: 'flex', gap: '1.75rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            <a href="#about" style={{ textDecoration: 'none', color: 'inherit', fontWeight: 500 }}>
              About
            </a>
            <a href="#features" style={{ textDecoration: 'none', color: 'inherit', fontWeight: 500 }}>
              Features
            </a>
            <a href="#comparison" style={{ textDecoration: 'none', color: 'inherit', fontWeight: 500 }}>
              Compare
            </a>
            <a href="#faq" style={{ textDecoration: 'none', color: 'inherit', fontWeight: 500 }}>
              FAQ
            </a>
            <span style={{ color: '#10b981', fontWeight: 600 }}>100% Free SaaS</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
