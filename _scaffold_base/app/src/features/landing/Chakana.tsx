/** Andean stepped cross (chakana) used as the Minka mark. */
export function Chakana({ size = 28 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 12 12"
			aria-hidden="true"
			focusable="false"
		>
			<defs>
				<linearGradient id="chakana-fill" x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stopColor="#ffb733" />
					<stop offset="1" stopColor="#ee295c" />
				</linearGradient>
			</defs>
			<path
				fill="url(#chakana-fill)"
				fillRule="evenodd"
				d="M4 0h4v2h2v2h2v4h-2v2H8v2H4v-2H2V8H0V4h2V2h2zM6 4.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"
			/>
		</svg>
	)
}
