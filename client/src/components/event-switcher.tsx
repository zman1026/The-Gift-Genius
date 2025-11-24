import { useEvent } from "@/contexts/EventContext";
import { useFamily } from "@/contexts/FamilyContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export function EventSwitcher() {
  const { selectedEventId, setSelectedEventId, events, isLoading } = useEvent();
  const { selectedFamilyId } = useFamily();
  const [, setLocation] = useLocation();

  if (!selectedFamilyId || isLoading) {
    return null;
  }

  if (events.length === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setLocation('/events/create')}
        className="gap-2"
        data-testid="button-create-first-event"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">Create Event</span>
      </Button>
    );
  }

  if (events.length === 1) {
    const event = events[0];
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
          <div 
            className="w-3 h-3 rounded-full flex-shrink-0" 
            style={{ backgroundColor: event.themePrimary }}
          />
          <span className="text-sm font-medium text-foreground truncate" data-testid="single-event-name">
            {event.name}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation('/events/create')}
          className="shrink-0"
          data-testid="button-create-event"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  const handleEventChange = (value: string) => {
    if (value === 'create-new') {
      setLocation('/events/create');
    } else {
      setSelectedEventId(value);
    }
  };

  return (
    <Select value={selectedEventId || undefined} onValueChange={handleEventChange}>
      <SelectTrigger className="w-[180px] sm:w-[220px]" data-testid="event-switcher">
        <div className="flex items-center gap-2 min-w-0">
          {selectedEventId && (
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0" 
              style={{ 
                backgroundColor: events.find((e: any) => e.id === selectedEventId)?.themePrimary 
              }}
            />
          )}
          <SelectValue placeholder="Select event" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {events.map((event: any) => (
          <SelectItem 
            key={event.id} 
            value={event.id}
            data-testid={`event-option-${event.id}`}
          >
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: event.themePrimary }}
              />
              <span className="truncate">{event.name}</span>
              {!event.isActive && (
                <span className="text-xs text-muted-foreground">(Inactive)</span>
              )}
            </div>
          </SelectItem>
        ))}
        <SelectItem 
          value="create-new"
          data-testid="event-option-create-new"
        >
          <div className="flex items-center gap-2 text-primary">
            <Plus className="w-4 h-4" />
            <span>Create New Event</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
