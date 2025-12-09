import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useFamily } from "@/contexts/FamilyContext";
import { useCurrentMember } from "@/contexts/CurrentMemberContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Gift, ArrowLeft, CheckCircle2, ExternalLink, MessageSquare, AlertCircle, Circle, ArrowUp, Edit, ShoppingBag, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShoppingOptionsDialog } from "@/components/shopping-options-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UnifiedAddItemDialog } from "@/components/unified-add-item-dialog";
import { ImportAmazonWishlistDialog } from "@/components/import-amazon-wishlist-dialog";

const editMemberSchema = z.object({
  displayName: z.string().nullable().optional(),
});

type EditMemberForm = z.infer<typeof editMemberSchema>;

export default function MemberWishlist() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { selectedFamilyId, families } = useFamily();
  const { setCurrentMember, clearCurrentMember } = useCurrentMember();
  const currentUserId = (user as any)?.id;
  const [, params] = useRoute("/members/:userId");
  const [, setLocation] = useLocation();
  const [purchaseNotes, setPurchaseNotes] = useState<Record<string, string>>({});
  const [openNoteDialog, setOpenNoteDialog] = useState<string | null>(null);
  const [selectedItemForShopping, setSelectedItemForShopping] = useState<any>(null);
  const [isEditMemberDialogOpen, setIsEditMemberDialogOpen] = useState(false);
  
  // Detail view state
  const [viewingItem, setViewingItem] = useState<any>(null);
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [isImportAmazonDialogOpen, setIsImportAmazonDialogOpen] = useState(false);
  
  const selectedFamily = families?.find((f: any) => f.id === selectedFamilyId);
  const isOrganizer = selectedFamily?.createdById === currentUserId;
  
  // Use a ref to always get the current selectedFamilyId (prevents stale closure bugs)
  const selectedFamilyIdRef = useRef(selectedFamilyId);
  useEffect(() => {
    selectedFamilyIdRef.current = selectedFamilyId;
  }, [selectedFamilyId]);

  const userId = params?.userId;

  const editMemberForm = useForm<EditMemberForm>({
    resolver: zodResolver(editMemberSchema),
    defaultValues: {
      displayName: "",
    },
  });

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
      if (!userId || !selectedFamilyId) return null;
      const response = await fetch(`/api/members/${userId}?familyId=${selectedFamilyId}`, {
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

  // Check if user can add items: organizer OR guardian with edit permission for managed profiles
  // memberData includes: isManagedProfile, guardianCanEdit, isGuardian, createdBy
  const isManagedProfile = memberData?.isManagedProfile === true;
  const isPrimaryGuardian = isManagedProfile && memberData?.createdBy === currentUserId;
  const isGuardianWithEditPermission = isManagedProfile && memberData?.guardianCanEdit === true;
  const canAddItems = isOrganizer || isPrimaryGuardian || isGuardianWithEditPermission;

  // Set/clear current member context when viewing this page
  useEffect(() => {
    if (userId && memberData) {
      const displayName = memberData.displayName || 
        (memberData.firstName ? `${memberData.firstName} ${memberData.lastName || ''}`.trim() : '') ||
        memberData.email;
      setCurrentMember(userId, displayName);
    }
    return () => {
      clearCurrentMember();
    };
  }, [userId, memberData, setCurrentMember, clearCurrentMember]);

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

  const editMemberMutation = useMutation({
    mutationFn: async (data: EditMemberForm) => {
      if (!selectedFamilyId || !userId) throw new Error("Missing required data");
      return apiRequest("PUT", `/api/families/${selectedFamilyId}/members/${userId}`, {
        displayName: data.displayName || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", userId, selectedFamilyId] });
      toast({
        title: "Updated",
        description: "Member name has been updated successfully",
      });
      setIsEditMemberDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update member name",
        variant: "destructive",
      });
    },
  });

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const handleCardClick = (item: any) => {
    setViewingItem(item);
  };

  const handleCloseDetailView = () => {
    setViewingItem(null);
    setPurchaseNotes({});
  };

  const handleMarkPurchasedFromDetail = () => {
    if (!viewingItem) return;
    const notes = purchaseNotes[viewingItem.id] || "";
    markPurchasedMutation.mutate(
      { itemId: viewingItem.id, notes },
      {
        onSuccess: () => {
          handleCloseDetailView();
        }
      }
    );
  };

  const handleUnmarkFromDetail = () => {
    if (!viewingItem) return;
    unmarkPurchasedMutation.mutate(viewingItem.id, {
      onSuccess: () => {
        handleCloseDetailView();
      }
    });
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
  
  // Compute primary display name: displayName > fullName > email
  const fullName = memberData?.firstName || memberData?.lastName
    ? `${memberData.firstName || ""} ${memberData.lastName || ""}`.trim()
    : "";
  const primaryDisplayName = memberData?.displayName || fullName || memberData?.email || "Group Member";
  const showEmailFallback = !memberData?.displayName && !fullName && memberData?.email;

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
      <div className="flex items-center gap-4 flex-wrap">
        <Avatar className="h-16 w-16">
          <AvatarImage src={memberData?.profileImageUrl || undefined} alt={primaryDisplayName} />
          <AvatarFallback className="text-2xl">
            {getInitials(memberData?.firstName, memberData?.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground" data-testid="member-name">
              {primaryDisplayName}'s Wish List
            </h1>
            {isOrganizer && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  editMemberForm.reset({ displayName: memberData?.displayName || "" });
                  setIsEditMemberDialogOpen(true);
                }}
                data-testid="button-edit-display-name"
                className="h-8 w-8"
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}
          </div>
          {showEmailFallback ? (
            <p className="text-muted-foreground text-xs mt-1">{memberData?.email}</p>
          ) : memberData?.displayName && fullName ? (
            <p className="text-muted-foreground text-sm mt-1">{fullName}</p>
          ) : null}
          <p className="text-muted-foreground mt-1">
            {items?.length || 0} items on their list
          </p>
        </div>
        {canAddItems && (
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => setIsAddItemDialogOpen(true)}
              data-testid="button-add-item-for-member"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
            <Button 
              variant="outline"
              onClick={() => setIsImportAmazonDialogOpen(true)}
              data-testid="button-import-amazon"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              Import Amazon List
            </Button>
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
              {primaryDisplayName} hasn't added any items to their wishlist yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {items.map((item: any) => {
            const isPurchased = !!item.purchase;

            return (
              <Card
                key={item.id}
                className={`flex flex-col overflow-hidden hover-elevate cursor-pointer ${isPurchased ? 'opacity-75' : ''}`}
                onClick={() => handleCardClick(item)}
                data-testid={`wishlist-item-${item.id}`}
              >
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}


      {/* Item Detail Sheet */}
      {viewingItem && (
        <Sheet open={!!viewingItem} onOpenChange={(open) => !open && handleCloseDetailView()}>
          <SheetContent className="overflow-y-auto w-full sm:max-w-lg">
            <SheetHeader>
              <SheetTitle data-testid="sheet-title-detail">{viewingItem.name}</SheetTitle>
              <SheetDescription>View and manage your wishlist item</SheetDescription>
            </SheetHeader>

            <div className="space-y-6 py-6">
              {/* Product Image */}
              {viewingItem.imageUrl && (
                <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                  <img
                    src={viewingItem.imageUrl}
                    alt={viewingItem.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Price */}
              {viewingItem.price && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Price</h3>
                  <p className="text-3xl font-bold text-primary" data-testid="text-price-detail">
                    ${parseFloat(viewingItem.price).toFixed(2)}
                  </p>
                </div>
              )}

              {/* Description */}
              {viewingItem.description && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
                  <p className="text-sm text-foreground" data-testid="text-description-detail">
                    {viewingItem.description}
                  </p>
                </div>
              )}

              {/* Item Details */}
              <div className="grid grid-cols-2 gap-4">
                {viewingItem.priority && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Priority</h3>
                    <Badge
                      variant={viewingItem.priority === "high" ? "destructive" : viewingItem.priority === "medium" ? "default" : "secondary"}
                      data-testid="badge-priority-detail"
                    >
                      {viewingItem.priority === "high" && <ArrowUp className="w-3 h-3 mr-1" />}
                      {viewingItem.priority === "medium" && <Circle className="w-3 h-3 mr-1" />}
                      {viewingItem.priority === "low" && <AlertCircle className="w-3 h-3 mr-1" />}
                      {viewingItem.priority === "high" ? "Must-Have!" : viewingItem.priority === "medium" ? "Would Love" : "Just a Thought"}
                    </Badge>
                  </div>
                )}
                {viewingItem.quantity && viewingItem.quantity !== 1 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Quantity</h3>
                    <p className="text-sm text-foreground" data-testid="text-quantity-detail">
                      {viewingItem.quantity}
                    </p>
                  </div>
                )}
                {viewingItem.itemType && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Type</h3>
                    <Badge variant="outline" data-testid="badge-type-detail">
                      {viewingItem.itemType.charAt(0).toUpperCase() + viewingItem.itemType.slice(1)}
                    </Badge>
                  </div>
                )}
                {viewingItem.category && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Category</h3>
                    <p className="text-sm text-foreground" data-testid="text-category-detail">
                      {viewingItem.category}
                    </p>
                  </div>
                )}
              </div>

              {/* Purchase Status */}
              {viewingItem.purchase && (
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <h3 className="font-medium text-foreground">Purchased</h3>
                  </div>
                  {viewingItem.purchase.notes && (
                    <p className="text-sm text-muted-foreground mt-2">
                      <strong>Note:</strong> {viewingItem.purchase.notes}
                    </p>
                  )}
                </div>
              )}

              {/* Purchase Notes Input (if not yet purchased) */}
              {!viewingItem.purchase && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Private Purchase Notes (Optional)</h3>
                  <Textarea
                    placeholder="e.g., Bought from Amazon, arriving Dec 20th"
                    value={purchaseNotes[viewingItem.id] || ""}
                    onChange={(e) => setPurchaseNotes({ ...purchaseNotes, [viewingItem.id]: e.target.value })}
                    className="resize-none h-24"
                    data-testid="input-purchase-notes-detail"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {primaryDisplayName} won't see this note.
                  </p>
                </div>
              )}

              {/* Product Link */}
              {viewingItem.url && (
                <Button
                  variant="outline"
                  className="w-full"
                  asChild
                  data-testid="button-view-product-detail"
                >
                  <a href={viewingItem.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Product
                  </a>
                </Button>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 pt-4">
                {/* Purchase Controls - Always show unless current user already purchased */}
                {viewingItem.purchase?.purchasedById === currentUserId ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleUnmarkFromDetail}
                    disabled={unmarkPurchasedMutation.isPending}
                    data-testid="button-unmark-purchased-detail"
                  >
                    {unmarkPurchasedMutation.isPending ? "Unmarking..." : "Unmark Purchase"}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={handleMarkPurchasedFromDetail}
                    disabled={markPurchasedMutation.isPending}
                    data-testid="button-mark-purchased-detail"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {markPurchasedMutation.isPending ? "Marking..." : "Mark as Purchased"}
                  </Button>
                )}

                {/* Shopping Options Button */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelectedItemForShopping(viewingItem);
                    setViewingItem(null);
                  }}
                  data-testid="button-shopping-options-detail"
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  View Shopping Options
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
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

      {/* Edit Member Dialog */}
      <Dialog open={isEditMemberDialogOpen} onOpenChange={setIsEditMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Wishlist</DialogTitle>
            <DialogDescription>
              Set a custom nickname for {fullName || memberData?.email || "this member"}
            </DialogDescription>
          </DialogHeader>
          <Form {...editMemberForm}>
            <form onSubmit={editMemberForm.handleSubmit((data) => editMemberMutation.mutate(data))} className="space-y-4">
              <FormField
                control={editMemberForm.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nickname (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="e.g., Mom, Dad, Brother"
                        data-testid="input-display-name"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Leave blank to use their full name
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditMemberDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editMemberMutation.isPending}
                  data-testid="button-save-edit"
                >
                  {editMemberMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {selectedFamilyId && userId && (
        <>
          <UnifiedAddItemDialog 
            open={isAddItemDialogOpen} 
            onOpenChange={setIsAddItemDialogOpen}
            familyId={selectedFamilyId}
            targetUserId={userId}
            targetUserName={primaryDisplayName}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/members", userId, "wishlist", selectedFamilyId] });
              setIsAddItemDialogOpen(false);
            }}
          />
          <ImportAmazonWishlistDialog
            open={isImportAmazonDialogOpen}
            onOpenChange={setIsImportAmazonDialogOpen}
            familyId={selectedFamilyId}
            targetUserId={userId}
            targetName={primaryDisplayName}
          />
        </>
      )}
    </div>
  );
}
