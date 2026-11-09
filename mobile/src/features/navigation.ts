// Explicit route inventory: adding a page requires choosing its access boundary.
export const guestScreens = ["index", "login", "signup"] as const;
export const publicScreens = ["forgot-password", "auth-confirm", "verify-registration", "reset-password", "oauth-callback", "privacy", "+not-found"] as const;
export const personalScreens = [
  "dashboard", "profile/index", "profile/body", "preferences", "settings",
  "wardrobe/index", "wardrobe/add", "wardrobe/[id]", "catalog/index", "catalog/[id]",
  "outfits/index", "outfits/new", "outfits/[id]", "recommendations", "recommendations/saved", "try-on",
] as const;
export const adminScreens = ["admin/index", "admin/catalog/index", "admin/catalog/new", "admin/catalog/[id]"] as const;
export const accountScreens = ["account-deletion"] as const;
export function routeAccess(ready:boolean, role:"user"|"admin"|undefined, deleting:boolean) {
 return {guest:ready && !role, personal:ready && !!role && !deleting,
  admin:ready && role==="admin" && !deleting, account:ready && !!role};
}
export const appDestinations = [
 {label:"Home",path:"/dashboard"}, {label:"Wardrobe",path:"/wardrobe"},
 {label:"Catalog",path:"/catalog"}, {label:"Outfits",path:"/outfits"}, {label:"Account",path:"/settings"},
] as const;
export function activeDestination(path:string) {
 if(path.startsWith('/profile') || path==='/preferences')return '/settings';
 if(path.startsWith('/recommendations') || path==='/try-on')return '/outfits';
 return appDestinations.find(item=>path===item.path || path.startsWith(item.path+'/'))?.path;
}
