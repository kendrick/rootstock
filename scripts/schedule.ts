/*
 * Installs `scripts/daily-run.sh` as a daily job on whatever machine this runs on, and is the only
 * place the three schedulers' config formats are written down.
 *
 * The split is the one `scripts/generate.ts` uses: everything above `main` is a pure function of its
 * arguments, and `main` is the only code that touches the filesystem, spawns a process, or reads the
 * environment. That is what lets `schedule.spec.mjs` pin the generated plist byte for byte without
 * installing anything, and what lets `--print` be provably effect-free rather than carefully written.
 *
 * Nothing rendered here carries a coordinate. ADR 0004 keeps the property's location out of the
 * repository, and the same argument applies to a plist somebody will paste into an issue the first
 * time a run misbehaves. The job reads its coordinates from an env file outside the checkout, which
 * `daily-run.sh` sources itself, and a spec asserts that no rendered artifact names one.
 *
 * Usage lives in `usage()` below and in docs/operations/daily-run.md, split on one rule: this file
 * prints only what it computed for the machine in front of it, and the runbook prints only what the
 * code cannot know. Neither restates the other, and the runbook pastes no plist.
 */

import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export type Scheduler = 'launchd' | 'systemd' | 'cron';

export const LABEL = 'com.rootstock.daily-run';

/** The crontab is the one surface shared with a human, so the managed region is fenced. */
const CRONTAB_BEGIN = '# BEGIN rootstock daily-run (managed by `pnpm schedule`; edits here are overwritten)';
const CRONTAB_END = '# END rootstock daily-run';

/** Commands the job cannot run without. A missing one fails the install rather than the 6am run. */
const REQUIRED_COMMANDS = ['pnpm', 'git', 'ssh'] as const;

/** Resolved for the PATH, but only warned about: the narrator is the one step that needs it. */
const OPTIONAL_COMMANDS = ['node', 'codex'] as const;

export interface ScheduleContext {
	scheduler: Scheduler;
	repoRoot: string;
	home: string;
	hour: number;
	minute: number;
	pathEntries: readonly string[];
	envFile: string;
	logDirectory: string;
	/*
	 * Resolved here rather than left as `$(id -u)` in the command, because that string only works
	 * through a shell, and spawning through one to interpolate a number Node already knows is how
	 * an argument containing a space becomes two arguments.
	 */
	uid: number;
}

/** A program and its arguments, non-empty so the program name is never `undefined`. */
export type Command = readonly [string, ...string[]];

export interface ManagedFile {
	path: string;
	contents: string;
	mode: number;
}

export interface InstallPlan {
	files: readonly ManagedFile[];
	activate: readonly Command[];
	warnings: readonly string[];
}

export function defaultEnvFile(home: string): string {
	return path.join(home, '.config', 'rootstock', 'env');
}

/**
 * A launchd plist is XML, and a checkout path is chosen by whoever cloned the repo. An ampersand in
 * a directory name would otherwise produce a plist that parses as nothing and a job that never runs.
 */
function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

/**
 * systemd reads the rest of the line after `Environment=NAME=`, so a value is safe unquoted unless
 * it carries a newline, which a PATH cannot. Kept as a named function anyway so the asymmetry with
 * {@link escapeXml} is deliberate rather than an omission.
 */
function systemdValue(value: string): string {
	return value.replaceAll('\n', ' ');
}

/**
 * launchd where there is one, then a systemd user manager, then cron.
 *
 * `/run/systemd/system` and not `which systemctl` alone: the binary is present on machines whose
 * init is something else entirely, and a timer installed into a systemd that is not running is a job
 * that reports success and never fires.
 */
export function detectScheduler(
	platform: string,
	probe: { exists: (target: string) => boolean; which: (name: string) => string | undefined },
): Scheduler {
	if (platform === 'darwin') {
		return 'launchd';
	}
	if (probe.which('systemctl') !== undefined && probe.exists('/run/systemd/system')) {
		return 'systemd';
	}
	return 'cron';
}

export interface ResolvedPath {
	entries: string[];
	warnings: string[];
	missing: string[];
}

/**
 * Builds the PATH the scheduled job runs with, from where the commands actually live on this machine
 * rather than from a list somebody hoped was right.
 *
 * The nvm warning is the one that matters. A shell that resolves `node` to
 * `~/.nvm/versions/node/v24.21.0/bin/node` bakes a version number into the job, and the next
 * `nvm install` leaves a scheduler entry that looks installed, reports nothing, and has not run since
 * whenever that upgrade happened. That is the failure this whole file exists to prevent, arriving by
 * a different door.
 */
