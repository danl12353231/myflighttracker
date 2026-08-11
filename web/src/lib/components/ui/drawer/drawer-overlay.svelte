<script lang="ts">
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: {
    ref?: HTMLElement | null;
    class?: string;
    [key: string]: unknown;
  } = $props();
</script>

<div
  bind:this={ref}
  class={cn('fixed inset-0 z-50 bg-black/80', className)}
  {...restProps}
></div>
