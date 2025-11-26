import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

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
  const [selectedFamilyId, setSelectedFamilyIdState] = useState<string | null>(() => {
    return localStorage.getItem('selectedFamilyId');
  });
  
  // Track previous family ID to detect changes
  const previousFamilyIdRef = useRef<string | null>(selectedFamilyId);
  
  // Track if this is the initial mount to avoid unnecessary resets
  const isInitialMountRef = useRef(true);

  const { data: families = [], isLoading, isFetching } = useQuery<Family[]>({
    queryKey: ['/api/families'],
  });

  // Wrapper function that updates localStorage synchronously and invalidates queries
  const setSelectedFamilyId = useCallback((newFamilyId: string | null) => {
    const previousFamilyId = previousFamilyIdRef.current;
    
    // Only take action if the family is actually changing
    if (newFamilyId !== previousFamilyId) {
      // Update localStorage SYNCHRONOUSLY before anything else
      // This ensures navigation doesn't lose the selection
      if (newFamilyId) {
        localStorage.setItem('selectedFamilyId', newFamilyId);
      } else {
        localStorage.removeItem('selectedFamilyId');
      }
      
      // Update the ref to track the new family
      previousFamilyIdRef.current = newFamilyId;
      
      // Invalidate all family-dependent queries to ensure fresh data
      // This clears cached data from the old family
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wishlist'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/purchases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/coordination-insights'] });
      queryClient.invalidateQueries({ queryKey: ['/api/families', previousFamilyId] });
      queryClient.invalidateQueries({ queryKey: ['/api/families', newFamilyId] });
    }
    
    setSelectedFamilyIdState(newFamilyId);
  }, []);

  // Only validate family selection after initial load and when not fetching
  // This prevents resetting to first family during query refetches
  useEffect(() => {
    // Skip validation while data is loading or fetching
    if (isLoading || isFetching) {
      return;
    }
    
    // Mark initial mount as complete after first successful load
    if (isInitialMountRef.current && families.length > 0) {
      isInitialMountRef.current = false;
    }
    
    if (families.length > 0) {
      // Check if currently selected family is still valid
      const isValidSelection = selectedFamilyId && families.some((f: any) => f.id === selectedFamilyId);
      
      if (!isValidSelection) {
        // Reset to first family if current selection is invalid or null
        setSelectedFamilyId(families[0].id);
      }
    } else if (families.length === 0 && selectedFamilyId && !isInitialMountRef.current) {
      // Only clear selection if user truly has no families (not during initial load)
      setSelectedFamilyId(null);
    }
  }, [families, selectedFamilyId, setSelectedFamilyId, isLoading, isFetching]);

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
