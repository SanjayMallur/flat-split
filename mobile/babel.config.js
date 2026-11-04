module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Resolve the `@/*` alias at the Babel layer so Metro finds it on every build.
      // Expo's tsconfig-paths resolution alone is flaky across `expo export` runs.
      ['module-resolver', { root: ['./'], alias: { '@': './src' }, extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'] }],
      // Reanimated 4 uses the worklets plugin; it MUST be listed last.
      'react-native-worklets/plugin',
    ],
  };
};
