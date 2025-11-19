import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Gift, ArrowLeft, CheckCircle2, ExternalLink, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function MemberWishlist() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, params] = useRoute("/members/:userId");
  const [, setLocation] = useLocation();
  const [purchaseNotes, setPurchaseNotes] = useState<Record<string, string>>({});
  const [openNoteDialog, setOpenNoteDialog] = useState<string | null>(null);

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

  const { data: memberData, isLoading: memberLoading } = useQuery({
    queryKey: ["/api/members", userId],
    enabled: !!userId,
    retry: false,
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/members", userId, "wishlist"],
    enabled: !!userId,
    retry: false,
  });

  const markPurchasedMutation = useMutation({
    mutationFn: async ({ itemId, notes }: { itemId: string; notes: string }) => {
      return await apiRequest("POST", `/api/wishlist/${itemId}/purchase`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", userId, "wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/members", userId, "wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
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

  const handleMarkPurchased = (itemId: string) => {
    markPurchasedMutation.mutate({ itemId, notes: purchaseNotes[itemId] || "" });
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  if (memberLoading || itemsLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-12 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  const hasItems = items && items.length > 0;
  const memberName = memberData?.firstName || memberData?.lastName
    ? `${memberData.firstName || ""} ${memberData.lastName || ""}`.trim()
    : memberData?.email || "Family Member";

  return (
    <div className="p-6 md:p-8 lg:p-12 space-y-6">
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item: any) => {
            const isPurchased = !!item.purchase;
            const isPurchasedByMe = item.purchase?.purchasedById === memberData?.userId;

            return (
              <Card
                key={item.id}
                className={`overflow-hidden hover-elevate ${isPurchased ? 'opacity-75' : ''}`}
                data-testid={`wishlist-item-${item.id}`}
              >
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gift className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                  {isPurchased && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Badge variant="secondary" className="text-sm">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Purchased
                      </Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-foreground line-clamp-2 mb-1">{item.name}</h3>
                    {item.price && (
                      <p className="text-lg font-bold text-primary">${parseFloat(item.price).toFixed(2)}</p>
                    )}
                    {item.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3 mt-2">{item.description}</p>
                    )}
                  </div>
                  
                  {isPurchased && item.purchase?.notes && (
                    <div className="bg-muted p-2 rounded-md">
                      <p className="text-xs text-muted-foreground flex items-start gap-1">
                        <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{item.purchase.notes}</span>
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {item.url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open(item.url, '_blank')}
                        data-testid={`button-view-${item.id}`}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    )}
                    
                    {!isPurchased ? (
                      <Dialog open={openNoteDialog === item.id} onOpenChange={(open) => setOpenNoteDialog(open ? item.id : null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="default"
                            size="sm"
                            className={item.url ? "" : "flex-1"}
                            data-testid={`button-mark-purchased-${item.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Mark Purchased
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
                        onClick={() => unmarkPurchasedMutation.mutate(item.id)}
                        disabled={unmarkPurchasedMutation.isPending}
                        data-testid={`button-unmark-purchased-${item.id}`}
                      >
                        Unmark
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
