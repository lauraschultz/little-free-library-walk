"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const geolib_1 = require("geolib");
const computePath_1 = require("./computePath");
const googleApi_1 = require("./googleApi");
const express_1 = __importDefault(require("express"));
const redis_1 = require("./redis");
const app = express_1.default();
const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`server listening on port ${port}`);
});
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
app.get("/path/:lat/:lng/:distance", async (req, res) => {
    const { lat, lng, distance } = req.params;
    const source = { lat: +lat, lng: +lng };
    console.log(req.params);
    const zip = await googleApi_1.getZipCodeByLatLng(source);
    const allLibraries = await getLibrariesByZipCode(zip);
    if (allLibraries.length === 0) {
        res.send([]);
        return;
    }
    let filteredLibraries = getNClosest(allLibraries, source, 8);
    // let radiusDist = +distance;
    // do {
    // 	filteredLibraries = filterLibrariesByLocation(source, radiusDist, allLibraries);
    // 	radiusDist -= 100;
    // } while(filteredLibraries.length > 8)
    console.log(`found ${filteredLibraries.length} within distance`);
    const distanceMatrix = await googleApi_1.getDistanceMatrix(filteredLibraries, source);
    const path = computePath_1.computePath(+distance + 1000, distanceMatrix);
    console.log(`path is ${path}\n`);
    console.log(`filteredLibraries are ${JSON.stringify(filteredLibraries)}\n`);
    res.send(path.map((i) => filteredLibraries[i - 1]));
});
const getLibrariesByZipCode = async (zip) => {
    const zipLibrariesInCache = await redis_1.getZipLibraries(zip);
    if (zipLibrariesInCache) {
        console.log("FOUND IN CACHE:");
        console.log(zipLibrariesInCache);
        return zipLibrariesInCache;
    }
    return new Promise((resolve, reject) => axios_1.default({
        method: "POST",
        url: "https://littlefreelibrary.secure.force.com/apexremote",
        headers: {
            "Content-Type": "application/json",
            Referer: "https://littlefreelibrary.secure.force.com/mapPage",
        },
        data: {
            action: "MapPageController",
            method: "remoteSearch",
            data: [zip, "ZipCode", null, null],
            type: "rpc",
            tid: 2,
            ctx: {
                csrf: "VmpFPSxNakF5TUMweE1TMHlORlF3TXpvMU5Eb3pOQzR6TmpCYSxwamN6MWhGcTFsYWt6X3c2My15cG5WLFpUTmhZelkw",
                vid: "066d00000027Meh",
                ns: "",
                ver: 29,
            },
        },
    }).then((response) => {
        // console.log(`response from LFL API: ${JSON.stringify(response.data)}`);
        if (response.data[0].statusCode !== 200) {
            reject();
        }
        else {
            console.log(JSON.stringify(response.data[0].result));
            const filteredResponse = response.data[0].result
                .map((r) => r.library)
                .filter((lib) => lib.Exact_Location_on_Map__c);
            redis_1.setZipLibraries(zip, filteredResponse);
            resolve(filteredResponse);
        }
    }));
};
const filterLibrariesByLocation = (source, distanceInMeters, libraries) => {
    return libraries.filter((lib) => {
        if (!lib.Library_Geolocation__c) {
            return false;
        }
        return geolib_1.getDistance(lib.Library_Geolocation__c, source) < distanceInMeters;
    });
};
const getNClosest = (libraries, source, n) => {
    return libraries
        .map((lib) => ({
        library: lib,
        distance: geolib_1.getDistance(lib.Library_Geolocation__c, source),
    }))
        .sort((a, b) => (a.distance > b.distance ? 1 : -1))
        .slice(0, n)
        .map((l) => l.library);
};
// getLibrariesByZipCode("55101")
// 	.then((r) =>
// 		filterLibrariesByLocation(
// 			{ lat: 44.95182809053841, lng: -93.0937146216185 },
// 			900,
// 			r
// 		)
// 	)
// libs
// 	.then((r) =>
// 		filterLibrariesByLocation({ lat: 44.9438, lng: -93.162 }, 1000, r)
// 	)
// 	.then((r) => getDistanceMatrix(r, { lat: 44.9438, lng: -93.162 }))
// 	.then((r) => console.log(`PATH: ${JSON.stringify(computePath(3000, r))}`));
