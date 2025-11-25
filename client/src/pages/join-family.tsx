import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Gift, Users } from "lucide-react";

const joinFamilySchema = z.object({
  inviteCode: z.string().min(1, "Invite code is required"),
});

type JoinFamilyFormData = z.infer<typeof joinFamilySchema>;

export default function JoinFamily() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const form = useForm<JoinFamilyFormData>({
    resolver: zodResolver(joinFamilySchema),
    defaultValues: {
      inviteCode: "",
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      const params = new URLSearchParams(window.location.search);
      const codeFromUrl = params.get('code');
      
      if (codeFromUrl) {
        form.setValue('inviteCode', codeFromUrl);
      }
    }
  }, [form, isAuthenticated]);

  const getLoginUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    
    return code 
      ? `/api/login?redirect=${encodeURIComponent(`/families/join?code=${code}`)}`
      : "/api/login";
  };

  const handleCreateAccount = () => {
    window.location.href = getLoginUrl();
  };

  const handleLogin = () => {
    window.location.href = getLoginUrl();
  };

  const joinFamilyMutation = useMutation({
    mutationFn: async (data: JoinFamilyFormData) => {
      return await apiRequest("POST", "/api/families/join", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "You've joined the group!",
      });
      setLocation("/");
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
        description: error.message || "Failed to join group",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: JoinFamilyFormData) => {
    joinFamilyMutation.mutate(data);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="max-w-lg w-full">
          <Card className="border-2">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Gift className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="font-serif text-3xl">You're Invited!</CardTitle>
              <CardDescription className="text-base">
                You've been invited to join a gift wishlist group. 
                Create an account or log in to start sharing your wishes!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
                <Users className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-medium text-sm">Join the group</p>
                  <p className="text-sm text-muted-foreground">
                    View wishlists, add your own items, and coordinate gift-giving together
                  </p>
                </div>
              </div>

              <Button
                onClick={handleCreateAccount}
                className="w-full"
                size="lg"
                data-testid="button-create-account"
              >
                Create Account
              </Button>

              <div className="text-center">
                <button
                  onClick={handleLogin}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
                  data-testid="button-login-link"
                >
                  Already have an account? Login here
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 lg:p-12">
      <Button
        variant="ghost"
        size="sm"
        className="mb-6"
        onClick={() => setLocation("/")}
        data-testid="button-back"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>

      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Join Group</CardTitle>
            <CardDescription>
              Enter the invite code shared by your group organizer to join.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="inviteCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invite Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter the invite code"
                          {...field}
                          data-testid="input-invite-code"
                          className="font-mono"
                        />
                      </FormControl>
                      <FormDescription>
                        The invite code is provided by the group organizer.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={joinFamilyMutation.isPending}
                    data-testid="button-submit"
                  >
                    {joinFamilyMutation.isPending ? "Joining..." : "Join Group"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/")}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
