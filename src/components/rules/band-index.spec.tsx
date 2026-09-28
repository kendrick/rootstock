import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BandIndex } from './band-index';
import { BANDS } from './bands';

describe('bandIndex', () => {
	it('links each band it is handed to that band\'s heading', () => {
		render(<BandIndex bands={BANDS.filter(({ band }) => band !== 'approaching')} />);

		const nav = screen.getByRole('navigation', { name: 'On this page' });
		const links = [...nav.querySelectorAll('a')].map(link => [link.textContent, link.getAttribute('href')]);
		expect(links).toEqual([
			['Fired this week', '#band-fired'],
			['Waiting', '#band-waiting'],
			['Guards', '#band-guard'],
		]);
	});
});
