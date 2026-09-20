module.exports = function (api) {
  api.cache(true);
  return {
    // jsxImportSource lets NativeWind turn className into styles; its preset adds the rest.
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    // Reanimated 4 takes its worklets plugin from react-native-worklets, and it must stay last.
    plugins: ['react-native-worklets/plugin'],
  };
};
