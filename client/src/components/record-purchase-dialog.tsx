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
  recipientId: z.string().min(1, "Please select a recipient"),
  description: z.string().min(1, "Description is required"),
  price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: "Price must be a valid non-negative number",
  }),
  purchasedFrom: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface RecordPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GroupMember {
  userId: string;
  managedProfileId: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  isManagedProfile: boolean;
}

export function RecordPurchaseDialog({ open, onOpenChange }: RecordPurchaseDialogProps) {
  const { selectedFamilyId } = useFamily();
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipientId: "",
      description: "",
      price: "",
      purchasedFrom: "",
      notes: "",
    },
  });

  const { data: members = [] } = useQuery<GroupMember[]>({
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

  const otherMembers = members.filter((m) => m.userId !== (user as any)?.id);

  const recordPurchaseMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const selectedMember = members.find((m) => m.userId === values.recipientId);
      if (!selectedMember) {
        throw new Error("Invalid recipient selected");
      }

      const payload = {
        familyId: selectedFamilyId,
        recipientUserId: selectedMember.isManagedProfile ? null : selectedMember.userId,
        recipientManagedProfileId: selectedMember.isManagedProfile ? selectedMember.managedProfileId : null,
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
      queryClient.invalidateQueries({ queryKey: ["/api/coordination-insights"] });
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

  const getInitials = (firstName?: string | null, lastName?: string | null, displayName?: string | null) => {
    if (displayName) {
      const parts = displayName.split(" ");
      return parts.map((p) => p[0]).join("").substring(0, 2).toUpperCase();
    }
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const getMemberDisplayName = (member: GroupMember) => {
    if (member.displayName) return member.displayName;
    const name = `${member.firstName || ""} ${member.lastName || ""}`.trim();
    return name || member.email || "Unknown";
  };

  const onSubmit = (values: FormValues) => {
    recordPurchaseMutation.mutate(values);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-red-600" />
            Record a Purchase
          </DialogTitle>
          <DialogDescription>
            Log a gift you purchased outside of someone's wishlist.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="recipientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-recipient">
                        <SelectValue placeholder="Select who this gift is for" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {otherMembers.map((member) => (
                        <SelectItem
                          key={member.userId}
                          value={member.userId}
                          data-testid={`option-recipient-${member.userId}`}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={member.profileImageUrl || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(member.firstName, member.lastName, member.displayName)}
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

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What did you buy?</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Blue sweater, Lego set"
                      data-testid="input-description"
                      {...field}
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
                    <DollarSign className="h-4 w-4" />
                    Price
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      data-testid="input-price"
                      {...field}
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
                    <Store className="h-4 w-4" />
                    Store (optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Amazon, Target"
                      data-testid="input-store"
                      {...field}
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
                    <StickyNote className="h-4 w-4" />
                    Notes (optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Arrives Dec 20th, gift wrapped"
                      className="resize-none"
                      data-testid="input-notes"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={recordPurchaseMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
                data-testid="button-record-purchase"
              >
                {recordPurchaseMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recording...
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
