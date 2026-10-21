<script lang="ts">
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { durationText, endAfter, readClock, readDate, readDuration } from '#lib/time-input.js';
	import { Input } from '#lib/components/ui/input/index.js';

	/**
	 * Start, End and Duration in one row, read forgivingly on leaving a field and linked:
	 * a typed end fills the duration, a typed duration fills the end, and a moved start
	 * keeps whichever of the two was typed last (an untouched end by default). Nothing is
	 * rewritten until the user types, so an untouched end's instant is never re-sent.
	 */
	let {
		start = $bindable(),
		end = $bindable(),
		duration = $bindable(),
		endDays = $bindable(),
		endZone,
		date,
		zone,
		errors,
		running = false,
		template = false,
		linked = null
	}: {
		start: string;
		end: string;
		duration: string;
		/** Days from the date to the end's date: "next day", "+N days". */
		endDays: number;
		/** The end's zone when it is not the start's. */
		endZone: string | null;
		/** The form's date as typed, for "Start at previous end". */
		date: string;
		/** The form's zone as it will be posted. */
		zone: () => string;
		/** The server's refusals, by field name. */
		errors: Record<string, string>;
		/** The entry is the running timer: no end keeps it running. */
		running?: boolean;
		/**
		 * A template's times of day: no date, the start may stay blank, no "previous end",
		 * and the template's note in place of the hint line.
		 */
		template?: boolean;
		/** Which of end and duration the loaded values hold (a template keeps one of them). */
		linked?: 'end' | 'duration' | null;
	} = $props();

	type Field = 'start' | 'end' | 'duration';

	/** Refusals read in the browser; `''` clears the server's for that field. */
	let local = $state<Record<string, string>>({});
	// A new refusal from the server replaces what the browser said.
	$effect.pre(() => {
		void errors;
		local = {};
	});
	const error = (name: Field) => (name in local ? local[name] : errors[name]) || '';

	/** Fields typed into since they were last read. */
	const typing: Record<Field, boolean> = { start: false, end: false, duration: false };
	/**
	 * Which of end and duration the user gave last; it holds when the start moves. It starts
	 * as the one the values were loaded with (read once: what was loaded).
	 */
	let lastTyped: 'end' | 'duration' | null = untrack(() => linked);
	/** The end is no longer the loaded instant (typed, filled or linked). */
	let endTyped = false;

	const toMinutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
	const startClock = () => {
		const r = readClock(start);
		return r.ok ? r.value : null;
	};

	/** The end from a duration, when the start reads. */
	function endFromDuration(minutes: number) {
		const s = startClock();
		// An end in another zone holds: the duration alone is sent.
		if (s === null || (endZone && !endTyped)) return;
		const e = endAfter(s, minutes);
		end = e.time;
		endDays = e.days;
		endTyped = true;
	}

	/** The duration from the end, when both read; an untouched end keeps its days. */
	function durationFromEnd() {
		const s = startClock();
		const e = readClock(end);
		if (s === null || !e.ok || (endZone && !endTyped)) return;
		const days = endTyped ? (e.value <= s ? 1 : 0) : endDays;
		const minutes = days * 1440 + toMinutes(e.value) - toMinutes(s);
		if (minutes <= 0) return;
		endDays = days;
		duration = durationText(minutes);
	}

	/** The start moved: the one of end and duration typed last holds. */
	function startMoved() {
		const d = readDuration(duration);
		if (lastTyped === 'duration' || (end === '' && d.ok)) {
			if (d.ok) endFromDuration(d.value);
		} else if (end !== '') {
			durationFromEnd();
		}
	}

	/** Reads a field typed into, shows it in its normal form and links the others. */
	function settle(name: Field): boolean {
		if (!typing[name]) return !error(name);
		typing[name] = false;
		const text = (name === 'start' ? start : name === 'end' ? end : duration).trim();
		if (name === 'start') {
			if (template && text === '') {
				// A template's start may stay blank: it is asked when the template is used.
				local.start = '';
				start = '';
				return true;
			}
			const r = readClock(text);
			if (!r.ok) {
				local.start = r.reason;
				return false;
			}
			local.start = '';
			start = r.value;
			startMoved();
			return true;
		}
		if (text === '') {
			// Emptying one empties the other: neither is a running timer.
			local[name] = '';
			end = '';
			duration = '';
			endDays = 0;
			endTyped = true;
			lastTyped = name;
			return true;
		}
		if (name === 'end') {
			const r = readClock(text);
			if (!r.ok) {
				local.end = r.reason;
				return false;
			}
			local.end = '';
			end = r.value;
			endTyped = true;
			lastTyped = 'end';
			durationFromEnd();
			return true;
		}
		const r = readDuration(text);
		if (!r.ok) {
			local.duration = r.reason;
			return false;
		}
		local.duration = '';
		duration = durationText(r.value);
		lastTyped = 'duration';
		endFromDuration(r.value);
		return true;
	}

	/** Reads every field still being typed; false when one cannot be read. */
	export function commit(): boolean {
		return (['start', 'end', 'duration'] as const).map(settle).every(Boolean);
	}

	/**
	 * Which of end and duration a template keeps: the one typed last, else the one it was
	 * loaded with, else the end when there is one.
	 */
	export function kept(): 'end' | 'duration' | '' {
		if (end === '' && duration === '') return '';
		return lastTyped ?? (end !== '' ? 'end' : 'duration');
	}

	/** A template filled the times: what it gave holds, as if typed. */
	export function filled(from: 'end' | 'duration' | null) {
		lastTyped = from;
		endTyped = true;
		local = {};
		for (const f of ['start', 'end', 'duration'] as const) typing[f] = false;
	}

	/** The end of the latest finished entry on the date, before the start; null when none. */
	let previous = $state<string | null>(null);
	$effect(() => {
		const d = readDate(date, '2000-01-01');
		const before = startClock();
		const tz = zone();
		if (template || !d.ok || !tz) {
			previous = null;
			return;
		}
		const query = new URLSearchParams({
			date: d.value,
			zone: tz,
			...(before === null ? {} : { before })
		});
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetch(`${resolve('/(app)/entries/previous-end')}?${query}`, {
					signal: controller.signal
				});
				const body = res.ok ? ((await res.json()) as { time: string | null }) : null;
				previous = body?.time ?? null;
			} catch {
				// Aborted by a newer change, or offline: no suggestion.
			}
		}, 200);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	function startAtPrevious() {
		if (previous === null) return;
		start = previous;
		typing.start = false;
		local.start = '';
		startMoved();
	}

	const fields = [
		{ name: 'start', label: 'Start' },
		{ name: 'end', label: 'End' },
		{ name: 'duration', label: 'Duration' }
	] as const;
	const value = (name: Field) => (name === 'start' ? start : name === 'end' ? end : duration);
	function set(name: Field, text: string) {
		if (name === 'start') start = text;
		else if (name === 'end') end = text;
		else duration = text;
		typing[name] = true;
	}
	const endNote = $derived(endDays === 1 ? 'next day' : endDays > 1 ? `+${endDays} days` : '');
