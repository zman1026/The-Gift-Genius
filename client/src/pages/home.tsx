import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useFamily } from "@/contexts/FamilyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, Users, Plus, UserPlus } from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { selectedFamilyId } = useFamily();
  const [, setLocation] = useLocation();

  const { data: families, isLoading: familiesLoading } = useQuery({
    queryKey: ["/api/families"],
    retry: false,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/stats", selectedFamilyId],
    queryFn: async () => {
      if (!selectedFamilyId) return null;
      const response = await fetch(`/api/stats?familyId=${selectedFamilyId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }
      return response.json();
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

  if (authLoading || familiesLoading || statsLoading) {
    return (
      <div className="p-6 md:p-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const hasFamilies = families && families.length > 0;

  return (
    <div className="p-6 md:p-8 lg:p-12 space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground mb-2">
          Welcome to Your Christmas Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage your wishlists and coordinate gifts with your family.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              My Wishlist Items
            </CardTitle>
            <Gift className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground" data-testid="stat-my-items">
              {stats?.myItemsCount || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Items on your wishlist
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Family Members
            </CardTitle>
            <Users className="w-4 h-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground" data-testid="stat-family-members">
              {stats?.familyMembersCount || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              People in your families
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Items to Purchase
            </CardTitle>
            <Gift className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground" data-testid="stat-items-to-purchase">
              {stats?.itemsToPurchaseCount || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Unpurchased items in your families
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Family Groups */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-2xl font-semibold text-foreground">
            Your Family Groups
          </h2>
          <div className="flex gap-2">
            <Button
              onClick={() => setLocation('/families/join')}
              variant="outline"
              size="sm"
              data-testid="button-join-family"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Join Family
            </Button>
            <Button
              onClick={() => setLocation('/families/create')}
              size="sm"
              data-testid="button-create-family"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Family
            </Button>
          </div>
        </div>

        {!hasFamilies ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-foreground">No Family Groups Yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Create your first family group or join an existing one to start sharing wishlists.
              </p>
              <div className="flex gap-3">
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {families.map((family: any) => (
              <Card key={family.id} className="hover-elevate cursor-pointer" onClick={() => setLocation('/members')}>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground" data-testid={`family-name-${family.id}`}>
                    {family.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">{family.memberCount || 0} members</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Invite Code: <span className="font-mono font-medium">{family.inviteCode}</span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
