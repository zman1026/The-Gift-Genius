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
import { ArrowLeft } from "lucide-react";

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

  const joinFamilyMutation = useMutation({
    mutationFn: async (data: JoinFamilyFormData) => {
      return await apiRequest("POST", "/api/families/join", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "You've joined the family group!",
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
        description: error.message || "Failed to join family group",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: JoinFamilyFormData) => {
    joinFamilyMutation.mutate(data);
  };

  return (
    <div className="p-6 md:p-8 lg:p-12">
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
            <CardTitle className="font-serif text-2xl">Join Family Group</CardTitle>
            <CardDescription>
              Enter the invite code shared by your family organizer to join their group.
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
                        The invite code is provided by the family organizer.
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
                    {joinFamilyMutation.isPending ? "Joining..." : "Join Family"}
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
