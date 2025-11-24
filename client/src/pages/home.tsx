import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useFamily } from "@/contexts/FamilyContext";
import { useEvent } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, UserPlus } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BudgetDialog } from "@/components/budget-dialog";
import { ActivityFeed } from "@/components/activity-feed";
import { EventHero } from "@/components/event-hero";
import { MemberSpotlight } from "@/components/member-spotlight";
import { QuickActions } from "@/components/quick-actions";
import { GiftCoordination } from "@/components/gift-coordination";

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
  const { selectedEventId, selectedEvent } = useEvent();
  const [, setLocation] = useLocation();
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  
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
    queryKey: ["/api/stats", selectedFamilyId, selectedEventId],
    queryFn: async () => {
      if (!selectedFamilyId) return null;
      
      const params = new URLSearchParams({ familyId: selectedFamilyId });
      if (selectedEventId) {
        params.append("eventId", selectedEventId);
      }
      
      const response = await fetch(`/api/stats?${params.toString()}`, {
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

  const handleAddItemClick = () => {
    setIsAddItemDialogOpen(true);
  };

  if (authLoading || familiesLoading || statsLoading) {
    return (
      <div className="p-3 md:p-8 space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  const hasFamilies = familiesData && familiesData.length > 0;

  // No family state
  if (!hasFamilies) {
    return (
      <div className="p-3 md:p-8">
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-primary" aria-hidden="true" />
            </div>
            <h3 className="font-serif text-xl font-semibold mb-2 text-foreground">Welcome to The Gift Genius!</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Start by creating a family group or joining one to begin sharing wishlists and coordinating gifts.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setLocation('/families/create')}
                data-testid="button-create-family-empty"
              >
                <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                Create Family
              </Button>
              <Button
                onClick={() => setLocation('/families/join')}
                variant="outline"
                data-testid="button-join-family-empty"
              >
                <UserPlus className="w-4 h-4 mr-2" aria-hidden="true" />
                Join Family
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No event selected state
  if (!selectedEventId || !selectedEvent) {
    return (
      <div className="p-3 md:p-8">
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-primary" aria-hidden="true" />
            </div>
            <h3 className="font-serif text-xl font-semibold mb-2 text-foreground">No Event Selected</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Please select an event from the header to view your dashboard and start coordinating gifts.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasBudget = selectedFamily?.giftBudget !== null && selectedFamily?.giftBudget !== undefined;

  return (
    <div className="p-3 md:p-8 space-y-3 md:space-y-4">
      {/* Event Hero Section */}
      {selectedEvent && (
        <EventHero
          eventName={selectedEvent.name}
          eventDate={selectedEvent.date}
          themePrimary={selectedEvent.themePrimary}
          themeAccent={selectedEvent.themeAccent}
          myItemsCount={stats?.myItemsCount || 0}
          familyMembersCount={stats?.familyMembersCount || 0}
          itemsPurchasedByOthers={stats?.itemsPurchasedByOthers || 0}
        />
      )}

      {/* Member Spotlight Section */}
      <MemberSpotlight familyId={selectedFamilyId!} eventId={selectedEventId || undefined} />

      {/* Quick Actions Section */}
      <QuickActions onAddItemClick={handleAddItemClick} />

      {/* Gift Coordination Section */}
      <GiftCoordination familyId={selectedFamilyId!} eventId={selectedEventId || undefined} />

      {/* Recent Activity Feed */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation('/activities')} 
              data-testid="view-all-activity"
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ActivityFeed familyId={selectedFamilyId!} eventId={selectedEventId || undefined} limit={5} compact />
        </CardContent>
      </Card>

      {/* Optional Budget Tracker - Only show if budget is set */}
      {hasBudget && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Gift Budget</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsBudgetDialogOpen(true)} 
                data-testid="edit-budget"
              >
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Spent</span>
                <span className="font-medium">${stats?.totalPurchased?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Budget</span>
                <span className="font-medium">${parseFloat(selectedFamily?.giftBudget?.toString() || '0').toFixed(2)}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all"
                  style={{ 
                    width: `${Math.min(100, ((stats?.totalPurchased || 0) / (parseFloat(selectedFamily?.giftBudget?.toString() || '0') || 1)) * 100)}%` 
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budget Dialog */}
      <BudgetDialog
        open={isBudgetDialogOpen}
        onOpenChange={setIsBudgetDialogOpen}
        currentBudget={selectedFamily?.giftBudget ? parseFloat(selectedFamily.giftBudget.toString()) : null}
        onSave={(budget) => updateBudgetMutation.mutate(budget)}
        isSaving={updateBudgetMutation.isPending}
      />
    </div>
  );
}
