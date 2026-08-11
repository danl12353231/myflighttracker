<script lang="ts">
  import createGlobe from 'cobe';
  import type { Marker } from 'cobe';
  import { mode } from 'mode-watcher';
  import { onMount } from 'svelte';
  import { spring } from 'svelte/motion';

  import { cn } from '$lib/utils';

  const getThemeOptions = (): {
    dark: number;
    diffuse: number;
    mapBrightness: number;
    baseColor: [number, number, number];
    markerColor: [number, number, number];
    glowColor: [number, number, number];
  } => {
    return mode.current === 'light'
      ? {
          dark: 0,
          diffuse: 0,
          mapBrightness: 10,
          baseColor: [1, 1, 1],
          markerColor: [60 / 255, 131 / 255, 246 / 255],
          glowColor: [0.4, 0.4, 0.4],
        }
      : {
          dark: 1,
          diffuse: 1.2,
          mapBrightness: 6,
          baseColor: [0.1, 0.1, 0.1],
          markerColor: [60 / 255, 131 / 255, 246 / 255],
          glowColor: [1, 1, 1],
        };
  };

  const rotation = spring(0, {
    stiffness: 0.04,
    damping: 0.4,
    precision: 0.005,
  });

  let className = '';
  export { className as class };

  let canvas: HTMLCanvasElement;
  let activePointerId: number | null = null;
  let dragStartClientX = 0;
  let dragStartRotation = 0;
  let rotationTarget = 0;

  const markers: (Marker & { delay: number })[] = [
    { location: [14.5995, 120.9842], size: 0.025, id: 'manila', delay: 0 },
    { location: [19.076, 72.8777], size: 0.025, id: 'mumbai', delay: 0.3 },
    { location: [23.8103, 90.4125], size: 0.025, id: 'dhaka', delay: 0.6 },
    { location: [30.0444, 31.2357], size: 0.025, id: 'cairo', delay: 0.9 },
    { location: [39.9042, 116.4074], size: 0.025, id: 'beijing', delay: 1.2 },
    { location: [-23.5505, -46.6333], size: 0.025, id: 'saopaulo', delay: 1.5 },
    { location: [19.4326, -99.1332], size: 0.025, id: 'mexico', delay: 1.8 },
    { location: [40.7128, -74.006], size: 0.025, id: 'nyc', delay: 2.1 },
    { location: [34.6937, 135.5022], size: 0.025, id: 'osaka', delay: 2.4 },
    { location: [41.0082, 28.9784], size: 0.025, id: 'istanbul', delay: 2.7 },
  ];

  const startDragging = (event: PointerEvent) => {
    if (activePointerId !== null) return;
    activePointerId = event.pointerId;
    dragStartClientX = event.clientX;
    dragStartRotation = rotationTarget;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  };

  const drag = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return;
    rotationTarget =
      dragStartRotation + (event.clientX - dragStartClientX) / 200;
    rotation.set(rotationTarget);
  };

  const stopDragging = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    activePointerId = null;
    canvas.style.cursor = 'grab';
  };

  onMount(() => {
    if (navigator.webdriver) return;

    const testCanvas = document.createElement('canvas');
    if (
      !testCanvas.getContext('webgl2') &&
      !testCanvas.getContext('webgl') &&
      !testCanvas.getContext('experimental-webgl')
    ) {
      return;
    }

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    const measure = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.round(bounds.width);
      height = Math.round(bounds.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    };
    measure();
    if (!width || !height) return;

    const globe = createGlobe(canvas, {
      devicePixelRatio: pixelRatio,
      width: Math.round(width * pixelRatio),
      height: Math.round(height * pixelRatio),
      phi: 0,
      theta: 0.3,
      mapSamples: 16000,
      ...getThemeOptions(),
      markerElevation: 0,
      markers,
    });

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(canvas);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let phi = 0;
    let frameId: number | null = null;

    const animate = () => {
      if (activePointerId === null && !reducedMotion.matches) phi += 0.005;
      if (width && height) {
        globe.update({
          phi: phi + $rotation,
          width: Math.round(width * pixelRatio),
          height: Math.round(height * pixelRatio),
          ...getThemeOptions(),
        });
      }
      frameId = requestAnimationFrame(animate);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;
      } else if (frameId === null) {
        frameId = requestAnimationFrame(animate);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    frameId = requestAnimationFrame(animate);

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      document.removeEventListener('visibilitychange', handleVisibility);
      resizeObserver.disconnect();
      globe.destroy();
    };
  });
</script>

<main
  class={cn(
    'relative aspect-square h-full max-h-full max-w-full overflow-hidden',
    className,
  )}
>
  <canvas
    class="h-full w-full cursor-grab touch-none contain-[layout_paint_size]"
    bind:this={canvas}
    onpointerdown={startDragging}
    onpointermove={drag}
    onpointerup={stopDragging}
    onpointercancel={stopDragging}
    onlostpointercapture={stopDragging}
  ></canvas>
  {#each markers as marker (marker.id)}
    <div
      class="globe-pulse"
      style="position-anchor: --cobe-{marker.id}; opacity: var(--cobe-visible-{marker.id}, 0); filter: blur(calc((1 - var(--cobe-visible-{marker.id}, 0)) * 8px)); --delay: {marker.delay}s;"
    >
      <span class="globe-pulse-ring"></span>
      <span class="globe-pulse-ring"></span>
      <span class="globe-pulse-dot"></span>
    </div>
  {/each}
</main>
