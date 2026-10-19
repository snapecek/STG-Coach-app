import type {CapacitorConfig} from '@capacitor/cli';
import {KeyboardResize} from '@capacitor/keyboard';

// Ship the compiled app inside the binary. Never point production at server.url.
const config:CapacitorConfig={
 appId:'eu.trenomi.app',appName:'Trenomi',webDir:'dist-native',
 loggingBehavior:'none',
 backgroundColor:'#101216',
 server:{androidScheme:'https'},
 android:{allowMixedContent:false,webContentsDebuggingEnabled:false},
 ios:{contentInset:'never',preferredContentMode:'mobile'},
 plugins:{
  // Native clients use the system HTTP stack. Edge Functions intentionally
  // restrict browser CORS to the public web origin; keep that policy intact.
  CapacitorHttp:{enabled:true},
  SystemBars:{insetsHandling:'native',initialViewportFitValueHint:'cover',style:'DARK',hidden:false},
  Keyboard:{resize:KeyboardResize.Native,resizeOnFullScreen:true},
  SplashScreen:{launchAutoHide:true,launchShowDuration:8000,launchFadeOutDuration:200,backgroundColor:'#101216',showSpinner:false},
 },
};
export default config;
