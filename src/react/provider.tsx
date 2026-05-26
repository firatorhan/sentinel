import { createContext } from "react";

export const SentinelContext = createContext(null);

export function SentinelProvider({ children }: any) {
  return (
    <SentinelContext.Provider value={null}>
      {children}
    </SentinelContext.Provider>
  );
}