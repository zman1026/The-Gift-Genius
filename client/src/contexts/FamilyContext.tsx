import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

interface Family {
  id: string;
  name: string;
  inviteCode: string;
  createdById: string;
  giftBudget: string | null;
  createdAt: Date;
  memberCount: number;
}

interface FamilyContextType {
  selectedFamilyId: string | null;
  setSelectedFamilyId: (familyId: string | null) => void;
  families: Family[];
  isLoading: boolean;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(() => {
    return localStorage.getItem('selectedFamilyId');
  });

  const { data: families = [], isLoading } = useQuery<Family[]>({
    queryKey: ['/api/families'],
  });

  useEffect(() => {
    if (families.length > 0) {
      // Check if currently selected family is still valid
      const isValidSelection = selectedFamilyId && families.some((f: any) => f.id === selectedFamilyId);
      
      if (!isValidSelection) {
        // Reset to first family if current selection is invalid or null
        setSelectedFamilyId(families[0].id);
      }
    } else if (families.length === 0 && selectedFamilyId) {
      // Clear selection if user has no families
      setSelectedFamilyId(null);
      localStorage.removeItem('selectedFamilyId');
    }
  }, [families, selectedFamilyId]);

  useEffect(() => {
    if (selectedFamilyId) {
      localStorage.setItem('selectedFamilyId', selectedFamilyId);
    }
  }, [selectedFamilyId]);

  return (
    <FamilyContext.Provider value={{ selectedFamilyId, setSelectedFamilyId, families, isLoading }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (context === undefined) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
}
