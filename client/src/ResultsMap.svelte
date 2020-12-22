<script lang="ts">
	export let selectedPlace: google.maps.LatLngLiteral;
	export let waypoints: google.maps.DirectionsWaypoint[];
	export let selectedLibrary: any;
	let map: google.maps.Map;
	let directionsService: google.maps.DirectionsService;
	let directionsRenderer: google.maps.DirectionsRenderer;
	let zoom: number;
	let center: google.maps.LatLngLiteral;
	let container: HTMLElement;
	const star_icon = {
		url: "./assets/marker_star.png",
	};
	const reg_icon = {
		url: "./assets/marker.png",
	};
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
	];

	$: {
		console.log(`selected library: ${JSON.stringify(selectedLibrary)}`);
		if (selectedLibrary) {
			map.setCenter({
				lat: selectedLibrary.Library_Geolocation__c.latitude,
				lng: selectedLibrary.Library_Geolocation__c.longitude,
			});

			map.setZoom(14);
			setTimeout(() => map.setZoom(17), 500);
		}
	}

	$: if (zoom) {
		console.log(waypoints);
		map = new google.maps.Map(container, {
			zoom,
			center,
		});
		directionsService = new google.maps.DirectionsService();
		directionsRenderer = new google.maps.DirectionsRenderer({
			suppressMarkers: true,
		});
		directionsRenderer.setMap(map);
		directionsService.route(
			{
				origin: selectedPlace,
				destination: selectedPlace,
				waypoints: waypoints,
				travelMode: google.maps.TravelMode.WALKING,
			},
			(result: google.maps.DirectionsResult) => {
				directionsRenderer.setDirections(result);
			}
		);
		let markers = [];
		markers.push(
			new google.maps.Marker({
				icon: star_icon,
				map: map,
				position: selectedPlace,
			})
		);
		waypoints.forEach((pt, i) => {
			const latLng = (pt.location as string).split(",");
			markers.push(
				new google.maps.Marker({
					// icon: reg_icon,
					label: { text: letters[i], color: "#ffffff" },
					map: map,
					position: new google.maps.LatLng({
						lat: +latLng[0],
						lng: +latLng[1],
					}),
					clickable: true,
				})
			);
		});
	}

	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition((position) => {
			let coords = position.coords;
			center = { lat: coords.latitude, lng: coords.longitude };
			zoom = 15;
		});
	} else {
		console.log("no geoloc.");
		center = { lat: 27.805352, lng: -33.194958 };
		zoom = 1;
	}
</script>

<div bind:this={container} class="h-80 rounded-md" />
