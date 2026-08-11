<script lang="ts">
  import Root from './drawer.svelte';

  let {
    shouldScaleBackground = true,
    open = $bindable(false),
    activeSnapPoint = $bindable<string | number | null>(null),
    children,
    ...restProps
  }: {
    shouldScaleBackground?: boolean;
    open?: boolean;
    activeSnapPoint?: string | number | null;
    children?: import('svelte').Snippet;
    [key: string]: unknown;
  } = $props();
</script>

<Root {shouldScaleBackground} bind:open bind:activeSnapPoint {...restProps}>
  {@render children?.()}
</Root>
