<script lang="ts">
  import { differenceInMinutes } from 'date-fns';
  import {
    Armchair,
    Clock,
    Plane,
    PlaneLanding,
    PlaneTakeoff,
    StickyNote,
    Users,
  } from '@o7/icon/lucide';

  import type { Airport, FlightPassenger } from '$lib/db/types';
  import {
    formatSeatForUser,
    getFlightPassengerLabel,
    toTitleCase,
    type FlightData,
  } from '$lib/utils';
  import { formatAircraft } from '$lib/utils/data/aircraft';
  import { resolveFlightTimeline } from '$lib/utils/data/flight-timeline';
  import { Duration, parseLocalizeISO } from '$lib/utils/datetime';
  import {
    formatDistance,
    formatTime,
    resolveFlightTimeZone,
  } from '$lib/utils/preferences';
  import type { Preferences } from '$lib/zod/user';

  let {
    flight,
    prefs,
    seatUserId,
  }: {
    flight: FlightData;
    prefs: Preferences;
    seatUserId?: string;
  } = $props();

  let now = $state(Date.now());
  $effect(() => {
    const interval = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(interval);
  });

  const timeline = $derived(resolveFlightTimeline(flight.raw));
  const departureTz = $derived(
    resolveFlightTimeZone(flight, 'departure', prefs),
  );
  const arrivalTz = $derived(resolveFlightTimeZone(flight, 'arrival', prefs));

  const parseTime = (value: string | null, timezone: string) =>
    value ? parseLocalizeISO(value, timezone) : null;

  const departureActual = $derived(
    timeline.recordedDeparture ??
      parseTime(flight.takeoffActual, flight.from?.tz ?? 'UTC'),
  );
  const departureScheduled = $derived(
    parseTime(
      flight.departureScheduled ?? flight.takeoffScheduled,
      flight.from?.tz ?? 'UTC',
    ),
  );
  const arrivalActual = $derived(
    timeline.recordedArrival ??
      parseTime(flight.landingActual, flight.to?.tz ?? 'UTC'),
  );
  const arrivalScheduled = $derived(
    parseTime(
      flight.arrivalScheduled ?? flight.landingScheduled,
      flight.to?.tz ?? 'UTC',
    ),
  );
  const departureTime = $derived(
    departureActual ?? departureScheduled ?? timeline.effectiveDeparture,
  );
  const arrivalTime = $derived(
    arrivalActual ?? arrivalScheduled ?? timeline.effectiveArrival,
  );

  type TimingStatus = {
    label: string;
    tone: 'positive' | 'warning' | 'neutral';
  };

  const timingStatus = (
    actual: Date | null,
    scheduled: Date | null,
  ): TimingStatus => {
    if (!actual) return { label: 'Scheduled', tone: 'neutral' };
    if (!scheduled) return { label: 'Recorded', tone: 'positive' };
    const difference = differenceInMinutes(actual, scheduled);
    if (Math.abs(difference) <= 5) {
      return { label: 'On time', tone: 'positive' };
    }
    return difference > 0
      ? { label: `${difference}m late`, tone: 'warning' }
      : { label: `${Math.abs(difference)}m early`, tone: 'positive' };
  };

  const departureStatus = $derived(
    timingStatus(departureActual, departureScheduled),
  );
  const arrivalStatus = $derived(timingStatus(arrivalActual, arrivalScheduled));

  const toneClass = (tone: TimingStatus['tone']) => {
    if (tone === 'positive') return 'text-emerald-500';
    if (tone === 'warning') return 'text-amber-500';
    return 'text-muted-foreground';
  };

  const durationUntil = (target: Date) => {
    const seconds = Math.max(
      0,
      Math.floor(Math.abs(target.getTime() - now) / 1_000),
    );
    return Duration.fromSeconds(seconds).toString(true);
  };

  const journeyStatus = $derived.by(() => {
    if (departureTime && now < departureTime.getTime()) {
      return {
        title: `Departs in ${durationUntil(departureTime)}`,
        detail: 'Times and airport details from your saved itinerary.',
      };
    }
    if (
      departureTime &&
      arrivalTime &&
      now >= departureTime.getTime() &&
      now < arrivalTime.getTime()
    ) {
      return {
        title: `In flight · lands in ${durationUntil(arrivalTime)}`,
        detail: 'Arrival timing is based on your saved itinerary.',
      };
    }
    if (arrivalTime && now >= arrivalTime.getTime()) {
      return {
        title: arrivalActual
          ? `Arrived ${durationUntil(arrivalTime)} ago`
          : `Scheduled arrival was ${durationUntil(arrivalTime)} ago`,
        detail: arrivalActual
          ? 'Recorded flight details and timing.'
          : 'Timing is based on your saved itinerary.',
      };
    }
    return {
      title: 'Itinerary saved',
      detail: 'Add scheduled or actual times for flight progress.',
    };
  });

  const distanceLabel = $derived(
    typeof flight.distance === 'number'
      ? formatDistance(flight.distance, prefs)
      : null,
  );
  const durationLabel = $derived(
    flight.duration !== null
      ? Duration.fromSeconds(flight.duration).toString()
      : null,
  );
  const seatLabel = $derived(formatSeatForUser(flight, seatUserId));
  const aircraftLabel = $derived(
    flight.aircraft || flight.aircraftReg ? formatAircraft(flight) : null,
  );

  const airportCode = (airport: Airport | null) =>
    airport ? (airport.iata ?? airport.icao) : 'N/A';
  const airportName = (airport: Airport | null) =>
    airport?.name ?? airport?.municipality ?? 'Unknown airport';

  const gateLabel = (terminal: string | null, gate: string | null) => ({
    terminal: terminal ? `Terminal ${terminal}` : null,
    gate: gate ? `Gate ${gate}` : null,
  });
  const departureGate = $derived(
    gateLabel(flight.departureTerminal, flight.departureGate),
  );
  const arrivalGate = $derived(
    gateLabel(flight.arrivalTerminal, flight.arrivalGate),
  );

  const seatDescriptor = (passenger: FlightPassenger) => {
    const seat = passenger.seat ? toTitleCase(passenger.seat) : null;
    const seatClass = passenger.seatClass
      ? toTitleCase(passenger.seatClass)
      : null;
    return [seatClass, passenger.seatNumber, seat].filter(Boolean).join(' · ');
  };

  const passengers = $derived(
    flight.passengers
      .map((passenger) => ({
        name: getFlightPassengerLabel(passenger),
        seat: seatDescriptor(passenger),
        reason: passenger.flightReason
          ? toTitleCase(passenger.flightReason)
          : null,
      }))
      .filter((passenger) => !!passenger.name),
  );
