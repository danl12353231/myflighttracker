<script lang="ts">
  import { List, Locate } from '@o7/icon/lucide';

  import { focusMapDetails } from '$lib/state.svelte';

  import DetailsActionButton from './DetailsActionButton.svelte';

  let { onShowInList }: { onShowInList: () => void } = $props();
</script>

<DetailsActionButton
  label="Locate flight"
  shortLabel="Locate"
  icon={Locate}
  onclick={focusMapDetails}
/>
<DetailsActionButton
  label="Open in flight list"
  shortLabel="Open list"
  icon={List}
  onclick={onShowInList}
/>
