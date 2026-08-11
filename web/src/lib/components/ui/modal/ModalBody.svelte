<script lang="ts">
  import type { Snippet } from 'svelte';

  import { cn } from '$lib/utils';

  let { class: className, children }: { class?: string; children: Snippet } =
    $props();
</script>

<div
  class={cn(
    'min-h-0 flex-1 overscroll-contain overflow-y-auto px-6 py-4',
    className,
  )}
>
  {@render children()}
</div>
