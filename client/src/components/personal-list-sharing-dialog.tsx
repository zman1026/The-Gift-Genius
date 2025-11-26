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
import { Input } from "@/components/ui/input";
import { Users, Share2, Globe, Info, Link2, Copy, Check, ExternalLink } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PersonalList } from "@shared/schema";

interface PersonalListFamilyShare {
  id: string;
  personalListId: string;
  familyId: string;
  sharedAt: string;
}

interface PersonalListSharingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: PersonalList;
}

export function PersonalListSharingDialog({
  open,
  onOpenChange,
  list,
}: PersonalListSharingDialogProps) {
  const { toast } = useToast();
  const { families } = useFamily();
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  const [copiedSlug, setCopiedSlug] = useState(false);

  const publicUrl = `${window.location.origin}/lists/${list.publicSlug}`;

  const { data: currentShares, isLoading: sharesLoading } = useQuery<PersonalListFamilyShare[]>({
    queryKey: ["/api/personal-lists", list.id, "family-shares"],
    queryFn: async () => {
      const response = await fetch(`/api/personal-lists/${list.id}/family-shares`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch sharing settings");
      }
      return response.json();
    },
    enabled: open,
  });

  const shareMutation = useMutation({
    mutationFn: async (familyId: string) => {
      return await apiRequest("POST", `/api/personal-lists/${list.id}/family-shares`, { familyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/personal-lists", list.id, "family-shares"]
      });
      toast({
        title: "List shared",
        description: "Your list is now visible to this group.",
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
    mutationFn: async (familyId: string) => {
      return await apiRequest("DELETE", `/api/personal-lists/${list.id}/family-shares/${familyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/personal-lists", list.id, "family-shares"]
      });
      toast({
        title: "Sharing removed",
        description: "Your list is no longer shared with this group.",
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

  const isSharedWithFamily = (familyId: string): boolean => {
    if (!currentShares) return false;
    return currentShares.some(share => share.familyId === familyId);
  };

  const handleToggleShare = async (familyId: string, shouldShare: boolean) => {
    setPendingChanges(prev => ({ ...prev, [familyId]: true }));
    
    try {
      if (shouldShare) {
        await shareMutation.mutateAsync(familyId);
      } else {
        await unshareMutation.mutateAsync(familyId);
      }
    } finally {
      setPendingChanges(prev => {
        const next = { ...prev };
        delete next[familyId];
        return next;
      });
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedSlug(true);
      toast({
        title: "Link copied",
        description: "The public link has been copied to your clipboard.",
      });
      setTimeout(() => setCopiedSlug(false), 2000);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" aria-hidden="true" />
            Share "{list.name}"
          </DialogTitle>
          <DialogDescription>
            Share this personal list with your groups or anyone with the public link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Link2 className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">Public Link</span>
            </div>
            <div className="flex items-center gap-2">
              <Input 
                value={publicUrl} 
                readOnly 
                className="text-xs"
                data-testid="input-public-url"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleCopyUrl}
                data-testid="button-copy-url"
              >
                {copiedSlug ? (
                  <Check className="w-4 h-4 text-green-600" aria-hidden="true" />
                ) : (
                  <Copy className="w-4 h-4" aria-hidden="true" />
                )}
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                asChild
              >
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this link can view your list without signing in.
            </p>
          </div>

          <Separator />

          {sharesLoading ? (
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
          ) : families.length === 0 ? (
            <div className="text-center py-6">
              <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
              <h3 className="font-medium mb-1">No Groups</h3>
              <p className="text-sm text-muted-foreground">
                You&apos;re not a member of any groups. Create or join a group to share this list with members.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[220px]">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm font-medium">Share with groups</span>
                </div>
                {families.map((family) => {
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
                              Members can view and purchase from this list
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
              <p className="font-medium mb-1">Sharing personal lists:</p>
              <ul className="space-y-1 text-blue-600 dark:text-blue-400">
                <li>Group members can view items and mark purchases</li>
                <li>Personal lists are separate from Christmas coordination</li>
                <li>They won&apos;t count toward group gift budgets</li>
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
