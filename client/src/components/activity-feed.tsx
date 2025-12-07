import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ActivityIcon, Gift, UserPlus, Trash2, ShoppingBag, X, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { z } from "zod";

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

interface ActivityFeedProps {
  familyId: string;
  limit?: number;
  compact?: boolean;
}

export function ActivityFeed({ familyId, limit = 10, compact = false }: ActivityFeedProps) {
  const { data: activities, isLoading, isError } = useQuery<Activity[]>({
    queryKey: ["/api/activities", familyId],
    queryFn: async () => {
      const params = new URLSearchParams({ 
        familyId,
        limit: limit.toString(),
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
    enabled: !!familyId,
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
      case "items_imported":
        return <Download className="w-4 h-4" />;
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
      case "items_imported": {
        const count = activity.metadata?.count || 0;
        const itemText = count === 1 ? "item" : "items";
        const recipientName = activity.metadata?.recipientDisplayName;
        if (recipientName) {
          return {
            text: `${actorName} imported ${count} ${itemText} to ${recipientName}'s wishlist`,
            color: "text-primary",
          };
        }
        return {
          text: `${actorName} imported ${count} ${itemText} to their wishlist`,
          color: "text-primary",
        };
      }
      default:
        return {
          text: `${actorName} performed an action`,
          color: "text-foreground",
        };
    }
  };

  const loadingSkeleton = (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );

  if (isLoading) {
    if (compact) return loadingSkeleton;
    return (
      <Card data-testid="activity-feed-loading">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ActivityIcon className="w-5 h-5 text-primary" />
            <CardTitle className="text-xl">Recent Activity</CardTitle>
          </div>
          <CardDescription>
            What's happening in your group
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSkeleton}
        </CardContent>
      </Card>
    );
  }

  const errorContent = (
    <div className="text-center py-8">
      <ActivityIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
      <p className="text-muted-foreground text-sm">
        Unable to load activities. Please try again later.
      </p>
    </div>
  );

  const emptyContent = (
    <div className="text-center py-8">
      <ActivityIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
      <p className="text-muted-foreground text-sm">
        No recent activity yet. Start adding items or inviting group members!
      </p>
    </div>
  );

  if (isError) {
    if (compact) return errorContent;
    return (
      <Card data-testid="activity-feed-error">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ActivityIcon className="w-5 h-5 text-primary" />
            <CardTitle className="text-xl">Recent Activity</CardTitle>
          </div>
          <CardDescription>
            What's happening in your group
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorContent}
        </CardContent>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    if (compact) return emptyContent;
    return (
      <Card data-testid="activity-feed-empty">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ActivityIcon className="w-5 h-5 text-primary" />
            <CardTitle className="text-xl">Recent Activity</CardTitle>
          </div>
          <CardDescription>
            What's happening in your group
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emptyContent}
        </CardContent>
      </Card>
    );
  }

  const activityList = (
    <div className="space-y-4">
      {activities.map((activity) => {
        const { text, color } = getActivityText(activity);
        
        return (
          <div
            key={activity.id}
            className="flex gap-3 items-start"
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
  );

  // Compact mode: just return the activity list without Card wrapper
  if (compact) {
    return activityList;
  }

  // Full mode: return Card with header
  return (
    <Card data-testid="activity-feed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ActivityIcon className="w-5 h-5 text-primary" />
          <CardTitle className="text-xl">Recent Activity</CardTitle>
        </div>
        <CardDescription>
          What's happening in your group
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activityList}
      </CardContent>
    </Card>
  );
}
