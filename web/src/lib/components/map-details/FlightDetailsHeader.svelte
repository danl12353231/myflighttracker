<script lang="ts">
  import { ChevronRight, X } from '@o7/icon/lucide';

  import { AirlineIcon } from '$lib/components/display';
  import { closeMapDetails } from '$lib/state.svelte';
  import type { FlightData } from '$lib/utils';
  import {
    formatCompactDateWithWeekday,
    formatCompactFlightDate,
  } from '$lib/utils/preferences';

  let {
    flight,
    onShowRoute,
  }: {
    flight: FlightData;
    onShowRoute?: () => void;
  } = $props();

  const flightNumber = $derived(
    flight.flightNumber?.trim()
      ? flight.flightNumber.replace(/([a-zA-Z]{2})(\d+)/, '$1 $2')
      : null,
  );

  const dateLabel = $derived(
    flight.date
      ? flight.datePrecision === 'day'
        ? formatCompactDateWithWeekday(flight.date, flight.from?.tz)
        : formatCompactFlightDate(
            flight.date,
            flight.datePrecision ?? 'day',
            flight.from?.tz,
          )
      : null,
  );

  const canShowRoute = $derived(!!(flight.from && flight.to) && !!onShowRoute);
  const endpointName = (airport: FlightData['from']) =>
    airport?.municipality ?? airport?.name ?? 'Unknown';
  const routeTitle = $derived(
    `${endpointName(flight.from)} to ${endpointName(flight.to)}`,
  );
</script>

<div class="flex items-center gap-3 px-4 pt-3 pb-4 sm:px-5 sm:pt-4">
  <div
    class="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/55"
  >
    <AirlineIcon airline={flight.airline} size={34} fallback="plane" />
  </div>
  <button
    type="button"
    class="group min-w-0 flex-1 text-left focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    disabled={!canShowRoute}
    onclick={() => onShowRoute?.()}
    aria-label="Open route details"
  >
    <p
      class="truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase"
    >
      {flightNumber ?? flight.airline?.name ?? 'Flight'}{dateLabel
        ? ` · ${dateLabel}`
        : ''}
    </p>
    <span class="mt-0.5 flex min-w-0 items-center gap-1">
      <span class="truncate text-xl leading-tight font-semibold tracking-tight">
        {routeTitle}
      </span>
      {#if canShowRoute}
        <ChevronRight size={18} class="shrink-0 text-muted-foreground" />
      {/if}
    </span>
  </button>
  <button
    type="button"
    class="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/45 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    onclick={closeMapDetails}
    aria-label="Close flight details"
  >
    <X size={24} />
  </button>
</div>
