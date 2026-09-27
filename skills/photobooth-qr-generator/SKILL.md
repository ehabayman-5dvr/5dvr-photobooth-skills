---
name: photobooth-qr-generator
description: >-
  Generates high-resolution QR codes for AI photobooth applications with branded viewer
  redirect URLs, resilient fallback endpoints, and UI display integration.
---

# Photobooth QR Code Generator Skill

This skill guides the implementation, customization, and troubleshooting of QR code generation in photobooth applications. It provides the standard 5DVR pattern for generating QR codes that link participants directly to mobile-friendly photo viewers and downloads.

## Architecture & Workflow

```
[Captured/Generated Photo]
         │
         ▼
[Cloudinary / Storage Upload] ──► Retrieves Secure Hosted Image URL
         │
         ▼
[Target URL Composition] ──────► https://photobooth-viewer.vercel.app/?url={ENCODED_IMAGE_URL}&branded=true
         │
         ├──► Primary: Client-side `qrcode` package (toDataURL / canvas)
         │       │ (If successful)
         │       └──► Returns Base64 PNG Data URL
         │
         └──► Fallback: Remote QR Generator (api.qrserver.com)
                 │ (If client generation encounters error)
                 └──► Returns resilient fallback HTTPS image URL
         │
         ▼
[ResultScreen UI Component] ──► Displays QR code with Cyber/Event HUD frame, download & countdown
```

## Standard Target URL Pattern

The generated QR code must point to the mobile photobooth viewer, passing the hosted image URL as an encoded query parameter:

```typescript
const viewerBaseUrl = 'https://photobooth-viewer.vercel.app/?url=';
const targetViewerUrl = `${viewerBaseUrl}${encodeURIComponent(secureImageUrl)}&branded=true`;
```

- `url`: URI-encoded HTTPS link to the hosted photo on Cloudinary or S3.
- `branded=true`: Instructs the viewer to render event branding, social sharing buttons, and save dialogs.

## Core Implementation (`qrService.ts`)

```typescript
import QRCode from 'qrcode';

export interface QrCodeOptions {
  width?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
}

/**
 * Generates a QR code data URL pointing to the photobooth viewer with fallback.
 */
export async function generatePhotoboothQrCode(
  imageUrl: string,
  options: QrCodeOptions = {}
): Promise<string> {
  const {
    width = 512,
    margin = 2,
    darkColor = '#030712',
    lightColor = '#FFFFFF',
  } = options;

  const viewerBaseUrl = 'https://photobooth-viewer.vercel.app/?url=';
  const targetViewerUrl = `${viewerBaseUrl}${encodeURIComponent(imageUrl)}&branded=true`;

  try {
    const qrDataUrl = await QRCode.toDataURL(targetViewerUrl, {
      width,
      margin,
      color: {
        dark: darkColor,
        light: lightColor,
      },
      errorCorrectionLevel: 'M',
    });
    return qrDataUrl;
  } catch (error) {
    console.warn('[QR Generator] Local QRCode generation failed, falling back to remote API:', error);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${width}x${width}&margin=${margin}&data=${encodeURIComponent(
      targetViewerUrl
    )}`;
  }
}
```

## Dependencies

Install `qrcode` and its type definitions:
```bash
npm install qrcode
npm install -D @types/qrcode
```

## Best Practices

1. **Resolution & Contrast**: Use at least 512x512px resolution with high contrast (dark foreground against pure white `#FFFFFF` or very light background) to ensure rapid scanning by iOS Camera and Android Lens even on glossy kiosks or angled monitors.
2. **Error Correction Level**: Use `'M'` (Medium, 15% recovery) or `'Q'` (Quartile, 25% recovery). Avoid `'L'` in kiosk environments with ambient lighting or glare.
3. **Encoding Verification**: Always use `encodeURIComponent()` on the image URL before appending it to `?url=`. Unencoded `&` or `/` characters will truncate the image link.
4. **Auto-Reset Integration**: In the UI screen showing the QR code, always implement an idle countdown timer (e.g., 60-90 seconds) with an explicit "Done / Finish" button that resets the photobooth to the attract screen.
