import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Users, Shield, Trash2, UserPlus, Edit, DollarSign, Crown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface GuardianManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  managedProfileId: string;
  profileName: string;
  familyId: string;
  currentUserId: string;
  isPrimaryGuardian: boolean;
}

interface Guardian {
  id: string;
  managedProfileId: string;
  guardianUserId: string;
  isPrimary: boolean;
  canEdit: boolean;
  canManageBudget: boolean;
  addedAt: string;
  guardian: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
}

interface Member {
  id: string;
  userId: string | null;
  managedProfileId: string | null;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  isManagedProfile: boolean;
}

function getInitials(firstName: string | null, lastName: string | null): string {
  const first = firstName?.charAt(0) || "";
  const last = lastName?.charAt(0) || "";
  return (first + last).toUpperCase() || "?";
}

export function GuardianManagementDialog({
  open,
  onOpenChange,
  managedProfileId,
  profileName,
  familyId,
  currentUserId,
  isPrimaryGuardian,
}: GuardianManagementDialogProps) {
  const { toast } = useToast();
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState<string>("");
  const [guardianToRemove, setGuardianToRemove] = useState<Guardian | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const { data: guardians, isLoading: guardiansLoading } = useQuery({
    queryKey: ["/api/managed-profiles", managedProfileId, "guardians"],
    queryFn: async () => {
      const response = await fetch(`/api/managed-profiles/${managedProfileId}/guardians`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch guardians");
      }
      return response.json();
    },
    enabled: open && !!managedProfileId,
  });

  const { data: allMembers } = useQuery({
    queryKey: ["/api/members", familyId],
    queryFn: async () => {
      const response = await fetch(`/api/members?familyId=${familyId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch members");
      }
      return response.json();
    },
    enabled: open && !!familyId,
  });

  const existingGuardianIds = new Set((guardians || []).map((g: Guardian) => g.guardianUserId));
  
  const availableMembers = (allMembers || []).filter((member: Member) => 
    member.userId && 
    !member.isManagedProfile && 
    !existingGuardianIds.has(member.userId)
  );

  const addGuardianMutation = useMutation({
    mutationFn: async (guardianUserId: string) => {
      return apiRequest("POST", `/api/managed-profiles/${managedProfileId}/guardians`, {
        guardianUserId,
        canEdit: true,
        canManageBudget: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managed-profiles", managedProfileId, "guardians"] });
      toast({
        title: "Guardian added",
        description: "The guardian has been added successfully",
      });
      setSelectedMemberToAdd("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add guardian",
        description: error.message || "There was a problem adding the guardian",
        variant: "destructive",
      });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ guardianUserId, permissions }: { guardianUserId: string; permissions: { canEdit?: boolean; canManageBudget?: boolean } }) => {
      return apiRequest("PATCH", `/api/managed-profiles/${managedProfileId}/guardians/${guardianUserId}`, permissions);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managed-profiles", managedProfileId, "guardians"] });
      toast({
        title: "Permissions updated",
        description: "Guardian permissions have been updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update permissions",
        description: error.message || "There was a problem updating permissions",
        variant: "destructive",
      });
    },
  });

  const removeGuardianMutation = useMutation({
    mutationFn: async (guardianUserId: string) => {
      return apiRequest("DELETE", `/api/managed-profiles/${managedProfileId}/guardians/${guardianUserId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managed-profiles", managedProfileId, "guardians"] });
      toast({
        title: "Guardian removed",
        description: "The guardian has been removed successfully",
      });
      setShowRemoveConfirm(false);
      setGuardianToRemove(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove guardian",
        description: error.message || "There was a problem removing the guardian",
        variant: "destructive",
      });
      setShowRemoveConfirm(false);
    },
  });

  const handleAddGuardian = () => {
    if (selectedMemberToAdd) {
      addGuardianMutation.mutate(selectedMemberToAdd);
    }
  };

  const handleRemoveGuardian = (guardian: Guardian) => {
    setGuardianToRemove(guardian);
    setShowRemoveConfirm(true);
  };

  const handleTogglePermission = (guardian: Guardian, permission: "canEdit" | "canManageBudget", value: boolean) => {
    updatePermissionsMutation.mutate({
      guardianUserId: guardian.guardianUserId,
      permissions: { [permission]: value },
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Manage Guardians
            </DialogTitle>
            <DialogDescription>
              Share management of {profileName}'s wishlist with other group members
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isPrimaryGuardian && availableMembers.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Add Guardian</Label>
                <div className="flex gap-2">
                  <Select value={selectedMemberToAdd} onValueChange={setSelectedMemberToAdd}>
                    <SelectTrigger className="flex-1" data-testid="select-add-guardian">
                      <SelectValue placeholder="Select a group member" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMembers.map((member: Member) => (
                        <SelectItem key={member.userId} value={member.userId!}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={member.profileImageUrl || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(member.firstName, member.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{member.displayName || `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAddGuardian}
                    disabled={!selectedMemberToAdd || addGuardianMutation.isPending}
                    size="icon"
                    data-testid="button-add-guardian"
                  >
                    <UserPlus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {isPrimaryGuardian && availableMembers.length === 0 && (guardians?.length || 0) <= 1 && (
              <div className="p-3 rounded-md bg-muted text-center text-sm text-muted-foreground">
                No other group members available to add as guardians
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-medium">Current Guardians</Label>
              <ScrollArea className="max-h-64">
                <div className="space-y-2">
                  {guardiansLoading ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">Loading...</div>
                  ) : (guardians?.length || 0) === 0 ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">No guardians found</div>
                  ) : (
                    (guardians || []).map((guardian: Guardian) => {
                      const isCurrentUser = guardian.guardianUserId === currentUserId;
                      const guardianName = guardian.guardian.firstName 
                        ? `${guardian.guardian.firstName} ${guardian.guardian.lastName || ""}`.trim()
                        : guardian.guardian.email;
                      
                      return (
                        <div
                          key={guardian.id}
                          className="p-3 rounded-md border space-y-3"
                          data-testid={`guardian-card-${guardian.guardianUserId}`}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={guardian.guardian.profileImageUrl || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(guardian.guardian.firstName, guardian.guardian.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium truncate">{guardianName}</span>
                                {guardian.isPrimary && (
                                  <Badge variant="default" className="text-xs">
                                    <Crown className="w-3 h-3 mr-1" />
                                    Primary
                                  </Badge>
                                )}
                                {isCurrentUser && !guardian.isPrimary && (
                                  <Badge variant="secondary" className="text-xs">You</Badge>
                                )}
                              </div>
                            </div>
                            {isPrimaryGuardian && !guardian.isPrimary && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleRemoveGuardian(guardian)}
                                disabled={removeGuardianMutation.isPending}
                                data-testid={`button-remove-guardian-${guardian.guardianUserId}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>

                          {!guardian.isPrimary && isPrimaryGuardian && (
                            <div className="space-y-2 pl-10">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Edit className="w-3 h-3 text-muted-foreground" />
                                  <Label htmlFor={`edit-${guardian.id}`} className="text-xs">
                                    Can edit wishlist
                                  </Label>
                                </div>
                                <Switch
                                  id={`edit-${guardian.id}`}
                                  checked={guardian.canEdit}
                                  onCheckedChange={(checked) => handleTogglePermission(guardian, "canEdit", checked)}
                                  disabled={updatePermissionsMutation.isPending}
                                  data-testid={`switch-can-edit-${guardian.guardianUserId}`}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <DollarSign className="w-3 h-3 text-muted-foreground" />
                                  <Label htmlFor={`budget-${guardian.id}`} className="text-xs">
                                    Can manage budget
                                  </Label>
                                </div>
                                <Switch
                                  id={`budget-${guardian.id}`}
                                  checked={guardian.canManageBudget}
                                  onCheckedChange={(checked) => handleTogglePermission(guardian, "canManageBudget", checked)}
                                  disabled={updatePermissionsMutation.isPending}
                                  data-testid={`switch-can-manage-budget-${guardian.guardianUserId}`}
                                />
                              </div>
                            </div>
                          )}

                          {guardian.isPrimary && (
                            <div className="text-xs text-muted-foreground pl-10">
                              Primary guardian has full access
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Guardian?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {guardianToRemove?.guardian.firstName || "this person"} as a guardian? 
              They will no longer be able to manage {profileName}'s wishlist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove-guardian">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (guardianToRemove) {
                  removeGuardianMutation.mutate(guardianToRemove.guardianUserId);
                }
              }}
              disabled={removeGuardianMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-remove-guardian"
            >
              {removeGuardianMutation.isPending ? "Removing..." : "Remove Guardian"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
