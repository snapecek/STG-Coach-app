import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {execFileSync} from 'node:child_process';
const release=process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||(()=>{try{return execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()}catch{return 'local-'+Date.now().toString(36)}})();
export default defineConfig({define:{'import.meta.env.VITE_APP_RELEASE':JSON.stringify(release)},plugins:[react(),tailwindcss(),{name:'release-version',generateBundle(){this.emitFile({type:'asset',fileName:'release.json',source:JSON.stringify({release})})}}]});
