import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useFamily } from "@/contexts/FamilyContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Users, Gift, Eye, UserPlus, Copy, Check, Lightbulb, Mail, Send, UserMinus, Edit, Settings } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";

const inviteEmailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type InviteEmailForm = z.infer<typeof inviteEmailSchema>;

const editMemberSchema = z.object({
  displayName: z.string().nullable().optional(),
  firstName: z.string().trim().min(1, "First name cannot be empty").optional(),
  lastName: z.string().trim().min(1, "Last name cannot be empty").optional(),
});

type EditMemberForm = z.infer<typeof editMemberSchema>;

const editFamilyNameSchema = z.object({
  name: z.string().trim().min(1, "Family name cannot be empty"),
});

type EditFamilyNameForm = z.infer<typeof editFamilyNameSchema>;

export default function Members() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { selectedFamilyId, families } = useFamily();
  const [, setLocation] = useLocation();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<any>(null);
  const [isEditMemberDialogOpen, setIsEditMemberDialogOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<any>(null);
  const [isEditFamilyNameDialogOpen, setIsEditFamilyNameDialogOpen] = useState(false);
  
  const selectedFamily = families?.find((f: any) => f.id === selectedFamilyId);
  const isOrganizer = selectedFamily?.createdById === (user as any)?.id;

  const form = useForm<InviteEmailForm>({
    resolver: zodResolver(inviteEmailSchema),
    defaultValues: {
      email: "",
    },
  });

  const editMemberForm = useForm<EditMemberForm>({
    resolver: zodResolver(editMemberSchema),
    defaultValues: {
      displayName: "",
      firstName: "",
      lastName: "",
    },
  });

  const editFamilyNameForm = useForm<EditFamilyNameForm>({
    resolver: zodResolver(editFamilyNameSchema),
    defaultValues: {
      name: selectedFamily?.name || "",
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

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!selectedFamilyId) throw new Error("No family selected");
      return apiRequest("DELETE", `/api/families/${selectedFamilyId}/members/${userId}`, {});
    },
    onSuccess: () => {
      // Invalidate both members and families queries to keep counts accurate
      queryClient.invalidateQueries({ queryKey: ["/api/members", selectedFamilyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      toast({
        title: "Member removed",
        description: "The member has been removed from the family",
      });
      setShowRemoveConfirm(false);
      setMemberToRemove(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove member",
        description: error.message || "There was a problem removing the member",
        variant: "destructive",
      });
      setShowRemoveConfirm(false);
    },
  });

  const editMemberMutation = useMutation({
    mutationFn: async (data: { userId: string; updates: EditMemberForm }) => {
      if (!selectedFamilyId) throw new Error("No family selected");
      
      // Update display name if provided
      if (data.updates.displayName !== undefined) {
        await apiRequest("PUT", `/api/families/${selectedFamilyId}/members/${data.userId}`, {
          displayName: data.updates.displayName || null,
        });
      }
      
      // Update profile name if first/last name provided
      if (data.updates.firstName !== undefined || data.updates.lastName !== undefined) {
        const profileUpdates: any = {};
        if (data.updates.firstName !== undefined) profileUpdates.firstName = data.updates.firstName;
        if (data.updates.lastName !== undefined) profileUpdates.lastName = data.updates.lastName;
        
        if (Object.keys(profileUpdates).length > 0) {
          await apiRequest("PUT", `/api/families/${selectedFamilyId}/members/${data.userId}/profile`, profileUpdates);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", selectedFamilyId] });
      toast({
        title: "Member updated",
        description: "The member's information has been updated successfully",
      });
      setIsEditMemberDialogOpen(false);
      setMemberToEdit(null);
      editMemberForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update member",
        description: error.message || "There was a problem updating the member",
        variant: "destructive",
      });
    },
  });

  const editFamilyNameMutation = useMutation({
    mutationFn: async (data: EditFamilyNameForm) => {
      if (!selectedFamilyId) throw new Error("No family selected");
      return apiRequest("PUT", `/api/families/${selectedFamilyId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      toast({
        title: "Family name updated",
        description: "The family name has been updated successfully",
      });
      setIsEditFamilyNameDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update family name",
        description: error.message || "There was a problem updating the family name",
        variant: "destructive",
      });
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

  const { data: members, isLoading } = useQuery({
    queryKey: ["/api/members", selectedFamilyId],
    queryFn: async () => {
      if (!selectedFamilyId) return [];
      const response = await fetch(`/api/members?familyId=${selectedFamilyId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch members");
      }
      return response.json();
    },
    enabled: !!selectedFamilyId,
    retry: false,
  });

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 lg:p-12 space-y-6">
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

  return (
    <div className="p-6 md:p-8 lg:p-12 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground">
              {selectedFamily?.name || "Family Members"}
            </h1>
            <p className="text-muted-foreground mt-1">
              View wishlists from all your family members
            </p>
          </div>
          {isOrganizer && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                editFamilyNameForm.reset({ name: selectedFamily?.name || "" });
                setIsEditFamilyNameDialogOpen(true);
              }}
              data-testid="button-edit-family-name"
              className="ml-2"
            >
              <Edit className="w-4 h-4" />
            </Button>
          )}
        </div>
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-invite-member">
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Member
            </Button>
          </DialogTrigger>
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
        <div className="space-y-2">
          {members.map((member: any) => {
            const isCurrentUser = !!user && member.userId === (user as any).id;
            return (
              <Card
                key={member.userId}
                className="hover-elevate"
                data-testid={`member-card-${member.userId}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage src={member.profileImageUrl || undefined} alt={member.firstName || "Member"} />
                      <AvatarFallback>
                        {getInitials(member.firstName, member.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate" data-testid={`member-name-${member.userId}`}>
                          {member.displayName || (member.firstName || member.lastName
                            ? `${member.firstName || ""} ${member.lastName || ""}`.trim()
                            : member.email || "Family Member")}
                        </h3>
                        {isCurrentUser && (
                          <span className="text-xs text-primary font-medium">(You)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Gift className="w-3.5 h-3.5" />
                        <span data-testid={`member-items-${member.userId}`}>
                          {member.itemCount || 0} items
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isCurrentUser ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation(`/members/${member.userId}`)}
                            data-testid={`button-view-wishlist-${member.userId}`}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Wishlist
                          </Button>
                          {isOrganizer && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setMemberToEdit(member);
                                  editMemberForm.reset({
                                    displayName: member.displayName || "",
                                    firstName: member.firstName || "",
                                    lastName: member.lastName || "",
                                  });
                                  setIsEditMemberDialogOpen(true);
                                }}
                                data-testid={`button-edit-member-${member.userId}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setMemberToRemove(member);
                                  setShowRemoveConfirm(true);
                                }}
                                data-testid={`button-remove-member-${member.userId}`}
                              >
                                <UserMinus className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation('/wishlist')}
                          data-testid="button-view-my-wishlist"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View My List
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Family Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.firstName || "this member"} from the family? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeMemberMutation.mutate(memberToRemove?.userId)}
              disabled={removeMemberMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-remove"
            >
              {removeMemberMutation.isPending ? "Removing..." : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Member Dialog */}
      <Dialog open={isEditMemberDialogOpen} onOpenChange={setIsEditMemberDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Member Information</DialogTitle>
            <DialogDescription>
              Update the display name (family-specific nickname) or actual profile name
            </DialogDescription>
          </DialogHeader>
          <Form {...editMemberForm}>
            <form onSubmit={editMemberForm.handleSubmit((data) => {
              if (memberToEdit) {
                editMemberMutation.mutate({ userId: memberToEdit.userId, updates: data });
              }
            })} className="space-y-4">
              <FormField
                control={editMemberForm.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name (Family Nickname)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="e.g., Mom, Dad, Grandma"
                        data-testid="input-display-name"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      This name only shows within this family group
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Separator />
              <FormField
                control={editMemberForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name (Profile)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="First name"
                        data-testid="input-first-name"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      This changes their name everywhere in the app
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editMemberForm.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name (Profile)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="Last name"
                        data-testid="input-last-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditMemberDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editMemberMutation.isPending}
                  data-testid="button-save-member"
                >
                  {editMemberMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Family Name Dialog */}
      <Dialog open={isEditFamilyNameDialogOpen} onOpenChange={setIsEditFamilyNameDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Family Name</DialogTitle>
            <DialogDescription>
              Change the name of your family group
            </DialogDescription>
          </DialogHeader>
          <Form {...editFamilyNameForm}>
            <form onSubmit={editFamilyNameForm.handleSubmit((data) => editFamilyNameMutation.mutate(data))} className="space-y-4">
              <FormField
                control={editFamilyNameForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Family Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter family name"
                        data-testid="input-family-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditFamilyNameDialogOpen(false)}
                  data-testid="button-cancel-edit-family"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editFamilyNameMutation.isPending}
                  data-testid="button-save-family-name"
                >
                  {editFamilyNameMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
