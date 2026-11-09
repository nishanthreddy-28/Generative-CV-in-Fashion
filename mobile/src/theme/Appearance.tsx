import {createContext, useContext, useEffect, useRef, useState, type PropsWithChildren} from "react";
import {Platform} from "react-native";
import * as SecureStore from "expo-secure-store";
import {atelier} from "./atelier";
import {colors} from "./tokens";

type Mode = "light" | "dark";
export type Palette = {[K in keyof typeof atelier]: string};
const light: Palette = {...colors};
const Appearance = createContext({mode:"light" as Mode, palette:light, toggle:()=>{}});
const key = "drapedrop.appearance";

export function AppearanceProvider({children}:PropsWithChildren) {
  const [mode,setMode]=useState<Mode>("light");
  const chosen=useRef(false);
  const writes=useRef<Promise<unknown>>(Promise.resolve());
  useEffect(()=>{
    let mounted=true;
    void (async()=>{
      try {
        const value=Platform.OS==="web" ? window.localStorage.getItem(key) : await SecureStore.getItemAsync(key);
        if(mounted && !chosen.current && (value==="light" || value==="dark"))setMode(value);
      } catch { /* Storage restrictions must not prevent choosing a theme. */ }
    })();
    return()=>{mounted=false;};
  },[]);
  function toggle(){
    chosen.current=true;
    const next=mode==="light" ? "dark" : "light";
    setMode(next);
    writes.current=writes.current.catch(()=>undefined).then(async()=>{
      try {
        if(Platform.OS==="web")window.localStorage.setItem(key,next);
        else await SecureStore.setItemAsync(key,next);
      } catch { /* The in-memory choice still works without persistence. */ }
    });
  }
  return <Appearance.Provider value={{mode,palette:mode==="dark" ? atelier : light,toggle}}>{children}</Appearance.Provider>;
}
export const useAppearance=()=>useContext(Appearance);
