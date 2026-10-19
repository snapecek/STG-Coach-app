type Platform = {userAgent:string;platform:string;maxTouchPoints:number;standalone:boolean};

// Detect installed iOS apps without relying on OS version tokens, which can be frozen.
export function isIosStandalone(device:Platform):boolean{
 const ios=/iPhone|iPad|iPod/.test(device.userAgent)||/Mac/.test(device.platform)&&device.maxTouchPoints>1;
 return ios&&device.standalone;
}
