import { useQuery } from "@tanstack/react-query";
import { useFamily } from "@/contexts/FamilyContext";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Gift, Calendar, ChevronRight, Users, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import type { PersonalList } from "@shared/schema";

interface SharedPersonalListWithOwner extends PersonalList {
  ownerFirstName: string | null;
  ownerLastName: string | null;
  ownerProfileImageUrl: string | null;
  itemCount: number;
}

function getInitials(firstName: string | null, lastName: string | null): string {
  const first = firstName?.charAt(0) || "";
  const last = lastName?.charAt(0) || "";
  return (first + last).toUpperCase() || "?";
}

const occasionThemes: Record<string, { primary: string; background: string }> = {
  birthday: { primary: "#EC4899", background: "#FDF2F8" },
  graduation: { primary: "#3B82F6", background: "#EFF6FF" },
  wedding: { primary: "#F43F5E", background: "#FFF1F2" },
  baby_shower: { primary: "#A855F7", background: "#FAF5FF" },
  anniversary: { primary: "#EF4444", background: "#FEF2F2" },
  housewarming: { primary: "#84CC16", background: "#F7FEE7" },
  holiday: { primary: "#DC2626", background: "#FEF2F2" },
  other: { primary: "#6366F1", background: "#EEF2FF" },
};

export function SharedPersonalLists() {
  const { selectedFamilyId } = useFamily();
  const { user } = useAuth();

  const { data: sharedLists, isLoading } = useQuery<SharedPersonalListWithOwner[]>({
    queryKey: ["/api/families", selectedFamilyId, "shared-personal-lists"],
    queryFn: async () => {
      if (!selectedFamilyId) return [];
      const response = await fetch(`/api/families/${selectedFamilyId}/shared-personal-lists`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch shared lists");
      }
      return response.json();
    },
    enabled: !!selectedFamilyId,
  });

  if (!selectedFamilyId) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const otherUsersLists = sharedLists?.filter(list => list.userId !== (user as any)?.id) || [];

  if (otherUsersLists.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" aria-hidden="true" />
            <CardTitle className="text-base">Personal Lists Shared with Your Group</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {otherUsersLists.length} {otherUsersLists.length === 1 ? "list" : "lists"}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Members have shared these personal wishlists with your group
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {otherUsersLists.map((list) => {
            const themeColors = occasionThemes[list.occasionType] || occasionThemes.other;
            const ownerName = list.ownerFirstName || list.ownerLastName
              ? `${list.ownerFirstName || ""} ${list.ownerLastName || ""}`.trim()
              : "Group Member";

            return (
              <Link 
                key={list.id} 
                href={`/lists/${list.publicSlug}`}
                className="block"
              >
                <div 
                  className="flex items-center gap-3 p-3 rounded-lg border hover-elevate"
                  data-testid={`shared-list-${list.id}`}
                >
                  <div 
                    className="p-2 rounded-lg shrink-0"
                    style={{ backgroundColor: themeColors.background }}
                  >
                    <Gift 
                      className="w-4 h-4" 
                      style={{ color: themeColors.primary }}
                      aria-hidden="true" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{list.name}</span>
                      {list.date && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                          <Calendar className="w-3 h-3" aria-hidden="true" />
                          {format(new Date(list.date), "MMM d")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={list.ownerProfileImageUrl || undefined} />
                        <AvatarFallback className="text-[8px]">
                          {getInitials(list.ownerFirstName, list.ownerLastName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{ownerName}</span>
                      <span className="text-muted-foreground/60 shrink-0">
                        {list.itemCount} item{list.itemCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
