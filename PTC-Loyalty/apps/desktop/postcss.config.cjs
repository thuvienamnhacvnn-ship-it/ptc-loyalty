// Isolate the desktop renderer from the root Next.js/Tailwind PostCSS config.
// The desktop app uses plain CSS, so no PostCSS plugins are needed here.
module.exports = { plugins: {} };
