<script>
  import { onMount } from 'svelte';
  import { PUBLIC_CAMERA_API_URL } from '$env/static/public';
  import HeroIcon from '$lib/HeroIcon.svelte';

  let healthState = 'checking';
  let healthMessage = 'Connecting to camera service';
  let cameras = [];
  let camera = null;
  let formDirty = false;
  let healthLoading = false;
  let saveState = 'idle';
  let saveMessage = '';
  let captureState = 'idle';
  let captureMessage = '';
  let capturePath = '';
  let streamKey = 0;
  let theme = 'dark';

  $: streamUrl = `${PUBLIC_CAMERA_API_URL}/stream.mjpg?reload=${streamKey}`;
  $: themeClass = theme === 'light' ? 'theme-light' : 'theme-dark';
  $: currentCameraStatus = cameras[0] ?? null;
  $: streamStatusText = formatStreamStatus(currentCameraStatus);
  $: streamIsStalled = currentCameraStatus?.health === 'stale' || currentCameraStatus?.health === 'not_streaming';

  async function refreshHealth() {
    healthLoading = true;
    try {
      const healthResponse = await fetch(`${PUBLIC_CAMERA_API_URL}/health`, { cache: 'no-store' });
      const health = await healthResponse.json();

      healthState = health.state ?? 'unknown';
      healthMessage = health.message ?? 'No status message';
      cameras = health.cameras ?? [];
    } catch (error) {
      healthState = 'offline';
      healthMessage = error instanceof Error ? error.message : 'Camera service is offline';
    } finally {
      healthLoading = false;
    }
  }

  async function loadConfig({ force = false } = {}) {
    if (formDirty && !force) {
      return;
    }
    try {
      const configResponse = await fetch(`${PUBLIC_CAMERA_API_URL}/config`, { cache: 'no-store' });
      const config = await configResponse.json();
      camera = { ...(config.cameras?.[0] ?? defaultCamera()) };
      formDirty = false;
    } catch {
      if (!camera) {
        camera = defaultCamera();
      }
    }
  }

  async function refreshAll() {
    await Promise.all([refreshHealth(), loadConfig()]);
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
      formDirty = false;
      streamKey += 1;
      await refreshAll();
    } catch (error) {
      saveState = 'error';
      saveMessage = error instanceof Error ? error.message : 'Unable to save settings';
    }
  }

  function reloadStream() {
    streamKey += 1;
  }

  async function captureImage() {
    captureState = 'capturing';
    captureMessage = 'Capturing latest frame';
    capturePath = '';

    try {
      const params = new URLSearchParams({
        procedure: 'gripper-detection',
        version: '0.1.0',
        bucket: 'manual'
      });
      const response = await fetch(`${PUBLIC_CAMERA_API_URL}/capture?${params.toString()}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      captureState = 'captured';
      capturePath = result.path ?? '';
      captureMessage = result.path ? `Saved ${result.path}` : 'Image captured';
      await refreshHealth();
    } catch (error) {
      captureState = 'error';
      captureMessage = error instanceof Error ? error.message : 'Unable to capture image';
    }
  }

  function markDirty() {
    formDirty = true;
    if (saveState === 'saved') {
      saveState = 'idle';
      saveMessage = '';
    }
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('dcs-lxdg-theme', theme);
  }

  function formatStreamStatus(status) {
    if (!status) {
      return 'No camera status received yet';
    }

    if (status.latest_frame_index === null || status.latest_frame_index === undefined) {
      return `Camera ${status.health}`;
    }

    const age = Number(status.latest_frame_age_seconds ?? 0).toFixed(1);
    return `Frame #${status.latest_frame_index} · ${age}s old · ${status.health}`;
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
    theme = localStorage.getItem('dcs-lxdg-theme') ?? 'dark';
    refreshAll();
    const interval = window.setInterval(refreshHealth, 3000);
    return () => window.clearInterval(interval);
  });
</script>

<svelte:head>
  <title>DCS-LXDG Camera Preview</title>
</svelte:head>

<main class={`oc-page ${themeClass}`}>
  <header class="oc-header">
    <div class="oc-header-inner">
      <div>
        <h1 class="oc-title flex items-center gap-2">
          <HeroIcon name="video-camera" className="h-6 w-6 text-cyan-400" />
          DCS-LXDG {camera?.label ?? 'Camera Preview'}
        </h1>
        <p class="oc-muted mt-1 text-sm">{PUBLIC_CAMERA_API_URL}</p>
      </div>
      <div class="flex items-center gap-3">
        <span
          class="oc-status-dot"
          class:bg-emerald-400={healthState === 'ready'}
          class:bg-amber-400={healthState === 'checking' || healthState === 'unknown' || healthState === 'degraded'}
          class:bg-red-500={healthState === 'error' || healthState === 'offline'}
        ></span>
        <span class="text-sm text-slate-300">{healthState}</span>
        {#if healthLoading}
          <span class="oc-spinner"></span>
        {/if}
        <button class="oc-button" type="button" on:click={toggleTheme} aria-label="Toggle theme">
          {#if theme === 'dark'}
            <HeroIcon name="sun" className="h-4 w-4" />
          {:else}
            <HeroIcon name="moon" className="h-4 w-4" />
          {/if}
        </button>
        <button
          class="oc-button"
          type="button"
          on:click={captureImage}
          disabled={captureState === 'capturing'}
        >
          {#if captureState === 'capturing'}
            <span class="oc-spinner"></span>
          {:else}
            <HeroIcon name="camera" className="h-4 w-4" />
          {/if}
          {captureState === 'capturing' ? 'Capturing' : 'Capture Image'}
        </button>
        <button
          class="oc-button"
          type="button"
          on:click={reloadStream}
        >
          <HeroIcon name="arrow-path" className="h-4 w-4" />
          Reload
        </button>
      </div>
    </div>
  </header>

  <section class="mx-auto grid max-w-7xl gap-4 px-6 py-5 lg:grid-cols-[1fr_360px]">
    <div class="overflow-hidden rounded border border-zinc-800 bg-black">
      <div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2 text-xs text-slate-300">
        <span>{streamStatusText}</span>
        {#if streamIsStalled}
          <span class="rounded bg-amber-500/20 px-2 py-1 text-amber-200">stream stale</span>
        {/if}
      </div>
      {#if captureMessage}
        <div
          class="border-b border-zinc-800 px-3 py-2 text-xs"
          class:text-slate-300={captureState === 'capturing'}
          class:text-emerald-300={captureState === 'captured'}
          class:text-red-300={captureState === 'error'}
          title={capturePath}
        >
          {captureMessage}
        </div>
      {/if}
      {#key streamKey}
        <img
          class="block aspect-video h-auto max-h-[calc(100vh-150px)] w-full object-contain"
          src={streamUrl}
          alt="Live camera preview"
        />
      {/key}
    </div>

    <aside class="oc-panel">
      <div class="flex items-center justify-between gap-3">
        <h2 class="flex items-center gap-2 text-base font-medium">
          <HeroIcon name="cog-6-tooth" className="h-5 w-5 text-cyan-400" />
          Camera Settings
        </h2>
        <span class="text-xs text-slate-400">{cameras[0]?.inspection_state ?? 'inspection disabled'}</span>
      </div>

      <p class="mt-3 flex items-center gap-2 text-sm leading-6 text-slate-300">
        <HeroIcon name="signal" className="h-4 w-4 text-cyan-400" />
        {healthMessage}
      </p>
      {#if formDirty}
        <p class="oc-alert-warning mt-3">You have unsaved camera settings.</p>
      {/if}
      {#if cameras[0]?.last_error}
        <p class="oc-alert-error mt-3">
          {cameras[0].last_error}
        </p>
      {/if}
      {#if cameras[0]?.inspection_last_error}
        <p class="oc-alert-warning mt-3">
          {cameras[0].inspection_last_error}
        </p>
      {/if}

      {#if camera}
        <form class="mt-5 space-y-4" on:submit|preventDefault={saveConfig}>
          <label class="block text-sm">
            <span class="text-slate-400">Camera ID</span>
            <input
              class="oc-input"
              bind:value={camera.id}
              on:input={markDirty}
            />
          </label>

          <label class="block text-sm">
            <span class="text-slate-400">Camera label</span>
            <input
              class="oc-input"
              bind:value={camera.label}
              on:input={markDirty}
            />
          </label>

          <label class="block text-sm">
            <span class="text-slate-400">Device path</span>
            <input
              class="oc-input"
              bind:value={camera.device}
              on:input={markDirty}
            />
          </label>

          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm">
              <span class="text-slate-400">Width</span>
              <input
                type="number"
                min="1"
                class="oc-input"
                bind:value={camera.width}
                on:input={markDirty}
              />
            </label>
            <label class="block text-sm">
              <span class="text-slate-400">Height</span>
              <input
                type="number"
                min="1"
                class="oc-input"
                bind:value={camera.height}
                on:input={markDirty}
              />
            </label>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm">
              <span class="text-slate-400">FPS</span>
              <input
                type="number"
                min="1"
                step="0.1"
                class="oc-input"
                bind:value={camera.fps}
                on:input={markDirty}
              />
            </label>
            <label class="block text-sm">
              <span class="text-slate-400">JPEG quality</span>
              <input
                type="number"
                min="1"
                max="100"
                class="oc-input"
                bind:value={camera.jpeg_quality}
                on:input={markDirty}
              />
            </label>
          </div>

          <label class="oc-checkbox-label">
            <input class="oc-checkbox" type="checkbox" bind:checked={camera.enabled} on:change={markDirty} />
            Camera enabled
          </label>

          <label class="oc-checkbox-label">
            <input
              class="oc-checkbox"
              type="checkbox"
              bind:checked={camera.inspection_enabled}
              on:change={markDirty}
            />
            Stream to inspection service
          </label>

          <label class="block text-sm">
            <span class="text-slate-400">Inspection target</span>
            <input
              placeholder="192.168.1.50:50052"
              class="oc-input"
              bind:value={camera.inspection_service_target}
              on:input={markDirty}
            />
          </label>

          <button
            class="oc-button-primary w-full"
            type="submit"
            disabled={saveState === 'saving'}
          >
            {#if saveState === 'saving'}
              <span class="h-4 w-4 animate-spin rounded-full border-2 border-cyan-800 border-t-white"></span>
            {:else}
              <HeroIcon name="check-circle" className="h-4 w-4" />
            {/if}
            {saveState === 'saving' ? 'Applying Settings' : 'Apply Settings'}
          </button>

          {#if saveMessage}
            <p
              class="text-sm"
              class:text-slate-400={saveState === 'saving'}
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
