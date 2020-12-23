const colors = require("tailwindcss/colors");
module.exports = {
	purge: {
		enabled: process.env.NODE_ENV === "production",
		content: ["./src/**/*.svelte"],
	},
	darkMode: false, // or 'media' or 'class'
	theme: {
		extend: {},
		fontFamily: {
			body: "Nunito",
		},
		colors: {
			gray: colors.coolGray,
			indigo: colors.indigo,
			fuchsia: colors.fuchsia,
			red: colors.red,
		},
	},
	variants: {
		extend: {},
	},
	plugins: [],
};