export function resolvePathEntries(
	which: (name: string) => string | undefined,
	home: string,
	platform: string,
	exists: (target: string) => boolean = () => false,
): ResolvedPath {
	const entries: string[] = [];
	const warnings: string[] = [];
	const missing: string[] = [];

	const add = (entry: string): void => {
		if (!entries.includes(entry)) {
			entries.push(entry);
		}
	};

	for (const name of [...REQUIRED_COMMANDS, ...OPTIONAL_COMMANDS]) {
		const resolved = which(name);
		if (resolved === undefined) {
			missing.push(name);
			continue;
		}
		add(path.dirname(resolved));
	}

	for (const name of OPTIONAL_COMMANDS) {
		if (missing.includes(name)) {
			warnings.push(`\`${name}\` is not on this PATH. The run will still publish a Plan; ${name === 'codex' ? 'it will carry the Planner\'s mechanical prose rather than the model\'s' : 'but pnpm will have to find its own runtime'}.`);
		}
	}

	if (platform === 'darwin') {
		add('/opt/homebrew/bin');
	}
	for (const entry of ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']) {
		add(entry);
	}

	// Warn only when the nvm copy is the one the job would actually get. The entries are reordered
	// above, so a stable node earlier in the list shadows a version-pinned one later, and warning on
	// mere presence would fire on a machine where nothing is wrong. A warning that cries wolf is one
	// nobody reads the day it is right.
	const nvmPrefix = path.join(home, '.nvm', 'versions', 'node');
	const winner = entries.find(entry => exists(path.join(entry, 'node')));
	if (winner !== undefined && winner.startsWith(nvmPrefix)) {
		warnings.push(
			`This job would run node from ${winner}, a version-pinned nvm directory. The next \`nvm install\` moves it and the job stops without saying so. Install node somewhere stable, or set PATH in ${defaultEnvFile(home)}, which the script reads after the scheduler's.`,
		);
	}

	return { entries, warnings, missing: missing.filter(name => (REQUIRED_COMMANDS as readonly string[]).includes(name)) };
}

function runScript(context: ScheduleContext): string {
	return path.join(context.repoRoot, 'scripts', 'daily-run.sh');
}

/**
 * `RunAtLoad` is false explicitly. It is already the default, and it is written down because the
 * alternative is installing a scheduler entry and having it immediately generate, commit and push,
 * which is a surprise worth recording as refused rather than leaving to a reader's memory of launchd.
 *
 * `StartCalendarInterval` fires a missed job when the machine wakes, which is the entire reason this
 * is a LaunchAgent and not a crontab line on a laptop.
 */
