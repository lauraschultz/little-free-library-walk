<script lang="ts">
	export let selectedPlace: google.maps.LatLngLiteral;
	let map: google.maps.Map;
	let zoom: number;
	let center: google.maps.LatLngLiteral;
	let container: HTMLElement;
	let searchInput: HTMLInputElement;
	let mapLoaded = false;
	const icon = {
		url: "assets/marker_star.png",
	};

	$: if (zoom) {
		map = new google.maps.Map(container, {
			zoom,
			center,
		});
		const searchBox = new google.maps.places.SearchBox(searchInput);
		map.controls[google.maps.ControlPosition.TOP_LEFT].push(searchInput);
		mapLoaded = true;
		map.addListener("bounds_changed", () => {
			searchBox.setBounds(map.getBounds());
			let markers: google.maps.Marker[] = [];
			searchBox.addListener("places_changed", () => {
				const places = searchBox.getPlaces();

				if (places.length == 0) {
					return;
				}
				// Clear out the old markers.
				// Clear out the old markers.
				markers.forEach((marker) => {
					marker.setMap(null);
				});
				markers = [];

				// For each place, get the icon, name and location.
				const bounds = new google.maps.LatLngBounds();
				places.forEach((place) => {
					if (!place.geometry) {
						console.log("Returned place contains no geometry");
						return;
					}

					// Create a marker for each place.
					selectedPlace = place.geometry.location.toJSON();
					markers.push(
						new google.maps.Marker({
							map,
							icon,
							title: place.name,
							position: place.geometry.location,
						})
					);

					if (place.geometry.viewport) {
						// Only geocodes have viewport.
						bounds.union(place.geometry.viewport);
					} else {
						bounds.extend(place.geometry.location);
					}
				});
				map.fitBounds(bounds);
			});

			map.addListener("click", (mapsMouseEvent) => {
				// Close the current InfoWindow.
				markers.forEach((marker) => {
					marker.setMap(null);
				});
				markers = [];
				selectedPlace = mapsMouseEvent.latLng.toJSON();
				markers.push(
					new google.maps.Marker({
						map,
						icon,
						position: mapsMouseEvent.latLng,
					})
				);
			});
		});
	}

	const initGeoloc = (position: GeolocationPosition) => {
		console.log(`position found: ${JSON.stringify(position)}`);
		let coords = position.coords;
		center = { lat: coords.latitude, lng: coords.longitude };
		zoom = 15;
	};

	const initWithoutGeoloc = () => {
		console.warn("Geolocation API not available");
		center = { lat: 40.812579, lng: -95.726705 };
		zoom = 3;
	};

	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(initGeoloc, initWithoutGeoloc, {
			timeout: 2000,
		});
	} else {
		initWithoutGeoloc();
	}
</script>

<input
	bind:this={searchInput}
	class={mapLoaded
		? "rounded px-2 py-1 m-3 border border-gray-300 text-base"
		: "hidden"} />

<div
	bind:this={container}
	class="h-80 rounded-md my-2 flex items-center justify-center bg-gray-200">
	<svg
		width="100%"
		height="100%"
		viewBox="0 0 20 20"
		class={mapLoaded ? "hidden" : "w-24 animate-spin"}
		fill="none"
		xmlns="http://www.w3.org/2000/svg">
		<path
			fill-rule="evenodd"
			clip-rule="evenodd"
			d="M0 10C0 15.5228 4.47715 20 10 20C15.5228 20 20 15.5228 20 10C20 4.47715 15.5228 0 10 0V2C14.4183 2 18 5.58172 18 10C18 14.4183 14.4183 18 10 18C5.58172 18 2 14.4183 2 10H0Z"
			fill="#374151" />
	</svg>
</div>
