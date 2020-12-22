import redis from "redis";
let redisClient: redis.RedisClient;

const REDIS_PORT = process.env.REDISCLOUD_URL || "6379";
const LFL_API_CACHE = 172800; // 48 hrs

interface Location {
	lat: string;
	lng: string;
}

export const initRedis = () => {
	console.log(`connecting redis.... port is ${REDIS_PORT}`);
	redisClient = redis.createClient(REDIS_PORT, { no_ready_check: true });
};

export const setKeyExp = (key: string, value: string, exp: number) => {
	if (!redisClient) {
		initRedis();
	}
	redisClient.SETEX(key, exp, value);
};

export const setKey = (key: string, value: any) => {
	if (!redisClient) {
		initRedis();
	}
	redisClient.SET(key, value);
};

export const getKey = (key: string): Promise<string | null> => {
	if (!redisClient) {
		initRedis();
	}
	return new Promise((resolve, reject) =>
		redisClient.GET(key, (err, val) => resolve(val))
	);
};

const getLocationKey = (locations: Location[]): string => {
	const sortedLocations = locations.sort((a, b) => (a.lat > b.lat ? -1 : 1));
	return `d:${sortedLocations[0].lat}_${sortedLocations[0].lng}:${sortedLocations[1].lat}_${sortedLocations[1].lng}`;
};

export const setDistanceCache = (locations: Location[], distance: number) => {
	setKey(getLocationKey(locations), distance);
};

export const getDistanceCache = (
	locations: { lat: string; lng: string }[]
): Promise<string | null> => getKey(getLocationKey(locations));

export const setZipLibraries = (zip: string, val: any) => {
	setKeyExp(zip, JSON.stringify(val), LFL_API_CACHE);
};

export const getZipLibraries = (zip: string): Promise<any> =>
	getKey(zip).then((result) => (result ? JSON.parse(result) : null));
