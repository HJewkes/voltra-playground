module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { 
        jsxImportSource: "nativewind",
        unstable_transformImportMeta: true,  // Handle import.meta for web
      }],
      "nativewind/babel",
    ],
  };
};
