require("dotenv").config();
import { Client, TravelMode } from "@googlemaps/google-maps-services-js";
import { DirectionsResponseData } from "@googlemaps/google-maps-services-js/dist/directions";

export const generateMap = (libraryPath: Library[]) => {
	const client = new Client({});
	return new Promise<DirectionsResponseData>((resolve, reject) => {
		client
			.directions({
				params: {
					mode: TravelMode.walking,
					key: process.env.GOOGLE_API_KEY || "",
					origin: libraryPath[0].Library_Geolocation__c,
					destination: libraryPath[0].Library_Geolocation__c,
					waypoints: libraryPath
						.slice(1)
						.map((lib) => lib.Library_Geolocation__c),
				},
			})
			.then((response) => resolve(response.data));
	});
};
