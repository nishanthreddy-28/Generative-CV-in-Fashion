// Tab-scoped storage restores same-tab reloads and OAuth redirects.
// No localStorage: normal tab closure ends this browser session.
export function webAuthStorage(tab?: Pick<Storage,"getItem"|"setItem"|"removeItem">) {
  const memory=new Map<string,string>();
  return {
    getItem(key:string){return tab ? tab.getItem(key) : memory.get(key) ?? null;},
    setItem(key:string,value:string){if(tab)tab.setItem(key,value);else memory.set(key,value);},
    removeItem(key:string){memory.delete(key);tab?.removeItem(key);},
  };
}
