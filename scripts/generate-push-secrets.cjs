// Writes credentials locally, never to stdout. Existing files are not overwritten.
const {createECDH,randomBytes}=require('node:crypto');
const {writeFileSync}=require('node:fs');
const file=process.argv[2]||'.env.push';
const ecdh=createECDH('prime256v1');ecdh.generateKeys();
writeFileSync(file,'APP_URL=https://project-ym4q2.vercel.app/\nVAPID_PUBLIC_KEY='+ecdh.getPublicKey().toString('base64url')+'\nVAPID_PRIVATE_KEY='+ecdh.getPrivateKey().toString('base64url')+'\nPUSH_DISPATCH_SECRET='+randomBytes(32).toString('base64url')+'\n',{flag:'wx',mode:0o600});
console.log('Nastavení bylo vytvořeno v '+file+'. Soubor obsahuje soukromé klíče; neposílejte jej do chatu ani na GitHub.');
