import { Calendar, Gift, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EventHeroProps {
  eventName: string;
  eventDate: Date | null;
  themePrimary: string | null;
  themeAccent: string | null;
  myItemsCount: number;
  familyMembersCount: number;
  itemsPurchasedByOthers: number;
}

export function EventHero({
  eventName,
  eventDate,
  themePrimary,
  themeAccent,
  myItemsCount,
  familyMembersCount,
  itemsPurchasedByOthers,
}: EventHeroProps) {
  const primaryColor = themePrimary || "#DC2626";
  const accentColor = themeAccent || "#15803D";
  
  const getDaysUntil = (date: Date | null) => {
    if (!date) return "No date set";
    
    const eventDateTime = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDateTime.setHours(0, 0, 0, 0);
    
    const diffTime = eventDateTime.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "Event passed";
    if (diffDays === 0) return "Today!";
    if (diffDays === 1) return "Tomorrow!";
    return `${diffDays} days to go`;
  };

  const daysUntil = getDaysUntil(eventDate);

  return (
    <Card
      className="relative overflow-hidden border-2"
      style={{
        borderColor: primaryColor,
      }}
      data-testid="event-hero"
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)`,
        }}
      />
      
      <div className="relative p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h2 
              className="font-serif text-2xl font-semibold mb-1 truncate"
              style={{ color: primaryColor }}
              data-testid="event-hero-name"
            >
              {eventName}
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span data-testid="event-hero-countdown">{daysUntil}</span>
            </div>
          </div>
          
          <Badge 
            variant="outline" 
            className="gap-1 flex-shrink-0"
            style={{
              borderColor: primaryColor,
              color: primaryColor,
            }}
            data-testid="event-hero-purchased-badge"
          >
            <Gift className="w-3 h-3" />
            {itemsPurchasedByOthers}
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5" data-testid="event-hero-items">
            <Gift className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{myItemsCount}</span>
            <span className="text-muted-foreground">items</span>
          </div>
          
          <div className="flex items-center gap-1.5" data-testid="event-hero-members">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{familyMembersCount}</span>
            <span className="text-muted-foreground">family members</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
