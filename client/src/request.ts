import axios from "axios";

export const getPath = (
	origin: google.maps.LatLngLiteral,
	distance: number
): Promise<any[]> => {
	return axios
		.get(`${process.env.SERVER}/path/${origin.lat}/${origin.lng}/${distance}`)
		.then((response) => {
			console.log(`received from server: ${JSON.stringify(response.data)}`);
			return response.data;
		});
};
