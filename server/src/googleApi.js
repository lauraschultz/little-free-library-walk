"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getZipCodeByLatLng = exports.getDistanceMatrix = void 0;
require("dotenv").config();
const google_maps_services_js_1 = require("@googlemaps/google-maps-services-js");
const getDistanceMatrix = (libraries, source) => {
    const client = new google_maps_services_js_1.Client({});
    const coords = [source].concat(libraries.map((lib) => ({
        lat: lib.Library_Geolocation__c.latitude,
        lng: lib.Library_Geolocation__c.longitude,
    })));
    console.log(`coords are ${JSON.stringify(coords)}\n\n`);
    return new Promise((resolve, reject) => Promise.all(new Array(coords.length - 1).fill(0).map((_, i) => new Promise((resolve, reject) => client
        .distancematrix({
        params: {
            origins: coords.slice(i, i + 1),
            destinations: coords.slice(i + 1),
            key: process.env.GOOGLE_API_KEY || "",
            mode: google_maps_services_js_1.TravelMode.walking,
        },
    })
        .then((result) => {
        // console.log(`recieved from api: ${JSON.stringify(r.data)}\n\n`);
        // console.log(JSON.stringify(r.data.rows[0].elements));
        let row = result.data.rows[0].elements.map((elem) => elem.distance.value);
        row.splice(0, 0, ...new Array(i + 1).fill(null));
        resolve(row);
    })))).then((result) => {
        console.log(`distance matrix is: ${JSON.stringify(result)}`);
        resolve(result);
    }));
};
exports.getDistanceMatrix = getDistanceMatrix;
const getZipCodeByLatLng = (source) => {
    const client = new google_maps_services_js_1.Client({});
    return new Promise((resolve, reject) => {
        client.reverseGeocode({
            params: {
                key: process.env.GOOGLE_API_KEY || "",
                latlng: source
            }
        }).then((result) => {
            console.log(`recieved from api: ${JSON.stringify(result.data)}\n\n`);
            resolve(result.data.results[0].address_components.filter(comp => comp.types.includes(google_maps_services_js_1.AddressType.postal_code))[0].long_name);
        });
    });
};
exports.getZipCodeByLatLng = getZipCodeByLatLng;
