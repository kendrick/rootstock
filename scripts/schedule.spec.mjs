import { describe, expect, it } from 'vitest';
import {
	defaultEnvFile,
	detectScheduler,
	LABEL,
	main,
	parseAt,
	planInstall,
	renderCrontabBlock,
	renderLaunchAgent,
	renderSystemdService,
	renderSystemdTimer,
	resolvePathEntries,
	rewriteCrontab,
} from './schedule';

// One frozen machine, so the golden renders below describe a fixed thing rather than whatever box
// the suite happens to run on.
const CONTEXT = {
	scheduler: 'launchd',
	repoRoot: '/Users/someone/repos/rootstock',
	home: '/Users/someone',
	hour: 6,
	minute: 0,
	pathEntries: ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'],
	envFile: '/Users/someone/.config/rootstock/env',
	logDirectory: '/Users/someone/Library/Logs/rootstock',
	uid: 501,
};

const LINUX_CONTEXT = {
	...CONTEXT,
	scheduler: 'systemd',
	repoRoot: '/srv/rootstock',
	home: '/home/someone',
	envFile: '/home/someone/.config/rootstock/env',
	logDirectory: '/home/someone/.local/state/rootstock',
	pathEntries: ['/home/someone/.local/share/pnpm', '/usr/bin', '/bin'],
};

function seams(overrides = {}) {
	const calls = { writeFile: [], mkdir: [], spawn: [], log: [], warn: [] };
	return {
		calls,
		effects: {
			which: name => `/usr/bin/${name}`,
			exists: () => true,
			readFile: () => 'ROOTSTOCK_LATITUDE=32\nROOTSTOCK_LONGITUDE=-97\nROOTSTOCK_TIME_ZONE=America/Chicago\n',
			writeFile: (target, contents, mode) => calls.writeFile.push({ target, contents, mode }),
			mkdir: target => calls.mkdir.push(target),
			spawn: (command, args, input) => {
				calls.spawn.push({ command, args, input });
				return { status: 0, stdout: '' };
			},
			log: line => calls.log.push(line),
			warn: line => calls.warn.push(line),
			platform: 'darwin',
			home: CONTEXT.home,
			repoRoot: CONTEXT.repoRoot,
			uid: 501,
			...overrides,
		},
	};
}

