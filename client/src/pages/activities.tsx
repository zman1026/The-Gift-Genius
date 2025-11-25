import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ActivityIcon, Gift, UserPlus, Trash2, ShoppingBag, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { z } from "zod";
import { useFamily } from "@/contexts/FamilyContext";

const activitySchema = z.object({
  id: z.string(),
  action: z.string(),
  metadata: z.any().optional(),
  createdAt: z.string(),
  actor: z.object({
    id: z.string(),
    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
    email: z.string(),
    profileImageUrl: z.string().optional().nullable(),
  }),
});

const activitiesResponseSchema = z.array(activitySchema);

type Activity = z.infer<typeof activitySchema>;

export default function Activities() {
  const { selectedFamilyId } = useFamily();

  const { data: activities, isLoading, isError } = useQuery<Activity[]>({
    queryKey: ["/api/activities", selectedFamilyId],
    queryFn: async () => {
      const params = new URLSearchParams({ 
        familyId: selectedFamilyId!,
        limit: "50",
      });
      
      const response = await fetch(`/api/activities?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch activities");
      }
      const data = await response.json();
      const validatedData = activitiesResponseSchema.parse(data);
      return validatedData;
    },
    enabled: !!selectedFamilyId,
    staleTime: 1000 * 60 * 3,
    retry: 2,
  });

  const getInitials = (firstName?: string, lastName?: string, email?: string) => {
    if (firstName || lastName) {
      return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
    }
    return email?.[0]?.toUpperCase() || "U";
  };

  const getActivityIcon = (action: string) => {
    switch (action) {
      case "item_added":
        return <Gift className="w-4 h-4" />;
      case "item_deleted":
        return <Trash2 className="w-4 h-4" />;
      case "item_purchased":
        return <ShoppingBag className="w-4 h-4" />;
      case "item_unpurchased":
        return <X className="w-4 h-4" />;
      case "member_joined":
        return <UserPlus className="w-4 h-4" />;
      default:
        return <ActivityIcon className="w-4 h-4" />;
    }
  };

  const getActivityText = (activity: Activity) => {
    const actorName = activity.actor?.firstName || activity.actor?.lastName
      ? `${activity.actor.firstName || ""} ${activity.actor.lastName || ""}`.trim()
      : activity.actor?.email || "Someone";

    const recipientName = activity.metadata?.recipientDisplayName;

    switch (activity.action) {
      case "item_added":
        if (recipientName) {
          return {
            text: `${actorName} added "${activity.metadata?.itemName || "an item"}" to ${recipientName}'s wishlist`,
            color: "text-primary",
          };
        }
        return {
          text: `${actorName} added "${activity.metadata?.itemName || "an item"}" to their wishlist`,
          color: "text-primary",
        };
      case "item_deleted":
        if (recipientName) {
          return {
            text: `${actorName} removed "${activity.metadata?.itemName || "an item"}" from ${recipientName}'s wishlist`,
            color: "text-muted-foreground",
          };
        }
        return {
          text: `${actorName} removed "${activity.metadata?.itemName || "an item"}" from their wishlist`,
          color: "text-muted-foreground",
        };
      case "item_purchased":
        return {
          text: `${actorName} marked "${activity.metadata?.itemName || "an item"}" as purchased`,
          color: "text-accent",
        };
      case "item_unpurchased":
        return {
          text: `${actorName} unmarked "${activity.metadata?.itemName || "an item"}" as purchased`,
          color: "text-muted-foreground",
        };
      case "member_joined":
        return {
          text: `${actorName} joined the group`,
          color: "text-primary",
        };
      default:
        return {
          text: `${actorName} performed an action`,
          color: "text-foreground",
        };
    }
  };

  if (!selectedFamilyId) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Activity Log</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Recent actions from your group members
            </p>
          </div>
          <div className="text-center py-12">
            <ActivityIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Please select a group to view activity
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6" data-testid="page-activities">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Activity Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Recent actions from your family members
          </p>
        </div>

        {isLoading && (
          <div className="space-y-4" data-testid="activities-loading">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex gap-3 p-4 bg-card rounded-lg border">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="text-center py-12" data-testid="activities-error">
            <ActivityIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              Unable to load activities. Please try again later.
            </p>
          </div>
        )}

        {!isLoading && !isError && (!activities || activities.length === 0) && (
          <div className="text-center py-12" data-testid="activities-empty">
            <ActivityIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              No recent activity yet. Start adding items or inviting group members!
            </p>
          </div>
        )}

        {!isLoading && !isError && activities && activities.length > 0 && (
          <div className="space-y-3" data-testid="activities-list">
            {activities.map((activity) => {
              const { text, color } = getActivityText(activity);
              
              return (
                <div
                  key={activity.id}
                  className="flex gap-3 items-start p-4 bg-card rounded-lg border hover-elevate"
                  data-testid={`activity-${activity.id}`}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage
                      src={activity.actor?.profileImageUrl || undefined}
                      alt={activity.actor?.firstName || "User"}
                    />
                    <AvatarFallback className="text-xs">
                      {getInitials(
                        activity.actor?.firstName || undefined,
                        activity.actor?.lastName || undefined,
                        activity.actor?.email
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <div className={`w-6 h-6 rounded-full bg-muted flex items-center justify-center ${color}`}>
                        {getActivityIcon(activity.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-relaxed">
                          {text}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
