<script lang="ts">
  import {
    MapPin,
    Plane,
    PlaneLanding,
    PlaneTakeoff,
    Plus,
    Radar,
    SquarePen,
    X,
  } from '@o7/icon/lucide';
  import { tick } from 'svelte';

  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { AirlineIcon } from '$lib/components/display';
  import { EditFlightModal } from '$lib/components/modals';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Drawer from '$lib/components/ui/drawer';
  import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from '$lib/components/ui/tabs';
  import type { Airport, Flight } from '$lib/db/types';
  import { openFlightDetails, openModalsState } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';
  import { canShowFlightOnMap } from '$lib/flight-visibility';
  import { prepareFlightData, type FlightData } from '$lib/utils';
  import { isGuestFlight } from '$lib/utils/flight-audience';
  import {
    isCompletedFlight,
    resolveFlightTimeline,
  } from '$lib/utils/data/flight-timeline';
  import { Duration } from '$lib/utils/datetime';
  import {
    formatTime,
    getPreferences,
    resolveFlightTimeZone,
  } from '$lib/utils/preferences';

  let { open = $bindable(false) }: { open: boolean } = $props();

  const prefs = $derived(getPreferences(page.data.user));

  const mine = trpc.flight.upcoming.query({ scope: 'mine' });
  const friends = trpc.flight.upcoming.query({ scope: 'friends' });

  let tab = $state<'mine' | 'friends'>('mine');
  let now = $state(Date.now());
  let editFlight = $state<FlightData | null>(null);
  let editOpen = $state(false);

  $effect(() => {
    if (!open) return;
    const interval = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(interval);
  });

  const mineFlights = $derived(
    (($mine.data ?? []) as Flight[]).filter(
      (flight) =>
        !isGuestFlight(flight) && !isCompletedFlight(flight, new Date(now)),
    ),
  );
  const friendsFlights = $derived(
    (($friends.data ?? []) as Flight[]).filter(
      (flight) => !isCompletedFlight(flight, new Date(now)),
    ),
  );

  const airportCode = (airport: Airport | null) =>
    airport ? (airport.iata ?? airport.icao) : '—';
  const airportCity = (airport: Airport | null) =>
    airport ? (airport.municipality ?? airport.name) : 'Unknown';

  const remaining = (target: number | null): string | null => {
    if (target === null) return null;
    const seconds = Math.max(0, Math.floor((target - now) / 1000));
    return Duration.fromSeconds(seconds).toString(true);
  };

  const openAddFlight = () => {
    open = false;
    openModalsState.addFlight = true;
  };

  const showFlightOnMap = async (flight: Flight) => {
    if (!canShowFlightOnMap(flight)) return;
    open = false;
    if (page.url.pathname !== '/') await goto('/');
    await tick();
    openFlightDetails(flight.id);
  };

  const openEditFlight = async (flight: Flight) => {
    const [prepared] = prepareFlightData([flight]);
    if (!prepared) return;
    editFlight = prepared;
    open = false;
    await tick();
    editOpen = true;
  };
</script>