</script>

{#snippet endpoint(
  direction: 'departure' | 'arrival',
  airport: Airport | null,
  time: Date | null,
  scheduled: Date | null,
  actual: Date | null,
  status: TimingStatus,
  terminal: string | null,
  gate: string | null,
  timezone: string,
)}
  <section class="px-4 py-5 sm:px-5">
    <div class="flex items-center gap-2.5">
      {#if direction === 'departure'}
        <PlaneTakeoff size={18} class="shrink-0" />
      {:else}
        <PlaneLanding size={18} class="shrink-0" />
      {/if}
      <p class="min-w-0 flex-1 truncate text-lg font-semibold">
        {airportCode(airport)}
        <span class="font-normal text-muted-foreground">·</span>
        <span class="font-normal">{airportName(airport)}</span>
      </p>
    </div>

    <div class="mt-3 flex items-end justify-between gap-3">
      <p
        class="text-5xl leading-none font-semibold tracking-[-0.04em] tabular-nums {toneClass(
          status.tone,
        )}"
      >
        {time ? formatTime(time, prefs, timezone) : '—'}
      </p>
      {#if gate}
        <span
          class="shrink-0 rounded-xl bg-amber-400 px-3 py-1.5 text-lg font-bold text-black shadow-sm tabular-nums"
        >
          {gate}
        </span>
      {/if}
    </div>

    <div class="mt-2 flex items-start justify-between gap-3 text-sm">
      <div class="min-w-0">
        <p class="font-semibold {toneClass(status.tone)}">{status.label}</p>
        {#if actual && scheduled && Math.abs(differenceInMinutes(actual, scheduled)) > 0}
          <p class="text-muted-foreground tabular-nums">
            Scheduled {formatTime(scheduled, prefs, timezone)}
          </p>
        {/if}
      </div>
      {#if terminal}
        <p class="shrink-0 text-right text-muted-foreground">{terminal}</p>
      {/if}
    </div>
  </section>
{/snippet}

<section
  class="border-y border-emerald-500/20 bg-emerald-500/10 px-4 py-4 sm:px-5"
>
  <p class="text-lg font-semibold text-emerald-500">{journeyStatus.title}</p>
  <p class="mt-0.5 text-sm leading-relaxed text-emerald-500/80">
    {journeyStatus.detail}
  </p>
</section>

{@render endpoint(
  'departure',
  flight.from,
  departureTime,
  departureScheduled,
  departureActual,
  departureStatus,
  departureGate.terminal,
  departureGate.gate,
  departureTz,
)}

<div class="flex items-center gap-3 px-4 text-sm text-muted-foreground sm:px-5">
  <span class="flex shrink-0 items-center gap-1.5 tabular-nums">
    <Clock size={15} />
    {durationLabel ?? 'Duration unknown'}
    {distanceLabel ? ` · ${distanceLabel}` : ''}
  </span>
  <span class="h-px flex-1 bg-border"></span>
</div>

{@render endpoint(
  'arrival',
  flight.to,
  arrivalTime,
  arrivalScheduled,
  arrivalActual,
  arrivalStatus,
  arrivalGate.terminal,
  arrivalGate.gate,
  arrivalTz,
)}

<section class="space-y-3 px-4 py-5 sm:px-5">
  <h3 class="text-xl font-semibold tracking-tight">Flight details</h3>
  <div class="grid grid-cols-2 gap-3">
    <div
      class="min-w-0 rounded-2xl border border-border/80 bg-background/35 p-4"
    >
      <Armchair size={24} class="text-muted-foreground" />
      <p class="mt-4 text-xs tracking-wide text-muted-foreground uppercase">
        Seat
      </p>
      <p class="mt-0.5 truncate text-lg font-semibold tabular-nums">
        {seatLabel ?? 'Not added'}
      </p>
    </div>
    <div
      class="min-w-0 rounded-2xl border border-border/80 bg-background/35 p-4"
    >
      <Plane size={24} class="text-muted-foreground" />
      <p class="mt-4 text-xs tracking-wide text-muted-foreground uppercase">
        Aircraft
      </p>
      <p class="mt-0.5 truncate text-lg font-semibold">
        {aircraftLabel ?? 'Not added'}
      </p>
    </div>
  </div>

  {#if flight.airline?.name || flight.flightNumber}
    <div
      class="flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-background/35 px-4 py-3 text-sm"
    >
      <span class="text-muted-foreground">Operated by</span>
      <span class="truncate text-right font-medium">
        {flight.airline?.name ?? 'Unknown airline'}{flight.flightNumber
          ? ` · ${flight.flightNumber}`
          : ''}
      </span>
    </div>
  {/if}
</section>

{#if passengers.length}
  <section class="space-y-3 px-4 py-5 sm:px-5">
    <h3 class="flex items-center gap-2 text-xl font-semibold tracking-tight">
      <Users size={20} />
      Passengers
    </h3>
    <div class="overflow-hidden rounded-2xl border border-border/80">
      {#each passengers as passenger, index (index)}
        <div
          class="flex items-center justify-between gap-4 bg-background/30 px-4 py-3 {index
            ? 'border-t border-border/70'
            : ''}"
        >
          <div class="min-w-0">
            <p class="truncate font-medium">{passenger.name}</p>
            {#if passenger.reason}
              <p class="text-xs text-muted-foreground">{passenger.reason}</p>
            {/if}
          </div>
          <span class="shrink-0 text-sm text-muted-foreground tabular-nums">
            {passenger.seat || 'No seat'}
          </span>
        </div>
      {/each}
    </div>
  </section>
{/if}

{#if flight.note}
  <section class="space-y-3 px-4 py-5 sm:px-5">
    <h3 class="flex items-center gap-2 text-xl font-semibold tracking-tight">
      <StickyNote size={20} />
      Good to know
    </h3>
    <p
      class="rounded-2xl border border-border/80 bg-background/35 p-4 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground"
    >
      {flight.note}
    </p>
  </section>
{/if}
