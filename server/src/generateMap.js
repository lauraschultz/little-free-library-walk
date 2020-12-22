"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMap = void 0;
require("dotenv").config();
const google_maps_services_js_1 = require("@googlemaps/google-maps-services-js");
const generateMap = (libraryPath) => {
    const client = new google_maps_services_js_1.Client({});
    return new Promise((resolve, reject) => {
        client
            .directions({
            params: {
                mode: google_maps_services_js_1.TravelMode.walking,
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
exports.generateMap = generateMap;
