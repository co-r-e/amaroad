"use client";

import type { ReactNode } from "react";

interface FragmentProps {
  children: ReactNode;
}

export function Fragment({ children }: FragmentProps) {
  return <div className="dexcode-fragment">{children}</div>;
}
