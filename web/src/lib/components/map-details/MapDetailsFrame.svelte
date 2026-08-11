<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';

  import { Modal } from '$lib/components/ui/modal';
  import { peekModalHistory } from '$lib/components/ui/modal/modal-history';
  import { Separator } from '$lib/components/ui/separator';
  import { isMediumScreen } from '$lib/utils/size';

  let {
    open,
    header,
    actions,
    children,
    onOpenChange,
    defaultSnapPoint = 0.55,
  }: {
    open: boolean;
    header: Snippet;
    actions?: Snippet;
    children: Snippet;
    onOpenChange?: (open: boolean) => void;
    defaultSnapPoint?: number;
  } = $props();

  let activeSnapPoint: string | number | null = $state(0.55);
  const drawerSnapPoints: (string | number)[] = [0.55, 0.95];

  $effect(() => {
    if (!open) return;
    activeSnapPoint = defaultSnapPoint;
  });

  const handleWindowKeydown = (e: KeyboardEvent) => {
    if (!open || !$isMediumScreen || e.key !== 'Escape' || e.defaultPrevented)
      return;
    if (peekModalHistory()) return;

    e.preventDefault();
    onOpenChange?.(false);
  };
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if $isMediumScreen}
  {#if open}
    <div
      in:fly={{ x: -420, duration: 260, easing: cubicOut }}
      class="absolute top-3 left-3 z-20 flex max-w-[calc(100vw-1.5rem)] items-start gap-2"
    >
      <aside
        class="glass-pane flex max-h-[calc(100vh-1.5rem)] w-[380px] max-w-full flex-col overflow-hidden rounded-xl"
      >
        {@render header()}
        <Separator />
        <div
          class="scrollbar-subtle flex-1 divide-y divide-border/60 overflow-y-auto"
        >
          {@render children()}
        </div>
      </aside>
      {#if actions}
        <div
          class="flex shrink-0 flex-col gap-1 rounded-lg border border-border/70 bg-background/95 p-1 shadow-xs"
          aria-label="Details actions"
        >
          {@render actions()}
        </div>
      {/if}
    </div>
  {/if}
{:else}
  <Modal
    {open}
    bind:activeSnapPoint
    drawerRawContent
    drawerHandleOnly
    drawerModal={false}
    {drawerSnapPoints}
    shouldScaleBackground={false}
    class="h-[95dvh] bg-background outline-none"
    overlayClass="pointer-events-none bg-black/30"
    onOpenChange={(v) => onOpenChange?.(v)}
  >
    <div class="shrink-0">
      {@render header()}
    </div>
    {#if actions}
      <div class="shrink-0 px-4 pb-3" aria-label="Details actions">
        <div
          class="flex gap-2 rounded-lg border border-border/70 bg-background/80 p-1"
        >
          {@render actions()}
        </div>
      </div>
    {/if}
    <Separator />
    <div
      class="scrollbar-subtle min-h-0 flex-1 divide-y divide-border/60 overscroll-contain overflow-y-auto"
    >
      {@render children()}
    </div>
  </Modal>
{/if}
