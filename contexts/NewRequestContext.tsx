import React, { createContext, useContext, useMemo, useState } from 'react';

type NewRequestContextType = {
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
};

const NewRequestContext = createContext<NewRequestContextType | null>(null);

export const NewRequestProvider = ({ children }: { children: React.ReactNode }) => {
  const [step, setStep] = useState(1);
  const value = useMemo(() => ({ step, setStep }), [step]);
  return <NewRequestContext.Provider value={value}>{children}</NewRequestContext.Provider>;
};

export const useNewRequest = () => {
  const ctx = useContext(NewRequestContext);
  if (!ctx) {
    throw new Error('useNewRequest must be used within NewRequestProvider');
  }
  return ctx;
};
