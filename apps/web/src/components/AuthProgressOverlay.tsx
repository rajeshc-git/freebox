import React, { useState, useEffect } from 'react';
import { Send, ShieldCheck, Lock, Sparkles, Loader2 } from 'lucide-react';

interface AuthProgressOverlayProps {
  isOpen: boolean;
  mode: 'send' | 'verify';
  phone?: string;
}

export const AuthProgressOverlay: React.FC<AuthProgressOverlayProps> = ({
  isOpen,
  mode,
  phone,
}) => {
  const [progress, setProgress] = useState(15);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);

  const sendStages = [
    { label: 'Connecting to Telegram MTProto DC4 Gateway...', sub: 'Initializing secure transport tunnel' },
    { label: 'Establishing Diffie-Hellman Key Nonce...', sub: 'Cryptographic handshake with Telegram' },
    { label: 'Requesting One-Time Verification Code...', sub: 'Authenticating phone route' },
    { label: 'Dispatching OTP to your Telegram app...', sub: 'Almost ready...' },
  ];

  const verifyStages = [
    { label: 'Authenticating with Telegram MTProto...', sub: 'Submitting cryptographic session proof' },
    { label: 'Verifying Telegram Cloud Token...', sub: 'Validating phone authorization' },
    { label: 'Mounting FreeBox Spool Vault...', sub: 'Zero-knowledge storage initialization' },
    { label: 'Access Granted! Entering Drive...', sub: 'Redirecting to your files' },
  ];

  const stages = mode === 'send' ? sendStages : verifyStages;

  useEffect(() => {
    if (!isOpen) {
      setProgress(15);
      setCurrentStageIndex(0);
      return;
    }

    setProgress(20);
    setCurrentStageIndex(0);

    // Progress increments realistically up to ~92% while waiting for async response
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 40) return prev + 12;
        if (prev < 65) return prev + 8;
        if (prev < 88) return prev + 4;
        if (prev < 94) return prev + 1;
        return prev;
      });
    }, 280);

    const stageTimer1 = setTimeout(() => setCurrentStageIndex(1), 600);
    const stageTimer2 = setTimeout(() => setCurrentStageIndex(2), 1600);
    const stageTimer3 = setTimeout(() => setCurrentStageIndex(3), 2800);

    return () => {
      clearInterval(interval);
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);
    };
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const currentStage = stages[currentStageIndex] || stages[stages.length - 1];

  return (
    <div className="auth-progress-backdrop">
      <div className="auth-progress-card">
        {/* Animated Icon with Glowing Rings */}
        <div className="auth-progress-icon-wrapper">
          <div className="auth-progress-pulse-ring-2" />
          <div className="auth-progress-pulse-ring" />
          <div className="auth-progress-icon-bg">
            {mode === 'send' ? (
              <Send size={32} color="#ffffff" style={{ transform: 'rotate(12deg)' }} />
            ) : (
              <ShieldCheck size={36} color="#38bdf8" />
            )}
          </div>
        </div>

        {/* Title */}
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.45rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            marginBottom: '0.4rem',
            color: '#ffffff',
          }}
        >
          {mode === 'send' ? 'Connecting to Telegram' : 'Verifying Access'}
        </h3>

        {/* Subtitle / Phone Badge */}
        {phone && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'rgba(255, 255, 255, 0.16)',
              padding: '0.25rem 0.75rem',
              borderRadius: 9999,
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#e0f2fe',
              marginBottom: '1rem',
              backdropFilter: 'blur(4px)',
            }}
          >
            <Lock size={12} color="#7dd3fc" />
            <span>{phone}</span>
          </div>
        )}

        {/* Glowing Progress Bar */}
        <div className="auth-progress-track">
          <div className="auth-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Progress Percentage & Status */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.78rem',
            color: '#bae6fd',
            fontWeight: 600,
            marginBottom: '1.25rem',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Loader2 size={13} className="spin" style={{ animation: 'ringSpin 1.4s linear infinite' }} />
            <span>Telegram MTProto v2.0</span>
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', color: '#ffffff', fontWeight: 700 }}>
            {progress}%
          </span>
        </div>

        {/* Dynamic Stage Info */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.22)',
            borderRadius: 14,
            padding: '0.85rem 1rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#ffffff',
              marginBottom: '0.15rem',
            }}
          >
            <Sparkles size={15} color="#38bdf8" />
            <span>{currentStage.label}</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#93c5fd', paddingLeft: '1.45rem' }}>
            {currentStage.sub}
          </div>
        </div>
      </div>
    </div>
  );
};
