import { COLUMNS, type Column, type DurationFormat } from '#lib/output.js';

export type OutputOptions = { round: boolean; split: boolean; duration: DurationFormat };
export type OutputChoice = { columns: Column[]; options: OutputOptions };

export const DEFAULT_CHOICE: OutputChoice = {
	columns: [...COLUMNS],
	options: { round: true, split: false, duration: 'hm' }
};

const NAMES = ['cols', 'round', 'split', 'duration'] as const;

/**
 * The choice an address asks for. Each name the address lacks comes from `kept` (a
 * string in the address's format), then the default. `named` is whether the address
 * has any of the four names. A form sent without the script may repeat a name: `cols`
 * once per ticked box (their values joined), a switch as its hidden 0 then its 1 (the
 * last value counts).
 */
export function readChoice(
	params: URLSearchParams,
	kept: string | undefined
): { choice: OutputChoice; named: boolean; columnsError: string | null } {
	const fallback = new URLSearchParams(kept ?? '');
	const from = (name: (typeof NAMES)[number]) => (params.has(name) ? params : fallback);
	const get = (name: (typeof NAMES)[number]) => from(name).getAll(name).at(-1) ?? null;

	const colsList = from('cols').getAll('cols');
	const cols = colsList.length === 0 ? null : colsList.join(',');
	const wanted = new Set((cols ?? '').split(','));
	const columns =
		cols === null ? [...DEFAULT_CHOICE.columns] : COLUMNS.filter((c) => wanted.has(c));
	const flag = (name: 'round' | 'split') => {
		const value = get(name);
		return value === '1' ? true : value === '0' ? false : DEFAULT_CHOICE.options[name];
	};
	const duration = get('duration');

	return {
		choice: {
			columns,
			options: {
				round: flag('round'),
				split: flag('split'),
				duration:
					duration === 'hm' || duration === 'decimal' ? duration : DEFAULT_CHOICE.options.duration
			}
		},
		named: NAMES.some((name) => params.has(name)),
		columnsError: columns.length === 0 ? 'Choose at least one column.' : null
	};
}

/** All four names, in a fixed order; reads back as `choice`. */
export function choiceQuery(choice: OutputChoice): string {
	const { round, split, duration } = choice.options;
	return `cols=${choice.columns.join(',')}&round=${round ? 1 : 0}&split=${split ? 1 : 0}&duration=${duration}`;
}

/** "Options · h:mm, rounded", "Options · decimal, exact, split". */
export function optionsLabel(options: OutputOptions): string {
	const parts = [
		options.duration === 'hm' ? 'h:mm' : 'decimal',
		options.round ? 'rounded' : 'exact'
	];
	if (options.split) parts.push('split');
	return `Options · ${parts.join(', ')}`;
}
