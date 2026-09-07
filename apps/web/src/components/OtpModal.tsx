import React, { useState, useEffect, useRef } from 'react';
import { Send, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface OtpModalProps {
  phone: string;
  isVerifying: boolean;
  error: string | null;
  requiresPassword: boolean;
  onVerify: (code: string, password?: string) => void;
  onResend: () => void;
  onClose: () => void;
}

export const OtpModal: React.FC<OtpModalProps> = ({
  phone,
  isVerifying,
  error,
  requiresPassword,
  onVerify,
  onResend,
  onClose,
}) => {
  const [digits, setDigits] = useState(['', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (requiresPassword) {
      passwordRef.current?.focus();
    } else {
      inputsRef.current[0]?.focus();
    }
  }, [requiresPassword]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleChange = (index: number, val: string) => {
    const char = val.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);

    if (char && index < 4) {
      inputsRef.current[index + 1]?.focus();
    }

    if (newDigits.every((d) => d !== '')) {
      onVerify(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 5);
    if (text.length === 5) {
      const newDigits = text.split('');
      setDigits(newDigits);
      inputsRef.current[4]?.focus();
      onVerify(text);
    }
  };

  const handleResend = () => {
    onResend();
    setResendCooldown(30);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onVerify(digits.join(''), password);
    }
  };

  return (
    <div className="modal-backdrop">
      <div style={{ background: '#fff', borderRadius: 24, padding: '2.25rem', width: '100%', maxWidth: 440, position: 'relative', boxShadow: 'var(--shadow-xl)', animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <button
          onClick={onClose}
          disabled={isVerifying}
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-light)', opacity: isVerifying ? 0.4 : 1 }}
        >
          ✕
        </button>

        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#eef6fd', color: 'var(--tg-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
          <Send size={28} />
        </div>

        {!requiresPassword ? (
          <>
            <h3 style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Enter Verification Code
            </h3>
            <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Check your <strong>Telegram app</strong> for the login code sent to <br />
              <span style={{ fontWeight: 600, color: 'var(--text-main)', background: 'var(--bg-surface-secondary)', padding: '0.2rem 0.6rem', borderRadius: 6 }}>
                {phone}
              </span>
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.65rem', marginBottom: '1rem' }} onPaste={handlePaste}>
              {digits.map((d, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputsRef.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  disabled={isVerifying}
                  style={{
                    width: 48,
                    height: 56,
                    border: error ? '1.5px solid #ef4444' : '1.5px solid var(--border-medium)',
                    borderRadius: 12,
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                    background: '#fff',
                    opacity: isVerifying ? 0.6 : 1,
                    transition: 'border-color 0.2s',
                  }}
                />
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#ef4444', fontWeight: 600, marginBottom: '0.75rem' }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => onVerify(digits.join(''))}
                disabled={isVerifying || digits.some((d) => d === '')}
                style={{
                  background: isVerifying ? '#94a3b8' : 'var(--tg-blue)',
                  color: '#fff',
                  border: 'none',
                  padding: '0.85rem',
                  borderRadius: 12,
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: isVerifying ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                {isVerifying ? (
                  <>
                    <span className="pulse-fast" style={{ display: 'inline-block' }}>●</span>
                    Verifying with Telegram...
                  </>
                ) : (
                  'Verify & Access Drive'
                )}
              </button>

              <button
                onClick={handleResend}
                disabled={resendCooldown > 0 || isVerifying}
                style={{
                  background: '#f8fafc',
                  color: resendCooldown > 0 ? 'var(--text-light)' : 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                  padding: '0.65rem',
                  borderRadius: 12,
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: resendCooldown > 0 || isVerifying ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                }}
              >
                <RefreshCw size={14} />
                {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code via Telegram'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 2FA Password Step */}
            <h3 style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Two-Step Verification
            </h3>
            <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Your Telegram account has Two-Step Verification enabled. Enter your cloud password to continue.
            </p>

            <form onSubmit={handlePasswordSubmit}>
              <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <input
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Cloud password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isVerifying}
                  style={{
                    width: '100%',
                    border: error ? '1.5px solid #ef4444' : '1.5px solid var(--border-medium)',
                    borderRadius: 12,
                    padding: '0.85rem 3rem 0.85rem 1rem',
                    fontSize: '1rem',
                    outline: 'none',
                    background: '#fff',
                    opacity: isVerifying ? 0.6 : 1,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && (
                <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#ef4444', fontWeight: 600, marginBottom: '0.75rem' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isVerifying || !password.trim()}
                style={{
                  width: '100%',
                  background: isVerifying ? '#94a3b8' : 'var(--tg-blue)',
                  color: '#fff',
                  border: 'none',
                  padding: '0.85rem',
                  borderRadius: 12,
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: isVerifying ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                {isVerifying ? (
                  <>
                    <span className="pulse-fast" style={{ display: 'inline-block' }}>●</span>
                    Verifying password...
                  </>
                ) : (
                  'Continue to Drive'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
