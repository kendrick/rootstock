import type { DailyAggregate } from '@/planner/plan';
import type { Citation } from '@/planner/task';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { thresholdRule, yardArtifact } from './fixtures';
import { SoilSparkline } from './soil-sparkline';

const planWindow = yardArtifact.plan.window;
const projection = yardArtifact.plan.tasks[0]!.citation;

/** The days this Rule reads, derived here the same way the component has to derive them, so a component that hard-coded soil temperature at 6 cm fails against a Rule that moved. */
const soilDays = [...planWindow]
	.filter(day => day.variable === thresholdRule.variable && day.depthCm === thresholdRule.depthCm && day.aggregate === thresholdRule.aggregate)
	.sort((left, right) => left.date.localeCompare(right.date));

const DAY_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function dayLabel(date: string): string {
	return DAY_FORMAT.format(Date.parse(`${date}T00:00:00Z`));
}

/**
 * Rebuilds the plotted series from the polylines the component actually drew,
 * rather than from a geometry helper it also exports. Every run after the first
 * repeats its predecessor's last point so the line joins across the
 * observed/forecast boundary, so the repeat is dropped here to get one point
 * per day back.
 */
function seriesPoints(container: HTMLElement): { x: number; y: number }[] {
	return [...container.querySelectorAll('polyline')].flatMap((polyline, index) => {
		const parsed = (polyline.getAttribute('points') ?? '')
			.trim()
			.split(/\s+/)
			.map((pair) => {
				const [x, y] = pair.split(',').map(Number);
				return { x: x!, y: y! };
			});
		return index === 0 ? parsed : parsed.slice(1);
	});
}

function polylineFor(container: HTMLElement, basis: 'observed' | 'forecast'): SVGPolylineElement {
	return container.querySelector<SVGPolylineElement>(`polyline[data-basis="${basis}"]`)!;
}

function thresholdLine(container: HTMLElement): SVGLineElement {
	return container.querySelector<SVGLineElement>('[data-role="threshold"]')!;
}

