import React, { useEffect, useState, useRef } from 'react';

export interface CapturePreviewScreenProps {
  imageSrc: string;
  autoProceedSeconds?: number; // Default 5s
  onRetake: () => void;
  onProceed: () => void;
  themeColor?: string;
}

/**
 * Shared Screen 4: Photo Preview Screen with mandatory 5-second auto-proceed timer.
 * Prevents line bottlenecking in kiosk event environments.
 */
export const CapturePreviewScreen: React.FC<CapturePreviewScreenProps> = ({
  imageSrc,
  autoProceedSeconds = 5,
  onRetake,
  onProceed,
  themeColor = '#3b82f6',
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(autoProceedSeconds);
  const proceedCalledRef = useRef<boolean>(false);

  useEffect(() => {
    setTimeLeft(autoProceedSeconds);
    proceedCalledRef.current = false;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!proceedCalledRef.current) {
            proceedCalledRef.current = true;
            onProceed();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoProceedSeconds, onProceed]);

  const handleManualProceed = () => {
    if (!proceedCalledRef.current) {
      proceedCalledRef.current = true;
      onProceed();
    }
  };

  const progressPercentage = ((autoProceedSeconds - timeLeft) / autoProceedSeconds) * 100;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      backgroundColor: '#0a0d14',
      color: '#fff',
      padding: '24px',
      boxSizing: 'border-box',
      position: 'relative'
    }}>
      {/* Captured Image Preview Frame */}
      <div style={{
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
        maxHeight: '70vh',
        maxWidth: '90vw'
      }}>
        <img
          src={imageSrc}
          alt="Captured Preview"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />

        {/* Auto-proceed timer badge */}
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          borderRadius: '24px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid rgba(255,255,255,0.2)',
          fontSize: '14px',
          fontWeight: 600
        }}>
          <span>Auto-proceeding in {timeLeft}s</span>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: themeColor,
            animation: 'pulse 1s infinite'
          }} />
        </div>

        {/* Progress Bar Line */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '6px',
          width: `${progressPercentage}%`,
          backgroundColor: themeColor,
          transition: 'width 1s linear'
        }} />
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '24px',
        marginTop: '32px',
        width: '100%',
        maxWidth: '480px'
      }}>
        <button
          onClick={onRetake}
          style={{
            flex: 1,
            padding: '16px 24px',
            fontSize: '18px',
            fontWeight: 700,
            borderRadius: '12px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Retake Photo
        </button>

        <button
          onClick={handleManualProceed}
          style={{
            flex: 1,
            padding: '16px 24px',
            fontSize: '18px',
            fontWeight: 700,
            borderRadius: '12px',
            backgroundColor: themeColor,
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: `0 4px 20px ${themeColor}66`,
            transition: 'all 0.2s'
          }}
        >
          Looks Great!
        </button>
      </div>
    </div>
  );
};
