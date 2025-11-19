import { useEffect, useState } from "react";
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

const createFamilySchema = z.object({
  name: z.string().min(1, "Family name is required").max(255, "Name is too long"),
});

type CreateFamilyFormData = z.infer<typeof createFamilySchema>;

export default function CreateFamily() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const form = useForm<CreateFamilyFormData>({
    resolver: zodResolver(createFamilySchema),
    defaultValues: {
      name: "",
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

  const createFamilyMutation = useMutation({
    mutationFn: async (data: CreateFamilyFormData) => {
      return await apiRequest("POST", "/api/families", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "Family group created successfully!",
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
        description: error.message || "Failed to create family group",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateFamilyFormData) => {
    createFamilyMutation.mutate(data);
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
            <CardTitle className="font-serif text-2xl">Create Family Group</CardTitle>
            <CardDescription>
              Create a new family group and invite members to share wishlists together.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Family Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Smith Family Christmas 2025"
                          {...field}
                          data-testid="input-family-name"
                        />
                      </FormControl>
                      <FormDescription>
                        Choose a memorable name for your family group.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={createFamilyMutation.isPending}
                    data-testid="button-submit"
                  >
                    {createFamilyMutation.isPending ? "Creating..." : "Create Family"}
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
