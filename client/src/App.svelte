<script lang="ts">
	export let mapReady: boolean;
	import ConfigScreen from "./ConfigScreen.svelte";
	import ResultScreen from "./ResultScreen.svelte";
	import { getPath } from "./request";
	// import type { env } from "process";
	let selectedPlace: google.maps.LatLngLiteral;
	// let waypoints: google.maps.DirectionsWaypoint[];
	let libraries: any[];
	let showConfig = true;

	const pathToMap = (
		selectedPlace: google.maps.LatLngLiteral,
		distance: number
	) => {
		showConfig = false;
		getPath(selectedPlace, distance).then((result: any[]) => {
			libraries = result;

			// console.log(`waypoints: ${JSON.stringify(waypoints)}`);
		});
	};
</script>

<svelte:head>
	<script
		defer
		async
		src={`https://maps.googleapis.com/maps/api/js?key=${process.env.GOOGLE_API_KEY}&callback=initMap&libraries=places,directions`}>
	</script>
</svelte:head>
<header
	class="flex-initial pt-4 md:pt-8 pb-28 md:pb-32 bg-gradient-to-r from-indigo-900 to-fuchsia-900 text-gray-50">
	<nav class="max-w-2xl mx-2 sm:mx-10 md:mx-auto">
		<img src="./assets/logo.svg" alt="Little Free Library Walk" class="w-48" />
	</nav>
</header>
<main class="flex-1 -mt-24 space-y-2">
	{#if showConfig}
		<ConfigScreen {pathToMap} bind:selectedPlace {mapReady} />
	{:else}
		<ResultScreen bind:selectedPlace bind:libraries bind:showConfig />
	{/if}
</main>
<footer class="flex-initial bg-gray-700 text-gray-50 mt-5">
	<a
		class="max-w-2xl mx-2 sm:mx-10 md:mx-auto py-4 block text-sm"
		href="https://github.com/lauraschultz/little-free-library-walk"
		target="_blank"
		rel="noreferer">
		<svg
			class="w-4 h-4 inline-block mr-1"
			fill="currentColor"
			viewBox="0 0 20 20"
			xmlns="http://www.w3.org/2000/svg"><path
				d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
		star on Github
	</a>
</footer>
