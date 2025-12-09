import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFamily } from "@/contexts/FamilyContext";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, ExternalLink, Calendar, User, Gift, AlertCircle, ArrowUp, Circle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { RecordPurchaseDialog } from "@/components/record-purchase-dialog";

interface PurchasedItem {
  id: string;
  itemId: string | null;
  notes: string | null;
  purchasedAt: string;
  price: string | null;
  description: string | null;
  purchasedFrom: string | null;
  recipientUserId: string | null;
  recipientManagedProfileId: string | null;
  itemSnapshot: string | null;
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
    managedProfileId: string | null;
  } | null;
  recipientUser: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  } | null;
  recipientManagedProfile: {
    id: string;
    displayName: string;
    profileImageUrl: string | null;
  } | null;
}

export default function Purchased() {
  const { selectedFamilyId } = useFamily();
  const { user } = useAuth();
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);

  const { data: purchasesData, isLoading } = useQuery<{ purchases: PurchasedItem[]; totalCount: number }>({
    queryKey: ["/api/purchases", selectedFamilyId, (user as any)?.id],
    queryFn: async () => {
      const url = new URL('/api/purchases', window.location.origin);
      url.searchParams.set('familyId', selectedFamilyId || '');
      const response = await fetch(url.toString(), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch purchased items");
      }
      return response.json();
    },
    enabled: !!selectedFamilyId && !!user,
  });

  const purchases = purchasesData?.purchases;

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
            <h2 className="text-xl font-semibold">No Group Selected</h2>
            <p className="text-muted-foreground mt-2">
              Please select or create a group to view purchased items.
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 md:w-10 md:h-10 text-primary" />
            Purchased Items
          </h1>
          <p className="text-muted-foreground mt-2">
            Items you've marked as purchased across your group
          </p>
        </div>
        <Button
          onClick={() => setRecordDialogOpen(true)}
          className="shrink-0"
          data-testid="button-record-purchase"
        >
          <Plus className="w-4 h-4 mr-2" />
          Record a Purchase
        </Button>
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
              How much you've spent on gifts for each group member
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
          {purchases.map((purchase) => {
            // Parse snapshot if item was deleted
            let snapshot = null;
            if (!purchase.item && purchase.itemSnapshot) {
              try {
                snapshot = JSON.parse(purchase.itemSnapshot);
              } catch (e) {
                console.error("Failed to parse item snapshot:", e);
              }
            }
            
            // Determine item type: deleted, off-wishlist, or regular
            const isDeleted = !purchase.item && snapshot !== null;
            const isOffWishlist = !purchase.item && !snapshot;
            
            // Get item details from snapshot (if deleted) or item (if exists) or off-wishlist fields
            const itemName = snapshot?.name || purchase.item?.name || purchase.description;
            const itemPrice = snapshot?.price || purchase.item?.price || purchase.price;
            const itemImageUrl = snapshot?.imageUrl || purchase.item?.imageUrl;
            const itemUrl = snapshot?.url || purchase.item?.url;
            const itemDescription = snapshot?.description || purchase.item?.description;
            const itemPriority = snapshot?.priority || purchase.item?.priority;
            const itemQuantity = snapshot?.quantity || purchase.item?.quantity || 1;
            
            const recipient = purchase.recipientUser || purchase.recipientManagedProfile;
            const recipientName = purchase.recipientUser 
              ? (purchase.recipientUser.firstName || purchase.recipientUser.lastName
                  ? `${purchase.recipientUser.firstName || ""} ${purchase.recipientUser.lastName || ""}`.trim()
                  : purchase.recipientUser.email)
              : purchase.recipientManagedProfile?.displayName;
            const recipientImage = purchase.recipientUser?.profileImageUrl || purchase.recipientManagedProfile?.profileImageUrl;

            return (
              <Card
                key={purchase.id}
                className="overflow-hidden hover-elevate"
                data-testid={`purchased-card-${purchase.id}`}
              >
                <div className="aspect-square w-full overflow-hidden bg-muted relative">
                  {itemImageUrl ? (
                    <img
                      src={itemImageUrl}
                      alt={itemName || "Purchase"}
                      className="w-full h-full object-cover"
                      data-testid={`img-purchased-${purchase.id}`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gift className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                  {isDeleted && (
                    <Badge 
                      variant="secondary"
                      className="absolute top-2 left-2 text-xs h-5"
                    >
                      Item Removed
                    </Badge>
                  )}
                  {isOffWishlist && (
                    <Badge 
                      variant="secondary"
                      className="absolute top-2 left-2 text-xs h-5"
                    >
                      Off-Wishlist
                    </Badge>
                  )}
                  {itemPriority && (
                    <Badge 
                      variant={
                        itemPriority === "high" ? "destructive" : 
                        itemPriority === "medium" ? "default" : 
                        "secondary"
                      }
                      className="absolute top-2 right-2 text-xs h-5"
                    >
                      {itemPriority === "high" && <ArrowUp className="w-2.5 h-2.5 mr-0.5" aria-hidden="true" />}
                      {itemPriority === "medium" && <Circle className="w-2.5 h-2.5 mr-0.5" aria-hidden="true" />}
                      {itemPriority === "low" && <AlertCircle className="w-2.5 h-2.5 mr-0.5" aria-hidden="true" />}
                      {itemPriority === "high" ? "Must-Have!" : 
                       itemPriority === "medium" ? "Would Love" : 
                       "Just a Thought"}
                    </Badge>
                  )}
                </div>
                <CardHeader className="space-y-2 p-3">
                  <CardTitle className="flex items-start justify-between gap-1 text-sm">
                    <span className="line-clamp-2" data-testid={`text-item-name-${purchase.id}`}>
                      {itemName}
                    </span>
                    {itemPrice && (
                      <Badge variant="secondary" className="shrink-0 text-xs h-5">
                        ${parseFloat(itemPrice).toFixed(2)}
                      </Badge>
                    )}
                  </CardTitle>
                  {itemQuantity && itemQuantity > 1 && (
                    <Badge variant="outline" className="text-xs h-5">
                      Qty: {itemQuantity}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 p-3 pt-0">
                  {itemDescription && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {itemDescription}
                    </p>
                  )}
                  {isOffWishlist && purchase.purchasedFrom && (
                    <p className="text-xs text-muted-foreground">
                      From: {purchase.purchasedFrom}
                    </p>
                  )}

                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center gap-1.5">
                      <Gift className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <Avatar className="h-5 w-5">
                          <AvatarImage
                            src={recipientImage || undefined}
                            alt={recipientName || "User"}
                          />
                          <AvatarFallback className="text-xs">
                            {recipient ? getInitials(
                              (purchase.recipientUser?.firstName || null), 
                              (purchase.recipientUser?.lastName || null)
                            ) : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground truncate">
                          {recipientName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(purchase.purchasedAt), "MMM d")}
                      </span>
                    </div>

                    {purchase.notes && (
                      <div className="bg-muted/50 p-2 rounded-md">
                        <p className="text-xs text-foreground italic line-clamp-2">{purchase.notes}</p>
                      </div>
                    )}
                  </div>

                  {itemUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      asChild
                      data-testid={`button-view-product-${purchase.id}`}
                    >
                      <a href={itemUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View Product
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <RecordPurchaseDialog
        open={recordDialogOpen}
        onOpenChange={setRecordDialogOpen}
      />
    </div>
  );
}
