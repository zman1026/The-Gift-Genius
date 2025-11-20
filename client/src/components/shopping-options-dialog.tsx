import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ExternalLink, 
  CheckCircle2, 
  Star, 
  Store, 
  DollarSign,
  Gift,
  ShoppingCart
} from "lucide-react";

interface ShoppingOption {
  title: string;
  price: number;
  link: string;
  source: string;
  rating?: number;
  reviews?: number;
  thumbnail?: string;
}

interface ShoppingOptionsDialogProps {
  item: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  familyId: string;
}

export function ShoppingOptionsDialog({
  item,
  open,
  onOpenChange,
  userId,
  familyId,
}: ShoppingOptionsDialogProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");

  // Clear notes when dialog opens or item changes
  useEffect(() => {
    if (open && item) {
      setNotes("");
    }
  }, [open, item]);

  const { data: shoppingOptions, isLoading } = useQuery({
    queryKey: ["/api/wishlist", item?.id, "shopping-options"],
    queryFn: async () => {
      if (!item?.id) return [];
      const response = await fetch(`/api/wishlist/${item.id}/shopping-options`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch shopping options");
      }
      return response.json();
    },
    enabled: !!item && open,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const markPurchasedMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/wishlist/${item.id}/purchase`, { notes });
    },
    onSuccess: () => {
      // Invalidate the specific wishlist query that member-wishlist page uses
      queryClient.invalidateQueries({ queryKey: ["/api/members", userId, "wishlist", familyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats", familyId] });
      toast({
        title: "Success",
        description: "Item marked as purchased!",
      });
      onOpenChange(false);
      setNotes("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark item as purchased",
        variant: "destructive",
      });
    },
  });

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Shopping Options</DialogTitle>
          <DialogDescription>
            Find the best place to purchase this gift
          </DialogDescription>
        </DialogHeader>

        {/* Item Details */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="w-24 h-24 bg-muted rounded-md overflow-hidden flex-shrink-0">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Gift className="w-10 h-10 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-foreground mb-1">{item.name}</h3>
                {item.price && (
                  <p className="text-primary font-bold mb-2">
                    Original Price: ${parseFloat(item.price).toFixed(2)}
                  </p>
                )}
                {item.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Original Product Link */}
        {item.url && (
          <div className="bg-muted/50 p-3 rounded-md">
            <Label className="text-xs text-muted-foreground mb-2 block">
              Original Product Link
            </Label>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between"
              onClick={() => window.open(item.url, '_blank')}
              data-testid="button-original-link"
            >
              <span className="truncate">Visit Original Page</span>
              <ExternalLink className="w-4 h-4 ml-2 flex-shrink-0" />
            </Button>
          </div>
        )}

        {/* Shopping Options */}
        <div>
          <Label className="text-sm font-semibold mb-3 block flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Where to Buy
          </Label>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : shoppingOptions && shoppingOptions.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {shoppingOptions.map((option: ShoppingOption, index: number) => (
                <Card key={index} className="hover-elevate">
                  <CardContent className="p-3">
                    <div className="flex gap-3">
                      {option.thumbnail && (
                        <div className="w-16 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                          <img
                            src={option.thumbnail}
                            alt={option.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-medium text-sm line-clamp-2 flex-1">
                            {option.title}
                          </h4>
                          <Badge variant="default" className="flex-shrink-0">
                            <DollarSign className="w-3 h-3 mr-0.5" />
                            {option.price.toFixed(2)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                          <span className="flex items-center gap-1">
                            <Store className="w-3 h-3" />
                            {option.source}
                          </span>
                          {option.rating && (
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 fill-primary text-primary" />
                              {option.rating.toFixed(1)}
                            </span>
                          )}
                          {option.reviews && (
                            <span>
                              ({option.reviews.toLocaleString()} reviews)
                            </span>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => window.open(option.link, '_blank')}
                          data-testid={`button-buy-option-${index}`}
                        >
                          View at {option.source}
                          <ExternalLink className="w-3 h-3 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <Store className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No shopping options found. Try the original link above.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Mark as Purchased Section */}
        <div className="border-t pt-4 mt-4">
          <Label className="text-sm font-semibold mb-3 block">
            Mark as Purchased
          </Label>
          <div className="space-y-3">
            <div>
              <Label htmlFor="purchase-notes" className="text-xs text-muted-foreground mb-2 block">
                Optional Notes (only you will see these)
              </Label>
              <Textarea
                id="purchase-notes"
                placeholder="e.g., Bought from Amazon, arrives Dec 20th..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none h-20"
                data-testid="input-purchase-notes"
              />
            </div>
            <Button
              onClick={() => markPurchasedMutation.mutate()}
              disabled={markPurchasedMutation.isPending}
              className="w-full"
              data-testid="button-mark-purchased"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {markPurchasedMutation.isPending ? "Marking..." : "Mark as Purchased"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
