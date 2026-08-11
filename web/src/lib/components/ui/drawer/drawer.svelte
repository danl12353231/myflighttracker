<script lang="ts" module>
  import { getContext, setContext } from 'svelte';

  const DrawerContextKey = Symbol('DrawerContext');
  const DrawerRootKey = Symbol('DrawerRoot');

  export type DrawerContext = {
    lockDismiss: () => void;
    unlockDismiss: () => void;
  };

  export type DrawerRootContext = {
    readonly open: boolean;
    readonly animating: boolean;
    readonly translateY: number;
    readonly overlayOpacity: number;
    readonly isDragging: boolean;
    readonly modal: boolean;
    readonly viewportH: number;
    readonly showHandle: boolean;
    onPointerDown: (e: PointerEvent) => void;
    onPointerUp: (e: PointerEvent) => void;
    onPointerMove: (e: PointerEvent) => void;
    setShowHandle: (v: boolean) => void;
  };

  export const getDrawerContext = () =>
    getContext<DrawerContext | undefined>(DrawerContextKey);

  export const getDrawerRootContext = () =>
    getContext<DrawerRootContext | undefined>(DrawerRootKey);
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    shouldScaleBackground = true,
    open = $bindable(false),
    activeSnapPoint = $bindable<string | number | null>(null),
    drawerState = $bindable<Record<string, unknown>>(),
    dismissible = true,
    modal = true,
    handleOnly = false,
    snapPoints = undefined as (string | number)[] | undefined,
    onOpenChange = undefined as ((open: boolean) => void) | undefined,
    onAnimationEnd = undefined as ((open: boolean) => void) | undefined,
    onDrag = undefined as ((e: PointerEvent, pct: number) => void) | undefined,
    onRelease = undefined as
      ((e: PointerEvent, o: boolean) => void) | undefined,
    closeThreshold = 0.25,
    children,
  }: {
    shouldScaleBackground?: boolean;
    open?: boolean;
    activeSnapPoint?: string | number | null;
    drawerState?: Record<string, unknown>;
    dismissible?: boolean;
    modal?: boolean;
    handleOnly?: boolean;
    snapPoints?: (string | number)[] | undefined;
    onOpenChange?: ((open: boolean) => void) | undefined;
    onAnimationEnd?: ((open: boolean) => void) | undefined;
    onDrag?: ((e: PointerEvent, pct: number) => void) | undefined;
    onRelease?: ((e: PointerEvent, o: boolean) => void) | undefined;
    closeThreshold?: number;
    children: Snippet;
  } = $props();

  let dismissLocked = $state(false);
  let isDragging = $state(false);
  let hasRendered = $state(false);
  let animating = $state(false);
  let contentShowHandle = $state(true);
  let dragStart = $state({ y: 0 });
  let dragCurrent = $state({ y: 0 });
  let viewportH = $state(
    typeof window !== 'undefined' ? window.innerHeight : 0,
  );
  let animTimer: ReturnType<typeof setTimeout>;

  setContext(DrawerContextKey, {
    lockDismiss: () => (dismissLocked = true),
    unlockDismiss: () => (dismissLocked = false),
  });

  const effectiveDismissible = $derived(dismissible && !dismissLocked);

  const offsets = $derived.by(() => {
    if (!snapPoints?.length) return [] as number[];
    const h = viewportH || window.innerHeight;
    return snapPoints.map((sp) =>
      typeof sp === 'number' ? (1 - sp) * h : h - parseInt(sp, 10),
    );
  });

  const curIndex = $derived.by(() => {
    if (!snapPoints?.length || activeSnapPoint == null) return -1;
    return snapPoints.indexOf(activeSnapPoint);
  });

  const curOffset = $derived.by(() => {
    const idx = curIndex;
    if (idx >= 0 && idx < offsets.length) return offsets[idx]!;
    return 0;
  });

  const dragDy = $derived.by(() => {
    if (!isDragging) return 0;
    return dragCurrent.y - dragStart.y;
  });

  const translateY = $derived.by(() => {
    if (!hasRendered) return viewportH;
    const base = curOffset;
    const dy = isDragging ? dragDy : 0;
    return Math.max(0, Math.min(viewportH, base + dy));
  });

  const overlayOpacity = $derived.by(() => {
    if (!modal) return 0;
    if (!hasRendered) return 0;
    const pct = translateY / (viewportH || 1);
    return Math.max(0, Math.min(1, 1 - pct));
  });

  function triggerClose() {
    if (animating) return;
    open = false;
  }

  $effect(() => {
    viewportH = window.innerHeight;
    const onResize = () => {
      viewportH = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  let prevOpen = false;
  $effect(() => {
    if (open && !prevOpen) {
      hasRendered = true;
      animating = true;
      if (snapPoints?.length) activeSnapPoint = snapPoints[0]!;
      onOpenChange?.(true);
      clearTimeout(animTimer);
      animTimer = setTimeout(() => {
        animating = false;
        onAnimationEnd?.(true);
      }, 350);
    }
    if (!open && prevOpen) {
      animating = true;
      isDragging = false;
      onOpenChange?.(false);
      clearTimeout(animTimer);
      animTimer = setTimeout(() => {
        animating = false;
        hasRendered = false;
        onAnimationEnd?.(false);
      }, 350);
    }
    prevOpen = open;
  });

  function onPointerDown(e: PointerEvent) {
    if (!open || !effectiveDismissible || !hasRendered || animating) return;
    const t = e.target as HTMLElement;
    if (t.closest('[data-vaul-no-drag]')) return;
    if (handleOnly && !t.closest('[data-vaul-handle]')) return;
    if (t.closest('button, a, input, select, textarea')) return;

    isDragging = true;
    dragStart = { y: e.clientY };
    dragCurrent = { y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    onDrag?.(e, 0);
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    dragCurrent = { y: e.clientY };
    onDrag?.(e, translateY / (viewportH || 1));
  }

  function onPointerUp(e: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    const off = translateY;
    const pct = off / (viewportH || 1);

    if (snapPoints?.length && offsets.length) {
      if (pct > 0.75 && effectiveDismissible) {
        triggerClose();
        onRelease?.(e, false);
      } else {
        let best = 0;
        let min = Infinity;
        offsets.forEach((o, i) => {
          const d = Math.abs(off - o);
          if (d < min) {
            min = d;
            best = i;
          }
        });
        activeSnapPoint = snapPoints[best]!;
        onRelease?.(e, true);
      }
    } else {
      if (pct > closeThreshold && effectiveDismissible) {
        triggerClose();
        onRelease?.(e, false);
      } else {
        triggerClose();
        onRelease?.(e, false);
      }
    }
  }

  setContext(DrawerRootKey, {
    get open() {
      return open;
    },
    get animating() {
      return animating;
    },
    get translateY() {
      return translateY;
    },
    get overlayOpacity() {
      return overlayOpacity;
    },
    get isDragging() {
      return isDragging;
    },
    get modal() {
      return modal;
    },
    get viewportH() {
      return viewportH;
    },
    get showHandle() {
      return contentShowHandle;
    },
    onPointerDown,
    onPointerUp,
    onPointerMove,
    setShowHandle: (v: boolean) => (contentShowHandle = v),
  });
</script>

<svelte:window onpointermove={onPointerMove} onpointerup={onPointerUp} />

{#if hasRendered}
  {@render children()}
{/if}
