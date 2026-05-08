# Camera Preview UI

Local camera preview application for the vision PC.

The UI displays the MJPEG stream exposed by `image-streaming-service` and does not talk directly to camera hardware. This lets operators see the camera feed without starting the inspection service.

## Configuration

- `PUBLIC_CAMERA_API_URL`, default `http://localhost:8080`

## Local Start

```bash
bun install
bun run dev --host 0.0.0.0
```

## Docker

Use the parent `vision/docker-compose.yml`:

```bash
cd ..
cp .env.example .env
docker compose --profile camera-preview up --build
```

This starts two camera streaming services and two preview UIs:

- Camera 1 stream API: `http://localhost:10001`
- Camera 2 stream API: `http://localhost:10002`
- Camera 1 UI: `http://localhost:10081`
- Camera 2 UI: `http://localhost:10082`

Each UI talks to one single-camera image streaming service. The inspection service is behind the separate `inspection` Compose profile.

To run the camera preview stack and the local development inspection service together:

```bash
docker compose --profile camera-preview --profile inspection up --build
```

If you open the UIs from another machine, set `CAMERA_1_PUBLIC_API_URL` and `CAMERA_2_PUBLIC_API_URL` in `vision/.env` to the Ubuntu camera PC address, for example `http://192.168.1.20:10001` and `http://192.168.1.20:10002`.
