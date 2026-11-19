const { withProjectBuildGradle } = require("@expo/config-plugins");

/**
 * Keep the native media tool focused on audio codecs/filters rather than the
 * much larger full FFmpeg package. The generated Android project receives
 * this setting during prebuild/EAS build.
 */
module.exports = function withFfmpegAudioPackage(config) {
  return withProjectBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (contents.includes("ffmpegKitPackage")) {
      return modConfig;
    }

    if (/ext\s*\{/.test(contents)) {
      contents = contents.replace(/ext\s*\{/, 'ext {\n    ffmpegKitPackage = "audio"');
    } else {
      contents = `ext {\n    ffmpegKitPackage = "audio"\n}\n\n${contents}`;
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });
};
