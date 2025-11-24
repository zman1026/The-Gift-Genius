import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFamily } from './FamilyContext';

interface Event {
  id: string;
  familyId: string;
  name: string;
  date: Date | null;
  eventType: string;
  themePrimary: string;
  themeAccent: string;
  isActive: boolean;
  createdAt: Date;
}

interface EventContextType {
  selectedEventId: string | null;
  setSelectedEventId: (eventId: string | null) => void;
  events: Event[];
  isLoading: boolean;
  selectedEvent: Event | null;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export function EventProvider({ children }: { children: ReactNode }) {
  const { selectedFamilyId } = useFamily();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(() => {
    // Load from localStorage, scoped by family
    if (selectedFamilyId) {
      return localStorage.getItem(`selectedEventId_${selectedFamilyId}`);
    }
    return null;
  });

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ['/api/families', selectedFamilyId, 'events'],
    enabled: !!selectedFamilyId,
  });

  // Auto-select the first active event or the first event if none selected
  useEffect(() => {
    if (events.length > 0 && selectedFamilyId) {
      const isValidSelection = selectedEventId && events.some((e: any) => e.id === selectedEventId);
      
      if (!isValidSelection) {
        // Try to select an active event first, otherwise select the first event
        const activeEvent = events.find((e: any) => e.isActive);
        const defaultEvent = activeEvent || events[0];
        setSelectedEventId(defaultEvent.id);
      }
    } else if (events.length === 0 && selectedEventId) {
      // Clear selection if family has no events
      setSelectedEventId(null);
      if (selectedFamilyId) {
        localStorage.removeItem(`selectedEventId_${selectedFamilyId}`);
      }
    }
  }, [events, selectedEventId, selectedFamilyId]);

  // Persist selection to localStorage (scoped by family)
  useEffect(() => {
    if (selectedEventId && selectedFamilyId) {
      localStorage.setItem(`selectedEventId_${selectedFamilyId}`, selectedEventId);
    }
  }, [selectedEventId, selectedFamilyId]);

  // Clear event selection immediately when family changes to prevent stale values
  useEffect(() => {
    // Reset to null first to clear any stale selection
    setSelectedEventId(null);
    
    if (selectedFamilyId) {
      const storedEventId = localStorage.getItem(`selectedEventId_${selectedFamilyId}`);
      if (storedEventId) {
        setSelectedEventId(storedEventId);
      }
    }
  }, [selectedFamilyId]);

  const selectedEvent = events.find((e: any) => e.id === selectedEventId) || null;

  return (
    <EventContext.Provider value={{ selectedEventId, setSelectedEventId, events, isLoading, selectedEvent }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  const context = useContext(EventContext);
  if (context === undefined) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
}