describe('renderLaunchAgent', () => {
	it('renders the plist this machine would get', () => {
		expect(renderLaunchAgent(CONTEXT)).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>com.rootstock.daily-run</string>
	<key>ProgramArguments</key>
	<array>
		<string>/Users/someone/repos/rootstock/scripts/daily-run.sh</string>
	</array>
	<key>WorkingDirectory</key>
	<string>/Users/someone/repos/rootstock</string>
	<key>StartCalendarInterval</key>
	<dict>
		<key>Hour</key>
		<integer>6</integer>
		<key>Minute</key>
		<integer>0</integer>
	</dict>
	<key>EnvironmentVariables</key>
	<dict>
		<key>HOME</key>
		<string>/Users/someone</string>
		<key>PATH</key>
		<string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
	</dict>
	<key>StandardOutPath</key>
	<string>/Users/someone/Library/Logs/rootstock/daily-run.log</string>
	<key>StandardErrorPath</key>
	<string>/Users/someone/Library/Logs/rootstock/daily-run.err.log</string>
	<key>RunAtLoad</key>
	<false/>
	<key>ProcessType</key>
	<string>Background</string>
</dict>
</plist>
`);
	});

	// Installing a scheduler entry that immediately generates, commits and pushes is a surprise. The
	// value is the launchd default, so only a written test keeps somebody from "tidying" the key away.
	it('refuses to run the job at load', () => {
		expect(renderLaunchAgent(CONTEXT)).toContain('<key>RunAtLoad</key>\n\t<false/>');
	});

	it('names the env file only when it has been moved off the default', () => {
		expect(renderLaunchAgent(CONTEXT)).not.toContain('ROOTSTOCK_ENV_FILE');
		expect(renderLaunchAgent({ ...CONTEXT, envFile: '/etc/rootstock.env' }))
			.toContain('<key>ROOTSTOCK_ENV_FILE</key>\n\t\t<string>/etc/rootstock.env</string>');
	});

	// A checkout path is chosen by whoever cloned the repo, and an unescaped ampersand makes a plist
	// that parses as nothing, which launchd reports by doing nothing at all.
	it('escapes a checkout path that would break the XML', () => {
		const rendered = renderLaunchAgent({ ...CONTEXT, repoRoot: '/Users/someone/R&D/rootstock' });

		expect(rendered).toContain('<string>/Users/someone/R&amp;D/rootstock</string>');
		expect(rendered).not.toContain('R&D');
	});
});

describe('renderSystemdTimer', () => {
	it('renders the timer', () => {
		expect(renderSystemdTimer({ ...LINUX_CONTEXT, hour: 6, minute: 30 })).toBe(`[Unit]
Description=Run the Rootstock daily job at 06:30 local time

[Timer]
OnCalendar=*-*-* 06:30:00
Persistent=true
AccuracySec=1m

[Install]
WantedBy=timers.target
`);
	});

	// The one line that makes a systemd timer behave like launchd. Without it a suspended box skips
	// the day and never catches up, which is the bug this whole change exists to remove.
	it('runs a job the machine slept through', () => {
		expect(renderSystemdTimer(LINUX_CONTEXT)).toContain('Persistent=true');
	});
});

describe('renderSystemdService', () => {
	it('renders the service', () => {
		expect(renderSystemdService(LINUX_CONTEXT)).toBe(`[Unit]
Description=Rootstock daily run: generate today's Artifact, commit it, and push
Documentation=file:///srv/rootstock/docs/operations/daily-run.md

[Service]
Type=oneshot
WorkingDirectory=/srv/rootstock
ExecStart=/srv/rootstock/scripts/daily-run.sh
Environment=PATH=/home/someone/.local/share/pnpm:/usr/bin:/bin
`);
	});
});

describe('renderCrontabBlock', () => {
	it('renders a fenced block', () => {
		expect(renderCrontabBlock({ ...LINUX_CONTEXT, scheduler: 'cron' })).toBe(
			`# BEGIN rootstock daily-run (managed by \`pnpm schedule\`; edits here are overwritten)
PATH=/home/someone/.local/share/pnpm:/usr/bin:/bin
0 6 * * * /srv/rootstock/scripts/daily-run.sh >> /home/someone/.local/state/rootstock/daily-run.log 2>&1
# END rootstock daily-run`,
		);
	});

	// The runbook's old crontab wrote its log into the checkout, which the script then runs
	// `git diff` against. The log belongs somewhere the repo never looks.
	it('keeps the log out of the checkout', () => {
		expect(renderCrontabBlock({ ...LINUX_CONTEXT, scheduler: 'cron' })).not.toContain('/srv/rootstock/daily-run.log');
	});
});

// The executable form of ADR 0004's argument, and the reason the coordinates live in a file the
// scheduler never reads: `--print` output goes into issues, and a plist is a thing people paste.
describe('the rendered config', () => {
	it('carries no coordinate, on any platform', () => {
		const rendered = [
			renderLaunchAgent(CONTEXT),
			renderSystemdService(LINUX_CONTEXT),
			renderSystemdTimer(LINUX_CONTEXT),
			renderCrontabBlock({ ...LINUX_CONTEXT, scheduler: 'cron' }),
		];

		for (const text of rendered) {
			expect(text).not.toContain('ROOTSTOCK_LATITUDE');
			expect(text).not.toContain('ROOTSTOCK_LONGITUDE');
			expect(text).not.toContain('ROOTSTOCK_TIME_ZONE');
		}
	});
});

describe('detectScheduler', () => {
	const systemd = { exists: target => target === '/run/systemd/system', which: () => '/usr/bin/systemctl' };

	it('picks launchd on macOS', () => {
		expect(detectScheduler('darwin', systemd)).toBe('launchd');
	});

	it('picks systemd on a linux box running it', () => {
		expect(detectScheduler('linux', systemd)).toBe('systemd');
	});

	// `systemctl` is installed on machines whose init is something else, and a timer handed to a
	// systemd that is not running is a job that reports success and never fires.
	it('falls back to cron when systemctl exists but systemd is not running', () => {
		expect(detectScheduler('linux', { exists: () => false, which: () => '/usr/bin/systemctl' })).toBe('cron');
	});

	it('falls back to cron on anything else', () => {
		expect(detectScheduler('freebsd', { exists: () => false, which: () => undefined })).toBe('cron');
	});
});

