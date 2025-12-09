import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Card, CardContent } from "@/components/ui/card";
import { 
  ExternalLink, 
  CheckCircle2,
  Gift,
  ShoppingBag
} from "lucide-react";

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

        {/* View with Google Shopping */}
        <div className="bg-muted/50 p-4 rounded-md">
          <Label className="text-sm font-semibold mb-3 block flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            Find this product
          </Label>
          <Button
            variant="outline"
            size="default"
            className="w-full justify-between"
            onClick={() => {
              const searchQuery = encodeURIComponent(item.name);
              window.open(`https://www.google.com/search?tbm=shop&q=${searchQuery}`, '_blank');
            }}
            data-testid="button-google-shopping"
          >
            <span>View product with Google Shopping</span>
            <ExternalLink className="w-4 h-4 ml-2 flex-shrink-0" />
          </Button>
          {item.url && (
            <>
              <div className="my-3 text-center text-xs text-muted-foreground">or</div>
              <Button
                variant="outline"
                size="default"
                className="w-full justify-between"
                asChild
                data-testid="button-original-link"
              >
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  <span className="truncate">Visit original product page</span>
                  <ExternalLink className="w-4 h-4 ml-2 flex-shrink-0" />
                </a>
              </Button>
            </>
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
