import axios from "axios";
import {SERVER} from "./config"

export const getPath = (origin: google.maps.LatLngLiteral, distance: number):Promise<any[]> => {
  return axios.get(`${SERVER}/path/${origin.lat}/${origin.lng}/${distance}`).then(response => {console.log(`received from server: ${JSON.stringify(response.data)}`); return response.data})
}
