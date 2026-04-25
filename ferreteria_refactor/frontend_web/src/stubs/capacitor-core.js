// Stub de @capacitor/core para build web — evita Illegal constructor
export const Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => 'web',
  isPluginAvailable: () => false,
  convertFileSrc: (url) => url,
};
export const registerPlugin = () => ({});
export const WebPlugin = class {};
