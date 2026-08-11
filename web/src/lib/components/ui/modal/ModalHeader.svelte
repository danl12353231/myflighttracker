<script lang="ts">
  import { X } from '@o7/icon';
  import { type Snippet } from 'svelte';

  import { getModalContext } from './Modal.svelte';

  import { cn } from '$lib/utils';

  let { children, class: className }: { children: Snippet; class?: string } =
    $props();

  const ctx = getModalContext();
  ctx.registerHeader();
</script>

<div
  class={cn(
    'flex items-start gap-2 px-6 py-3 md:items-center md:justify-between',
    className,
  )}
>
  {@render children()}
  <button
    type="button"
    onclick={ctx.closeModal}
    class="ml-auto flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:size-9"
  >
    <X size={20} />
    <span class="sr-only">Close</span>
  </button>
</div>
