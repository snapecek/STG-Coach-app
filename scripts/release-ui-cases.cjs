function memberCases(source){
 const parameters={STG_SELECTED_HIIT_ONLY:['hiit','kettlebell']};
 return [...new Set(source.match(/STG_[A-Z_]+_ONLY/g)||[])].sort().flatMap(flag=>(parameters[flag]||['1']).map(value=>({flag,value})));
}
module.exports={memberCases};