describe('resolvePathEntries', () => {
	it('puts each command\'s own directory first, deduped, in order', () => {
		const resolved = resolvePathEntries(
			name => (name === 'pnpm' ? '/opt/homebrew/bin/pnpm' : `/usr/bin/${name}`),
			'/Users/someone',
			'darwin',
		);

		expect(resolved.entries.slice(0, 2)).toEqual(['/opt/homebrew/bin', '/usr/bin']);
		expect(new Set(resolved.entries).size).toBe(resolved.entries.length);
	});

	it('reports a missing required command rather than scheduling a job that cannot run', () => {
		const resolved = resolvePathEntries(
			name => (name === 'pnpm' ? undefined : `/usr/bin/${name}`),
			'/Users/someone',
			'darwin',
		);

		expect(resolved.missing).toEqual(['pnpm']);
	});

	// The most likely cause of a job that works for six weeks and then stops: the baked path carries
	// a node version number, and the next `nvm install` moves it.
	it('warns when node resolves inside a version-pinned nvm directory', () => {
		const resolved = resolvePathEntries(
			name => (name === 'node'
				? '/Users/someone/.nvm/versions/node/v24.21.0/bin/node'
				: `/usr/bin/${name}`),
			'/Users/someone',
			'darwin',
		);

		expect(resolved.missing).toEqual([]);
		expect(resolved.warnings.join(' ')).toContain('nvm');
	});

	it('only warns about a missing codex, because a run without prose still publishes', () => {
		const resolved = resolvePathEntries(
			name => (name === 'codex' ? undefined : `/usr/bin/${name}`),
			'/Users/someone',
			'darwin',
		);

		expect(resolved.missing).toEqual([]);
		expect(resolved.warnings.join(' ')).toContain('codex');
	});
});

describe('rewriteCrontab', () => {
	const block = '# BEGIN rootstock daily-run (managed by `pnpm schedule`; edits here are overwritten)\nX=1\n# END rootstock daily-run';

	it('appends the block to a crontab that has none', () => {
		expect(rewriteCrontab('0 2 * * * /usr/bin/backup\n', block)).toBe(`0 2 * * * /usr/bin/backup\n${block}\n`);
	});

	// The property that matters most: somebody else's jobs survive, above and below.
	it('replaces an existing block and leaves every other line alone', () => {
		const existing = `0 2 * * * /usr/bin/backup\n${block.replace('X=1', 'X=0')}\n30 4 * * * /usr/bin/other\n`;

		expect(rewriteCrontab(existing, block)).toBe(
			`0 2 * * * /usr/bin/backup\n30 4 * * * /usr/bin/other\n${block}\n`,
		);
	});

	it('is idempotent', () => {
		const once = rewriteCrontab('0 2 * * * /usr/bin/backup\n', block);

		expect(rewriteCrontab(once, block)).toBe(once);
	});

	it('removes the block entirely when given null', () => {
		const existing = `0 2 * * * /usr/bin/backup\n${block}\n`;

		expect(rewriteCrontab(existing, null)).toBe('0 2 * * * /usr/bin/backup\n');
	});

	it('leaves a crontab with no block untouched on uninstall', () => {
		expect(rewriteCrontab('0 2 * * * /usr/bin/backup\n', null)).toBe('0 2 * * * /usr/bin/backup\n');
	});

	it('empties a crontab that held nothing else', () => {
		expect(rewriteCrontab(`${block}\n`, null)).toBe('');
	});

	// Deleting to the end of the file would take unrelated jobs with it. The only honest reading of a
	// half-open block is that somebody edited it by hand and should say what they meant.
	it('refuses a begin sentinel with no end rather than guessing', () => {
		const broken = '# BEGIN rootstock daily-run (managed by `pnpm schedule`; edits here are overwritten)\nX=1\n0 2 * * * /usr/bin/backup\n';

		expect(() => rewriteCrontab(broken, block)).toThrow(/no matching/);
	});
});

describe('parseAt', () => {
	it('reads a zero-padded 24-hour time', () => {
		expect(parseAt('06:00')).toEqual({ hour: 6, minute: 0 });
		expect(parseAt('23:59')).toEqual({ hour: 23, minute: 59 });
	});

	// A job silently scheduled at the wrong hour is hard to notice, so every shape is refused loudly.
	it('refuses a time that is not one', () => {
		expect(() => parseAt('25:00')).toThrow();
		expect(() => parseAt('6:0')).toThrow();
		expect(() => parseAt('0600')).toThrow();
		expect(() => parseAt('')).toThrow();
	});
});