describe('soilSparkline', () => {
	it('draws every day the Rule reads, in date order, and no day it does not', () => {
		// A precipitation day and a soil day at another depth: both are real
		// shapes for `Plan.window` to carry, and both belong to a different Rule.
		const foreign: DailyAggregate[] = [
			{ ...soilDays[0]!, variable: 'precipitation', depthCm: null, unit: 'mm', aggregate: 'sum' },
			{ ...soilDays[0]!, depthCm: 18 },
		];
		const { container } = render(
			<SoilSparkline window={[...foreign, ...planWindow].reverse()} rule={thresholdRule} citation={null} />,
		);

		const points = seriesPoints(container);
		expect(points).toHaveLength(soilDays.length);
		expect(points.map(point => point.x)).toEqual([...points.map(point => point.x)].sort((left, right) => left - right));
	});

	/*
	 * The failure this component exists to avoid. A threshold scaled to the
	 * series alone leaves the plot the moment every reading sits on one side of
	 * it, which is the normal February case — and a reference line nobody can
	 * see answers "how close are we" with silence.
	 */
	it('puts the threshold line on the same scale as the series', () => {
		const { container } = render(<SoilSparkline window={planWindow} rule={thresholdRule} citation={null} />);

		const line = thresholdLine(container);
		const thresholdY = Number(line.getAttribute('y1'));
		expect(Number(line.getAttribute('y2'))).toBe(thresholdY);

		const points = seriesPoints(container);
		const belowIndex = soilDays.findIndex(day => day.value < thresholdRule.value);
		const aboveIndex = soilDays.findIndex(day => day.value > thresholdRule.value);
		expect(belowIndex).toBeGreaterThanOrEqual(0);
		expect(aboveIndex).toBeGreaterThanOrEqual(0);

		// SVG y grows downward, so a warmer day sits at a smaller y than the
		// threshold and a cooler day at a larger one.
		expect(points[aboveIndex]!.y).toBeLessThan(thresholdY);
		expect(points[belowIndex]!.y).toBeGreaterThan(thresholdY);
	});

	it('keeps the threshold inside the plot when no reading comes near it', () => {
		// 80F over a spring window that tops out in the fifties: every point is
		// below the line, and the line still has to be on the chart.
		const unreachable = { ...thresholdRule, value: 80 };
		const { container } = render(<SoilSparkline window={planWindow} rule={unreachable} citation={null} />);

		const thresholdY = Number(thresholdLine(container).getAttribute('y1'));
		const points = seriesPoints(container);

		expect(thresholdY).toBeGreaterThan(0);
		expect(thresholdY).toBeLessThan(170);
		expect(Math.min(...points.map(point => point.y))).toBeGreaterThan(thresholdY);
		expect(container.textContent).toContain('80°F threshold');
	});

	it('names the threshold value and unit in text', () => {
		const { container } = render(<SoilSparkline window={planWindow} rule={thresholdRule} citation={null} />);

		expect(container.textContent).toContain('55°F');
	});

	it('marks the day a projection Citation names, on that day\'s own point', () => {
		const { container } = render(<SoilSparkline window={planWindow} rule={thresholdRule} citation={projection} />);

		expect(projection.kind).toBe('threshold-projection');
		const projectedDate = projection.kind === 'threshold-projection' ? projection.projectedDate : '';
		const index = soilDays.findIndex(day => day.date === projectedDate);
		expect(index).toBeGreaterThanOrEqual(0);

		const marker = container.querySelector('[data-role="marked-day"]')!;
		const point = seriesPoints(container)[index]!;
		expect(Number(marker.getAttribute('cx'))).toBeCloseTo(point.x, 1);
		expect(Number(marker.getAttribute('cy'))).toBeCloseTo(point.y, 1);

		// A marker on its own is a shape-only encoding, so the date is written out
		// beside it.
		const label = container.querySelector('[data-role="marked-day-label"]')!;
		expect(label.textContent).toContain(dayLabel(projectedDate));
		expect(label.textContent).toContain('Projected');
	});

	it('marks a threshold Citation\'s last satisfied day instead', () => {
		const satisfied = soilDays[10]!;
		const citation: Citation = {
			kind: 'threshold',
			variable: thresholdRule.variable,
			depthCm: thresholdRule.depthCm,
			aggregate: thresholdRule.aggregate,
			from: soilDays[8]!.date,
			to: satisfied.date,
		};
		const { container } = render(<SoilSparkline window={planWindow} rule={thresholdRule} citation={citation} />);

		const index = soilDays.findIndex(day => day.date === satisfied.date);
		const marker = container.querySelector('[data-role="marked-day"]')!;
		expect(Number(marker.getAttribute('cx'))).toBeCloseTo(seriesPoints(container)[index]!.x, 1);
		expect(container.querySelector('[data-role="marked-day-label"]')?.textContent).toContain(dayLabel(satisfied.date));
	});

	it('marks nothing for a Citation that never read this series, or for none at all', () => {
		const cadence: Citation = { kind: 'cadence', lastOccurrenceId: 'deep-water-fig-2026-08-24', elapsedDays: 18 };
		const { container: withCadence } = render(<SoilSparkline window={planWindow} rule={thresholdRule} citation={cadence} />);
		const { container: withNone } = render(<SoilSparkline window={planWindow} rule={thresholdRule} citation={null} />);

		expect(withCadence.querySelector('[data-role="marked-day"]')).toBeNull();
		expect(withNone.querySelector('[data-role="marked-day"]')).toBeNull();
	});

	it('says so when the cited day falls outside the window the plan ships', () => {
		// ADR 0003's own consequence: a Rule reaching past the window produces a
		// Citation the interface cannot draw.
		const citation: Citation = {
			kind: 'threshold-projection',
			variable: thresholdRule.variable,
			depthCm: thresholdRule.depthCm,
			aggregate: thresholdRule.aggregate,
			projectedDate: '2026-12-25',
		};
		const { container } = render(<SoilSparkline window={planWindow} rule={thresholdRule} citation={citation} />);

		expect(container.querySelector('[data-role="marked-day"]')).toBeNull();
		expect(container.textContent).toContain('falls outside the window');
	});

	/*
	 * The shell has a single monochrome palette, so the ramp step between the two
	 * runs is the weakest channel on the chart. What this asserts is the second
	 * channel: strip every colour and the forecast days are still forecast days.
	 */
	it('distinguishes forecast days from observed by something other than stroke colour', () => {
		const { container } = render(<SoilSparkline window={planWindow} rule={thresholdRule} citation={null} />);

		const observed = polylineFor(container, 'observed');
		const forecast = polylineFor(container, 'forecast');

		expect(observed.getAttribute('stroke-dasharray')).toBeNull();
		expect(forecast.getAttribute('stroke-dasharray')).toBeTruthy();

		// And in words, for a reader who is not going to squint at a dash pattern.
		const legend = container.querySelector('ul')!;
		expect(legend.textContent).toContain('Observed');
		expect(legend.textContent).toContain('Forecast');
	});

	it('joins the forecast run to the observed one so the line does not appear to break', () => {
		const { container } = render(<SoilSparkline window={planWindow} rule={thresholdRule} citation={null} />);

		// One run of each basis, not one polyline per day: a splitter that starts a
		// fresh run on every point still joins, and still draws a stack of
		// two-point segments nobody meant.
		expect(container.querySelectorAll('polyline')).toHaveLength(2);

		const parse = (polyline: SVGPolylineElement): string[] => (polyline.getAttribute('points') ?? '').trim().split(/\s+/);
		expect(parse(polylineFor(container, 'forecast'))[0]).toBe(parse(polylineFor(container, 'observed')).at(-1));
	});

	it('reads provenance off the data rather than asserting it', () => {
		const { container: modeled } = render(<SoilSparkline window={planWindow} rule={thresholdRule} citation={null} />);
		expect(modeled.textContent).toContain('modeled');

		const probed = planWindow.map(day => ({ ...day, provenance: 'measured' as const }));
		const { container: measured } = render(<SoilSparkline window={probed} rule={thresholdRule} citation={null} />);
		expect(measured.textContent).toContain('measured at a probe');

		const mixed = planWindow.map((day, index) => (index % 2 === 0 ? { ...day, provenance: 'measured' as const } : day));
		const { container: both } = render(<SoilSparkline window={mixed} rule={thresholdRule} citation={null} />);
		expect(both.textContent).toContain('Modeled and measured days are mixed');
	});

	it('renders a sentence, not an empty chart, when the window carries nothing this Rule reads', () => {
		const { container } = render(<SoilSparkline window={[]} rule={thresholdRule} citation={projection} />);

		expect(container.querySelector('svg')).toBeNull();
		const sentence = container.textContent ?? '';
		expect(sentence).toContain('no daily mean soil temperature at 6 cm readings');
		expect(sentence.trim().endsWith('.')).toBe(true);
	});

	it('renders the same sentence when the window holds only days belonging to another Rule', () => {
		const rainOnly = planWindow.map(day => ({ ...day, variable: 'precipitation' as const, depthCm: null, unit: 'mm' as const }));
		const { container } = render(<SoilSparkline window={rainOnly} rule={thresholdRule} citation={null} />);

		expect(container.querySelector('svg')).toBeNull();
		expect(container.textContent).toContain('nothing to draw against the 55°F threshold');
	});

	it('carries a table view holding every value the chart draws', () => {
		const { container } = render(<SoilSparkline window={planWindow} rule={thresholdRule} citation={null} />);

		expect(container.querySelector('details')).not.toBeNull();
		const rows = [...container.querySelectorAll('tbody tr')];
		expect(rows).toHaveLength(soilDays.length);
		expect(rows[0]!.textContent).toContain(dayLabel(soilDays[0]!.date));
		expect(rows.at(-1)!.textContent).toContain('Forecast');
		expect(rows[0]!.textContent).toContain('Observed');
	});

	it('describes itself with a real title and desc rather than an aria-label', () => {
		const { container } = render(<SoilSparkline window={planWindow} rule={thresholdRule} citation={projection} />);

		const svg = container.querySelector('svg')!;
		expect(svg.getAttribute('role')).toBe('img');
		expect(svg.getAttribute('aria-label')).toBeNull();

		const title = svg.querySelector('title')!;
		const desc = svg.querySelector('desc')!;
		// The two elements have to be the ones the svg points at, not merely
		// present: an aria-labelledby naming ids nothing carries labels nothing.
		expect(svg.getAttribute('aria-labelledby')).toBe(`${title.id} ${desc.id}`);
		expect(title.textContent).toContain('55°F threshold');

		expect(desc.textContent).toContain('observed');
		expect(desc.textContent).toContain('forecast');
		// Where the series stands against the threshold, not just that one exists.
		expect(desc.textContent).toContain('sit at or above it');
	});
});
