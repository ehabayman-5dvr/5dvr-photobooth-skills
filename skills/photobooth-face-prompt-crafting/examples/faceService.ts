import '@tensorflow/tfjs';
import * as faceapi from 'face-api.js';

export interface FaceDetectionResult {
  maleCount: number;
  femaleCount: number;
  childCount: number;
  totalPeople: number;
}

const LOCAL_MODEL_URL = './models';
const FALLBACK_MODEL_URL = 'https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js@0.22.2/weights';

let modelLoadPromise: Promise<boolean> | null = null;
let backendPromise: Promise<void> | null = null;
let envPatched = false;
let tfFetchPatched = false;

// Patch face-api.js environment with browser implementations
const ensureEnvPatched = () => {
  if (envPatched) return;
  const nativeFetch = window.fetch ? window.fetch.bind(window) : undefined;

  try {
    faceapi.env.monkeyPatch({
      fetch: nativeFetch,
      Canvas: HTMLCanvasElement,
      Image: HTMLImageElement,
      createCanvasElement: () => document.createElement('canvas'),
      createImageElement: () => document.createElement('img'),
    });
    envPatched = true;
    console.log('✅ face-api.js environment patched');
  } catch (error) {
    console.warn('Failed to monkey patch face-api.js environment.', error);
  }
};

// Ensure TensorFlow uses native fetch
const ensureTfFetchPatched = () => {
  if (tfFetchPatched) return;
  const nativeFetch = window.fetch ? window.fetch.bind(window) : undefined;
  if (!nativeFetch) return;

  try {
    const platformFetch = faceapi?.tf?.env().platform?.fetch;
    if (platformFetch !== nativeFetch) {
      faceapi.tf.env().platform.fetch = nativeFetch;
    }
    tfFetchPatched = true;
  } catch (error) {
    console.warn('Failed to override TensorFlow fetch implementation.', error);
  }
};

// Initialize TensorFlow backend with WebGL and CPU fallback
const ensureBackendReady = async (): Promise<void> => {
  ensureTfFetchPatched();

  if (!backendPromise) {
    backendPromise = (async () => {
      try {
        await faceapi.tf.setBackend('webgl');
        await faceapi.tf.ready();
        console.log('✅ TensorFlow.js WebGL backend initialized');
      } catch (error) {
        console.warn('WebGL backend init failed, falling back to CPU backend', error);
        await faceapi.tf.setBackend('cpu');
        await faceapi.tf.ready();
        console.log('✅ TensorFlow.js CPU backend initialized');
      }
    })().catch((error) => {
      backendPromise = null;
      throw error;
    });
  }

  return backendPromise;
};

// Helper to check if a URL returns JSON rather than HTML 404 fallback
const verifyModelUrl = async (baseUrl: string): Promise<boolean> => {
  try {
    const testUrl = `${baseUrl}/ssd_mobilenetv1_model-weights_manifest.json`;
    const response = await fetch(testUrl, { method: 'HEAD' });
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('text/html')) {
      return false;
    }
    return response.ok;
  } catch (e) {
    return false;
  }
};

export const loadFaceApiModels = async (): Promise<boolean> => {
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    ensureEnvPatched();
    await ensureBackendReady();

    const loadFromSource = async (baseUrl: string) => {
      const isAvailable = await verifyModelUrl(baseUrl);
      if (!isAvailable) {
        throw new Error(`Model manifest not found at ${baseUrl}`);
      }

      await faceapi.nets.ssdMobilenetv1.loadFromUri(baseUrl);

      try {
        await faceapi.nets.ageGenderNet.loadFromUri(baseUrl);
      } catch (e) {
        console.warn('AgeGender model failed to load (Optional)');
      }

      try {
        await faceapi.nets.faceLandmark68Net.loadFromUri(baseUrl);
      } catch (e) {
        console.warn('FaceLandmark model failed to load (Optional)');
      }
    };

    try {
      await loadFromSource(LOCAL_MODEL_URL);
      console.log('✅ Models loaded from LOCAL source.');
      return true;
    } catch (localError) {
      console.warn('Local model load failed, falling back to CDN:', localError);
      try {
        await loadFromSource(FALLBACK_MODEL_URL);
        console.log('✅ Models loaded from CDN.');
        return true;
      } catch (cdnError) {
        console.error('❌ CRITICAL: All model sources failed.', cdnError);
        return false;
      }
    }
  })();

  return modelLoadPromise;
};

export const detectFaces = async (
  videoElement: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  isLoaded: boolean
): Promise<FaceDetectionResult> => {
  const fallback: FaceDetectionResult = { maleCount: 0, femaleCount: 1, childCount: 0, totalPeople: 1 };
  if (!isLoaded) return fallback;

  try {
    // @ts-ignore
    if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
      return fallback;
    }

    const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
    let task: any = faceapi.detectAllFaces(videoElement, options);

    // @ts-ignore
    const hasLandmarks = !!faceapi.nets.faceLandmark68Net.params;
    // @ts-ignore
    const hasGender = !!faceapi.nets.ageGenderNet.params;

    if (hasLandmarks) {
      task = task.withFaceLandmarks();
      if (hasGender) {
        task = task.withAgeAndGender();
      }
    }

    const results = await task;
    let maleCount = 0;
    let femaleCount = 0;
    let childCount = 0;

    results.forEach((res: any) => {
      const gender = res.gender || 'unknown';
      const age = res.age ? Math.round(res.age) : 30;

      if (age < 15) {
        childCount++;
      } else {
        if (gender === 'male') maleCount++;
        else femaleCount++;
      }
    });

    return { maleCount, femaleCount, childCount, totalPeople: results.length };
  } catch (error) {
    return fallback;
  }
};
