const DEFAULT_CAMERA_API_URL = 'http://localhost:8080';

export function normalizeCameraApiUrl(value) {
  const normalized = String(value ?? '').trim().replace(/\/+$/, '');
  return normalized || DEFAULT_CAMERA_API_URL;
}

export function defaultCamera() {
  return {
    id: 'camera-0',
    label: 'Camera 0',
    device: '/dev/video0',
    width: 640,
    height: 480,
    fps: 10,
    jpeg_quality: 85,
    enabled: true,
    inspection_enabled: false,
    inspection_service_target: ''
  };
}

export function buildCameraConfigPayload(camera) {
  if (!camera || typeof camera !== 'object') {
    throw new Error('Camera settings are unavailable');
  }

  const id = requiredText(camera.id, 'Camera ID');
  const device = requiredText(camera.device, 'Device path');
  const width = positiveNumber(camera.width, 'Width', { integer: true });
  const height = positiveNumber(camera.height, 'Height', { integer: true });
  const fps = positiveNumber(camera.fps, 'FPS');
  const jpegQuality = positiveNumber(camera.jpeg_quality, 'JPEG quality', { integer: true });

  if (jpegQuality > 100) {
    throw new Error('JPEG quality must be between 1 and 100');
  }
  if (typeof camera.enabled !== 'boolean' || typeof camera.inspection_enabled !== 'boolean') {
    throw new Error('Camera enable settings must be true or false');
  }

  return {
    cameras: [
      {
        ...camera,
        id,
        label: optionalText(camera.label, 'Camera label'),
        device,
        width,
        height,
        fps,
        jpeg_quality: jpegQuality,
        enabled: camera.enabled,
        inspection_enabled: camera.inspection_enabled,
        inspection_service_target: optionalText(
          camera.inspection_service_target,
          'Inspection target'
        )
      }
    ]
  };
}

export async function fetchCameraHealth(fetcher, baseUrl) {
  return requestJson(fetcher, `${normalizeCameraApiUrl(baseUrl)}/health`, {
    cache: 'no-store'
  });
}

export async function fetchCameraConfig(fetcher, baseUrl) {
  return requestJson(fetcher, `${normalizeCameraApiUrl(baseUrl)}/config`, {
    cache: 'no-store'
  });
}

export async function saveCameraConfig(fetcher, baseUrl, camera) {
  const payload = buildCameraConfigPayload(camera);
  return requestJson(fetcher, `${normalizeCameraApiUrl(baseUrl)}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function captureLatestImage(
  fetcher,
  baseUrl,
  { procedure = 'gripper-detection', version = '0.1.0', bucket = 'manual' } = {}
) {
  const params = new URLSearchParams({
    procedure: safeCaptureMetadata(procedure, 'Procedure'),
    version: safeCaptureMetadata(version, 'Version'),
    bucket: safeCaptureMetadata(bucket, 'Bucket')
  });
  return requestJson(fetcher, `${normalizeCameraApiUrl(baseUrl)}/capture?${params}`, {
    method: 'POST'
  });
}

export function buildStreamUrl(baseUrl, reloadKey) {
  const params = new URLSearchParams({ reload: String(reloadKey) });
  return `${normalizeCameraApiUrl(baseUrl)}/stream.mjpg?${params}`;
}

async function requestJson(fetcher, url, options) {
  if (typeof fetcher !== 'function') {
    throw new Error('A fetch implementation is required');
  }

  const response = await fetcher(url, options);
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail || `Camera service request failed (${response.status})`);
  }
  return response.json();
}

function requiredText(value, label) {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be text`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

function optionalText(value, label) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new Error(`${label} must be text`);
  }
  return value.trim();
}

function positiveNumber(value, label, { integer = false } = {}) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new Error(`${label} must be a number`);
  }
  if (typeof value === 'string' && !value.trim()) {
    throw new Error(`${label} must be greater than zero`);
  }

  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error(`${label} must be greater than zero`);
  }
  if (integer && !Number.isInteger(normalized)) {
    throw new Error(`${label} must be a whole number`);
  }
  return normalized;
}

function safeCaptureMetadata(value, label) {
  const normalized = requiredText(value, label);
  if (!/^[A-Za-z0-9_.-]+$/.test(normalized)) {
    throw new Error(`${label} contains unsupported characters`);
  }
  return normalized;
}
