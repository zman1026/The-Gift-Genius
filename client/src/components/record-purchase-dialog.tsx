import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useFamily } from "@/contexts/FamilyContext";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Gift, DollarSign, Store, StickyNote, Loader2 } from "lucide-react";

const formSchema = z.object({
  recipientType: z.enum(["user", "managed"]),
  recipientUserId: z.string().nullable(),
  recipientManagedProfileId: z.string().nullable(),
  description: z.string().min(1, "Description is required"),
  price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: "Price must be a valid non-negative number",
  }),
  purchasedFrom: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => {
    if (data.recipientType === "user") {
      return data.recipientUserId !== null && data.recipientUserId !== "";
    }
    return data.recipientManagedProfileId !== null && data.recipientManagedProfileId !== "";
  },
  { message: "Please select a recipient", path: ["recipientUserId"] }
);

type FormValues = z.infer<typeof formSchema>;

interface RecordPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FamilyMember {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profileImageUrl: string | null;
  role: string;
}

interface ManagedProfile {
  id: string;
  displayName: string;
  profileImageUrl: string | null;
  createdBy: string;
}

export function RecordPurchaseDialog({ open, onOpenChange }: RecordPurchaseDialogProps) {
  const { selectedFamilyId } = useFamily();
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipientType: "user",
      recipientUserId: null,
      recipientManagedProfileId: null,
      description: "",
      price: "",
      purchasedFrom: "",
      notes: "",
    },
  });

  const recipientType = form.watch("recipientType");

  const { data: members = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/members", selectedFamilyId],
    queryFn: async () => {
      if (!selectedFamilyId) return [];
      const response = await fetch(`/api/members?familyId=${selectedFamilyId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch members");
      return response.json();
    },
    enabled: open && !!selectedFamilyId,
  });

  const { data: managedProfiles = [] } = useQuery<ManagedProfile[]>({
    queryKey: ["/api/managed-profiles", selectedFamilyId],
    queryFn: async () => {
      if (!selectedFamilyId) return [];
      const response = await fetch(`/api/managed-profiles?familyId=${selectedFamilyId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch managed profiles");
      return response.json();
    },
    enabled: open && !!selectedFamilyId,
  });

  const recordPurchaseMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        familyId: selectedFamilyId,
        recipientUserId: values.recipientType === "user" ? values.recipientUserId : null,
        recipientManagedProfileId: values.recipientType === "managed" ? values.recipientManagedProfileId : null,
        description: values.description,
        price: Number(values.price),
        purchasedFrom: values.purchasedFrom || undefined,
        notes: values.notes || undefined,
      };
      return apiRequest("POST", "/api/purchases/off-list", payload);
    },
    onSuccess: () => {
      toast({
        title: "Purchase recorded",
        description: "Your purchase has been added to your records.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/families", selectedFamilyId, "purchase-totals"] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record purchase",
        variant: "destructive",
      });
    },
  });

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const getMemberDisplayName = (member: FamilyMember) => {
    if (member.firstName || member.lastName) {
      return `${member.firstName || ""} ${member.lastName || ""}`.trim();
    }
    return member.email;
  };

  const otherMembers = members.filter((m) => m.userId !== (user as any)?.id);

  const handleSubmit = (values: FormValues) => {
    recordPurchaseMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Record a Purchase
          </DialogTitle>
          <DialogDescription>
            Log a gift you purchased outside of someone's wishlist.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="recipientType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient Type</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("recipientUserId", null);
                      form.setValue("recipientManagedProfileId", null);
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-recipient-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">Group Member</SelectItem>
                      {managedProfiles.length > 0 && (
                        <SelectItem value="managed">Child Profile</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {recipientType === "user" && (
              <FormField
                control={form.control}
                name="recipientUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-recipient-user">
                          <SelectValue placeholder="Select a group member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {otherMembers.map((member) => (
                          <SelectItem key={member.userId} value={member.userId}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={member.profileImageUrl || undefined} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(member.firstName, member.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <span>{getMemberDisplayName(member)}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {recipientType === "managed" && (
              <FormField
                control={form.control}
                name="recipientManagedProfileId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-recipient-managed">
                          <SelectValue placeholder="Select a child profile" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {managedProfiles.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={profile.profileImageUrl || undefined} />
                                <AvatarFallback className="text-xs">
                                  {profile.displayName.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span>{profile.displayName}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What did you buy?</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Blue bicycle, LEGO Star Wars set"
                      {...field}
                      data-testid="input-purchase-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    Price
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...field}
                      data-testid="input-purchase-price"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purchasedFrom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <Store className="w-4 h-4" />
                    Store (optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Amazon, Target, Walmart"
                      {...field}
                      data-testid="input-purchase-store"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <StickyNote className="w-4 h-4" />
                    Notes (optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Arrives Dec 20th, gift wrapped"
                      className="resize-none"
                      {...field}
                      data-testid="input-purchase-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-purchase"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={recordPurchaseMutation.isPending}
                data-testid="button-submit-purchase"
              >
                {recordPurchaseMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Record Purchase"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
