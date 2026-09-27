import QRCode from 'qrcode';

export interface QrCodeOptions {
  width?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export interface PhotoboothQrResult {
  qrCodeUrl: string;
  targetViewerUrl: string;
  isFallback: boolean;
}

const DEFAULT_VIEWER_BASE_URL = 'https://photobooth-viewer.vercel.app/?url=';

/**
 * Builds the standard mobile photobooth viewer link
 */
export function buildViewerUrl(imageUrl: string, branded: boolean = true, customViewerBase?: string): string {
  const base = customViewerBase || DEFAULT_VIEWER_BASE_URL;
  return `${base}${encodeURIComponent(imageUrl)}${branded ? '&branded=true' : ''}`;
}

/**
 * Generates high-resolution QR code for photobooth photo sharing
 */
export async function generatePhotoboothQr(
  imageUrl: string,
  options: QrCodeOptions = {}
): Promise<PhotoboothQrResult> {
  const {
    width = 512,
    margin = 2,
    darkColor = '#030712',
    lightColor = '#FFFFFF',
    errorCorrectionLevel = 'M',
  } = options;

  const targetViewerUrl = buildViewerUrl(imageUrl, true);

  try {
    const qrCodeUrl = await QRCode.toDataURL(targetViewerUrl, {
      width,
      margin,
      color: {
        dark: darkColor,
        light: lightColor,
      },
      errorCorrectionLevel,
    });

    return {
      qrCodeUrl,
      targetViewerUrl,
      isFallback: false,
    };
  } catch (error) {
    console.warn('[QR Generator] QRCode.toDataURL error, utilizing fallback endpoint:', error);
    const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${width}x${width}&margin=${margin}&data=${encodeURIComponent(
      targetViewerUrl
    )}`;

    return {
      qrCodeUrl: fallbackUrl,
      targetViewerUrl,
      isFallback: true,
    };
  }
}
