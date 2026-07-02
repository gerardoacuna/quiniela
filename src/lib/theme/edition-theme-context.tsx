'use client';
import { createContext, useContext, type ReactNode } from 'react';

const EditionLabelContext = createContext<string>('GIRO · MMXXVI');

export function EditionThemeProvider({ label, children }: { label: string; children: ReactNode }) {
  return <EditionLabelContext.Provider value={label}>{children}</EditionLabelContext.Provider>;
}

export function useEditionLabel(): string {
  return useContext(EditionLabelContext);
}
