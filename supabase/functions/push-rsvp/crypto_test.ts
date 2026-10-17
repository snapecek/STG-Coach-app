import webpush from 'npm:web-push@3.6.7';
import ece from 'npm:http_ece@1.2.0';
import {createECDH,randomBytes} from 'node:crypto';
Deno.test('real Web Push encryption preserves member, answer, count and target in the Deno runtime',()=>{
 const vapid=webpush.generateVAPIDKeys(),device=createECDH('prime256v1');device.generateKeys();const auth=randomBytes(16);
 const payload={title:'Klub · Trénink',body:'Jana Nováková · přijde. Přihlášeno: 5',url:'/?push-club=20000000-0000-4000-8000-000000000001&push-event=50000000-0000-4000-8000-000000000001',tag:'trenomi-rsvp-1'};
 const details=webpush.generateRequestDetails({endpoint:'https://fcm.googleapis.com/fcm/send/fictional-crypto-test',keys:{p256dh:device.getPublicKey().toString('base64url'),auth:auth.toString('base64url')}},JSON.stringify(payload),{TTL:60,urgency:'high',vapidDetails:{subject:'https://project-ym4q2.vercel.app',publicKey:vapid.publicKey,privateKey:vapid.privateKey}});
 const plain=ece.decrypt(details.body,{version:'aes128gcm',privateKey:device,authSecret:auth}).toString('utf8');
 if(plain!==JSON.stringify(payload))throw new Error('Web Push payload changed during encryption');
 if(details.headers['Content-Encoding']!=='aes128gcm'||!String(details.headers.Authorization).startsWith('vapid '))throw new Error('Web Push encryption or VAPID missing');
});