<Drawer.Root bind:open shouldScaleBackground={false}>
  <Drawer.Content raw class="h-[min(85dvh,48rem)]">
    <div class="flex shrink-0 items-center justify-between px-4 pb-3">
      <Drawer.Title class="flex items-center gap-2 text-base">
        <Radar size={18} />
        Active flights
      </Drawer.Title>
      <Button
        variant="ghost"
        size="icon-sm"
        class="rounded-full"
        onclick={() => (open = false)}
        aria-label="Close active flights"
      >
        <X size={16} />
      </Button>
    </div>

    <Tabs bind:value={tab} class="min-h-0 flex-1 gap-0 px-4">
      <TabsList class="grid w-full grid-cols-2">
        <TabsTrigger value="mine">My flights</TabsTrigger>
        <TabsTrigger value="friends">Friends</TabsTrigger>
      </TabsList>

      <TabsContent
        value="mine"
        class="scrollbar-subtle mt-3 min-h-0 space-y-2 overscroll-contain overflow-y-auto pb-3"
      >
        {#if $mine.isPending}
          <p class="py-8 text-center text-sm text-muted-foreground">
            Loading flights…
          </p>
        {:else if mineFlights.length === 0}
          <div class="flex flex-col items-center gap-3 py-10 text-center">
            <Plane size={28} class="text-muted-foreground" />
            <p class="text-sm text-muted-foreground">
              No upcoming flights yet.
            </p>
            <Button size="sm" onclick={openAddFlight}>
              <Plus />
              Add a flight
            </Button>
          </div>
        {:else}
          {#each mineFlights as flight (flight.id)}
            {@render flightCard(flight)}
          {/each}
        {/if}
      </TabsContent>

      <TabsContent
        value="friends"
        class="scrollbar-subtle mt-3 min-h-0 space-y-2 overscroll-contain overflow-y-auto pb-3"
      >
        {#if $friends.isPending}
          <p class="py-8 text-center text-sm text-muted-foreground">
            Loading flights…
          </p>
        {:else if friendsFlights.length === 0}
          <div class="flex flex-col items-center gap-3 py-10 text-center">
            <Plane size={28} class="text-muted-foreground" />
            <p class="text-sm text-muted-foreground">
              No upcoming flights for friends yet.
            </p>
            <Button size="sm" onclick={openAddFlight}>
              <Plus />
              Add a flight
            </Button>
          </div>
        {:else}
          {#each friendsFlights as flight (flight.id)}
            {@render flightCard(flight)}
          {/each}
        {/if}
      </TabsContent>
    </Tabs>

    <div class="shrink-0 border-t bg-background p-4">
      <Button class="w-full" onclick={openAddFlight}>
        <Plus />
        Add flight
      </Button>
    </div>
  </Drawer.Content>
</Drawer.Root>

{#if editFlight}
  {#key editFlight.id}
    <EditFlightModal
      flight={editFlight}
      bind:open={editOpen}
      showTrigger={false}
    />
  {/key}
{/if}

{#snippet flightCard(flight: Flight)}
  {@const timeline = resolveFlightTimeline(flight)}
  {@const departureTz = resolveFlightTimeZone(flight, 'departure', prefs)}
  {@const arrivalTz = resolveFlightTimeZone(flight, 'arrival', prefs)}
  {@const depMs = timeline.effectiveDeparture?.getTime() ?? null}
  {@const arrMs = timeline.effectiveArrival?.getTime() ?? null}
  {@const inAir = depMs !== null && depMs <= now}
  {@const guests = flight.passengers
    .filter((passenger) => passenger.guestName)
    .map((passenger) => passenger.guestName!)}
  {@const label = inAir
    ? `In the air · Landing in ${remaining(arrMs) ?? '—'}`
    : `Departs in ${remaining(depMs) ?? '—'}`}

  <div
    role="button"
    tabindex="0"
    class="flex cursor-pointer flex-col gap-2.5 rounded-xl border bg-card p-3 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    onclick={() => showFlightOnMap(flight)}
    onkeydown={(event) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showFlightOnMap(flight);
      }
    }}
  >
    <div class="flex items-center gap-2">
      <AirlineIcon airline={flight.airline} size={22} />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold">
          {flight.flightNumber ?? flight.airline?.name ?? 'Flight'}
        </p>
        {#if flight.flightNumber && flight.airline}
          <p class="truncate text-xs text-muted-foreground">
            {flight.airline.name}
          </p>
        {/if}
      </div>
      {#if tab === 'friends' && guests.length > 0}
        <Badge variant="secondary" class="shrink-0">
          {guests.join(', ')}
        </Badge>
      {/if}
    </div>

    <div class="flex items-center justify-between">
      <div class="min-w-0">
        <p class="truncate text-lg font-bold leading-tight">
          {airportCode(flight.from)}
        </p>
        <p class="truncate text-xs text-muted-foreground">
          {airportCity(flight.from)}
        </p>
      </div>
      <Plane size={16} class="shrink-0 text-muted-foreground" />
      <div class="min-w-0 text-right">
        <p class="truncate text-lg font-bold leading-tight">
          {airportCode(flight.to)}
        </p>
        <p class="truncate text-xs text-muted-foreground">
          {airportCity(flight.to)}
        </p>
      </div>
    </div>

    <div class="flex items-center justify-between text-sm">
      <div class="flex items-center gap-1.5 text-muted-foreground">
        <PlaneTakeoff size={14} class="shrink-0" />
        <span>
          {timeline.effectiveDeparture
            ? formatTime(timeline.effectiveDeparture, prefs, departureTz)
            : '—'}
        </span>
      </div>
      <div class="flex items-center gap-1.5 text-muted-foreground">
        <PlaneLanding size={14} class="shrink-0" />
        <span>
          {timeline.effectiveArrival
            ? formatTime(timeline.effectiveArrival, prefs, arrivalTz)
            : '—'}
        </span>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <div
        class="min-w-0 flex-1 rounded-lg bg-muted/50 px-2 py-1.5 text-center text-sm font-medium"
      >
        {label}
      </div>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Show flight on map"
        title="Show flight on map"
        disabled={!canShowFlightOnMap(flight)}
        onclick={(event) => {
          event.stopPropagation();
          showFlightOnMap(flight);
        }}
      >
        <MapPin size={15} />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Edit flight"
        title="Edit flight"
        onclick={(event) => {
          event.stopPropagation();
          openEditFlight(flight);
        }}
      >
        <SquarePen size={15} />
      </Button>
    </div>
  </div>
{/snippet}
