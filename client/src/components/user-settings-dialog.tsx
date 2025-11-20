import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useFamily } from "@/contexts/FamilyContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Loader2, LogOut } from "lucide-react";

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserSettingsDialog({ open, onOpenChange }: UserSettingsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedFamilyId, setSelectedFamilyId } = useFamily();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [familyToLeave, setFamilyToLeave] = useState("");

  const { data: families } = useQuery({
    queryKey: ["/api/families"],
    retry: false,
  });

  // Sync form state with user data when dialog opens or user data changes
  useEffect(() => {
    if (user && open) {
      setFirstName((user as any).firstName || "");
      setLastName((user as any).lastName || "");
      setProfileImageUrl((user as any).profileImageUrl || "");
    }
  }, [user, open]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      // Only send fields that have values
      const updates: any = {};
      if (firstName.trim()) updates.firstName = firstName.trim();
      if (lastName.trim()) updates.lastName = lastName.trim();
      if (profileImageUrl) updates.profileImageUrl = profileImageUrl;

      return await apiRequest("PUT", "/api/user", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Success",
        description: "Your profile has been updated!",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const leaveFamilyMutation = useMutation({
    mutationFn: async (familyId: string) => {
      return await apiRequest("DELETE", `/api/families/${familyId}/leave`, {});
    },
    onSuccess: async (_, familyIdLeft) => {
      // Invalidate queries first
      await queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      
      // If we left the currently selected family, clear it
      // The FamilyContext will automatically select another family or clear if none available
      if (selectedFamilyId === familyIdLeft) {
        setSelectedFamilyId(null);
      }
      
      toast({
        title: "Left family",
        description: "You have successfully left the family",
      });
      setShowLeaveConfirm(false);
      setFamilyToLeave(""); // Reset dropdown selection
      onOpenChange(false);
      // Redirect to home
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to leave family",
        variant: "destructive",
      });
      setShowLeaveConfirm(false);
    },
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImageUrl(reader.result as string);
      setIsUploadingImage(false);
    };
    reader.onerror = () => {
      toast({
        title: "Error",
        description: "Failed to read image file",
        variant: "destructive",
      });
      setIsUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const getInitials = (first?: string, last?: string) => {
    if (!first && !last) return "U";
    return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate at least one name is provided
    if (!firstName.trim() && !lastName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide at least a first name or last name",
        variant: "destructive",
      });
      return;
    }
    
    updateProfileMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" data-testid="dialog-user-settings">
        <DialogHeader>
          <DialogTitle>Profile Settings</DialogTitle>
          <DialogDescription>
            Update your name and profile picture
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profileImageUrl || undefined} alt={firstName || "User"} />
              <AvatarFallback className="text-2xl">{getInitials(firstName, lastName)}</AvatarFallback>
            </Avatar>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              data-testid="input-profile-image-file"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
              data-testid="button-upload-profile-image"
            >
              {isUploadingImage ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Picture
                </>
              )}
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                placeholder="Enter your first name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                data-testid="input-first-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Enter your last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                data-testid="input-last-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
                data-testid="input-email-disabled"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
          </div>

          {families && families.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Leave Family</h3>
                  <p className="text-sm text-muted-foreground">Remove yourself from a family group</p>
                </div>
                <div className="flex gap-2">
                  <Select value={familyToLeave} onValueChange={setFamilyToLeave}>
                    <SelectTrigger className="flex-1" data-testid="select-family-to-leave">
                      <SelectValue placeholder="Select a family to leave" />
                    </SelectTrigger>
                    <SelectContent>
                      {families.map((family: any) => (
                        <SelectItem key={family.id} value={family.id}>
                          {family.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={!familyToLeave}
                    onClick={() => setShowLeaveConfirm(true)}
                    data-testid="button-leave-family"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Leave
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              data-testid="button-cancel-settings"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="flex-1"
              data-testid="button-save-settings"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>

      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Family?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this family? This action cannot be undone and you will need a new invite code to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-leave">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => leaveFamilyMutation.mutate(familyToLeave)}
              disabled={leaveFamilyMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-leave"
            >
              {leaveFamilyMutation.isPending ? "Leaving..." : "Leave Family"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
