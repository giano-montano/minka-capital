import createGlobe, { type Arc, type Marker } from "cobe"
import { useEffect, useRef } from "react"
import styles from "./Landing.module.css"

type LatLon = [number, number]

// Peruvian startup hubs on the demo map. Lima is the capital "hub" that every
// arc departs from, like capital flowing to the regions.
const LIMA: LatLon = [-12.0464, -77.0428]
const CITIES: { id: string; name: string; location: LatLon }[] = [
	{ id: "lima", name: "Lima", location: LIMA },
	{ id: "cusco", name: "Cusco", location: [-13.5319, -71.9675] },
	{ id: "arequipa", name: "Arequipa", location: [-16.409, -71.5375] },
	{ id: "trujillo", name: "Trujillo", location: [-8.1116, -79.0288] },
	{ id: "iquitos", name: "Iquitos", location: [-3.7437, -73.2516] },
	{ id: "piura", name: "Piura", location: [-5.1945, -80.6328] },
	{ id: "puno", name: "Puno", location: [-15.8402, -70.0219] },
]

// Andean textile palette (cochineal red, Inca gold, jungle green) in 0-1 RGB.
const COCHINEAL: [number, number, number] = [0.93, 0.16, 0.36]
const INCA_GOLD: [number, number, number] = [1, 0.72, 0.2]
const JUNGLE: [number, number, number] = [0.2, 0.85, 0.6]

const MARKERS: Marker[] = CITIES.map((city, i) => ({
	id: city.id,
	location: city.location,
	size: city.id === "lima" ? 0.09 : 0.05,
	color: city.id === "lima" ? COCHINEAL : i % 2 ? INCA_GOLD : JUNGLE,
}))

const ARCS: Arc[] = CITIES.slice(1).map((city) => ({
	id: `lima-${city.id}`,
	from: LIMA,
	to: city.location,
}))

// cobe's angles that put a lat/lon in front of the camera.
const PERU_PHI = Math.PI - ((-75 * Math.PI) / 180 - Math.PI / 2)
const PERU_THETA = 0.15

/**
 * WebGL globe (cobe) that rests on Peru. Drag to spin it; on release it eases
 * back to Peru. City labels are DOM elements anchored to the markers through
 * CSS anchor positioning, so they fade when a city turns behind the globe.
 */
export function PeruGlobe() {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const reduceMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches
		let width = canvas.offsetWidth
		let phi = PERU_PHI + 1.2 // start away from Peru and sweep in
		let theta = PERU_THETA
		let drag: { x: number; y: number; phi: number; theta: number } | null = null
		let time = 0
		let frame = 0

		const globe = createGlobe(canvas, {
			devicePixelRatio: Math.min(window.devicePixelRatio, 2),
			width: width * 2,
			height: width * 2,
			phi,
			theta,
			dark: 1,
			diffuse: 1.4,
			mapSamples: 20000,
			mapBrightness: 7,
			mapBaseBrightness: 0.02,
			baseColor: [0.16, 0.13, 0.3],
			markerColor: INCA_GOLD,
			glowColor: [0.55, 0.2, 0.45],
			markers: MARKERS,
			arcs: ARCS,
			arcColor: INCA_GOLD,
			arcWidth: 0.6,
			arcHeight: 0.25,
			markerElevation: 0.02,
			scale: 1.05,
		})

		const loop = () => {
			time += 1
			if (!drag) {
				// Ease back to Peru with a gentle sway so it never looks frozen.
				const sway = reduceMotion ? 0 : Math.sin(time / 140) * 0.18
				phi += (PERU_PHI + sway - phi) * 0.035
				theta += (PERU_THETA - theta) * 0.05
			}
			globe.update({ phi, theta, width: width * 2, height: width * 2 })
			frame = requestAnimationFrame(loop)
		}
		frame = requestAnimationFrame(loop)

		const onDown = (e: PointerEvent) => {
			drag = { x: e.clientX, y: e.clientY, phi, theta }
			canvas.setPointerCapture(e.pointerId)
		}
		const onMove = (e: PointerEvent) => {
			if (!drag) return
			phi = drag.phi + (e.clientX - drag.x) / 160
			theta = Math.max(
				-0.8,
				Math.min(0.8, drag.theta + (e.clientY - drag.y) / 300),
			)
		}
		const onUp = () => {
			drag = null
		}
		const onResize = () => {
			width = canvas.offsetWidth
		}

		canvas.addEventListener("pointerdown", onDown)
		canvas.addEventListener("pointermove", onMove)
		canvas.addEventListener("pointerup", onUp)
		canvas.addEventListener("pointercancel", onUp)
		window.addEventListener("resize", onResize)
		requestAnimationFrame(() => canvas.classList.add(styles.globeReady ?? ""))

		return () => {
			cancelAnimationFrame(frame)
			canvas.removeEventListener("pointerdown", onDown)
			canvas.removeEventListener("pointermove", onMove)
			canvas.removeEventListener("pointerup", onUp)
			canvas.removeEventListener("pointercancel", onUp)
			window.removeEventListener("resize", onResize)
			globe.destroy()
		}
	}, [])

	return (
		<div className={styles.globeWrap}>
			<canvas
				ref={canvasRef}
				className={styles.globe}
				aria-label="Globo interactivo centrado en Perú; arrástralo para girarlo"
			/>
			{CITIES.map((city) => (
				<span
					key={city.id}
					className={styles.cityLabel}
					style={
						{
							positionAnchor: `--cobe-${city.id}`,
							opacity: `var(--cobe-visible-${city.id}, 0)`,
						} as React.CSSProperties
					}
				>
					{city.name}
				</span>
			))}
		</div>
	)
}
