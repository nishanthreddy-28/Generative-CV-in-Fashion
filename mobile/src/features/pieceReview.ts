export const garmentGroups = ["Tops","Bottoms","Dresses","Outerwear","Shoes","Accessories"] as const;
export type GarmentGroup = typeof garmentGroups[number];
const slots: Record<string,GarmentGroup>={top:"Tops",bottom:"Bottoms",full:"Dresses",outer:"Outerwear",shoes:"Shoes"};
export function suggestedPiece(value:{slot:string;category:string;colors:{name:string}[]}) {
  const category=slots[value.slot];
  if(!category)throw new Error("This garment category needs review.");
  const color=value.colors.map(item=>item.name).join(", ");
  const leading=value.colors[0]?.name?.trim()??"";
  const label=value.category.trim();
  const name=[leading,label].filter(Boolean).join(" ");
  return {category,color,name:name.charAt(0).toUpperCase()+name.slice(1)};
}
export function validPiece(values:Record<string,string>){
  return !!values.name?.trim() && values.name.trim().length<=200 &&
    garmentGroups.includes(values.category as GarmentGroup) && (values.color?.length??0)<=200;
}
