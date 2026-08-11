<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    preventCycle = false,
    class: className,
    children,
    ...restProps
  }: {
    ref?: HTMLElement | null;
    preventCycle?: boolean;
    class?: string;
    children?: Snippet;
    [key: string]: unknown;
  } = $props();
</script>

<div
  bind:this={ref}
  data-vaul-handle=""
  class={cn(
    'flex h-7 shrink-0 items-center justify-center rounded-t-2xl bg-inherit',
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</div>
