import { describe, expect, test } from 'bun:test';

import {
  buildCameraConfigPayload,
  buildStreamUrl,
  captureLatestImage,
  defaultCamera,
  fetchCameraHealth,
  normalizeCameraApiUrl,
  saveCameraConfig
} from './camera-api.js';

describe('camera configuration boundary', () => {
  test('normalizes the mutable settings sent to the camera service', () => {
    const payload = buildCameraConfigPayload({
      ...defaultCamera(),
      id: ' camera-east ',
      label: ' Inspection camera ',
      device: ' /dev/video2 ',
      width: '1280',
      height: '720',
      fps: '12.5',
      jpeg_quality: '92',
      inspection_enabled: true,
      inspection_service_target: ' inspection:50052 '
    });

    expect(payload).toEqual({
      cameras: [
        {
          ...defaultCamera(),
          id: 'camera-east',
          label: 'Inspection camera',
          device: '/dev/video2',
          width: 1280,
          height: 720,
          fps: 12.5,
          jpeg_quality: 92,
          inspection_enabled: true,
          inspection_service_target: 'inspection:50052'
        }
      ]
    });
  });

  test.each([
    ['blank width', { width: '' }, 'Width must be greater than zero'],
    ['zero FPS', { fps: 0 }, 'FPS must be greater than zero'],
    ['fractional height', { height: 480.5 }, 'Height must be a whole number'],
    ['excessive JPEG quality', { jpeg_quality: 101 }, 'JPEG quality must be between 1 and 100'],
    ['blank device', { device: '  ' }, 'Device path is required'],
    ['non-numeric width', { width: true }, 'Width must be a number'],
    ['string enable state', { enabled: 'false' }, 'Camera enable settings must be true or false']
  ])('rejects %s before performing a production mutation', async (_name, override, message) => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return jsonResponse({});
    };

    await expect(saveCameraConfig(fetcher, 'http://camera-api', {
      ...defaultCamera(),
      ...override
    })).rejects.toThrow(message);
    expect(calls).toBe(0);
  });

  test('sends one validated JSON mutation to the configured service', async () => {
    const calls = [];
    const fetcher = async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ cameras: [{ id: 'camera-0' }] });
    };

    await saveCameraConfig(fetcher, 'http://camera-api/', defaultCamera());

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://camera-api/config');
    expect(calls[0].options.method).toBe('PUT');
    expect(calls[0].options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(calls[0].options.body)).toEqual({ cameras: [defaultCamera()] });
  });

  test('surfaces a rejected mutation response without retrying it', async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return new Response('camera device is busy', { status: 409 });
    };

    await expect(saveCameraConfig(fetcher, 'http://camera-api', defaultCamera()))
      .rejects.toThrow('camera device is busy');
    expect(calls).toBe(1);
  });
});

describe('read and capture requests', () => {
  test('health checks are explicit no-store reads', async () => {
    const calls = [];
    const fetcher = async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ state: 'ready', cameras: [] });
    };

    await expect(fetchCameraHealth(fetcher, 'http://camera-api/'))
      .resolves.toEqual({ state: 'ready', cameras: [] });
    expect(calls).toEqual([
      { url: 'http://camera-api/health', options: { cache: 'no-store' } }
    ]);
  });

  test('valid capture metadata is sent in one explicit mutation', async () => {
    const calls = [];
    const fetcher = async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ path: '/captures/latest.jpg' });
    };

    await captureLatestImage(fetcher, 'http://camera-api', {
      procedure: 'gripper-detection',
      version: 'v1.2.3',
      bucket: 'manual_review'
    });

    expect(calls).toEqual([
      {
        url: 'http://camera-api/capture?procedure=gripper-detection&version=v1.2.3&bucket=manual_review',
        options: { method: 'POST' }
      }
    ]);
  });

  test('invalid capture metadata is rejected before a mutation', async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return jsonResponse({});
    };

    await expect(captureLatestImage(fetcher, 'http://camera-api', {
      bucket: '../production'
    })).rejects.toThrow('Bucket contains unsupported characters');
    expect(calls).toBe(0);
  });

  test('stream URLs and empty environment values use a safe deterministic base', () => {
    expect(normalizeCameraApiUrl('  ')).toBe('http://localhost:8080');
    expect(buildStreamUrl('http://camera-api/', 3)).toBe(
      'http://camera-api/stream.mjpg?reload=3'
    );
  });
});

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
}
