import { useQuery } from "@tanstack/react-query";
import { useFamily } from "@/contexts/FamilyContext";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, ExternalLink, Calendar, User, Gift, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface PurchasedItem {
  id: string;
  itemId: string;
  notes: string | null;
  purchasedAt: string;
  item: {
    id: string;
    name: string;
    description: string | null;
    price: string | null;
    url: string | null;
    imageUrl: string | null;
    priority: string;
    quantity: number;
    category: string | null;
    userId: string;
  };
  purchaser: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
  owner: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
}

export default function Purchased() {
  const { selectedFamilyId } = useFamily();
  const { user } = useAuth();

  const { data: purchases, isLoading } = useQuery<PurchasedItem[]>({
    queryKey: ["/api/purchases", selectedFamilyId, (user as any)?.id],
    queryFn: async () => {
      const response = await fetch(`/api/purchases?familyId=${selectedFamilyId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch purchased items");
      }
      return response.json();
    },
    enabled: !!selectedFamilyId && !!user,
  });

  const { data: purchaseTotals } = useQuery({
    queryKey: ["/api/families", selectedFamilyId, "purchase-totals"],
    queryFn: async () => {
      if (!selectedFamilyId) return [];
      const response = await fetch(`/api/families/${selectedFamilyId}/purchase-totals`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch purchase totals");
      }
      return response.json();
    },
    enabled: !!selectedFamilyId,
  });

  const { data: members } = useQuery({
    queryKey: ["/api/members", selectedFamilyId],
    queryFn: async () => {
      if (!selectedFamilyId) return [];
      const response = await fetch(`/api/members?familyId=${selectedFamilyId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch members");
      }
      return response.json();
    },
    enabled: !!selectedFamilyId,
  });

  // Create a map of userId to member info
  const memberMap = new Map(
    (members || []).map((m: any) => [m.userId, m])
  );

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-600 dark:text-red-400";
      case "medium":
        return "text-yellow-600 dark:text-yellow-400";
      case "low":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-muted-foreground";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "Must-Have!";
      case "medium":
        return "Would Love";
      case "low":
        return "Just a Thought";
      default:
        return priority;
    }
  };

  if (!selectedFamilyId) {
    return (
      <div className="p-4 md:p-8 lg:p-12 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground" />
          <div>
            <h2 className="text-xl font-semibold">No Family Selected</h2>
            <p className="text-muted-foreground mt-2">
              Please select or create a family to view purchased items.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 lg:p-12 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {[...Array(12)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const totalSpent = (purchaseTotals || []).reduce((sum: number, p: any) => sum + (p?.totalSpent || 0), 0);

  return (
    <div className="p-4 md:p-8 lg:p-12 space-y-6">
      <div>
        <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground flex items-center gap-3">
          <ShoppingBag className="w-8 h-8 md:w-10 md:h-10 text-primary" />
          Purchased Items
        </h1>
        <p className="text-muted-foreground mt-2">
          Items you've marked as purchased across your family
        </p>
      </div>

      {purchaseTotals && purchaseTotals.length > 0 && (
        <Card data-testid="purchase-totals-summary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Spending Summary</span>
              <Badge variant="secondary" className="text-base">
                Total: ${totalSpent.toFixed(2)}
              </Badge>
            </CardTitle>
            <CardDescription>
              How much you've spent on gifts for each family member
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {purchaseTotals.map((total: any) => {
                const member: any = memberMap.get(total.userId);
                if (!member) return null;
                
                return (
                  <div
                    key={total.userId}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                    data-testid={`purchase-total-${total.userId}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage
                          src={member.profileImageUrl || undefined}
                          alt={member.firstName || "Member"}
                        />
                        <AvatarFallback>
                          {getInitials(member.firstName, member.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">
                          {member.displayName || (member.firstName || member.lastName
                            ? `${member.firstName || ""} ${member.lastName || ""}`.trim()
                            : member.email)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {total.itemsPurchased} {total.itemsPurchased === 1 ? "item" : "items"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary text-lg">
                        ${(typeof total.totalSpent === 'number' ? total.totalSpent : 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!purchases || purchases.length === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-xl font-semibold">No Purchased Items Yet</h3>
              <p className="text-muted-foreground mt-2">
                When you mark items as purchased, they'll appear here.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {purchases.map((purchase) => (
            <Card
              key={purchase.id}
              className="overflow-hidden hover-elevate"
              data-testid={`purchased-card-${purchase.id}`}
            >
              {purchase.item.imageUrl && (
                <div className="aspect-square w-full overflow-hidden bg-muted">
                  <img
                    src={purchase.item.imageUrl}
                    alt={purchase.item.name}
                    className="w-full h-full object-cover"
                    data-testid={`img-purchased-${purchase.id}`}
                  />
                </div>
              )}
              <CardHeader className="space-y-2 p-3">
                <CardTitle className="flex items-start justify-between gap-1 text-sm">
                  <span className="line-clamp-2" data-testid={`text-item-name-${purchase.id}`}>
                    {purchase.item.name}
                  </span>
                  {purchase.item.price && (
                    <Badge variant="secondary" className="shrink-0 text-xs h-5">
                      ${parseFloat(purchase.item.price).toFixed(2)}
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-1 text-xs">
                  <span className={getPriorityColor(purchase.item.priority)}>
                    {getPriorityLabel(purchase.item.priority)}
                  </span>
                  {purchase.item.quantity > 1 && (
                    <Badge variant="outline" className="text-xs h-5">
                      Qty: {purchase.item.quantity}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {purchase.item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {purchase.item.description}
                  </p>
                )}

                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center gap-1.5">
                    <Gift className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Avatar className="h-5 w-5">
                        <AvatarImage
                          src={purchase.owner.profileImageUrl || undefined}
                          alt={purchase.owner.firstName || "User"}
                        />
                        <AvatarFallback className="text-xs">
                          {getInitials(purchase.owner.firstName, purchase.owner.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground truncate">
                        {purchase.owner.firstName || purchase.owner.lastName
                          ? `${purchase.owner.firstName || ""} ${purchase.owner.lastName || ""}`.trim()
                          : purchase.owner.email}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(purchase.purchasedAt), "MMM d")}
                    </span>
                  </div>

                  {purchase.notes && user && purchase.purchaser.id === (user as any).id && (
                    <div className="bg-muted/50 p-2 rounded-md">
                      <p className="text-xs text-foreground italic line-clamp-2">{purchase.notes}</p>
                    </div>
                  )}
                </div>

                {purchase.item.url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-7"
                    asChild
                    data-testid={`button-view-product-${purchase.id}`}
                  >
                    <a href={purchase.item.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      View
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
