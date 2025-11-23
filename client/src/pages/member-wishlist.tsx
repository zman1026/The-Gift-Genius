import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useFamily } from "@/contexts/FamilyContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Gift, ArrowLeft, CheckCircle2, ExternalLink, MessageSquare, AlertCircle, Circle, ArrowUp, ShoppingCart, CheckSquare, Square } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShoppingOptionsDialog } from "@/components/shopping-options-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function MemberWishlist() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { selectedFamilyId } = useFamily();
  const [, params] = useRoute("/members/:userId");
  const [, setLocation] = useLocation();
  const [purchaseNotes, setPurchaseNotes] = useState<Record<string, string>>({});
  const [openNoteDialog, setOpenNoteDialog] = useState<string | null>(null);
  const [selectedItemForShopping, setSelectedItemForShopping] = useState<any>(null);
  const [shoppingMode, setShoppingMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Use a ref to always get the current selectedFamilyId (prevents stale closure bugs)
  const selectedFamilyIdRef = useRef(selectedFamilyId);
  useEffect(() => {
    selectedFamilyIdRef.current = selectedFamilyId;
  }, [selectedFamilyId]);

  const userId = params?.userId;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: memberData, isLoading: memberLoading} = useQuery({
    queryKey: ["/api/members", userId, selectedFamilyId],
    queryFn: async () => {
      if (!userId) return null;
      const response = await fetch(`/api/members/${userId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch member");
      }
      return response.json();
    },
    enabled: !!userId && !!selectedFamilyId,
    retry: false,
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/members", userId, "wishlist", selectedFamilyId],
    queryFn: async () => {
      if (!userId || !selectedFamilyId) return [];
      const response = await fetch(`/api/members/${userId}/wishlist?familyId=${selectedFamilyId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch wishlist");
      }
      return response.json();
    },
    enabled: !!userId && !!selectedFamilyId,
    retry: false,
  });

  const markPurchasedMutation = useMutation({
    mutationFn: async ({ itemId, notes }: { itemId: string; notes: string }) => {
      return await apiRequest("POST", `/api/wishlist/${itemId}/purchase`, { notes });
    },
    onSuccess: () => {
      const currentFamilyId = selectedFamilyIdRef.current;
      queryClient.invalidateQueries({ queryKey: ["/api/members", userId, "wishlist", currentFamilyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats", currentFamilyId] });
      toast({
        title: "Success",
        description: "Item marked as purchased!",
      });
      setOpenNoteDialog(null);
      setPurchaseNotes({});
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to mark item as purchased",
        variant: "destructive",
      });
    },
  });

  const unmarkPurchasedMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return await apiRequest("DELETE", `/api/wishlist/${itemId}/purchase`, {});
    },
    onSuccess: () => {
      const currentFamilyId = selectedFamilyIdRef.current;
      queryClient.invalidateQueries({ queryKey: ["/api/members", userId, "wishlist", currentFamilyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats", currentFamilyId] });
      toast({
        title: "Success",
        description: "Purchase marking removed",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to remove purchase marking",
        variant: "destructive",
      });
    },
  });

  const bulkPurchaseMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const promises = itemIds.map(itemId => 
        apiRequest("POST", `/api/wishlist/${itemId}/purchase`, { notes: "" })
      );
      return await Promise.all(promises);
    },
    onSuccess: () => {
      const currentFamilyId = selectedFamilyIdRef.current;
      queryClient.invalidateQueries({ queryKey: ["/api/members", userId, "wishlist", currentFamilyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats", currentFamilyId] });
      toast({
        title: "Success",
        description: `${selectedItems.size} items marked as purchased!`,
      });
      setSelectedItems(new Set());
      setShoppingMode(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark items as purchased",
        variant: "destructive",
      });
    },
  });

  const handleMarkPurchased = (itemId: string) => {
    markPurchasedMutation.mutate({ itemId, notes: purchaseNotes[itemId] || "" });
  };

  const handleBulkPurchase = () => {
    if (selectedItems.size === 0) return;
    bulkPurchaseMutation.mutate(Array.from(selectedItems));
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  if (memberLoading || itemsLoading) {
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

  const hasItems = items && items.length > 0;
  const memberName = memberData?.firstName || memberData?.lastName
    ? `${memberData.firstName || ""} ${memberData.lastName || ""}`.trim()
    : memberData?.email || "Family Member";

  // Filter items based on shopping mode
  const displayedItems = shoppingMode 
    ? items?.filter((item: any) => !item.purchase) || []
    : items || [];

  return (
    <div className="p-6 md:p-8 lg:p-12 space-y-6 pb-24">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocation("/members")}
        data-testid="button-back"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Members
      </Button>

      {/* Member Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={memberData?.profileImageUrl || undefined} alt={memberName} />
            <AvatarFallback className="text-2xl">
              {getInitials(memberData?.firstName, memberData?.lastName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground" data-testid="member-name">
              {memberName}'s Wishlist
            </h1>
            <p className="text-muted-foreground mt-1">
              {items?.length || 0} items on their list
            </p>
          </div>
        </div>
        
        {hasItems && (
          <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
            <ShoppingCart className="w-4 h-4 text-primary" />
            <Label htmlFor="shopping-mode" className="cursor-pointer text-sm font-medium">
              Shopping Mode
            </Label>
            <Switch
              id="shopping-mode"
              checked={shoppingMode}
              onCheckedChange={(checked) => {
                setShoppingMode(checked);
                if (!checked) setSelectedItems(new Set());
              }}
              data-testid="switch-shopping-mode"
            />
          </div>
        )}
      </div>

      {!hasItems ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Gift className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-xl mb-2 text-foreground">No Items Yet</h3>
            <p className="text-muted-foreground max-w-md">
              {memberName} hasn't added any items to their wishlist yet.
            </p>
          </CardContent>
        </Card>
      ) : displayedItems.length === 0 && shoppingMode ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <h3 className="font-semibold text-xl mb-2 text-foreground">All Items Purchased!</h3>
            <p className="text-muted-foreground max-w-md">
              You've purchased all items on {memberName}'s wishlist. Great job! 🎉
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setShoppingMode(false)}
              data-testid="button-exit-shopping-mode"
            >
              Show All Items
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {displayedItems.map((item: any) => {
            const isPurchased = !!item.purchase;
            const isPurchasedByMe = item.purchase?.purchasedById === memberData?.userId;
            const isSelected = selectedItems.has(item.id);

            return (
              <Card
                key={item.id}
                className={`flex flex-col overflow-hidden ${isSelected ? 'ring-2 ring-primary' : 'hover-elevate'} cursor-pointer ${isPurchased ? 'opacity-75' : ''}`}
                onClick={() => {
                  if (shoppingMode) {
                    toggleItemSelection(item.id);
                  } else if (!isPurchased) {
                    setSelectedItemForShopping(item);
                  }
                }}
                data-testid={`wishlist-item-${item.id}`}
              >
                {shoppingMode && (
                  <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleItemSelection(item.id)}
                      className="bg-background border-2"
                      data-testid={`checkbox-${item.id}`}
                    />
                  </div>
                )}
                <div className="aspect-square bg-muted relative overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gift className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                  {item.priority && !isPurchased && (
                    <Badge 
                      variant={item.priority === "high" ? "destructive" : item.priority === "medium" ? "default" : "secondary"} 
                      className="absolute top-2 right-2 text-xs h-5"
                      data-testid={`badge-priority-${item.id}`}
                    >
                      {item.priority === "high" && <ArrowUp className="w-2.5 h-2.5 mr-0.5" />}
                      {item.priority === "medium" && <Circle className="w-2.5 h-2.5 mr-0.5" />}
                      {item.priority === "low" && <AlertCircle className="w-2.5 h-2.5 mr-0.5" />}
                      {item.priority === "high" ? "Must-Have!" : item.priority === "medium" ? "Would Love" : "Just a Thought"}
                    </Badge>
                  )}
                  {isPurchased && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Purchased
                      </Badge>
                    </div>
                  )}
                </div>
                <CardContent className="flex flex-col p-3 gap-2">
                  <h3 className="font-semibold text-sm text-foreground line-clamp-2">{item.name}</h3>
                  {item.price && (
                    <p className="text-base font-bold text-primary">${parseFloat(item.price).toFixed(2)}</p>
                  )}
                  {item.quantity && item.quantity !== 1 && (
                    <Badge variant="outline" className="text-xs h-5 w-fit" data-testid={`badge-quantity-${item.id}`}>
                      Qty: {item.quantity}
                    </Badge>
                  )}
                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                  )}
                  
                  {isPurchased && item.purchase?.notes && (
                    <div className="bg-muted p-2 rounded-md">
                      <p className="text-xs text-muted-foreground flex items-start gap-1">
                        <MessageSquare className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{item.purchase.notes}</span>
                      </p>
                    </div>
                  )}

                  {!shoppingMode && (
                    <div className="flex gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                      {item.url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(item.url, '_blank')}
                          data-testid={`button-view-${item.id}`}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          <span className="truncate">View</span>
                        </Button>
                      )}
                      
                      {!isPurchased ? (
                      <Dialog open={openNoteDialog === item.id} onOpenChange={(open) => setOpenNoteDialog(open ? item.id : null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1"
                            data-testid={`button-mark-purchased-${item.id}`}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            <span className="truncate">Purchase</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Mark as Purchased</DialogTitle>
                            <DialogDescription>
                              Add private notes about this purchase (optional). {memberName} won't see this.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 pt-2">
                            <Textarea
                              placeholder="e.g., Bought from Amazon, arriving Dec 20th"
                              value={purchaseNotes[item.id] || ""}
                              onChange={(e) => setPurchaseNotes({ ...purchaseNotes, [item.id]: e.target.value })}
                              className="resize-none h-24"
                              data-testid={`input-purchase-notes-${item.id}`}
                            />
                            <div className="flex gap-3">
                              <Button
                                onClick={() => handleMarkPurchased(item.id)}
                                disabled={markPurchasedMutation.isPending}
                                data-testid={`button-confirm-purchase-${item.id}`}
                              >
                                {markPurchasedMutation.isPending ? "Saving..." : "Confirm Purchase"}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setOpenNoteDialog(null)}
                                data-testid="button-cancel-purchase"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    ) : isPurchasedByMe ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => unmarkPurchasedMutation.mutate(item.id)}
                        disabled={unmarkPurchasedMutation.isPending}
                        data-testid={`button-unmark-purchased-${item.id}`}
                      >
                        <span className="truncate">Unmark</span>
                      </Button>
                    ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Floating Bulk Purchase Button */}
      {shoppingMode && selectedItems.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-50">
          <Button
            size="lg"
            onClick={handleBulkPurchase}
            disabled={bulkPurchaseMutation.isPending}
            className="shadow-lg"
            data-testid="button-bulk-purchase"
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            {bulkPurchaseMutation.isPending 
              ? "Purchasing..." 
              : `Mark ${selectedItems.size} as Purchased`}
          </Button>
        </div>
      )}

      {/* Shopping Options Dialog */}
      {selectedItemForShopping && selectedFamilyId && userId && (
        <ShoppingOptionsDialog
          item={selectedItemForShopping}
          open={!!selectedItemForShopping}
          onOpenChange={(open) => !open && setSelectedItemForShopping(null)}
          userId={userId}
          familyId={selectedFamilyId}
        />
      )}
    </div>
  );
}
