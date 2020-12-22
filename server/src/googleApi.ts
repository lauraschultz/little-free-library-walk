require("dotenv").config();
import {
	AddressType,
	Client,
	LatLng,
	ReverseGeocodeResponse,
	TravelMode,
} from "@googlemaps/google-maps-services-js";
import { DistanceMatrixResponse } from "@googlemaps/google-maps-services-js/dist/distance";

export const getDistanceMatrix = (
	libraries: Library[],
	source: LatLng
): Promise<number[][]> => {
	const client = new Client({});

	const coords = [source].concat(
		libraries.map((lib) => ({
			lat: lib.Library_Geolocation__c.latitude,
			lng: lib.Library_Geolocation__c.longitude,
		}))
	);
				console.log(`coords are ${JSON.stringify(coords)}\n\n`);

	return new Promise<number[][]>((resolve, reject) =>
		Promise.all(
			new Array(coords.length - 1).fill(0).map(
				(_, i) =>
					new Promise<number[]>((resolve, reject) =>
						client
							.distancematrix({
								params: {
									origins: coords.slice(i, i + 1),
									destinations: coords.slice(i + 1),
									key: process.env.GOOGLE_API_KEY || "",
									mode: TravelMode.walking,
								},
							})
							.then((result: DistanceMatrixResponse) => {
								// console.log(`recieved from api: ${JSON.stringify(r.data)}\n\n`);
								// console.log(JSON.stringify(r.data.rows[0].elements));
								let row = result.data.rows[0].elements.map(
									(elem) => elem.distance.value
								);
								row.splice(0, 0, ...new Array(i + 1).fill(null));
								resolve(row);
							})
					)
			)
		).then((result) => {
			console.log(`distance matrix is: ${JSON.stringify(result)}`);
			resolve(result);
		})
	);
};

export const getZipCodeByLatLng = (source: LatLng): Promise<string> => {
	const client = new Client({});
	return new Promise<string>((resolve, reject) => {
		client.reverseGeocode({
		params: {
			key: process.env.GOOGLE_API_KEY || "",
			latlng: source
		}
	}).then((result: ReverseGeocodeResponse) => {
		console.log(`recieved from api: ${JSON.stringify(result.data)}\n\n`);
		resolve(result.data.results[0].address_components.filter(comp => comp.types.includes(AddressType.postal_code))[0].long_name)
	})
	})
	
}
