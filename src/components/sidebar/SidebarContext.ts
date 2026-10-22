"use client";

import { createContext } from "react";

export const SidebarContext = createContext<{
  collapsed: boolean;
  previewId: string | null;
  showPreview: (id: string | null) => void;
} | null>(null);
