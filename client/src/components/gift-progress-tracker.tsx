import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Gift, ShoppingCart, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { useFamily } from "@/contexts/FamilyContext";
import { cn } from "@/lib/utils";

interface MemberProgress {
  userId: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profileImageUrl: string | null;
  itemCount: number;
  purchasedCount: number;
}

export function GiftProgressTracker() {
  const [, setLocation] = useLocation();
  const { selectedFamilyId } = useFamily();

  const { data: members, isLoading } = useQuery({
    queryKey: ["/api/members", selectedFamilyId],
    queryFn: async () => {
      if (!selectedFamilyId) return [];
      const response = await fetch(`/api/members?familyId=${selectedFamilyId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch members");
      return response.json();
    },
    enabled: !!selectedFamilyId,
  });

  const { data: purchases } = useQuery({
    queryKey: ["/api/purchases", selectedFamilyId],
    queryFn: async () => {
      if (!selectedFamilyId) return [];
      const response = await fetch(`/api/purchases?familyId=${selectedFamilyId}`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedFamilyId,
  });

  if (isLoading) {
    return null;
  }

  if (!members || members.length === 0) {
    return null;
  }

  // Calculate purchase progress for each member
  const memberProgress: MemberProgress[] = members.map((member: any) => {
    const purchasedCount = purchases?.filter((p: any) => p.itemUserId === member.userId).length || 0;
    return {
      ...member,
      purchasedCount,
    };
  });

  // Filter out current user and members with no items
  const othersWithItems = memberProgress.filter((m) => m.itemCount > 0);

  if (othersWithItems.length === 0) {
    return null;
  }

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    if (!firstName && !lastName) return "?";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const getName = (member: MemberProgress) => {
    if (member.displayName) return member.displayName;
    if (member.firstName || member.lastName) {
      return `${member.firstName || ""} ${member.lastName || ""}`.trim();
    }
    return member.email;
  };

  return (
    <Card data-testid="gift-progress-tracker">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          Who Needs Gifts?
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Track your gift-buying progress for each family member
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {othersWithItems.map((member) => {
          const progress = member.itemCount > 0 ? (member.purchasedCount / member.itemCount) * 100 : 0;
          const isComplete = member.purchasedCount === member.itemCount && member.itemCount > 0;

          return (
            <div
              key={member.userId}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                isComplete ? "bg-primary/5 border-primary/20" : "hover-elevate active-elevate-2"
              )}
              onClick={() => setLocation(`/members/${member.userId}`)}
              data-testid={`gift-progress-${member.userId}`}
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={member.profileImageUrl || undefined} alt={getName(member)} />
                <AvatarFallback>{getInitials(member.firstName, member.lastName)}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm text-foreground truncate">{getName(member)}</p>
                  {isComplete && (
                    <Badge variant="default" className="h-5 px-1.5 text-xs shrink-0">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Complete
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={progress} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {member.purchasedCount}/{member.itemCount}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center shrink-0">
                <Gift className={cn("w-5 h-5", isComplete ? "text-primary" : "text-muted-foreground")} />
                <span className="text-xs text-muted-foreground mt-0.5">{member.itemCount}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
