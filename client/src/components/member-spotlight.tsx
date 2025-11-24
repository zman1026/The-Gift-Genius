import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

interface MemberSpotlightProps {
  familyId: string;
  eventId?: string;
}

interface FamilyMember {
  id: string;
  userId?: string;
  managedProfileId?: string;
  displayName: string | null;
  user?: {
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
  };
  managedProfile?: {
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
  };
  itemCount?: number;
}

export function MemberSpotlight({ familyId, eventId }: MemberSpotlightProps) {
  const [, setLocation] = useLocation();

  const { data: members, isLoading } = useQuery<FamilyMember[]>({
    queryKey: ["/api/members", familyId],
    enabled: !!familyId,
  });

  const { data: itemCounts, isLoading: isLoadingCounts, error: countsError } = useQuery<Record<string, number>>({
    queryKey: ["/api/wishlist/member-counts", familyId, eventId],
    queryFn: async () => {
      const params = new URLSearchParams({ familyId });
      if (eventId) {
        params.append("eventId", eventId);
      }
      const response = await fetch(`/api/wishlist/member-counts?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch member counts");
      return response.json();
    },
    enabled: !!familyId && !!eventId,
  });

  const getDisplayName = (member: FamilyMember) => {
    if (member.displayName) return member.displayName;
    
    if (member.user) {
      return `${member.user.firstName} ${member.user.lastName}`.trim();
    }
    
    if (member.managedProfile) {
      return `${member.managedProfile.firstName} ${member.managedProfile.lastName || ""}`.trim();
    }
    
    return "Unknown";
  };

  const getInitials = (member: FamilyMember) => {
    const name = getDisplayName(member);
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getProfileImage = (member: FamilyMember) => {
    return member.user?.profileImageUrl || member.managedProfile?.profileImageUrl;
  };

  const getMemberIdentifier = (member: FamilyMember) => {
    return member.userId || member.managedProfileId || member.id;
  };

  const handleMemberClick = (member: FamilyMember) => {
    const identifier = getMemberIdentifier(member);
    setLocation(`/members/${identifier}`);
  };

  // Wait for both members and counts to load
  if (isLoading || isLoadingCounts) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Family Wishlists</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2 min-w-[80px]">
                <div className="w-14 h-14 rounded-full bg-muted animate-pulse" />
                <div className="h-4 w-12 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't render if there's an error loading counts or no event selected
  if (countsError || !eventId || !members || members.length === 0 || !itemCounts) {
    return null;
  }

  // Filter members to only show those with items in the selected event
  const membersWithItems = members.filter((member) => {
    const identifier = getMemberIdentifier(member);
    const itemCount = itemCounts[identifier] || 0;
    return itemCount > 0;
  });

  // Don't render if no members have items in this event
  if (membersWithItems.length === 0) {
    return null;
  }

  return (
    <Card data-testid="member-spotlight">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Family Wishlists</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {membersWithItems.map((member) => {
            const identifier = getMemberIdentifier(member);
            const itemCount = itemCounts?.[identifier] || 0;
            
            return (
              <button
                key={identifier}
                className="flex flex-col items-center gap-2 min-w-[80px] cursor-pointer hover-elevate active-elevate-2 p-2 rounded-lg border-0 bg-transparent"
                onClick={() => handleMemberClick(member)}
                data-testid={`member-spotlight-${identifier}`}
              >
                <div className="relative">
                  <Avatar className="w-14 h-14 border-2 border-border">
                    <AvatarImage src={getProfileImage(member)} alt={getDisplayName(member)} />
                    <AvatarFallback className="text-sm font-medium">
                      {getInitials(member)}
                    </AvatarFallback>
                  </Avatar>
                  {itemCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-xs"
                      data-testid={`member-count-${identifier}`}
                    >
                      {itemCount}
                    </Badge>
                  )}
                </div>
                <div className="text-center max-w-[80px]">
                  <p className="text-xs font-medium text-foreground truncate">
                    {getDisplayName(member).split(" ")[0]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