export function renderLaunchAgent(context: ScheduleContext): string {
	const environment: [string, string][] = [
		['HOME', context.home],
		['PATH', context.pathEntries.join(':')],
		...(context.envFile === defaultEnvFile(context.home) ? [] : [['ROOTSTOCK_ENV_FILE', context.envFile] as [string, string]]),
	];

	const environmentLines = environment
		.map(([name, value]) => `\t\t<key>${escapeXml(name)}</key>\n\t\t<string>${escapeXml(value)}</string>`)
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>${LABEL}</string>
	<key>ProgramArguments</key>
	<array>
		<string>${escapeXml(runScript(context))}</string>
	</array>
	<key>WorkingDirectory</key>
	<string>${escapeXml(context.repoRoot)}</string>
	<key>StartCalendarInterval</key>
	<dict>
		<key>Hour</key>
		<integer>${context.hour}</integer>
		<key>Minute</key>
		<integer>${context.minute}</integer>
	</dict>
	<key>EnvironmentVariables</key>
	<dict>
${environmentLines}
	</dict>
	<key>StandardOutPath</key>
	<string>${escapeXml(path.join(context.logDirectory, 'daily-run.log'))}</string>
	<key>StandardErrorPath</key>
	<string>${escapeXml(path.join(context.logDirectory, 'daily-run.err.log'))}</string>
	<key>RunAtLoad</key>
	<false/>
	<key>ProcessType</key>
	<string>Background</string>
</dict>
</plist>
`;
}

/**
 * No `Environment=HOME=`: systemd sets it for user units. No `EnvironmentFile=`: its format is not
 * shell, so pointing it at the env file would make that one file mean two different things depending
 * on which scheduler read it. `daily-run.sh` sources the file itself on every platform instead.
 */
export function renderSystemdService(context: ScheduleContext): string {
	const environment = [
		`Environment=PATH=${systemdValue(context.pathEntries.join(':'))}`,
		...(context.envFile === defaultEnvFile(context.home)
			? []
			: [`Environment=ROOTSTOCK_ENV_FILE=${systemdValue(context.envFile)}`]),
	].join('\n');

	return `[Unit]
Description=Rootstock daily run: generate today's Artifact, commit it, and push
Documentation=file://${path.join(context.repoRoot, 'docs/operations/daily-run.md')}

[Service]
Type=oneshot
WorkingDirectory=${context.repoRoot}
ExecStart=${runScript(context)}
${environment}
`;
}

/**
 * `Persistent=true` is the systemd equivalent of launchd firing a missed `StartCalendarInterval` on
 * wake. Without it a suspended or powered-off box silently skips the day and never catches up, which
 * is the bug this issue opened with. Deleting that one line reintroduces it, so a spec names it.
 */
export function renderSystemdTimer(context: ScheduleContext): string {
	const at = `${String(context.hour).padStart(2, '0')}:${String(context.minute).padStart(2, '0')}`;

	return `[Unit]
Description=Run the Rootstock daily job at ${at} local time

[Timer]
OnCalendar=*-*-* ${at}:00
Persistent=true
AccuracySec=1m

[Install]
WantedBy=timers.target
`;
}

/**
 * Cron's assignment lines apply to the schedule lines that follow them in the file, so a
 * self-contained block appended at the end is correct without disturbing anything above it.
 */
export function renderCrontabBlock(context: ScheduleContext): string {
	const assignments = [
		`PATH=${context.pathEntries.join(':')}`,
		...(context.envFile === defaultEnvFile(context.home) ? [] : [`ROOTSTOCK_ENV_FILE=${context.envFile}`]),
	].join('\n');

	const log = path.join(context.logDirectory, 'daily-run.log');

	return `${CRONTAB_BEGIN}
${assignments}
${context.minute} ${context.hour} * * * ${runScript(context)} >> ${log} 2>&1
${CRONTAB_END}`;
}

/**
 * Replaces the managed region and leaves every other line exactly where it was. This is the only
 * function here that can destroy something a person wrote, which is why it is pure, why it is fenced
 * by sentinels rather than by matching on the command, and why it carries the most spec cases.
 *
 * A begin sentinel with no end is refused rather than guessed at. Deleting to the end of the file
 * would take unrelated jobs with it, and the only honest reading of a half-open block is that
 * somebody edited it by hand and should say what they meant.
 */
export function rewriteCrontab(existing: string, block: string | null): string {
	const lines = existing.split('\n');
	const begin = lines.indexOf(CRONTAB_BEGIN);

	let kept = lines;
	if (begin !== -1) {
		const end = lines.indexOf(CRONTAB_END, begin);
		if (end === -1) {
			throw new Error(
				`The crontab has a '${CRONTAB_BEGIN}' line with no matching '${CRONTAB_END}'. Fix it by hand; refusing to guess where the managed block ends.`,
			);
		}
		kept = [...lines.slice(0, begin), ...lines.slice(end + 1)];
	}

	const body = kept.join('\n').replace(/\n+$/, '');

	if (block === null) {
		return body === '' ? '' : `${body}\n`;
	}

	return body === '' ? `${block}\n` : `${body}\n${block}\n`;
}

/** The env file the installer drops when none exists. Blank values on purpose: see ADR 0004. */
export function renderEnvTemplate(): string {
	return `# Read by scripts/daily-run.sh on every scheduled run, and by nothing else.
#
# This file lives outside the checkout because the repository is public and GitHub Pages publishes a
# public site whatever the repository's own visibility is. ADR 0004 works through that in full.
#
# Fill in all three ROOTSTOCK_ values before the first scheduled run, or it will fail loudly rather
# than guess a plausible coordinate and publish a confidently wrong Plan.

ROOTSTOCK_LATITUDE=
ROOTSTOCK_LONGITUDE=
ROOTSTOCK_TIME_ZONE=

# Where codex keeps the credentials the Narration step spends. Defaults to ~/.codex in the script.
CODEX_HOME=

# The SSH private key the push uses. Defaults to ~/.ssh/rootstock_deploy in the script. It has to be
# a real file: the 1Password agent wants an approval prompt, and the push runs under BatchMode=yes.
ROOTSTOCK_DEPLOY_KEY=
`;
}

export function planInstall(context: ScheduleContext): InstallPlan {
	const uid = context.uid;

	if (context.scheduler === 'launchd') {
		const plist = path.join(context.home, 'Library', 'LaunchAgents', `${LABEL}.plist`);
		return {
			files: [{ path: plist, contents: renderLaunchAgent(context), mode: 0o644 }],
			activate: [
				['launchctl', 'bootout', `gui/${uid}/${LABEL}`],
				['launchctl', 'bootstrap', `gui/${uid}`, plist],
				['launchctl', 'enable', `gui/${uid}/${LABEL}`],
			],
			warnings: [],
		};
	}

	if (context.scheduler === 'systemd') {
		const unitDir = path.join(context.home, '.config', 'systemd', 'user');
		return {
			files: [
				{ path: path.join(unitDir, 'rootstock-daily.service'), contents: renderSystemdService(context), mode: 0o644 },
				{ path: path.join(unitDir, 'rootstock-daily.timer'), contents: renderSystemdTimer(context), mode: 0o644 },
			],
			activate: [
				// Without lingering, a --user timer only runs while a session is open, so a headless box
				// gets a job that looks installed and never fires.
				['loginctl', 'enable-linger', process.env.USER ?? ''],
				['systemctl', '--user', 'daemon-reload'],
				['systemctl', '--user', 'enable', '--now', 'rootstock-daily.timer'],
			],
			warnings: [],
		};
	}

	return {
		files: [],
		activate: [],
		warnings: [
			'cron does not fire a job it missed. A machine asleep or powered off at the scheduled minute skips the day entirely and never catches up, and the published Plan simply gets a day older. launchd and a systemd timer with Persistent=true both run the missed job on wake. If this machine sleeps, schedule it another way.',
		],
	};
}

/** `--at HH:MM`, rejected loudly rather than coerced: a job at the wrong hour is hard to notice. */
export function parseAt(value: string): { hour: number; minute: number } {
	const match = /^(\d{2}):(\d{2})$/.exec(value);
	if (match === null) {
		throw new Error(`--at wants HH:MM in 24-hour time, zero-padded, and got '${value}'.`);
	}

	const hour = Number(match[1]);
	const minute = Number(match[2]);
	if (hour > 23 || minute > 59) {
		throw new Error(`--at wants a real time of day and got '${value}'.`);
	}

	return { hour, minute };
}

function usage(): void {
	console.error(`usage: pnpm schedule [--print] [--status] [--uninstall] [--at HH:MM] [--scheduler launchd|systemd|cron] [--env-file PATH]

  (no flags)   write the scheduler config for this machine and load it
  --print      render what would be written, to stdout, and touch nothing
  --status     report what is actually loaded on this machine
  --uninstall  unload the job and remove its config; never touches the env file or the deploy key
  --at         time of day, local, 24-hour, zero-padded. Default 06:00
  --scheduler  override detection, mostly so --print can render another machine's config
  --env-file   where daily-run.sh reads the coordinates from. Default ~/.config/rootstock/env
  --checkout   the checkout the job runs in. Default this one; prefer a clone that only holds main

docs: docs/operations/daily-run.md`);
}

interface Effects {
	which: (name: string) => string | undefined;
	exists: (target: string) => boolean;
	readFile: (target: string) => string;
	writeFile: (target: string, contents: string, mode: number) => void;
	mkdir: (target: string) => void;
	spawn: (command: string, args: readonly string[], input?: string) => { status: number; stdout: string };
	log: (line: string) => void;
	warn: (line: string) => void;
	platform: string;
	home: string;
	repoRoot: string;
	uid: number;
}

/**
 * The CLI. Returns an exit code rather than calling `process.exit`, for the reason
 * `scripts/generate.ts` gives: exiting mid-flush swallows the paths it just printed.
 */
export function main(argv: readonly string[], effects: Effects): number {
	if (argv.includes('-h') || argv.includes('--help')) {
		usage();
		return 0;
	}

	const print = argv.includes('--print');
	const status = argv.includes('--status');
	const uninstall = argv.includes('--uninstall');

	let hour = 6;
	let minute = 0;
	let scheduler: Scheduler | undefined;
	let envFile = defaultEnvFile(effects.home);
	/*
	 * The checkout the job runs in, which is usually not this one. A tree shared with development
	 * sits on a feature branch half the time, and `daily-run.sh` refuses to publish from one, so a
	 * scheduled job wants a clone that only ever holds main.
	 */
	let checkout = effects.repoRoot;

	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index];
		const value = argv[index + 1];
		try {
			if (flag === '--at') {
				({ hour, minute } = parseAt(value ?? ''));
			}
			else if (flag === '--scheduler') {
				if (value !== 'launchd' && value !== 'systemd' && value !== 'cron') {
					throw new Error(`--scheduler wants launchd, systemd, or cron, and got '${value ?? ''}'.`);
				}
				scheduler = value;
			}
			else if (flag === '--env-file') {
				if (value === undefined) {
					throw new Error('--env-file wants a path.');
				}
				envFile = value;
			}
			else if (flag === '--checkout') {
				if (value === undefined) {
					throw new Error('--checkout wants a path to a checkout of this repository.');
				}
				checkout = value;
			}
		}
		catch (cause) {
			effects.warn(cause instanceof Error ? cause.message : String(cause));
			return 2;
		}
	}

	const resolved = resolvePathEntries(effects.which, effects.home, effects.platform, effects.exists);
	if (resolved.missing.length > 0 && !status) {
		effects.warn(`Cannot schedule a job that will not run: ${resolved.missing.join(', ')} not found on PATH. Install ${resolved.missing.length === 1 ? 'it' : 'them'} and try again.`);
		return 2;
	}

	const context: ScheduleContext = {
		scheduler: scheduler ?? detectScheduler(effects.platform, effects),
		repoRoot: checkout,
		home: effects.home,
		hour,
		minute,
		pathEntries: resolved.entries,
		envFile,
		uid: effects.uid,
		logDirectory: effects.platform === 'darwin'
			? path.join(effects.home, 'Library', 'Logs', 'rootstock')
			: path.join(effects.home, '.local', 'state', 'rootstock'),
	};

	if (status) {
		return reportStatus(context, effects);
	}

	const plan = planInstall(context);

	if (context.scheduler === 'cron') {
		return manageCrontab(context, plan, effects, { print, uninstall });
	}

	if (uninstall) {
		return removeJob(context, plan, effects);
	}

	if (print) {
		for (const file of plan.files) {
			effects.log(`# --- ${file.path} ---`);
			effects.log(file.contents.replace(/\n$/, ''));
			effects.log('');
		}
		effects.log('# --- activate ---');
		for (const command of plan.activate) {
			effects.log(`# ${command.join(' ')}`);
		}
		effects.log('');
		effects.log(`# --- environment ---`);
		effects.log(`# ${context.envFile}  (not written by --print; holds the coordinates, ADR 0004)`);
		for (const warning of [...plan.warnings, ...resolved.warnings]) {
			effects.warn(warning);
		}
		return 0;
	}

	for (const file of plan.files) {
		effects.mkdir(path.dirname(file.path));
		effects.writeFile(file.path, file.contents, file.mode);
		effects.log(`wrote ${file.path}`);
	}
	effects.mkdir(context.logDirectory);
	ensureEnvFile(context, effects);

	for (const command of plan.activate) {
		// The first launchctl command is a bootout of a job that may not be loaded, and systemd's
		// linger call is a no-op when it is already set. Both are expected to fail sometimes, and the
		// install is defined by the state afterwards rather than by any one command's code.
		effects.spawn(command[0], command.slice(1));
	}

	effects.log(`scheduled ${LABEL} for ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} local, via ${context.scheduler}`);
	for (const warning of [...plan.warnings, ...resolved.warnings]) {
		effects.warn(warning);
	}
	return 0;
}

