import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Loader2, Camera } from "lucide-react";

interface ChildProfileEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: string;
  child: {
    id: string;
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
  } | null;
}

export function ChildProfileEditDialog({ 
  open, 
  onOpenChange, 
  familyId,
  child 
}: ChildProfileEditDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    if (child && open) {
      setFirstName(child.firstName || "");
      setLastName(child.lastName || "");
      setProfileImageUrl(child.profileImageUrl || "");
    }
  }, [child, open]);

  const updateChildMutation = useMutation({
    mutationFn: async () => {
      if (!child) throw new Error("No child selected");
      
      const updates: any = {};
      if (firstName.trim()) updates.firstName = firstName.trim();
      if (lastName.trim()) updates.lastName = lastName.trim();
      if (profileImageUrl) updates.profileImageUrl = profileImageUrl;

      return await apiRequest("PUT", `/api/families/${familyId}/children/${child.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({
        title: "Success",
        description: "Profile has been updated!",
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
    if (!first && !last) return "C";
    return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();
  };

  const handleClose = () => {
    setFirstName("");
    setLastName("");
    setProfileImageUrl("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Child Profile</DialogTitle>
          <DialogDescription>
            Update {child?.firstName || "child"}'s profile information and photo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage 
                  src={profileImageUrl || undefined} 
                  alt={firstName || "Child"} 
                />
                <AvatarFallback className="text-2xl">
                  {getInitials(firstName, lastName)}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="secondary"
                size="icon"
                className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                data-testid="button-upload-child-photo"
              >
                {isUploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                data-testid="input-child-photo"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Click the camera icon to upload a photo
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="child-first-name">First Name</Label>
              <Input
                id="child-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                data-testid="input-child-first-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="child-last-name">Last Name</Label>
              <Input
                id="child-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name (optional)"
                data-testid="input-child-last-name"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-child-edit">
            Cancel
          </Button>
          <Button 
            onClick={() => updateChildMutation.mutate()}
            disabled={updateChildMutation.isPending || !firstName.trim()}
            data-testid="button-save-child-profile"
          >
            {updateChildMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
