export const uiPalettes=[
 {id:'trenomi',name:'Trenomi',color:'#FFB317',description:'Původní žlutá Trenomi'},
 {id:'cyan',name:'Ledová',color:'#49C6E5',description:'Svěží azurová'},
 {id:'mint',name:'Máta',color:'#78D6B0',description:'Klidná zelená'},
 {id:'blue',name:'Sportovní modrá',color:'#81AEFF',description:'Čistá modrá'},
 {id:'violet',name:'Levandule',color:'#B59AFF',description:'Jemná fialová'},
 {id:'coral',name:'Korálová',color:'#FF9985',description:'Teplá korálová'},
 {id:'rose',name:'Růžová',color:'#F3A0C7',description:'Tlumená růžová'},
 {id:'lime',name:'Limetka',color:'#C8EB57',description:'Energická limetková'},
] as const;
export type UiPalette=typeof uiPalettes[number]['id'];
export function uiPalette(value:unknown){return uiPalettes.find(p=>p.id===value)||uiPalettes[0]}
export function applyUiPalette(value:unknown){
 const palette=uiPalette(value);
 document.documentElement.dataset.uiPalette=palette.id;
 document.documentElement.style.setProperty('--orange',palette.color);
}
