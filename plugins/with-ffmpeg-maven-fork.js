const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

/**
 * ffmpeg-kit-react-native 6.0.2 still points at the retired com.arthenica
 * binaries. The bridge API/package names remain compatible with this audio
 * artifact, which is published on Maven Central by the community maintainer.
 */
module.exports = function withFfmpegMavenFork(config) {
  return withDangerousMod(config, ["android", async (modConfig) => {
    const gradlePath = path.join(
      modConfig.modRequest.projectRoot,
      "node_modules",
      "ffmpeg-kit-react-native",
      "android",
      "build.gradle",
    );

    if (fs.existsSync(gradlePath)) {
      let contents = fs.readFileSync(gradlePath, "utf8");
      const oldDependency = "implementation 'com.arthenica:ffmpeg-kit-' + safePackageName(safeExtGet('ffmpegKitPackage', 'https')) + ':' + safePackageVersion(safeExtGet('ffmpegKitPackage', 'https'))";
      const newDependency = "implementation 'io.github.maxrave-dev:ffmpeg-kit-audio:6.0.1'";
      if (contents.includes(oldDependency)) {
        contents = contents.replace(oldDependency, newDependency);
        fs.writeFileSync(gradlePath, contents);
      }
    }

    return modConfig;
  }]);
};
