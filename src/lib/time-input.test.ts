import { describe, expect, it } from 'vitest';
import {
	durationText,
	endAfter,
	minutesBetween,
	readClock,
	readDate,
	readDuration
} from './time-input';

const ok = <T>(value: T) => ({ ok: true, value });
const no = (reason: string) => ({ ok: false, reason });

describe('readClock', () => {
	it.each([
		['9', '09:00'],
		['09', '09:00'],
		['9h', '09:00'],
		['13', '13:00'],
		['900', '09:00'],
		['0900', '09:00'],
		['1330', '13:30'],
		['9:00', '09:00'],
		['9.00', '09:00'],
		['9,00', '09:00'],
		['9am', '09:00'],
		['9 am', '09:00'],
		['9:30pm', '21:30'],
		['12am', '00:00'],
		['12pm', '12:00'],
		[' 9 AM ', '09:00'],
		['23:59', '23:59']
	])('reads %j as %s', (typed, read) => {
		expect(readClock(typed)).toEqual(ok(read));
	});

	it.each([
		['', 'Not a time. Type 9, 900, 9:00 or 1330.'],
		['abc', 'Not a time. Type 9, 900, 9:00 or 1330.'],
		['9:5', 'Minutes take two digits, as in 9:05.'],
		['17.5', 'Type 17:30 or 17:05.'],
		['8,3', 'Type 8:30 or 8:03.'],
		['24', 'Not a time of day.'],
		['2400', 'Not a time of day.'],
		['960', 'Not a time of day.'],
		['25:00', 'Not a time of day.']
	])('refuses %j', (typed, reason) => {
		expect(readClock(typed)).toEqual(no(reason));
	});
});

describe('readDuration', () => {
	it.each([
		['5:30', 330],
		['5h30', 330],
		['5h 30m', 330],
		['5h30m', 330],
		['5.5', 330],
		['5,5', 330],
		['0.25', 15],
		['1.30', 78],
		['5h', 300],
		['90m', 90],
		[':90', 90],
		['1h30m', 90],
		['90', 90],
		['330', 330],
		['5', 5]
	])('reads %j as %d minutes', (typed, minutes) => {
		expect(readDuration(typed)).toEqual(ok(minutes));
	});

	it.each([
		['', 'Not a duration. Type 5:30, 5.5, 5h30 or 90 (minutes).'],
		['x', 'Not a duration. Type 5:30, 5.5, 5h30 or 90 (minutes).'],
		['0', 'A duration is more than zero.'],
		['0:00', 'A duration is more than zero.'],
		['0m', 'A duration is more than zero.']
	])('refuses %j', (typed, reason) => {
		expect(readDuration(typed)).toEqual(no(reason));
	});
});

describe('readDate', () => {
	const today = '2026-10-20';
	it.each([
		['2026-10-18', '2026-10-18'],
		['20261018', '2026-10-18'],
		['2026.10.18', '2026-10-18'],
		['2026/10/18', '2026-10-18'],
		['2026,10,18', '2026-10-18'],
		['10.18', '2026-10-18'],
		['1018', '2026-10-18'],
		['10-18', '2026-10-18']
	])('reads %j as %s', (typed, read) => {
		expect(readDate(typed, today)).toEqual(ok(read));
	});

	it.each(['2026-02-30', '2026-13-01', '', 'x'])('refuses %j', (typed) => {
		expect(readDate(typed, today)).toEqual(no('Not a date. Type 2026-10-18, 20261018 or 10.18.'));
	});
});

describe('durationText', () => {
	it.each([
		[330, '5:30'],
		[5, '0:05'],
		[1500, '25:00']
	])('shows %d as %s', (minutes, text) => {
		expect(durationText(minutes)).toBe(text);
	});
});

describe('minutesBetween', () => {
	it.each([
		['09:00', '17:30', 510],
		['22:00', '06:00', 480],
		['09:00', '09:00', 1440]
	])('from %s to %s is %d', (start, end, minutes) => {
		expect(minutesBetween(start, end)).toBe(minutes);
	});
});

describe('endAfter', () => {
	it.each([
		['13:00', 330, { time: '18:30', days: 0 }],
		['22:00', 480, { time: '06:00', days: 1 }]
	])('%s plus %d minutes', (start, minutes, end) => {
		expect(endAfter(start, minutes)).toEqual(end);
	});
});