function ensureEnvFile(context: ScheduleContext, effects: Effects): void {
	if (!effects.exists(context.envFile)) {
		effects.mkdir(path.dirname(context.envFile));
		effects.writeFile(context.envFile, renderEnvTemplate(), 0o600);
		effects.log(`wrote ${context.envFile} with blank values; fill it in before the first run`);
		return;
	}

	// Read back rather than assume. The installer cannot know the coordinates and is not supposed to,
	// so the most useful thing it can do is say which names are still empty.
	const blank = ['ROOTSTOCK_LATITUDE', 'ROOTSTOCK_LONGITUDE', 'ROOTSTOCK_TIME_ZONE'].filter((name) => {
		const match = new RegExp(`^${name}=(.*)$`, 'm').exec(effects.readFile(context.envFile));
		return match?.[1] === undefined || match[1].trim() === '';
	});

	if (blank.length > 0) {
		effects.warn(`${context.envFile} still has no value for ${blank.join(', ')}. The run fails loudly without them.`);
	}
}

function removeJob(context: ScheduleContext, plan: InstallPlan, effects: Effects): number {
	const uid = context.uid;
	const commands: Command[] = context.scheduler === 'launchd'
		? [['launchctl', 'bootout', `gui/${uid}/${LABEL}`]]
		: [['systemctl', '--user', 'disable', '--now', 'rootstock-daily.timer']];

	for (const command of commands) {
		effects.spawn(command[0], command.slice(1));
	}
	for (const file of plan.files) {
		effects.spawn('rm', ['-f', file.path]);
		effects.log(`removed ${file.path}`);
	}
	if (context.scheduler === 'systemd') {
		effects.spawn('systemctl', ['--user', 'daemon-reload']);
	}

	// Neither of these is the installer's to delete. The coordinates exist on exactly one machine per
	// ADR 0004, and revoking the deploy key is a GitHub-side action; wiping either as a side effect of
	// "stop the job for a week" is the wrong default.
	effects.log(`left ${context.envFile} in place`);
	effects.log('left the deploy key in place; revoke it on GitHub if that is what you meant');
	return 0;
}

