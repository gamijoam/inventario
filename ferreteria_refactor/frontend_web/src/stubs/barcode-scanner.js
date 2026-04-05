// Stub de @capacitor-community/barcode-scanner para build web
export const BarcodeScanner = {
  prepare: async () => {},
  hideBackground: async () => {},
  startScan: async () => ({ hasContent: false, content: '' }),
  stopScan: async () => {},
  checkPermission: async () => ({ granted: true }),
  requestPermission: async () => ({ granted: false }),
};
