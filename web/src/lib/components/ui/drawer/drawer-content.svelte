<script lang="ts">
  import type { Snippet } from 'svelte';

  import { getDrawerRootContext } from './drawer.svelte';
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    style,
    noPadding = false,
    raw = false,
    structured = false,
    showHandle = true,
    overlayClass,
    overlayStyle,
    children,
  }: {
    ref?: HTMLElement | null;
    class?: string;
    style?: string;
    noPadding?: boolean;
    raw?: boolean;
    structured?: boolean;
    showHandle?: boolean;
    overlayClass?: string;
    overlayStyle?: string;
    children: Snippet;
  } = $props();

  const ctx = getDrawerRootContext();

  $effect(() => {
    ctx?.setShowHandle(showHandle);
  });

  let contentEl = $state<HTMLElement | null>(null);
  $effect(() => {
    ref = contentEl;
  });
</script>

{#if ctx}
  {#if ctx.modal}
    <div
      class={cn('fixed inset-0 z-50 bg-black/80', overlayClass)}
      style={[
        overlayStyle,
        `opacity: ${ctx.overlayOpacity}`,
        ctx.open ? '' : 'pointer-events: none',
      ].join(';')}
      aria-hidden="true"
      onclick={() => {
        /* click-outside handled transparently since overlay covers the viewport but the root dialog click-outside is not used */
      }}
    ></div>
  {/if}
  <div
    bind:this={contentEl}
    role="dialog"
    aria-modal={ctx.modal ? 'true' : undefined}
    class={cn(
      'fixed inset-x-0 bottom-0 z-50 flex min-h-0 w-full max-w-none flex-col overflow-hidden rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)]',
      className,
    )}
    style={[
      style,
      `transform: translateY(${ctx.translateY}px)`,
      ctx.isDragging
        ? ''
        : 'transition: transform 350ms cubic-bezier(0.32, 0.72, 0, 1)',
    ]
      .filter(Boolean)
      .join('; ')}
    onpointerdown={ctx.onPointerDown}
    onpointerup={ctx.onPointerUp}
    data-vaul-drawer=""
  >
    {#if ctx.showHandle}
      <div
        class="flex h-7 shrink-0 items-center justify-center rounded-t-2xl bg-inherit"
        data-vaul-handle=""
      >
        <div class="h-1.5 w-11 rounded-full bg-muted-foreground/25"></div>
      </div>
    {/if}
    {#if raw}
      {@render children()}
    {:else if structured}
      <div class="flex min-h-0 flex-1 flex-col" class:p-3={!noPadding}>
        {@render children()}
      </div>
    {:else}
      <div
        class="scrollbar-hide min-h-0 flex-1 overscroll-contain overflow-y-auto bg-inherit"
      >
        <div class:p-3={!noPadding}>
          {@render children()}
        </div>
      </div>
    {/if}
  </div>
{/if}
