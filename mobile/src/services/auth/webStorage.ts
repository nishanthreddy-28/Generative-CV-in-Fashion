// Web access/refresh tokens remain memory-only. Only the short-lived PKCE verifier
// survives a same-tab OAuth redirect in sessionStorage; never persist session tokens.
export function webAuthStorage(verifiers?: Pick<Storage,"getItem"|"setItem"|"removeItem">) {
  const sessions=new Map<string,string>();
  const verifier=(key:string)=>key.endsWith('-code-verifier');
  return {
    getItem(key:string){return verifier(key) ? verifiers?.getItem(key) ?? sessions.get(key) ?? null : sessions.get(key) ?? null;},
    setItem(key:string,value:string){if(verifier(key) && verifiers)verifiers.setItem(key,value);else sessions.set(key,value);},
    removeItem(key:string){sessions.delete(key);if(verifier(key))verifiers?.removeItem(key);},
  };
}
