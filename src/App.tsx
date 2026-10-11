/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// Custom typewriter hook according to specifications:
// takes text, speed (default 38ms per char), startDelay (default 600ms)
// reveals one character at a time after the delay.
function useTypewriter(
  text: string,
  speed: number = 38,
  startDelay: number = 600
): { displayed: string; done: boolean } {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let index = 0;
    let timerId: ReturnType<typeof setInterval>;

    const delayTimeout = setTimeout(() => {
      timerId = setInterval(() => {
        index += 1;
        setDisplayed(text.slice(0, index));
        if (index >= text.length) {
          clearInterval(timerId);
          setDone(true);
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(delayTimeout);
      if (timerId) clearInterval(timerId);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}

const NAV_LINKS = [
  { label: 'Labs', href: '#labs' },
  { label: 'Studio', href: '#studio' },
  { label: 'Openings', href: '#openings' },
  { label: 'Shop', href: '#shop' },
];

const ACTION_PILLS = [
  { label: 'Pitch us an idea', href: 'mailto:pitch@mainframe.co?subject=Project%20Pitch' },
  { label: 'Come work here', href: '#openings' },
  { label: 'Send a brief hello', href: 'mailto:hello@mainframe.co?subject=Hello%20Mainframe' },
  { label: 'See how we operate', href: '#studio' },
];

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const prevXRef = useRef<number | null>(null);
  const targetTimeRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pillsVisible, setPillsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  // Typewriter hook
  const typewriterText =
    'Glad you stopped in. Good taste tends to find us. Now, what are we building?';
  const { displayed, done } = useTypewriter(typewriterText, 38, 600);

  // Pills visibility timer: 400ms after page load independent of typewriter
  useEffect(() => {
    const timer = setTimeout(() => {
      setPillsVisible(true);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // onSeeked handler to queue next seek if targetTime moved (prevents seek flooding)
  const handleSeeked = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    isSeekingRef.current = false;
    if (Math.abs(video.currentTime - targetTimeRef.current) > 0.005) {
      isSeekingRef.current = true;
      video.currentTime = targetTimeRef.current;
    }
  }, []);

  // Mouse scrub controller
  useEffect(() => {
    const SENSITIVITY = 0.8;

    const handleMouseMove = (e: MouseEvent) => {
      const video = videoRef.current;
      if (!video || !video.duration || isNaN(video.duration)) return;

      if (prevXRef.current === null) {
        prevXRef.current = e.clientX;
        return;
      }

      const delta = e.clientX - prevXRef.current;
      prevXRef.current = e.clientX;

      const offset = (delta / window.innerWidth) * SENSITIVITY * video.duration;
      targetTimeRef.current = Math.min(
        Math.max(0, targetTimeRef.current + offset),
        video.duration
      );

      if (!isSeekingRef.current) {
        isSeekingRef.current = true;
        video.currentTime = targetTimeRef.current;
      }
    };

    const handleMouseLeave = () => {
      prevXRef.current = null;
    };

    // Also support horizontal touch scrubbing for mobile devices
    const handleTouchMove = (e: TouchEvent) => {
      const video = videoRef.current;
      if (!video || !video.duration || isNaN(video.duration) || e.touches.length === 0) return;

      const clientX = e.touches[0].clientX;
      if (prevXRef.current === null) {
        prevXRef.current = clientX;
        return;
      }

      const delta = clientX - prevXRef.current;
      prevXRef.current = clientX;

      const offset = (delta / window.innerWidth) * SENSITIVITY * video.duration;
      targetTimeRef.current = Math.min(
        Math.max(0, targetTimeRef.current + offset),
        video.duration
      );

      if (!isSeekingRef.current) {
        isSeekingRef.current = true;
        video.currentTime = targetTimeRef.current;
      }
    };

    const handleTouchEnd = () => {
      prevXRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText('hello@mainframe.co');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // IndexedDB persistence for user-uploaded custom background video
  const DB_NAME = 'MainframeMediaDB';
  const STORE_NAME = 'videos';
  const KEY = 'background_video';

  const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const saveVideoBlob = async (blob: Blob): Promise<void> => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(blob, KEY);
    } catch {
      // Ignored if storage restricted
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video source state: supports local file (/bg-video.mp4), drag-and-dropped video, or external link
  const DEFAULT_FALLBACK_VIDEO =
    'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_041744_63efcd78-bf7d-4039-99e2-2461e8a61903.mp4';
  const [videoSrc, setVideoSrc] = useState<string>(DEFAULT_FALLBACK_VIDEO);

  // Load persisted video from IndexedDB on initial mount
  useEffect(() => {
    (async () => {
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(KEY);
        req.onsuccess = () => {
          if (req.result instanceof Blob) {
            const objectUrl = URL.createObjectURL(req.result);
            setVideoSrc(objectUrl);
          }
        };
      } catch {
        // Fallback default
      }
    })();
  }, []);

  const handleApplyFile = useCallback((file: File) => {
    if (file.type.startsWith('video/') || file.name.endsWith('.mp4') || file.name.endsWith('.webm')) {
      const objectUrl = URL.createObjectURL(file);
      setVideoSrc(objectUrl);
      saveVideoBlob(file);
    }
  }, []);

  // Drag-and-drop listener to allow instant loading of user's local KlingAI video
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleApplyFile(e.dataTransfer.files[0]);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    // Keyboard shortcut 'V' to open file picker for custom video
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'v' || e.key === 'V') && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        fileInputRef.current?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleApplyFile]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white select-none">
      {/* Hidden file picker input (press 'V' or drag-and-drop to pick local video file) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleApplyFile(e.target.files[0]);
          }
        }}
      />

      {/* BACKGROUND VIDEO (mouse-scrub controlled) */}
      <video
        ref={videoRef}
        src={videoSrc}
        muted
        playsInline
        preload="auto"
        onError={() => {
          if (videoSrc !== DEFAULT_FALLBACK_VIDEO) {
            setVideoSrc(DEFAULT_FALLBACK_VIDEO);
          }
        }}
        onSeeked={handleSeeked}
        className="fixed inset-0 z-0 object-cover w-full h-full pointer-events-none"
        style={{
          objectPosition: 'center center',
        }}
      />

      {/* NAVBAR (fixed, z-index: 10) */}
      <header className="fixed top-0 left-0 right-0 z-10 w-full px-5 sm:px-8 py-4 sm:py-5 flex flex-row justify-between items-center">
        {/* Logo (left) */}
        <div className="flex flex-row items-center gap-3">
          <span
            className="text-[21px] sm:text-[26px] tracking-tight text-white select-none"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Mainframe®
          </span>
          <span
            className="text-[25px] sm:text-[30px] text-white select-none"
            style={{ letterSpacing: '-0.02em' }}
            aria-hidden="true"
          >
            ✳︎
          </span>
        </div>

        {/* Desktop nav links (center, hidden below md) */}
        <nav
          className="hidden md:flex flex-row items-center text-[23px] text-white"
          aria-label="Main Navigation"
        >
          {NAV_LINKS.map((link, idx) => (
            <React.Fragment key={link.label}>
              <a
                href={link.href}
                className="hover:opacity-60 transition-opacity"
              >
                {link.label}
              </a>
              {idx < NAV_LINKS.length - 1 && (
                <span className="select-none">,&nbsp;</span>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Desktop CTA (right, hidden below md) */}
        <div className="hidden md:block">
          <a
            href="mailto:hello@mainframe.co"
            className="text-[23px] text-white underline underline-offset-2 hover:opacity-60 transition-opacity"
          >
            Get in touch
          </a>
        </div>

        {/* Mobile hamburger (visible below md) */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden z-20 flex flex-col justify-center items-center w-8 h-8 gap-[5px] focus:outline-none"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
        >
          <span
            className={`w-6 h-[2px] bg-white transition-all duration-300 transform origin-center ${
              mobileMenuOpen ? 'rotate-45 translate-y-[7px]' : ''
            }`}
          />
          <span
            className={`w-6 h-[2px] bg-white transition-opacity duration-300 ${
              mobileMenuOpen ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <span
            className={`w-6 h-[2px] bg-white transition-all duration-300 transform origin-center ${
              mobileMenuOpen ? '-rotate-45 -translate-y-[7px]' : ''
            }`}
          />
        </button>
      </header>

      {/* Mobile overlay (z-index: 9) */}
      <div
        className={`fixed inset-0 bg-black/90 backdrop-blur-md z-[9] flex flex-col justify-center items-start px-8 gap-8 transition-opacity duration-300 md:hidden ${
          mobileMenuOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            onClick={() => setMobileMenuOpen(false)}
            className="text-[32px] font-medium text-white hover:opacity-70 transition-opacity"
          >
            {link.label}
          </a>
        ))}
        <a
          href="mailto:hello@mainframe.co"
          onClick={() => setMobileMenuOpen(false)}
          className="text-[32px] font-medium text-white underline underline-offset-4 hover:opacity-70 transition-opacity"
        >
          Get in touch
        </a>
      </div>

      {/* HERO SECTION (z-index: 1) */}
      <main className="relative z-[1] w-full h-screen flex flex-col justify-end pb-12 md:justify-center md:pb-0 px-5 sm:px-8 md:px-10 overflow-hidden">
        <div className="max-w-xl relative z-10">
          {/* 1. Blurred intro label */}
          <div
            className="pointer-events-none select-none mb-5 sm:mb-6"
            style={{
              fontSize: 'clamp(18px, 4vw, 26px)',
              lineHeight: 1.3,
              fontWeight: 400,
              color: '#fff',
              filter: 'blur(4px)',
            }}
          >
            Hey there, meet A.R.I.A,
            <br />
            Mainframe's Adaptive Response Interface Agent
          </div>

          {/* 2. Typewriter text */}
          <p
            className="text-white mb-5 sm:mb-6 font-normal min-h-[54px] select-text"
            style={{
              fontSize: 'clamp(18px, 4vw, 26px)',
              lineHeight: 1.35,
              fontWeight: 400,
            }}
          >
            {displayed}
            {!done && (
              <span
                className="inline-block w-[2px] h-[1.1em] bg-white align-middle ml-[2px] animate-blink"
                aria-hidden="true"
              />
            )}
          </p>

          {/* 3. Action pill buttons */}
          <div
            className="flex flex-wrap gap-y-1"
            style={{
              opacity: pillsVisible ? 1 : 0,
              transform: pillsVisible ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 0.4s ease, transform 0.4s ease',
            }}
          >
            {/* 4 white pill buttons */}
            {ACTION_PILLS.map((pill) => (
              <a
                key={pill.label}
                href={pill.href}
                className="inline-flex items-center justify-center bg-white text-black border border-black/10 rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.3em] mx-[0.2em] mb-[0.4em] whitespace-nowrap hover:bg-black hover:text-white transition-colors duration-200 cursor-pointer"
              >
                {pill.label}
              </a>
            ))}

            {/* 1 outline pill button with copy to clipboard */}
            <button
              type="button"
              onClick={handleCopyEmail}
              title="Click to copy email address"
              className="inline-flex items-center justify-center text-white bg-transparent border border-white rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.3em] mx-[0.2em] mb-[0.4em] whitespace-nowrap gap-2 sm:gap-3 hover:bg-white hover:text-black transition-colors duration-200 cursor-pointer group"
            >
              <span>
                {copied ? (
                  <span>Copied to clipboard!</span>
                ) : (
                  <>
                    Reach us:{' '}
                    <span className="underline underline-offset-1">
                      hello@mainframe.co
                    </span>
                  </>
                )}
              </span>

              {/* Small 12x12 copy icon (inline SVG of two overlapping rectangles) */}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="inline-block shrink-0"
                aria-hidden="true"
              >
                <rect x="4" y="4" width="7" height="7" rx="1" />
                <path d="M2.5 8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v0.5" />
              </svg>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
