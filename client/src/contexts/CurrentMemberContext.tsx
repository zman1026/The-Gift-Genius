import { createContext, useContext, useState, ReactNode } from "react";

interface CurrentMemberContextType {
  currentMemberId: string | null;
  currentMemberName: string | null;
  setCurrentMember: (memberId: string | null, memberName: string | null) => void;
  clearCurrentMember: () => void;
}

const CurrentMemberContext = createContext<CurrentMemberContextType | undefined>(undefined);

export function CurrentMemberProvider({ children }: { children: ReactNode }) {
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [currentMemberName, setCurrentMemberName] = useState<string | null>(null);

  const setCurrentMember = (memberId: string | null, memberName: string | null) => {
    setCurrentMemberId(memberId);
    setCurrentMemberName(memberName);
  };

  const clearCurrentMember = () => {
    setCurrentMemberId(null);
    setCurrentMemberName(null);
  };

  return (
    <CurrentMemberContext.Provider
      value={{
        currentMemberId,
        currentMemberName,
        setCurrentMember,
        clearCurrentMember,
      }}
    >
      {children}
    </CurrentMemberContext.Provider>
  );
}

export function useCurrentMember() {
  const context = useContext(CurrentMemberContext);
  if (context === undefined) {
    throw new Error("useCurrentMember must be used within a CurrentMemberProvider");
  }
  return context;
}
