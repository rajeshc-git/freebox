import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface SmartImageProps {
  src: string;
  alt: string;
  filename?: string;
  style?: React.CSSProperties;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  filename = '',
  style,
  className,
  onClick,
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>(src);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    const isHeic =
      filename.toLowerCase().endsWith('.heic') ||
      filename.toLowerCase().endsWith('.heif') ||
      alt.toLowerCase().endsWith('.heic') ||
      alt.toLowerCase().endsWith('.heif');

    // Check if the browser natively supports HEIC (e.g. Safari on Apple devices)
    const isAppleSafari =
      /Safari/i.test(navigator.userAgent) &&
      !/Chrome|CriOS|Edg|OPR|Firefox/i.test(navigator.userAgent);

    if (!isHeic || isAppleSafari) {
      setResolvedSrc(src);
      setIsConverting(false);
      setHasError(false);
      return;
    }

    // Convert HEIC in non-Safari browsers (Chrome, Edge, Firefox) using heic2any
    let isMounted = true;
    setIsConverting(true);
    setHasError(false);

    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.blob();
      })
      .then(async (blob) => {
        try {
          const heic2any = (await import('heic2any')).default;
          const result = await heic2any({
            blob,
            toType: 'image/jpeg',
            quality: 0.92,
          });
          const convertedBlob = Array.isArray(result) ? result[0] : result;
          if (isMounted) {
            const objectUrl = URL.createObjectURL(convertedBlob);
            setResolvedSrc(objectUrl);
            setIsConverting(false);
          }
        } catch (convErr) {
          console.warn('HEIC client conversion error, falling back to direct stream', convErr);
          if (isMounted) {
            setResolvedSrc(src);
            setIsConverting(false);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to fetch HEIC image', err);
        if (isMounted) {
          setHasError(true);
          setIsConverting(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [src, filename, alt]);

  if (isConverting) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          background: '#f8fafc',
          borderRadius: 12,
          padding: '2rem',
          color: 'var(--tg-blue)',
          ...style,
        }}
      >
        <Loader2 size={32} className="pulse-fast" style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>
          Rendering iPhone HEIC Photo...
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      style={style}
      className={className}
      onClick={onClick}
      onError={() => setHasError(true)}
    />
  );
};
