<script>
  import { onMount } from 'svelte';
  import { PUBLIC_CAMERA_API_URL } from '$env/static/public';

  let healthState = 'checking';
  let healthMessage = 'Connecting to camera service';
  let cameras = [];
  let camera = null;
  let saveState = 'idle';
  let saveMessage = '';
  let streamKey = 0;

  $: streamUrl = `${PUBLIC_CAMERA_API_URL}/stream.mjpg?reload=${streamKey}`;

  async function refresh() {
    try {
      const [healthResponse, configResponse] = await Promise.all([
        fetch(`${PUBLIC_CAMERA_API_URL}/health`, { cache: 'no-store' }),
        fetch(`${PUBLIC_CAMERA_API_URL}/config`, { cache: 'no-store' })
      ]);
      const health = await healthResponse.json();
      const config = await configResponse.json();

      healthState = health.state ?? 'unknown';
      healthMessage = health.message ?? 'No status message';
      cameras = health.cameras ?? [];
      camera = { ...(config.cameras?.[0] ?? defaultCamera()) };
    } catch (error) {
      healthState = 'offline';
      healthMessage = error instanceof Error ? error.message : 'Camera service is offline';
      if (!camera) {
        camera = defaultCamera();
      }
    }
  }

  async function saveConfig() {
    if (!camera) {
      return;
    }

    saveState = 'saving';
    saveMessage = 'Saving camera settings';
    const payload = {
      cameras: [
        {
          ...camera,
          width: Number(camera.width),
          height: Number(camera.height),
          fps: Number(camera.fps),
          jpeg_quality: Number(camera.jpeg_quality)
        }
      ]
    };

    try {
      const response = await fetch(`${PUBLIC_CAMERA_API_URL}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      saveState = 'saved';
      saveMessage = 'Settings applied';
      streamKey += 1;
      await refresh();
    } catch (error) {
      saveState = 'error';
      saveMessage = error instanceof Error ? error.message : 'Unable to save settings';
    }
  }

  function reloadStream() {
    streamKey += 1;
  }

  function defaultCamera() {
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

  onMount(() => {
    refresh();
    const interval = window.setInterval(refresh, 3000);
    return () => window.clearInterval(interval);
  });
</script>

<svelte:head>
  <title>OpenClaw Camera Preview</title>
</svelte:head>

<main class="min-h-screen bg-zinc-950 text-zinc-100">
  <header class="border-b border-zinc-800 bg-zinc-900">
    <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
      <div>
        <h1 class="text-xl font-semibold tracking-normal">{camera?.label ?? 'Camera Preview'}</h1>
        <p class="mt-1 text-sm text-zinc-400">{PUBLIC_CAMERA_API_URL}</p>
      </div>
      <div class="flex items-center gap-3">
        <span
          class="h-3 w-3 rounded-full"
          class:bg-emerald-400={healthState === 'ready'}
          class:bg-amber-400={healthState === 'checking' || healthState === 'unknown'}
          class:bg-red-500={healthState === 'error' || healthState === 'offline'}
        ></span>
        <span class="text-sm text-zinc-300">{healthState}</span>
        <button
          class="rounded border border-zinc-700 px-3 py-2 text-sm hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          type="button"
          on:click={reloadStream}
        >
          Reload
        </button>
      </div>
    </div>
  </header>

  <section class="mx-auto grid max-w-7xl gap-4 px-6 py-5 lg:grid-cols-[1fr_360px]">
    <div class="overflow-hidden rounded border border-zinc-800 bg-black">
      {#key streamKey}
        <img
          class="block aspect-video h-auto max-h-[calc(100vh-150px)] w-full object-contain"
          src={streamUrl}
          alt="Live camera preview"
        />
      {/key}
    </div>

    <aside class="rounded border border-zinc-800 bg-zinc-900 p-4">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-base font-medium">Camera Settings</h2>
        <span class="text-xs text-zinc-400">{cameras[0]?.inspection_state ?? 'inspection disabled'}</span>
      </div>

      <p class="mt-3 text-sm leading-6 text-zinc-300">{healthMessage}</p>
      {#if cameras[0]?.last_error}
        <p class="mt-3 rounded border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-100">
          {cameras[0].last_error}
        </p>
      {/if}
      {#if cameras[0]?.inspection_last_error}
        <p class="mt-3 rounded border border-amber-900 bg-amber-950 px-3 py-2 text-sm text-amber-100">
          {cameras[0].inspection_last_error}
        </p>
      {/if}

      {#if camera}
        <form class="mt-5 space-y-4" on:submit|preventDefault={saveConfig}>
          <label class="block text-sm">
            <span class="text-zinc-400">Camera ID</span>
            <input
              class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-cyan-500 focus:outline-none"
              bind:value={camera.id}
            />
          </label>

          <label class="block text-sm">
            <span class="text-zinc-400">Camera label</span>
            <input
              class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-cyan-500 focus:outline-none"
              bind:value={camera.label}
            />
          </label>

          <label class="block text-sm">
            <span class="text-zinc-400">Device path</span>
            <input
              class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-cyan-500 focus:outline-none"
              bind:value={camera.device}
            />
          </label>

          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm">
              <span class="text-zinc-400">Width</span>
              <input
                type="number"
                min="1"
                class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-cyan-500 focus:outline-none"
                bind:value={camera.width}
              />
            </label>
            <label class="block text-sm">
              <span class="text-zinc-400">Height</span>
              <input
                type="number"
                min="1"
                class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-cyan-500 focus:outline-none"
                bind:value={camera.height}
              />
            </label>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm">
              <span class="text-zinc-400">FPS</span>
              <input
                type="number"
                min="1"
                step="0.1"
                class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-cyan-500 focus:outline-none"
                bind:value={camera.fps}
              />
            </label>
            <label class="block text-sm">
              <span class="text-zinc-400">JPEG quality</span>
              <input
                type="number"
                min="1"
                max="100"
                class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-cyan-500 focus:outline-none"
                bind:value={camera.jpeg_quality}
              />
            </label>
          </div>

          <label class="flex items-center gap-3 text-sm text-zinc-300">
            <input class="h-4 w-4 accent-cyan-500" type="checkbox" bind:checked={camera.enabled} />
            Camera enabled
          </label>

          <label class="flex items-center gap-3 text-sm text-zinc-300">
            <input
              class="h-4 w-4 accent-cyan-500"
              type="checkbox"
              bind:checked={camera.inspection_enabled}
            />
            Stream to inspection service
          </label>

          <label class="block text-sm">
            <span class="text-zinc-400">Inspection target</span>
            <input
              placeholder="192.168.1.50:50052"
              class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-cyan-500 focus:outline-none"
              bind:value={camera.inspection_service_target}
            />
          </label>

          <button
            class="w-full rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            type="submit"
          >
            Apply Settings
          </button>

          {#if saveMessage}
            <p
              class="text-sm"
              class:text-zinc-400={saveState === 'saving'}
              class:text-emerald-300={saveState === 'saved'}
              class:text-red-300={saveState === 'error'}
            >
              {saveMessage}
            </p>
          {/if}
        </form>
      {/if}
    </aside>
  </section>
</main>
