import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, 'autopilot.sh');

// Fake CLI: each call pops the next line from `actions` and evals it in the repo.
// Helpers available to an action: outcome, verdict, wrong_verdict, dirty, stop.
// verdict <file unit> [pass] [tree] [by] [unit inside the file]
const FAKE = `#!/usr/bin/env bash
set -e
echo x >> "$FAKE_DIR/calls"
printf '%s\\n' "$@" > "$FAKE_DIR/args"
action=$(head -n 1 "$FAKE_DIR/actions" || true)
tail -n +2 "$FAKE_DIR/actions" > "$FAKE_DIR/actions.rest" || true
mv "$FAKE_DIR/actions.rest" "$FAKE_DIR/actions"
mkdir -p .autopilot/verdicts
outcome() { printf '{"status":"%s","unit":"%s","summary":"%s"}' "$1" "\${2:-u1}" "\${3:-did it}" > .autopilot/outcome.json; }
verdict() { printf '{"unit":"%s","pass":%s,"tree":"%s","by":"%s","findings":[],"screenshots":[]}' "\${5:-$1}" "\${2:-true}" "\${3:-$(git rev-parse 'main^{tree}')}" "\${4:-usability-gate}" > ".autopilot/verdicts/$1.json"; }
wrong_verdict() { verdict "$1" true deadbeef; }
dirty() { echo junk > junk.txt; }
stop() { touch .autopilot/stop; }
eval "$action"
`;

let repo: string;
let fakeDir: string;

function git(...args: string[]) {
	const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
	if (r.status !== 0) throw new Error(r.stderr);
	return r.stdout.trim();
}

function setup(actions: string[]) {
	writeFileSync(path.join(fakeDir, 'actions'), actions.map((a) => a + '\n').join(''));
}

function run(args: string[] = []) {
	const r = spawnSync('bash', [path.join(repo, 'scripts/autopilot.sh'), ...args], {
		cwd: repo,
		encoding: 'utf8',
		env: { ...process.env, AUTOPILOT_CLAUDE: path.join(fakeDir, 'claude'), FAKE_DIR: fakeDir }
	});
	return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
}

const calls = () =>
	existsSync(path.join(fakeDir, 'calls'))
		? readFileSync(path.join(fakeDir, 'calls'), 'utf8').trim().split('\n').length
		: 0;
const logs = () => readdirSync(path.join(repo, '.autopilot/logs'));
const runsLines = () =>
	readFileSync(path.join(repo, '.autopilot/runs.md'), 'utf8').trim().split('\n');

beforeEach(() => {
	repo = mkdtempSync(path.join(tmpdir(), 'autopilot-repo-'));
	fakeDir = mkdtempSync(path.join(tmpdir(), 'autopilot-fake-'));
	git('init', '-q', '-b', 'main');
	git('config', 'user.email', 't@example.com');
	git('config', 'user.name', 't');
	writeFileSync(path.join(repo, '.gitignore'), '.autopilot/\n');
	writeFileSync(path.join(repo, 'a.txt'), 'a\n');
	mkdirSync(path.join(repo, 'scripts'));
	copyFileSync(SCRIPT, path.join(repo, 'scripts/autopilot.sh'));
	git('add', '-A');
	git('commit', '-q', '-m', 'chore: init');
	writeFileSync(path.join(fakeDir, 'claude'), FAKE, { mode: 0o755 });
});

afterEach(() => {
	rmSync(repo, { recursive: true, force: true });
	rmSync(fakeDir, { recursive: true, force: true });
});

