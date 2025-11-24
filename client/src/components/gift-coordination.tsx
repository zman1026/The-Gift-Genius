import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Gift } from "lucide-react";
import { useLocation } from "wouter";

interface GiftCoordinationProps {
  familyId: string;
  eventId?: string;
}

interface CoordinationInsight {
  type: "high-priority" | "no-gifts" | "personal-progress";
  message: string;
  count?: number;
  memberId?: string;
  memberName?: string;
}

export function GiftCoordination({ familyId, eventId }: GiftCoordinationProps) {
  const [, setLocation] = useLocation();

  const { data: insights, isLoading } = useQuery<CoordinationInsight[]>({
    queryKey: ["/api/coordination-insights", familyId, eventId],
    queryFn: async () => {
      const params = new URLSearchParams({ familyId });
      if (eventId) {
        params.append("eventId", eventId);
      }
      const response = await fetch(`/api/coordination-insights?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch coordination insights");
      return response.json();
    },
    enabled: !!familyId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Gift Coordination</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!insights || insights.length === 0) {
    return (
      <Card data-testid="gift-coordination">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Gift Coordination</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span>Everything looks great! No urgent coordination needed.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getIcon = (type: CoordinationInsight["type"]) => {
    switch (type) {
      case "high-priority":
        return <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />;
      case "no-gifts":
        return <Gift className="w-4 h-4 text-blue-500 flex-shrink-0" />;
      case "personal-progress":
        return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />;
      default:
        return <Gift className="w-4 h-4 flex-shrink-0" />;
    }
  };

  const handleInsightClick = (insight: CoordinationInsight) => {
    if (insight.type === "high-priority") {
      setLocation('/wishlist');
    } else if (insight.type === "no-gifts" && insight.memberId) {
      setLocation(`/members/${insight.memberId}`);
    } else if (insight.type === "personal-progress") {
      setLocation('/purchased');
    }
  };

  return (
    <Card data-testid="gift-coordination">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Gift Coordination</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((insight, index) => (
          <div
            key={index}
            className="flex items-start gap-2.5 p-2.5 rounded-md hover-elevate cursor-pointer"
            onClick={() => handleInsightClick(insight)}
            data-testid={`coordination-insight-${insight.type}`}
          >
            {getIcon(insight.type)}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{insight.message}</p>
            </div>
            {insight.count !== undefined && (
              <Badge variant="secondary" className="flex-shrink-0">
                {insight.count}
              </Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
