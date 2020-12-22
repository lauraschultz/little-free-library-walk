import App from "./App.svelte";

const app = new App({
	target: document.body,
	props: {
		mapReady: false,
	},
});

(window as any).initMap = function ready() {
	console.log(`maps api ready.`);
	app.$set({ mapReady: true });
};

export default app;
