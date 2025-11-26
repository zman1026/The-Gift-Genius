import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useFamily } from "@/contexts/FamilyContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Share2, Globe, Info, ExternalLink } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Family } from "@shared/schema";

interface UserWishlistShare {
  id: string;
  userId: string;
  familyId: string;
  sourceFamilyId: string;
  createdAt: string;
}

interface ManagedWishlistShare {
  id: string;
  managedProfileId: string;
  familyId: string;
  sourceFamilyId: string;
  createdAt: string;
}

interface CrossFamilySharingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "user" | "managed";
  managedProfileId?: string;
  profileName?: string;
}

export function CrossFamilySharingDialog({
  open,
  onOpenChange,
  mode,
  managedProfileId,
  profileName,
}: CrossFamilySharingDialogProps) {
  const { toast } = useToast();
  const { selectedFamilyId, families } = useFamily();
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});

  const { data: currentShares, isLoading: sharesLoading } = useQuery<UserWishlistShare[] | ManagedWishlistShare[]>({
    queryKey: mode === "user" 
      ? ["/api/wishlist-shares/user"]
      : ["/api/wishlist-shares/managed", managedProfileId],
    queryFn: async () => {
      const endpoint = mode === "user"
        ? "/api/wishlist-shares/user"
        : `/api/wishlist-shares/managed/${managedProfileId}`;
      const response = await fetch(endpoint, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch sharing settings");
      }
      return response.json();
    },
    enabled: open && (mode === "user" || !!managedProfileId),
  });

  const shareMutation = useMutation({
    mutationFn: async ({ familyId, sourceFamilyId }: { familyId: string; sourceFamilyId: string }) => {
      const endpoint = mode === "user"
        ? "/api/wishlist-shares/user"
        : `/api/wishlist-shares/managed/${managedProfileId}`;
      return await apiRequest("POST", endpoint, { familyId, sourceFamilyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: mode === "user" 
          ? ["/api/wishlist-shares/user"]
          : ["/api/wishlist-shares/managed", managedProfileId]
      });
      toast({
        title: "List shared",
        description: "Your wishlist is now visible to this group.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to share list",
        variant: "destructive",
      });
    },
  });

  const unshareMutation = useMutation({
    mutationFn: async ({ familyId, sourceFamilyId }: { familyId: string; sourceFamilyId: string }) => {
      const endpoint = mode === "user"
        ? "/api/wishlist-shares/user"
        : `/api/wishlist-shares/managed/${managedProfileId}`;
      return await apiRequest("DELETE", endpoint, { familyId, sourceFamilyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: mode === "user" 
          ? ["/api/wishlist-shares/user"]
          : ["/api/wishlist-shares/managed", managedProfileId]
      });
      toast({
        title: "Sharing removed",
        description: "Your wishlist is no longer shared with this group.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove sharing",
        variant: "destructive",
      });
    },
  });

  const currentFamily = families.find(f => f.id === selectedFamilyId);
  const otherFamilies = families.filter(f => f.id !== selectedFamilyId);

  const isSharedWithFamily = (familyId: string): boolean => {
    if (!currentShares || !selectedFamilyId) return false;
    return currentShares.some(share => 
      share.familyId === familyId && share.sourceFamilyId === selectedFamilyId
    );
  };

  const handleToggleShare = async (targetFamilyId: string, shouldShare: boolean) => {
    if (!selectedFamilyId) return;
    
    setPendingChanges(prev => ({ ...prev, [targetFamilyId]: true }));
    
    try {
      if (shouldShare) {
        await shareMutation.mutateAsync({ 
          familyId: targetFamilyId, 
          sourceFamilyId: selectedFamilyId 
        });
      } else {
        await unshareMutation.mutateAsync({ 
          familyId: targetFamilyId, 
          sourceFamilyId: selectedFamilyId 
        });
      }
    } finally {
      setPendingChanges(prev => {
        const next = { ...prev };
        delete next[targetFamilyId];
        return next;
      });
    }
  };

  const isLoading = sharesLoading;
  const displayName = mode === "managed" ? profileName : "your";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" aria-hidden="true" />
            Share Christmas List
          </DialogTitle>
          <DialogDescription>
            Share {displayName} Christmas wishlist with other groups you belong to. 
            This lets members of those groups see and coordinate gifts without duplicates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {currentFamily && (
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-xs">Source</Badge>
                <span className="text-sm font-medium">{currentFamily.name}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                This is where {displayName} wishlist items live. Items added here will be visible to groups you share with.
              </p>
            </div>
          )}

          <Separator />

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-5 w-10" />
                </div>
              ))}
            </div>
          ) : otherFamilies.length === 0 ? (
            <div className="text-center py-6">
              <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
              <h3 className="font-medium mb-1">Only One Group</h3>
              <p className="text-sm text-muted-foreground">
                You&apos;re only a member of one group. Join or create another group to share your wishlist across groups.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[280px]">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm font-medium">Share with other groups</span>
                </div>
                {otherFamilies.map((family) => {
                  const isShared = isSharedWithFamily(family.id);
                  const isPending = pendingChanges[family.id];
                  
                  return (
                    <div 
                      key={family.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                      data-testid={`share-option-${family.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10">
                          <Users className="w-4 h-4 text-primary" aria-hidden="true" />
                        </div>
                        <div>
                          <span className="text-sm font-medium">{family.name}</span>
                          {isShared && (
                            <p className="text-xs text-muted-foreground">
                              Members can see and purchase from this list
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`share-${family.id}`}
                          checked={isShared}
                          disabled={isPending}
                          onCheckedChange={(checked) => handleToggleShare(family.id, checked)}
                          data-testid={`switch-share-${family.id}`}
                        />
                        <Label htmlFor={`share-${family.id}`} className="sr-only">
                          Share with {family.name}
                        </Label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">How cross-group sharing works:</p>
              <ul className="space-y-1 text-blue-600 dark:text-blue-400">
                <li>Items stay in your original group&apos;s list</li>
                <li>Shared groups can view and purchase items</li>
                <li>Purchases sync across all groups to prevent duplicates</li>
                <li>You won&apos;t see who purchased your items</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-sharing">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
