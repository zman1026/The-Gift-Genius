import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Gift, Eye } from "lucide-react";

export default function Members() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

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

  const { data: members, isLoading } = useQuery({
    queryKey: ["/api/members"],
    retry: false,
  });

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-12 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const hasMembers = members && members.length > 0;

  return (
    <div className="p-6 md:p-8 lg:p-12 space-y-6">
      <div>
        <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground">
          Family Members
        </h1>
        <p className="text-muted-foreground mt-1">
          View wishlists from all your family members
        </p>
      </div>

      {!hasMembers ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-xl mb-2 text-foreground">No Family Members Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Invite family members to join your group and start sharing wishlists.
            </p>
            <Button onClick={() => setLocation("/")} data-testid="button-go-home">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {members.map((member: any) => {
            const isCurrentUser = member.userId === user?.id;
            return (
              <Card
                key={member.userId}
                className="hover-elevate overflow-hidden"
                data-testid={`member-card-${member.userId}`}
              >
                <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={member.profileImageUrl || undefined} alt={member.firstName || "Member"} />
                    <AvatarFallback className="text-xl">
                      {getInitials(member.firstName, member.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1 w-full">
                    <h3 className="font-semibold text-foreground truncate" data-testid={`member-name-${member.userId}`}>
                      {member.firstName || member.lastName
                        ? `${member.firstName || ""} ${member.lastName || ""}`.trim()
                        : member.email || "Family Member"}
                    </h3>
                    {isCurrentUser && (
                      <p className="text-xs text-primary font-medium">(You)</p>
                    )}
                    <div className="flex items-center justify-center gap-2 text-muted-foreground pt-2">
                      <Gift className="w-4 h-4" />
                      <span className="text-sm" data-testid={`member-items-${member.userId}`}>
                        {member.itemCount || 0} items
                      </span>
                    </div>
                  </div>
                  {!isCurrentUser && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setLocation(`/members/${member.userId}`)}
                      data-testid={`button-view-wishlist-${member.userId}`}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Wishlist
                    </Button>
                  )}
                  {isCurrentUser && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setLocation('/wishlist')}
                      data-testid="button-view-my-wishlist"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View My List
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
