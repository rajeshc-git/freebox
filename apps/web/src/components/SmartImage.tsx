import React, { useState, useEffect } from 'react';

interface SmartImageProps {
  src: string;
  alt: string;
  filename?: string;
  style?: React.CSSProperties;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

// Global lightweight in-memory cache for converted HEIC blob URLs (pure RAM, zero localStorage)
const heicBlobMemoryCache = new Map<string, string>();
const heicConversionPromiseCache = new Map<string, Promise<string>>();

export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  filename = '',
  style,
  className,
  onClick,
}) => {
  const isHeic =
    filename.toLowerCase().endsWith('.heic') ||
    filename.toLowerCase().endsWith('.heif') ||
    alt.toLowerCase().endsWith('.heic') ||
    alt.toLowerCase().endsWith('.heif');

  // Check if browser natively supports HEIC (e.g. Safari on Apple devices)
  const isAppleSafari =
    typeof navigator !== 'undefined' &&
    /Safari/i.test(navigator.userAgent) &&
    !/Chrome|CriOS|Edg|OPR|Firefox/i.test(navigator.userAgent);

  // Check in-memory cache immediately to prevent any flicker / delay when switching tabs
  const initialSrc = !isHeic || isAppleSafari
    ? src
    : heicBlobMemoryCache.get(src) || src;

  const [resolvedSrc, setResolvedSrc] = useState<string>(initialSrc);
  const [isConverting, setIsConverting] = useState<boolean>(
    isHeic && !isAppleSafari && !heicBlobMemoryCache.has(src)
  );
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    if (!isHeic || isAppleSafari) {
      setResolvedSrc(src);
      setIsConverting(false);
      setHasError(false);
      return;
    }

    // If already in memory cache, use immediately with zero delay
    if (heicBlobMemoryCache.has(src)) {
      setResolvedSrc(heicBlobMemoryCache.get(src)!);
      setIsConverting(false);
      setHasError(false);
      return;
    }

    let isMounted = true;
    setIsConverting(true);
    setHasError(false);

    // Reuse conversion promise if already in-flight for this src
    let conversionPromise = heicConversionPromiseCache.get(src);
    if (!conversionPromise) {
      conversionPromise = (async () => {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const blob = await res.blob();
        const heic2any = (await import('heic2any')).default;
        const result = await heic2any({
          blob,
          toType: 'image/jpeg',
          quality: 0.92,
        });
        const convertedBlob = Array.isArray(result) ? result[0] : result;
        const objectUrl = URL.createObjectURL(convertedBlob);
        heicBlobMemoryCache.set(src, objectUrl);
        return objectUrl;
      })();
      heicConversionPromiseCache.set(src, conversionPromise);
    }

    conversionPromise
      .then((objectUrl) => {
        if (isMounted) {
          setResolvedSrc(objectUrl);
          setIsConverting(false);
        }
      })
      .catch((err) => {
        console.warn('HEIC client conversion error, falling back to direct stream', err);
        if (isMounted) {
          setResolvedSrc(src);
          setIsConverting(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [src, filename, alt, isHeic, isAppleSafari]);

  if (isConverting) {
    return (
      <div
        className={`skeleton-shimmer ${className || ''}`}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 140,
          borderRadius: 8,
          ...style,
        }}
      />
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
