"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getZipLibraries = exports.setZipLibraries = exports.getDistanceCache = exports.setDistanceCache = exports.getKey = exports.setKey = exports.setKeyExp = exports.initRedis = void 0;
const redis_1 = __importDefault(require("redis"));
let redisClient;
const REDIS_PORT = process.env.REDIS_URL || 6379;
const LFL_API_CACHE = 172800; // 48 hrs
const initRedis = () => {
    redisClient = redis_1.default.createClient(+REDIS_PORT);
};
exports.initRedis = initRedis;
const setKeyExp = (key, value, exp) => {
    if (!redisClient) {
        exports.initRedis();
    }
    redisClient.SETEX(key, exp, value);
};
exports.setKeyExp = setKeyExp;
const setKey = (key, value) => {
    if (!redisClient) {
        exports.initRedis();
    }
    redisClient.SET(key, value);
};
exports.setKey = setKey;
const getKey = (key) => {
    if (!redisClient) {
        exports.initRedis();
    }
    return new Promise((resolve, reject) => redisClient.GET(key, (err, val) => resolve(val)));
};
exports.getKey = getKey;
const getLocationKey = (locations) => {
    const sortedLocations = locations.sort((a, b) => (a.lat > b.lat ? -1 : 1));
    return `d:${sortedLocations[0].lat}_${sortedLocations[0].lng}:${sortedLocations[1].lat}_${sortedLocations[1].lng}`;
};
const setDistanceCache = (locations, distance) => {
    exports.setKey(getLocationKey(locations), distance);
};
exports.setDistanceCache = setDistanceCache;
const getDistanceCache = (locations) => exports.getKey(getLocationKey(locations));
exports.getDistanceCache = getDistanceCache;
const setZipLibraries = (zip, val) => {
    exports.setKeyExp(zip, JSON.stringify(val), LFL_API_CACHE);
};
exports.setZipLibraries = setZipLibraries;
const getZipLibraries = (zip) => exports.getKey(zip).then((result) => (result ? JSON.parse(result) : null));
exports.getZipLibraries = getZipLibraries;
