import { useState, useCallback, useEffect, useRef } from 'react';

export type PhotoboothScreen =
  | 'splash'
  | 'preset_selection'
  | 'capture'
  | 'preview'
  | 'loading'
  | 'result';

export interface PhotoboothFlowConfig {
  hasPresetsScreen: boolean;
  previewAutoProceedSeconds?: number; // Default 5s
  resultIdleTimeoutSeconds?: number;   // Default 60s
  hasPrinting?: boolean;
}

export interface PhotoboothFlowState {
  currentScreen: PhotoboothScreen;
  capturedImage: string | null;
  generatedImage: string | null;
  qrCodeUrl: string | null;
  selectedPreset: any | null;
  isGenerating: boolean;
  error: string | null;
}

export function usePhotoboothFlow(config: PhotoboothFlowConfig) {
  const {
    hasPresetsScreen = false,
    previewAutoProceedSeconds = 5,
    resultIdleTimeoutSeconds = 60,
  } = config;

  const [currentScreen, setCurrentScreen] = useState<PhotoboothScreen>('splash');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<any | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset entire flow to Splash screen
  const resetToSplash = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setCapturedImage(null);
    setGeneratedImage(null);
    setQrCodeUrl(null);
    setSelectedPreset(null);
    setIsGenerating(false);
    setError(null);
    setCurrentScreen('splash');
  }, []);

  // Screen 1 -> Screen 2 or Screen 3
  const handleStart = useCallback(() => {
    if (hasPresetsScreen) {
      setCurrentScreen('preset_selection');
    } else {
      setCurrentScreen('capture');
    }
  }, [hasPresetsScreen]);

  // Screen 2 -> Screen 3
  const handleSelectPreset = useCallback((preset: any) => {
    setSelectedPreset(preset);
    setCurrentScreen('capture');
  }, []);

  // Screen 3 -> Screen 4 (Capture Complete)
  const handlePhotoCaptured = useCallback((imageSrc: string) => {
    setCapturedImage(imageSrc);
    setCurrentScreen('preview');
  }, []);

  // Screen 4 -> Screen 3 (Retake Photo)
  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    setCurrentScreen('capture');
  }, []);

  // Screen 4 -> Screen 5 (Proceed to Generation)
  const handleProceedToGenerate = useCallback(() => {
    setCurrentScreen('loading');
  }, []);

  // Screen 5 -> Screen 6 (Generation Complete)
  const handleGenerationComplete = useCallback((finalImage: string, qrUrl: string) => {
    setGeneratedImage(finalImage);
    setQrCodeUrl(qrUrl);
    setIsGenerating(false);
    setCurrentScreen('result');
  }, []);

  // Auto-reset timer when on Result Screen
  useEffect(() => {
    if (currentScreen === 'result') {
      idleTimerRef.current = setTimeout(() => {
        console.log('[Photobooth Flow] Result screen idle timeout reached. Resetting to Splash.');
        resetToSplash();
      }, resultIdleTimeoutSeconds * 1000);

      return () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      };
    }
  }, [currentScreen, resultIdleTimeoutSeconds, resetToSplash]);

  return {
    currentScreen,
    capturedImage,
    generatedImage,
    qrCodeUrl,
    selectedPreset,
    isGenerating,
    error,
    setIsGenerating,
    setError,
    actions: {
      handleStart,
      handleSelectPreset,
      handlePhotoCaptured,
      handleRetake,
      handleProceedToGenerate,
      handleGenerationComplete,
      resetToSplash,
    },
    config: {
      previewAutoProceedSeconds,
      resultIdleTimeoutSeconds,
      hasPresetsScreen,
    },
  };
}