describe('autopilot loop', () => {
	it('passed with a matching verdict, then round-complete', () => {
		setup(['outcome passed u1 "built it"; verdict u1', 'outcome round-complete u2 "all done"']);
		const r = run();
		expect(r.code).toBe(0);
		expect(logs()).toHaveLength(2);
		const lines = runsLines();
		expect(lines).toHaveLength(2);
		expect(lines[0]).toMatch(/^- \S+ session 1 unit u1 passed: built it \(log .+\)$/);
		expect(lines[1]).toContain('session 2 unit u2 round-complete: all done');
	});

	it('continue then round-complete', () => {
		setup(['outcome continue', 'outcome round-complete']);
		expect(run().code).toBe(0);
		expect(calls()).toBe(2);
	});

	it('refuses a pass with no verdict', () => {
		setup(['outcome passed u1']);
		const r = run();
		expect(r.code).toBe(1);
		expect(r.out).toContain('no verdict');
	});

	it('refuses a pass whose verdict tree differs', () => {
		setup(['outcome passed u1; wrong_verdict u1']);
		const r = run();
		expect(r.code).toBe(1);
		expect(r.out).toContain('tree');
	});

	it('refuses a pass whose verdict says pass false', () => {
		setup(['outcome passed u1; verdict u1 false']);
		expect(run().code).toBe(1);
	});

	it('refuses a pass whose verdict is by neither the gate nor the stand-in', () => {
		setup(['outcome passed u1; verdict u1 true "" builder']);
		const r = run();
		expect(r.code).toBe(1);
		expect(r.out).toContain('not by the gate or the stand-in');
	});

	it('accepts a pass whose verdict is by the stand-in', () => {
		setup(['outcome passed u1; verdict u1 true "" operator-stand-in', 'outcome round-complete']);
		expect(run().code).toBe(0);
	});

	it('refuses a pass whose verdict names another unit', () => {
		setup(['outcome passed u1; verdict u1 true "" usability-gate u2']);
		const r = run();
		expect(r.code).toBe(1);
		expect(r.out).toContain('names another unit');
	});

	it('refuses a pass whose unit id is not a plain name', () => {
		setup(['outcome passed ../u1; verdict u1']);
		const r = run();
		expect(r.code).toBe(1);
		expect(r.out).toContain('invalid unit id');
	});

	it('denies branch deletion, fetching and memory writes by flag', () => {
		setup(['outcome round-complete']);
		expect(run().code).toBe(0);
		const args = readFileSync(path.join(fakeDir, 'args'), 'utf8').trim().split('\n');
		const flag = args.indexOf('--disallowedTools');
		expect(flag).toBeGreaterThan(-1);
		expect(args.slice(flag + 1, flag + 10)).toEqual([
			'Bash(git branch -D *)',
			'Bash(git branch -d *)',
			'Bash(git branch --delete *)',
			'Bash(git pull *)',
			'Bash(git fetch *)',
			'Write(.claude/memory/**)',
			'Edit(.claude/memory/**)',
			'Write(docs/operator-voice.md)',
			'Edit(docs/operator-voice.md)'
		]);
		expect(args[flag + 10]).toBe('--permission-mode');
		expect(args).toContain('auto');
	});

	it('stops on failed after one session', () => {
		setup(['outcome failed u1 "broke"']);
		expect(run().code).toBe(1);
		expect(calls()).toBe(1);
	});

	it('fails when the session writes no outcome, naming the log', () => {
		setup(['true']);
		const r = run();
		expect(r.code).toBe(1);
		expect(r.out).toContain('.autopilot/logs/');
	});

	it('fails when the outcome is invalid', () => {
		setup(['echo "{\\"status\\":\\"bogus\\"}" > .autopilot/outcome.json']);
		expect(run().code).toBe(1);
	});

	it('removes a stale outcome before the session', () => {
		mkdirSync(path.join(repo, '.autopilot'));
		writeFileSync(
			path.join(repo, '.autopilot/outcome.json'),
			'{"status":"round-complete","unit":"old","summary":"old"}'
		);
		setup(['true']);
		expect(run().code).toBe(1);
	});

	it('exits 2 on a dirty tree at start', () => {
		writeFileSync(path.join(repo, 'junk.txt'), 'x');
		setup(['outcome round-complete']);
		expect(run().code).toBe(2);
		expect(calls()).toBe(0);
	});

	it('exits 2 before the next session when a session leaves a dirty tree', () => {
		setup(['dirty; outcome continue', 'outcome round-complete']);
		expect(run().code).toBe(2);
		expect(calls()).toBe(1);
	});

	it('accepts a session that commits its work', () => {
		setup(['echo b > b.txt; git add b.txt; git commit -q -m "feat: b"; outcome continue', 'outcome round-complete']);
		expect(run().code).toBe(0);
	});

	it('exits 0 at start when the stop file exists', () => {
		mkdirSync(path.join(repo, '.autopilot'));
		writeFileSync(path.join(repo, '.autopilot/stop'), '');
		setup(['outcome round-complete']);
		const r = run();
		expect(r.code).toBe(0);
		expect(r.out).toContain('stop');
		expect(calls()).toBe(0);
	});

	it('exits 0 after the session that creates the stop file', () => {
		setup(['stop; outcome continue', 'outcome continue']);
		expect(run().code).toBe(0);
		expect(calls()).toBe(1);
	});

	it('exits 3 when max-sessions is reached with work left', () => {
		setup(Array(5).fill('outcome continue'));
		expect(run(['2']).code).toBe(3);
		expect(calls()).toBe(2);
	});
});
