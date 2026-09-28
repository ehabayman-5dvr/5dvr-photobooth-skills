import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface CaptureScreenProps {
  onCapture: (capturedDataUrl: string) => void;
  countdownSeconds?: number; // Default: 3
  themeColor?: string;
}

/**
 * Shared Screen 3: Photo Capture Screen
 *
 * Implements 5DVR physical camera setup standard:
 * - Camera mounted physically at 90° for native tall portrait framing.
 * - Live viewport transform: `translate(-50%, -50%) scaleX(-1) rotate(-90deg)`
 *   un-mirrors the feed horizontally while keeping orientation upright on vertical kiosk screens.
 * - No face-align UI/guides (clean, natural framing for solo and group photos).
 * - Canvas frame extraction applies the matching scaleX(-1) & rotate(-90deg) transform
 *   producing a clean, upright 1080x1920 portrait still image.
 */
export const CaptureScreen: React.FC<CaptureScreenProps> = ({
  onCapture,
  countdownSeconds = 3,
  themeColor = '#3b82f6',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Initialize camera stream
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function initCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: 'user',
          },
          audio: false,
        });

        activeStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setIsReady(true);
          };
        }
      } catch (err: any) {
        console.error('Camera access failed:', err);
        setCameraError(err.message || 'Unable to access camera.');
      }
    }

    initCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Frame capture with physical camera transform
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;

    const canvas = document.createElement('canvas');
    // Rotate 90deg swaps width and height for tall portrait output (e.g., 1080x1920)
    canvas.width = video.videoHeight;
    canvas.height = video.videoWidth;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Apply matching transform: translate to center -> un-mirror horizontally -> rotate -90deg
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(-1, 1);
    ctx.rotate((-90 * Math.PI) / 180);
    ctx.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2);

    return canvas.toDataURL('image/jpeg', 0.95);
  }, []);

  // Countdown timer logic
  const startCountdown = () => {
    if (countdown !== null || !isReady) return;
    setCountdown(countdownSeconds);
  };

  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }

    // Countdown reached 0 -> Flash & Capture
    setIsFlashing(true);
    const photo = captureFrame();

    setTimeout(() => {
      setIsFlashing(false);
      if (photo) {
        onCapture(photo);
      }
    }, 250);
  }, [countdown, captureFrame, onCapture]);

  if (cameraError) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#0a0d14',
        color: '#ff4d4f',
        padding: '24px',
        textAlign: 'center',
      }}>
        <h2>Camera Error</h2>
        <p>{cameraError}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '16px',
            padding: '12px 24px',
            backgroundColor: themeColor,
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      height: '100vh',
      width: '100vw',
      backgroundColor: '#000',
      overflow: 'hidden',
    }}>
      {/*
        Physical Camera Live Viewport:
        - Sideways-mounted camera (90°)
        - translate(-50%, -50%): Centers the feed
        - scaleX(-1): Flips feed horizontally in screen space to un-mirror it
        - rotate(-90deg): Restores upright orientation
        - Clean framing: NO face-align oval or guides rendered
      */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) scaleX(-1) rotate(-90deg)',
          width: '100vh',
          height: '100vw',
          objectFit: 'cover',
          pointerEvents: 'none',
        }}
      />

      {/* Screen flash on capture */}
      {isFlashing && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#fff',
          zIndex: 50,
          pointerEvents: 'none',
        }} />
      )}

      {/* Countdown Display */}
      {countdown !== null && countdown > 0 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
          pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: '120px',
            fontWeight: 800,
            color: '#fff',
            textShadow: '0 0 40px rgba(0,0,0,0.8), 0 0 80px rgba(59,130,246,0.8)',
            animation: 'scalePulse 1s ease-in-out infinite',
          }}>
            {countdown}
          </div>
        </div>
      )}

      {/* Bottom Controls / Shutter Button */}
      {countdown === null && (
        <div style={{
          position: 'absolute',
          bottom: '48px',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10,
        }}>
          <button
            onClick={startCountdown}
            disabled={!isReady}
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              backgroundColor: '#fff',
              border: `4px solid ${themeColor}`,
              boxShadow: `0 0 30px ${themeColor}88, inset 0 0 10px rgba(0,0,0,0.2)`,
              cursor: isReady ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.15s ease',
              outline: 'none',
            }}
          >
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: themeColor,
            }} />
          </button>
        </div>
      )}
    </div>
  );
};
