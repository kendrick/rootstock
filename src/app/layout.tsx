import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import './globals.css';

export const metadata: Metadata = {
	title: 'rootstock',
	description: 'Yard tasks, each one cited to the rule and the reading that produced it.',
};

export default function RootLayout({ children }: LayoutProps<'/'>): ReactElement {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
