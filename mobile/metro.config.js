const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.watchFolders = [projectRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

// Expo Go on Android does not register ExpoTopicSubscriptionModule, but
// expo-notifications requires it eagerly at import time (TopicSubscriptionModule.android.js),
// which crashes the whole app in Expo Go. Redirect that one module to a shim
// that falls back to a JS stub when the native module is unavailable.
const topicSubscriptionShim = path.resolve(projectRoot, 'src/lib/topicSubscriptionModuleShim.ts');
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isTopicSubscriptionModule =
    moduleName === './TopicSubscriptionModule' ||
    moduleName.endsWith('/TopicSubscriptionModule') ||
    moduleName.endsWith('expo-notifications/build/TopicSubscriptionModule');
  if (platform === 'android' && isTopicSubscriptionModule) {
    return { type: 'sourceFile', filePath: topicSubscriptionShim };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
