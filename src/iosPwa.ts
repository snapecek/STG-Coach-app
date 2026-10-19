type Platform = {userAgent:string;platform:string;maxTouchPoints:number;standalone:boolean};

// Modern iOS paints a system blur band over installed PWAs, independently of
// safe-area insets. Keep the club identity below it. Safari tabs must not pay this
// clearance. Do not version-gate: installed apps can report frozen OS versions.
// Field report: https://github.com/vjt/grappa-irc/issues/2190
export function needsIosPwaHeaderClearance(device:Platform):boolean{
 const ios=/iPhone|iPad|iPod/.test(device.userAgent)||/Mac/.test(device.platform)&&device.maxTouchPoints>1;
 return ios&&device.standalone;
}