describe('planInstall', () => {
	it('bootstraps the agent after booting out whatever was loaded', () => {
		const plan = planInstall(CONTEXT);

		expect(plan.files).toHaveLength(1);
		expect(plan.files[0].path).toBe(`/Users/someone/Library/LaunchAgents/${LABEL}.plist`);
		expect(plan.activate[0][1]).toBe('bootout');
		expect(plan.activate[1][1]).toBe('bootstrap');
	});

	// Without lingering a --user timer only fires while a session is open, so a headless box gets a
	// job that looks installed and never runs.
	it('enables lingering for a systemd timer', () => {
		const plan = planInstall(LINUX_CONTEXT);

		expect(plan.files.map(file => file.path)).toEqual([
			'/home/someone/.config/systemd/user/rootstock-daily.service',
			'/home/someone/.config/systemd/user/rootstock-daily.timer',
		]);
		expect(plan.activate.flat()).toContain('enable-linger');
	});

	it('warns that cron never catches up', () => {
		expect(planInstall({ ...CONTEXT, scheduler: 'cron' }).warnings.join(' ')).toContain('missed');
	});
});

describe('main', () => {
	// The whole point of the flag. A reader reaches for --print to find out what would happen, and it
	// would be a poor way to learn that it already had.
	it('--print writes nothing, makes no directory, and spawns nothing', () => {
		const { calls, effects } = seams();

		expect(main(['--print'], effects)).toBe(0);
		expect(calls.writeFile).toEqual([]);
		expect(calls.mkdir).toEqual([]);
		expect(calls.spawn).toEqual([]);
		expect(calls.log.join('\n')).toContain('<key>Label</key>');
	});

	// The env file is the one thing --print must name without reading, because its whole reason for
	// existing is that its contents may not be shared.
	it('--print names the env file without printing what is in it', () => {
		const { calls, effects } = seams();
		main(['--print'], effects);

		expect(calls.log.join('\n')).toContain(defaultEnvFile(CONTEXT.home));
		expect(calls.log.join('\n')).not.toContain('ROOTSTOCK_LATITUDE');
	});

	it('refuses to schedule a job whose pnpm is missing', () => {
		const { calls, effects } = seams({ which: name => (name === 'pnpm' ? undefined : `/usr/bin/${name}`) });

		expect(main([], effects)).toBe(2);
		expect(calls.writeFile).toEqual([]);
		expect(calls.warn.join(' ')).toContain('pnpm');
	});

	it('writes the plist and loads it', () => {
		const { calls, effects } = seams();

		expect(main([], effects)).toBe(0);
		expect(calls.writeFile[0].target).toBe(`/Users/someone/Library/LaunchAgents/${LABEL}.plist`);
		expect(calls.writeFile[0].mode).toBe(0o644);
		expect(calls.spawn.map(call => call.args[0])).toContain('bootstrap');
	});

	it('creates the env file at 0600 when there is none, and says it is blank', () => {
		const { calls, effects } = seams({ exists: target => !target.endsWith('/env') });
		main([], effects);

		const written = calls.writeFile.find(call => call.target.endsWith('/env'));
		expect(written.mode).toBe(0o600);
		expect(written.contents).toContain('ROOTSTOCK_LATITUDE=\n');
	});

	it('says which coordinates are still missing from an existing env file', () => {
		const { calls, effects } = seams({ readFile: () => 'ROOTSTOCK_LATITUDE=32\nROOTSTOCK_LONGITUDE=\nROOTSTOCK_TIME_ZONE=\n' });
		main([], effects);

		expect(calls.warn.join(' ')).toContain('ROOTSTOCK_LONGITUDE, ROOTSTOCK_TIME_ZONE');
	});

	it('refuses a bad --at before writing anything', () => {
		const { calls, effects } = seams();

		expect(main(['--at', '25:00'], effects)).toBe(2);
		expect(calls.writeFile).toEqual([]);
	});

	// So --print can render another machine's config from this one, which is also how the spec drives
	// all three targets without pretending to be a different platform.
	it('honours --scheduler over detection', () => {
		const { calls, effects } = seams();
		main(['--print', '--scheduler', 'systemd'], effects);

		expect(calls.log.join('\n')).toContain('Persistent=true');
	});

	it('leaves the env file and the deploy key alone on uninstall', () => {
		const { calls, effects } = seams();

		expect(main(['--uninstall'], effects)).toBe(0);
		expect(calls.spawn.map(call => call.args[0])).toContain('bootout');
		expect(calls.log.join('\n')).toContain('left /Users/someone/.config/rootstock/env in place');
		expect(calls.log.join('\n')).toContain('deploy key');
	});
});
