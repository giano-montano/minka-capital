import { labPrefix } from "@stellar-scaffold/app-lib"
import { NavLink, Outlet, Route, Routes } from "react-router-dom"
import styles from "./App.module.css"
import ConnectAccount from "./components/ConnectAccount"
import Debug from "./pages/Debug"
import Home from "./pages/Home"
import Landing from "./pages/Landing"

function App() {
	return (
		<Routes>
			<Route path="/" element={<Landing />} />
			<Route element={<AppLayout />}>
				<Route path="/app" element={<Home />} />
				<Route path="/debug" element={<Debug />} />
				<Route path="/debug/:contractName" element={<Debug />} />
			</Route>
		</Routes>
	)
}

const AppLayout = () => (
	<div className={styles.AppLayout}>
		<header className={styles.header}>
			<NavLink to="/" className={styles.logo}>
				Minka Capital
			</NavLink>
			<nav className={styles.headerNav}>
				<NavLink
					to="/app"
					className={({ isActive }) => (isActive ? styles.active : "")}
				>
					Dashboard
				</NavLink>
				<NavLink
					to="/debug"
					className={({ isActive }) => (isActive ? styles.active : "")}
				>
					Contract Explorer
				</NavLink>
				<a href={labPrefix()} target="_blank" rel="noreferrer">
					Transaction Explorer
				</a>
			</nav>
			<ConnectAccount />
		</header>

		<main className={styles.main}>
			<Outlet />
		</main>

		<footer className={styles.footer}>
			<nav className={styles.footerNav}>
				<span>
					Prototipo en Stellar Testnet · No es una oferta de inversión
				</span>
				<a
					href="https://github.com/giano-montano/stellar-hackathon-wazaa"
					target="_blank"
					rel="noreferrer"
				>
					GitHub
				</a>
			</nav>
		</footer>
	</div>
)

export default App
