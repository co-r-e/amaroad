"use client";

import { createContext, useContext, type ReactNode } from "react";

const ExportModeContext = createContext<boolean>(false);

interface ExportModeProviderProps {
  children: ReactNode;
  isExporting: boolean;
}

export function ExportModeProvider({ children, isExporting }: ExportModeProviderProps): ReactNode {
  return (
    <ExportModeContext.Provider value={isExporting}>
      {children}
    </ExportModeContext.Provider>
  );
}

export function useExportMode(): boolean {
  return useContext(ExportModeContext);
}
