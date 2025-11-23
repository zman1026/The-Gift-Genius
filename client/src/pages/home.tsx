import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useFamily } from "@/contexts/FamilyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Gift, Users, Plus, UserPlus, Search, Zap, Copy, Check, Mail, Send } from "lucide-react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ChristmasCountdown } from "@/components/christmas-countdown";
import { BudgetTracker } from "@/components/budget-tracker";
import { BudgetDialog } from "@/components/budget-dialog";
import { ActivityFeed } from "@/components/activity-feed";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { GiftProgressTracker } from "@/components/gift-progress-tracker";

const inviteEmailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type InviteEmailForm = z.infer<typeof inviteEmailSchema>;

export default function Home() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { selectedFamilyId, families } = useFamily();
  const [, setLocation] = useLocation();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  const selectedFamily = families?.find((f: any) => f.id === selectedFamilyId);

  const form = useForm<InviteEmailForm>({
    resolver: zodResolver(inviteEmailSchema),
    defaultValues: {
      email: "",
    },
  });

  const sendInviteMutation = useMutation({
    mutationFn: async (data: InviteEmailForm) => {
      if (!selectedFamilyId) throw new Error("No family selected");
      return apiRequest("POST", `/api/families/${selectedFamilyId}/invitations`, data);
    },
    onSuccess: () => {
      toast({
        title: "Invitation sent!",
        description: "The invite email has been sent successfully.",
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send invitation",
        description: error.message || "There was a problem sending the invite email.",
        variant: "destructive",
      });
    },
  });

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
    onError: (error: any) => {
      toast({
        title: "Failed to update budget",
        description: error.message || "There was a problem updating the budget.",
        variant: "destructive",
      });
    },
  });

  const { data: familiesData, isLoading: familiesLoading } = useQuery({
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

  const handleCopyCode = async () => {
    if (selectedFamily?.inviteCode) {
      await navigator.clipboard.writeText(selectedFamily.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      toast({
        title: "Copied!",
        description: "Invite code copied to clipboard",
      });
    }
  };
  
  const handleCopyLink = async () => {
    const inviteUrl = `${window.location.origin}/families/join?code=${selectedFamily?.inviteCode}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast({
      title: "Copied!",
      description: "Invite link copied to clipboard",
    });
  };

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

  const hasFamilies = familiesData && familiesData.length > 0;

  return (
    <div className="p-4 md:p-8 lg:p-12 space-y-4 md:space-y-6">
      {/* Compact Hero Row - Countdown + Onboarding side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChristmasCountdown />
        <div className="lg:flex lg:items-stretch">
          <OnboardingChecklist />
        </div>
      </div>

      {/* Main Dashboard Grid - Always show stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {hasFamilies && selectedFamilyId ? (
          <>
            <GiftProgressTracker />
            <BudgetTracker
              budget={selectedFamily?.giftBudget ? parseFloat(selectedFamily.giftBudget) : null}
              totalPurchased={stats?.totalPurchased || 0}
              onSetBudget={() => setIsBudgetDialogOpen(true)}
            />
          </>
        ) : (
          <Card className="lg:col-span-2">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Gift className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-foreground">Ready to Start?</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Create or join a family group to see your gift coordination dashboard and start tracking your Christmas shopping.
              </p>
            </CardContent>
          </Card>
        )}
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
            {familiesData.map((family: any) => (
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

      {/* Invite Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite Family Member</DialogTitle>
            <DialogDescription>
              Send an invitation email or share the invite code/link with your family member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {selectedFamily?.inviteCode ? (
              <>
                {/* Email Invitation Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Send Invitation Email</h3>
                  </div>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit((data) => sendInviteMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                placeholder="family@example.com"
                                data-testid="input-invite-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        disabled={sendInviteMutation.isPending}
                        className="w-full"
                        data-testid="button-send-invite-email"
                      >
                        {sendInviteMutation.isPending ? (
                          <>Sending...</>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send Invitation
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </div>

                <Separator />

                {/* Manual Share Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Copy className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Or Share Manually</h3>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Invite Code</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={selectedFamily.inviteCode}
                        className="font-mono text-lg"
                        data-testid="input-invite-code"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyCode}
                        data-testid="button-copy-code"
                      >
                        {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      They can use this code on the "Join Family" page
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Invite Link</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={`${window.location.origin}/families/join?code=${selectedFamily.inviteCode}`}
                        className="text-sm"
                        data-testid="input-invite-link"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyLink}
                        data-testid="button-copy-link"
                      >
                        {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Share this link and they'll be taken directly to the join page
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-4 bg-muted rounded-md text-center">
                <p className="text-sm text-muted-foreground">
                  No family selected or invite code unavailable.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
