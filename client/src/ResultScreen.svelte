<script lang="ts">
	import ResultsMap from "./ResultsMap.svelte";
	import { fly } from "svelte/transition";
	export let selectedPlace: google.maps.LatLngLiteral;
	export let showConfig: boolean;
	export let libraries: any[];
	let libraryChosen = false;
	let waypoints: google.maps.DirectionsWaypoint[];

	let selectedLibrary = 0;
	const letters = [
		"A",
		"B",
		"C",
		"D",
		"E",
		"F",
		"G",
		"H",
		"I",
		"J",
		"K",
		"L",
		"M",
		"N",
		"O",
		"P",
		"Q",
		"R",
		"S",
	];
	const reset = () => {
		libraries = undefined;
		selectedLibrary = 0;
		showConfig = true;
	};
	$: {
		if (libraries) {
			waypoints = libraries.map((r) => {
				const loc = r.Library_Geolocation__c;
				return {
					location: `${loc.latitude},${loc.longitude}`,
					stopover: true,
				};
			});
		}
	}
</script>

<div
	in:fly={{ x: 300, duration: 200, delay: 200 }}
	out:fly={{ x: 300, duration: 200 }}
	class="max-w-2xl rounded-xl bg-gray-50 border border-gray-400 shadow-xl mx-2 sm:mx-10 md:mx-auto p-4 md:p-6 ">
	{#if libraries}
		{#if libraries.length > 0}
			<ResultsMap
				{selectedPlace}
				{waypoints}
				selectedLibrary={libraryChosen ? libraries[selectedLibrary] : null} />
			<div class="rounded border border-gray-200 flex mt-4">
				<ul
					class="inline-block w-1/4 sm:w-5/12 divide-y divide-gray-300 overflow-x-hidden bg-gray-200">
					{#each libraries as lib, i}
						<li
							class={'cursor-pointer leading-none pl-2 py-2 overflow-hidden overflow-ellipsis whitespace-nowrap text-sm ' + (selectedLibrary === i ? 'bg-gray-50 shadow rounded-l' : 'shadow-inner')}
							on:click={() => {
								selectedLibrary = i;
								libraryChosen = true;
							}}>
							<span
								class="leading-none  w-4 inline-block text-center h-4 py-0.5 bg-red-500 text-gray-50 font-bold mr-1 text-xs rounded-full">{letters[i]}</span>
							{lib.List_As_Name__c || lib.Library_Name__c}
						</li>
					{/each}
				</ul>
				<div class="inline-block w-3/4 sm:w-7/12 px-3 md:px-6 py-3">
					<h3 class="text-lg leading-none my-1 pb-1 border-b border-gray-300">
						{libraries[selectedLibrary].List_As_Name__c || libraries[selectedLibrary].Library_Name__c}
					</h3>
					<p class="text-xs uppercase tracking-wide text-gray-600">
						{libraries[selectedLibrary].Street__c}
					</p>
					<p class="leading-tight">
						{libraries[selectedLibrary].Library_Story__c || ''}
					</p>
				</div>
			</div>
		{:else}
			<p class="font-bold text-lg">
				<!-- <svg
					class="w-6 h-6 inline-block mr-1 "
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> -->
				Nothing found for the address you selected.
			</p><img
				src="assets/person_with_map.png"
				class="max-w-md mx-auto my-4 w-full"
				alt="woman holding a map" />
		{/if}
	{:else}calculating your route...{/if}
</div>
<div
	in:fly={{ x: 300, duration: 200, delay: 200 }}
	out:fly={{ x: 300, duration: 200 }}
	class="max-w-2xl rounded-xl bg-gray-50 border border-gray-400 shadow-xl mx-2 sm:mx-10 md:mx-auto px-4 md:px-6 py-2">
	<button on:click={reset}><svg
			class="w-6 h-6 inline-block mr-2 hover:text-indigo-800"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"><path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg>Go
		back</button>
</div>
