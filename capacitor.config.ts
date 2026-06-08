import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.paypulse',
  appName: 'PayPulse',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
