import { requireNativeModule } from 'expo-modules-core';

const stubModule = {
  addListener: () => { },
  removeListeners: () => { },
  subscribeToTopicAsync: () => Promise.resolve(null),
  unsubscribeFromTopicAsync: () => Promise.resolve(null),
};

let resolvedModule: typeof stubModule;

try {
  resolvedModule = requireNativeModule('ExpoTopicSubscriptionModule');
} catch {
  resolvedModule = stubModule;
}

export default resolvedModule;