</script>

<div class="grid grid-cols-3 gap-2 lg:gap-3">
	{#each fields as f (f.name)}
		<div class="flex min-w-0 flex-col gap-1.5">
			<label for="entry-{f.name}" class="text-xs text-muted-foreground">{f.label}</label>
			<Input
				id="entry-{f.name}"
				name={f.name}
				type="text"
				inputmode="text"
				autocomplete="off"
				class="figures"
				value={value(f.name)}
				oninput={(e) => set(f.name, e.currentTarget.value)}
				onblur={() => settle(f.name)}
				aria-invalid={error(f.name) ? 'true' : undefined}
				aria-describedby={[
					error(f.name) ? `${f.name}-error` : '',
					f.name === 'end' && (endNote || endZone) ? 'end-note' : '',
					'entry-time-hint'
				]
					.filter(Boolean)
					.join(' ')}
			/>
			{#if f.name === 'end' && (endNote || endZone)}
				<p id="end-note" class="text-xs text-muted-foreground">
					{[endNote, endZone].filter(Boolean).join(' · ')}
				</p>
			{/if}
			{#if error(f.name)}
				<p id="{f.name}-error" class="text-xs text-irregular">{error(f.name)}</p>
			{/if}
		</div>
	{/each}
</div>
<div class="flex flex-col gap-1 pt-1.5 text-xs text-muted-foreground">
	{#if !template && end === '' && duration === ''}
		<p class="text-foreground">
			{running ? 'No end: the timer keeps running.' : 'No end: this starts a timer.'}
		</p>
	{/if}
	{#if previous !== null}
		<button
			type="button"
			class="min-h-11 w-fit text-left font-semibold text-foreground figures underline decoration-input underline-offset-4 transition-colors duration-150 ease-out hover:decoration-foreground lg:min-h-9"
			onclick={startAtPrevious}>Start at previous end {previous}</button
		>
	{/if}
	{#if template}
		<p id="entry-time-hint">Any field may stay blank; only the blanks are asked when it is used.</p>
	{:else}
		<p id="entry-time-hint">Times: 9, 900, 9:00, 1330 · Duration: 5:30, 5.5, 5h30, 90 (minutes)</p>
	{/if}
</div>
