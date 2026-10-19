export async function pickNativePhoto(){
 const {Camera,CameraSource,CameraResultType}=await import('@capacitor/camera');
 const photo=await Camera.getPhoto({source:CameraSource.Prompt,resultType:CameraResultType.Uri,quality:90,correctOrientation:true,saveToGallery:false,
  promptLabelHeader:'Fotografie z tréninku',promptLabelPhoto:'Vybrat z galerie',promptLabelPicture:'Vyfotit',promptLabelCancel:'Zrušit'});
 if(!photo.webPath)throw new Error('Fotografii nelze načíst.');
 const response=await fetch(photo.webPath);if(!response.ok)throw new Error('Fotografii nelze načíst.');
 return new File([await response.blob()],'trenomi-fotografie.jpeg',{type:'image/jpeg'});
}
