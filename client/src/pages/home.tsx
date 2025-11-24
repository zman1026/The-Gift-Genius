import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useFamily } from "@/contexts/FamilyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Gift, Users, Plus, UserPlus, ChevronRight, Clock, ListTodo, Sparkles, X } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BudgetTracker } from "@/components/budget-tracker";
import { BudgetDialog } from "@/components/budget-dialog";
import { ActivityFeed } from "@/components/activity-feed";
import { GiftProgressTracker } from "@/components/gift-progress-tracker";

interface DashboardStats {
  myItemsCount: number;
  familyMembersCount: number;
  itemsPurchasedByOthers: number;
  totalPurchased: number;
}

interface FamilyData {
  id: string;
  name: string;
  giftBudget: number | null;
}

export default function Home() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { selectedFamilyId, families } = useFamily();
  const [, setLocation] = useLocation();
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    return localStorage.getItem("onboarding-banner-dismissed") === "true";
  });
  
  const selectedFamily = families?.find((f) => f.id === selectedFamilyId);

  const updateBudgetMutation = useMutation({
    mutationFn: async (giftBudget: number | null) => {
      if (!selectedFamilyId) throw new Error("No family selected");
      return apiRequest("PUT", `/api/families/${selectedFamilyId}/budget`, { giftBudget });
    },
    onSuccess: () => {
      toast({
        title: "Budget updated!",
        description: "Your gift-buying budget has been updated successfully.",
      });
      setIsBudgetDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats", selectedFamilyId] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "There was a problem updating the budget.";
      toast({
        title: "Failed to update budget",
        description: message,
        variant: "destructive",
      });
    },
  });

  const { data: familiesData, isLoading: familiesLoading } = useQuery<FamilyData[]>({
    queryKey: ["/api/families"],
    retry: false,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats | null>({
    queryKey: ["/api/stats", selectedFamilyId],
    queryFn: async () => {
      if (!selectedFamilyId) return null;
      const response = await fetch(`/api/stats?familyId=${selectedFamilyId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }
      return response.json() as Promise<DashboardStats>;
    },
    enabled: !!selectedFamilyId,
    retry: false,
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

  const handleDismissOnboarding = () => {
    localStorage.setItem("onboarding-banner-dismissed", "true");
    setOnboardingDismissed(true);
  };

  if (authLoading || familiesLoading || statsLoading) {
    return (
      <div className="p-3 md:p-8 space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  const hasFamilies = familiesData && familiesData.length > 0;
  const hasItems = (stats?.myItemsCount || 0) > 0;
  const hasMembers = (stats?.familyMembersCount || 0) > 1;
  const needsOnboarding = !hasFamilies || !hasItems || !hasMembers;

  return (
    <div className="p-3 md:p-8 space-y-3 md:space-y-4">
      {/* Compact Stats Banner */}
      {hasFamilies && selectedFamilyId && (
        <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 rounded-lg p-3 border border-primary/20">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Clock className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">
                  {/* Calculate days until Christmas */}
                  {(() => {
                    const now = new Date();
                    const christmas = new Date(now.getFullYear(), 11, 25);
                    if (now > christmas) christmas.setFullYear(christmas.getFullYear() + 1);
                    const daysLeft = Math.floor((christmas.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return `${daysLeft} days until Christmas`;
                  })()}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {stats?.myItemsCount || 0} items • {stats?.familyMembersCount || 0} family members
                </div>
              </div>
            </div>
            <Badge variant="outline" className="gap-1 flex-shrink-0 text-xs">
              <Gift className="w-3 h-3" />
              {stats?.itemsPurchasedByOthers || 0}
            </Badge>
          </div>
        </div>
      )}

      {/* Dismissible Onboarding Banner */}
      {needsOnboarding && !onboardingDismissed && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2 pt-3 px-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Getting Started</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDismissOnboarding}
                data-testid="button-dismiss-onboarding"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 px-3 pb-3">
            {!hasFamilies && (
              <div 
                className="flex items-center justify-between gap-2 p-2.5 rounded-md hover-elevate cursor-pointer" 
                onClick={() => setLocation('/families/create')}
                data-testid="quick-create-family"
              >
                <div className="flex items-center gap-2.5 flex-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Create or join a family</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            )}
            {!hasItems && hasFamilies && (
              <div 
                className="flex items-center justify-between gap-2 p-2.5 rounded-md hover-elevate cursor-pointer" 
                onClick={() => setLocation('/my-list')}
                data-testid="quick-add-item"
              >
                <div className="flex items-center gap-2.5 flex-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <ListTodo className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Add your first wishlist item</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            )}
            {!hasMembers && hasFamilies && (
              <div 
                className="flex items-center justify-between gap-2 p-2.5 rounded-md hover-elevate cursor-pointer" 
                onClick={() => setLocation('/members')}
                data-testid="quick-invite"
              >
                <div className="flex items-center gap-2.5 flex-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <UserPlus className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Invite family members</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Action Tiles - Mobile-First Single Column */}
      <div className="space-y-3">
        {/* My Wishlist Health */}
        {hasFamilies && selectedFamilyId && (
          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation('/my-list')}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Gift className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">My Wishlist</h3>
                    <p className="text-xs text-muted-foreground">
                      {stats?.myItemsCount || 0} items added
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gift Progress Tracker */}
        {hasFamilies && selectedFamilyId && <GiftProgressTracker />}

        {/* Budget Tracker */}
        {hasFamilies && selectedFamilyId && (
          <BudgetTracker
            budget={selectedFamily?.giftBudget ? parseFloat(selectedFamily.giftBudget) : null}
            totalPurchased={stats?.totalPurchased || 0}
            onSetBudget={() => setIsBudgetDialogOpen(true)}
          />
        )}

        {/* Activity Feed - Limited to 5 items */}
        {hasFamilies && selectedFamilyId && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <Button variant="ghost" onClick={() => setLocation('/more')} data-testid="view-all-activity">
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <ActivityFeed familyId={selectedFamilyId} limit={5} compact />
            </CardContent>
          </Card>
        )}
      </div>

      {/* No Family State */}
      {!hasFamilies && (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-6 md:py-12 text-center">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 md:mb-4">
              <Users className="w-6 h-6 md:w-8 md:h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-base md:text-lg mb-2 text-foreground">Welcome to Gift Genie!</h3>
            <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6 max-w-md">
              Start by creating a family group or joining one to begin sharing wishlists.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setLocation('/families/create')}
                data-testid="button-create-family-empty"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Family
              </Button>
              <Button
                onClick={() => setLocation('/families/join')}
                variant="outline"
                data-testid="button-join-family-empty"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Join Family
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budget Dialog */}
      <BudgetDialog
        open={isBudgetDialogOpen}
        onOpenChange={setIsBudgetDialogOpen}
        currentBudget={selectedFamily?.giftBudget ? parseFloat(selectedFamily.giftBudget) : null}
        onSave={(budget) => updateBudgetMutation.mutate(budget)}
        isSaving={updateBudgetMutation.isPending}
      />
    </div>
  );
}