function reportStatus(context: ScheduleContext, effects: Effects): number {
	const command: Command = context.scheduler === 'launchd'
		? ['launchctl', 'print', `gui/${context.uid}/${LABEL}`]
		: context.scheduler === 'systemd'
			? ['systemctl', '--user', 'list-timers', 'rootstock-daily.timer']
			: ['crontab', '-l'];

	const result = effects.spawn(command[0], command.slice(1));
	if (result.status !== 0) {
		effects.log(`no ${context.scheduler} job named ${LABEL} is loaded on this machine`);
		return 0;
	}

	effects.log(context.scheduler === 'cron'
		? result.stdout.split('\n').filter(line => line.includes('rootstock')).join('\n')
		: result.stdout.trim());
	return 0;
}

function manageCrontab(
	context: ScheduleContext,
	plan: InstallPlan,
	effects: Effects,
	options: { print: boolean; uninstall: boolean },
): number {
	const block = options.uninstall ? null : renderCrontabBlock(context);

	if (options.print) {
		effects.log('# --- crontab ---');
		effects.log(block ?? '');
		effects.log('');
		effects.log('# --- activate ---');
		effects.log('# crontab -l | ... | crontab -   (pnpm schedule does this for you)');
		effects.log('');
		effects.log(`# --- environment ---`);
		effects.log(`# ${context.envFile}  (not written by --print; holds the coordinates, ADR 0004)`);
		for (const warning of plan.warnings) {
			effects.warn(warning);
		}
		return 0;
	}

	const listed = effects.spawn('crontab', ['-l']);
	const existing = listed.status === 0 ? listed.stdout : '';

	let updated: string;
	try {
		updated = rewriteCrontab(existing, block);
	}
	catch (cause) {
		effects.warn(cause instanceof Error ? cause.message : String(cause));
		return 2;
	}

	effects.mkdir(context.logDirectory);
	if (!options.uninstall) {
		ensureEnvFile(context, effects);
	}
	effects.spawn('crontab', ['-'], updated);
	effects.log(options.uninstall ? 'removed the rootstock block from the crontab' : 'wrote the rootstock block into the crontab');
	for (const warning of plan.warnings) {
		effects.warn(warning);
	}
	return 0;
}

/* Only run when this file is the program, so the spec can import the renderers without installing. */
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	process.exitCode = main(process.argv.slice(2), {
		// `sh -c` with the name as a positional, never `shell: true` with it concatenated into the
		// command string. Node deprecated that shape for exactly the reason it looks wrong.
		which: (name) => {
			const found = spawnSync('sh', ['-c', 'command -v "$1"', 'sh', name], { encoding: 'utf8' });
			const target = found.stdout.trim();
			return found.status === 0 && target !== '' ? target : undefined;
		},
		exists: target => existsSync(target),
		readFile: target => readFileSync(target, 'utf8'),
		writeFile: (target, contents, mode) => {
			writeFileSync(target, contents);
			chmodSync(target, mode);
		},
		mkdir: target => void mkdirSync(target, { recursive: true }),
		spawn: (command, args, input) => {
			const result = spawnSync(command, [...args], { encoding: 'utf8', input });
			return { status: result.status ?? 1, stdout: result.stdout ?? '' };
		},
		log: line => console.log(line),
		warn: line => console.error(line),
		platform: process.platform,
		home: process.env.HOME ?? '',
		repoRoot: path.resolve(import.meta.dirname, '..'),
		uid: process.getuid?.() ?? 0,
	});
}
