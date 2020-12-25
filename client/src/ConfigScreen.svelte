<script lang="ts">
	import MapBase from "./MapBase.svelte";
	import { fly } from "svelte/transition";
	export let mapReady = false;
	export let selectedPlace: google.maps.LatLngLiteral;
	export let pathToMap;
	let error = false;
	let miles = 2;
	$: {
		if (selectedPlace) {
			error = false;
		}
	}
</script>

<div
	out:fly={{ x: -300, duration: 200 }}
	in:fly={{ x: -300, duration: 200, delay: 200 }}
	class="max-w-2xl rounded-xl bg-gray-50 border border-gray-400 shadow-xl mx-2 sm:mx-10 md:mx-auto p-4 md:p-6 ">
	<div class="flex items-center mb-4">
		<span
			class="flex-initial border-4 border-fuchsia-800 text-fuchsia-800 font-black text-3xl leading-none px-3.5 py-2 rounded-full">1</span>
		<h2
			class="flex-1 font-bold text-2xl border-b border-gray-300 italic leading-none mx-4">
			Choose your start and end point
		</h2>
	</div>
	<p class="ml-2">Type an address in the box or click any point on the map</p>

	{#if mapReady}
		<MapBase bind:selectedPlace />
	{/if}

	<div class="flex items-center my-4">
		<span
			class="flex-initial border-4 border-fuchsia-800 text-fuchsia-800 font-black text-3xl leading-none px-3.5 py-2 rounded-full">2</span>
		<h2
			class="flex-1 font-bold text-2xl border-b border-gray-300 italic leading-none mx-4">
			Choose your route length
		</h2>
	</div>

	<label class="flex items-center ml-2">
		<div class="flex-initial">
			<p class="leading-tight">{miles} miles</p>
			<p class="leading-tight">(about {Math.floor(miles * 15)} minutes)</p>
		</div><input
			type="range"
			min="0"
			max="5"
			step=".25"
			bind:value={miles}
			class="m-2 flex-1" /></label>

	<button
		on:click={() => {
			if (selectedPlace) {
				console.log('pressed');
				pathToMap(selectedPlace, miles * 1.609 * 1000);
			} else {
				error = true;
			}
		}}
		class={'px-2 py-1 w-full mt-4 text-gray-50 rounded ' + (selectedPlace ? 'bg-indigo-800' : 'bg-gray-300 cursor-pointer')}>continue</button>

	{#if error}
		<div class="text-red-800 p-2 text-sm italic">
			Please choose a location on the map before continuing.
		</div>
	{/if}
</div>
