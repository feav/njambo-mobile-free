import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.njambo.cm',
  appName: 'Njambo',
  webDir: 'www',
  cordova: {
    preferences: {
      ScrollEnabled: 'false',
      BackupWebStorage: 'none',
      SplashMaintainAspectRatio: 'true',
      FadeSplashScreenDuration: '300',
      SplashShowOnlyFirstTime: 'false',
      SplashScreen: 'screen',
      SplashScreenDelay: '3000',
      SplashScreenSpinnerColor: 'white',
      SplashScreenBackgroundColor: 'white',
      ShowSplashScreenSpinner: 'false',
      StatusBarBackgroundColor: '#2F4F36',
      StatusBarOverlaysWebView: 'true'
    }
  }
};

export default config;
