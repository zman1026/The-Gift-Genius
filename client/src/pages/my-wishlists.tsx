import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useFamily } from "@/contexts/FamilyContext";
import { useCurrentMember } from "@/contexts/CurrentMemberContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Gift, Cake, GraduationCap, Heart, Baby, Home, PartyPopper, Calendar, Trash2, Edit, TreePine, Users, DollarSign, Share2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { format } from "date-fns";
import { UnifiedAddItemDialog } from "@/components/unified-add-item-dialog";
import { CrossFamilySharingDialog } from "@/components/cross-family-sharing-dialog";
import { PersonalListSharingDialog } from "@/components/personal-list-sharing-dialog";
import type { PersonalList, WishlistItem, Family } from "@shared/schema";

const occasionTypes = [
  { value: "birthday", label: "Birthday", icon: Cake },
  { value: "graduation", label: "Graduation", icon: GraduationCap },
  { value: "wedding", label: "Wedding", icon: Heart },
  { value: "baby_shower", label: "Baby Shower", icon: Baby },
  { value: "anniversary", label: "Anniversary", icon: Heart },
  { value: "housewarming", label: "Housewarming", icon: Home },
  { value: "holiday", label: "Holiday", icon: PartyPopper },
  { value: "other", label: "Other", icon: Gift },
] as const;

const occasionThemes: Record<string, { primary: string; accent: string; background: string }> = {
  birthday: { primary: "#EC4899", accent: "#F97316", background: "#FDF2F8" },
  graduation: { primary: "#3B82F6", accent: "#10B981", background: "#EFF6FF" },
  wedding: { primary: "#F43F5E", accent: "#D4AF37", background: "#FFF1F2" },
  baby_shower: { primary: "#A855F7", accent: "#EC4899", background: "#FAF5FF" },
  anniversary: { primary: "#EF4444", accent: "#F59E0B", background: "#FEF2F2" },
  housewarming: { primary: "#84CC16", accent: "#F97316", background: "#F7FEE7" },
  holiday: { primary: "#DC2626", accent: "#15803D", background: "#FEF2F2" },
  other: { primary: "#6366F1", accent: "#8B5CF6", background: "#EEF2FF" },
};

const christmasTheme = { primary: "#DC2626", accent: "#15803D", background: "#FEF2F2" };

const createListSchema = z.object({
  name: z.string().min(1, "List name is required").max(255),
  occasionType: z.enum(["birthday", "graduation", "wedding", "baby_shower", "anniversary", "housewarming", "holiday", "other"]),
  description: z.string().optional(),
  date: z.string().optional(),
});

type CreateListFormData = z.infer<typeof createListSchema>;

const addPersonalItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(255),
  description: z.string().optional(),
  price: z.string().optional(),
  link: z.union([z.string().url("Must be a valid URL"), z.literal("")]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  quantity: z.coerce.number().int().positive().optional(),
});

type AddPersonalItemFormData = z.infer<typeof addPersonalItemSchema>;

export default function MyWishlists() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { selectedFamilyId, families } = useFamily();
  const { currentMemberId, currentMemberName } = useCurrentMember();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [isChristmasAddDialogOpen, setIsChristmasAddDialogOpen] = useState(false);
  const [addingToListId, setAddingToListId] = useState<string | null>(null);
  const [isSharingDialogOpen, setIsSharingDialogOpen] = useState(false);
  const [sharingList, setSharingList] = useState<PersonalList | null>(null);

  const form = useForm<CreateListFormData>({
    resolver: zodResolver(createListSchema),
    defaultValues: {
      name: "",
      occasionType: "birthday",
      description: "",
      date: "",
    },
  });

  const { data: personalLists, isLoading: listsLoading } = useQuery<PersonalList[]>({
    queryKey: ["/api/personal-lists"],
    enabled: isAuthenticated,
  });

  const { data: wishlistItems, isLoading: wishlistLoading } = useQuery<WishlistItem[]>({
    queryKey: ["/api/wishlist", selectedFamilyId],
    queryFn: async () => {
      if (!selectedFamilyId) return [];
      const params = new URLSearchParams({ familyId: selectedFamilyId });
      const response = await fetch(`/api/wishlist?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch wishlist");
      }
      return response.json();
    },
    enabled: isAuthenticated && !!selectedFamilyId,
  });

  const { data: budgetData } = useQuery<{
    totalAllocated: number;
    totalSpent: number;
    totalRemaining: number;
    memberBudgets: any[];
  }>({
    queryKey: ['/api/families', selectedFamilyId, 'budget'],
    queryFn: async () => {
      const response = await fetch(`/api/families/${selectedFamilyId}/budget`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error('Failed to fetch budget data');
      return response.json();
    },
    enabled: isAuthenticated && !!selectedFamilyId,
  });

  const selectedFamily = families?.find((f: Family) => f.id === selectedFamilyId);

  const createListMutation = useMutation({
    mutationFn: async (data: CreateListFormData) => {
      const themeColors = occasionThemes[data.occasionType];
      return await apiRequest("POST", "/api/personal-lists", {
        ...data,
        themeColors,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal-lists"] });
      toast({
        title: "List created",
        description: "Your personal list has been created successfully.",
      });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create list",
        variant: "destructive",
      });
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async (listId: string) => {
      return await apiRequest("DELETE", `/api/personal-lists/${listId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal-lists"] });
      toast({
        title: "List deleted",
        description: "Your personal list has been deleted.",
      });
      setDeletingListId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete list",
        variant: "destructive",
      });
    },
  });

  const personalItemForm = useForm<AddPersonalItemFormData>({
    resolver: zodResolver(addPersonalItemSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      link: "",
      priority: "medium",
      quantity: 1,
    },
  });

  const addPersonalItemMutation = useMutation({
    mutationFn: async ({ listId, data }: { listId: string; data: AddPersonalItemFormData }) => {
      const priceValue = data.price?.trim();
      return await apiRequest("POST", `/api/personal-lists/${listId}/items`, {
        ...data,
        price: priceValue ? parseFloat(priceValue) : undefined,
        link: data.link?.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal-lists"] });
      toast({
        title: "Item added",
        description: "The item has been added to your list.",
      });
      setAddingToListId(null);
      personalItemForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add item",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (data: CreateListFormData) => {
    createListMutation.mutate(data);
  };

  const handlePersonalItemSubmit = (data: AddPersonalItemFormData) => {
    if (addingToListId) {
      addPersonalItemMutation.mutate({ listId: addingToListId, data });
    }
  };

  const handleChristmasAddSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/wishlist", selectedFamilyId] });
    setIsChristmasAddDialogOpen(false);
  };

  const getOccasionIcon = (type: string) => {
    const occasion = occasionTypes.find(o => o.value === type);
    return occasion?.icon || Gift;
  };

  const getOccasionLabel = (type: string) => {
    const occasion = occasionTypes.find(o => o.value === type);
    return occasion?.label || type;
  };

  const sortedPersonalLists = personalLists?.slice().sort((a, b) => {
    if (a.date && b.date) {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });

  if (authLoading || listsLoading || wishlistLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-32 w-full mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">My Wishlists</h1>
          <p className="text-muted-foreground">Manage your wishlists for gift exchanges and special occasions</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-list">
              <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
              Create List
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Personal List</DialogTitle>
              <DialogDescription>
                Create a new wishlist for a special occasion. You can share it with friends and family.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>List Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="My Birthday Wishlist" 
                          {...field} 
                          data-testid="input-list-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="occasionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Occasion</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-occasion-type">
                            <SelectValue placeholder="Select an occasion" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {occasionTypes.map((occasion) => {
                            const Icon = occasion.icon;
                            return (
                              <SelectItem key={occasion.value} value={occasion.value}>
                                <div className="flex items-center gap-2">
                                  <Icon className="w-4 h-4" aria-hidden="true" />
                                  {occasion.label}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date (optional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          data-testid="input-list-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Tell people what you're celebrating..." 
                          {...field} 
                          data-testid="input-list-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={createListMutation.isPending}
                    data-testid="button-submit-create-list"
                  >
                    {createListMutation.isPending ? "Creating..." : "Create List"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {selectedFamilyId && selectedFamily && (
        <Card 
          className="relative overflow-hidden hover-elevate mb-6"
          data-testid="card-christmas-wishlist"
        >
          <div 
            className="absolute top-0 left-0 right-0 h-1.5"
            style={{ backgroundColor: christmasTheme.primary }}
          />
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div 
                  className="p-2.5 rounded-lg shrink-0"
                  style={{ backgroundColor: christmasTheme.background }}
                >
                  <TreePine 
                    className="w-6 h-6" 
                    style={{ color: christmasTheme.accent }}
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-xl">Christmas Wishlist</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <Users className="w-3 h-3" aria-hidden="true" />
                      Shared with {selectedFamily.name}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {wishlistItems?.length || 0} item{(wishlistItems?.length || 0) !== 1 ? 's' : ''}
                    </span>
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Items on this list are visible to your group members for gift coordination.
            </p>
            
            {budgetData && budgetData.totalAllocated > 0 && (
              <div 
                className="rounded-lg p-3 space-y-2"
                style={{ backgroundColor: christmasTheme.background }}
                data-testid="budget-summary"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign 
                      className="w-4 h-4" 
                      style={{ color: christmasTheme.accent }}
                      aria-hidden="true" 
                    />
                    <span className="text-sm font-medium">Gift Budget</span>
                  </div>
                  <Link href="/gift-coordination">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid="button-manage-budget">
                      Manage
                    </Button>
                  </Link>
                </div>
                <div className="space-y-1">
                  <Progress
                    value={Math.min((budgetData.totalSpent / budgetData.totalAllocated) * 100, 100)}
                    className="h-2"
                    data-testid="progress-budget"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span data-testid="text-budget-spent">
                      ${budgetData.totalSpent.toFixed(2)} spent
                    </span>
                    <span data-testid="text-budget-remaining">
                      ${budgetData.totalRemaining.toFixed(2)} left of ${budgetData.totalAllocated.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {(!budgetData || budgetData.totalAllocated === 0) && (
              <Link href="/gift-coordination" className="block">
                <div 
                  className="rounded-lg p-3 border border-dashed flex items-center justify-between hover-elevate"
                  data-testid="budget-setup-prompt"
                >
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm text-muted-foreground">Coordinate gifts and set a budget</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">Recommended</Badge>
                </div>
              </Link>
            )}
            
            <div className="flex items-center gap-2 flex-wrap">
              <Link href="/wishlist">
                <Button variant="outline" size="sm" data-testid="button-view-christmas-list">
                  View List
                </Button>
              </Link>
              <Button 
                size="sm" 
                onClick={() => setIsChristmasAddDialogOpen(true)}
                data-testid="button-add-christmas-item"
              >
                <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                Add Item
              </Button>
              {families.length > 1 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setIsSharingDialogOpen(true)}
                  data-testid="button-share-christmas-list"
                >
                  <Share2 className="w-4 h-4 mr-1" aria-hidden="true" />
                  Share
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedFamilyId && (
        <CrossFamilySharingDialog
          open={isSharingDialogOpen}
          onOpenChange={setIsSharingDialogOpen}
          mode="user"
        />
      )}

      {selectedFamilyId && (
        <UnifiedAddItemDialog 
          open={isChristmasAddDialogOpen} 
          onOpenChange={setIsChristmasAddDialogOpen}
          familyId={selectedFamilyId}
          targetUserId={currentMemberId || undefined}
          targetUserName={currentMemberName || undefined}
          onSuccess={handleChristmasAddSuccess}
        />
      )}

      {!selectedFamilyId && (
        <Card className="mb-6 border-dashed">
          <CardContent className="py-8 text-center">
            <TreePine className="w-10 h-10 mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
            <h3 className="font-semibold mb-1">No Group Selected</h3>
            <p className="text-sm text-muted-foreground">
              Select a group from the sidebar to see your Christmas Wishlist
            </p>
          </CardContent>
        </Card>
      )}

      {sortedPersonalLists && sortedPersonalLists.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-muted-foreground">Personal Lists</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedPersonalLists.map((list) => {
              const Icon = getOccasionIcon(list.occasionType);
              const themeColors = list.themeColors || occasionThemes[list.occasionType] || occasionThemes.other;
              
              return (
                <Card 
                  key={list.id} 
                  className="relative overflow-hidden hover-elevate"
                  data-testid={`card-list-${list.id}`}
                >
                  <div 
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: themeColors.primary }}
                  />
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div 
                          className="p-2 rounded-lg shrink-0"
                          style={{ backgroundColor: themeColors.background }}
                        >
                          <Icon 
                            className="w-5 h-5" 
                            style={{ color: themeColors.primary }}
                            aria-hidden="true"
                          />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-lg truncate">{list.name}</CardTitle>
                          <CardDescription className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-xs">
                              {getOccasionLabel(list.occasionType)}
                            </Badge>
                            {list.date && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" aria-hidden="true" />
                                {format(new Date(list.date), "MMM d, yyyy")}
                              </span>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {list.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {list.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Link href={`/personal-lists/${list.id}`}>
                          <Button variant="outline" size="sm" data-testid={`button-view-list-${list.id}`}>
                            View List
                          </Button>
                        </Link>
                        <Button 
                          size="sm" 
                          onClick={() => setAddingToListId(list.id)}
                          data-testid={`button-add-item-${list.id}`}
                        >
                          <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                          Add Item
                        </Button>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setSharingList(list)}
                          data-testid={`button-share-list-${list.id}`}
                        >
                          <Share2 className="w-4 h-4" aria-hidden="true" />
                        </Button>
                        <Link href={`/personal-lists/${list.id}`}>
                          <Button variant="ghost" size="icon" data-testid={`button-edit-list-${list.id}`}>
                            <Edit className="w-4 h-4" aria-hidden="true" />
                          </Button>
                        </Link>
                        <Dialog open={deletingListId === list.id} onOpenChange={(open) => !open && setDeletingListId(null)}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setDeletingListId(list.id)}
                              data-testid={`button-delete-list-${list.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" aria-hidden="true" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Delete List</DialogTitle>
                              <DialogDescription>
                                Are you sure you want to delete "{list.name}"? This will permanently delete the list and all its items.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setDeletingListId(null)}>
                                Cancel
                              </Button>
                              <Button 
                                variant="destructive" 
                                onClick={() => deleteListMutation.mutate(list.id)}
                                disabled={deleteListMutation.isPending}
                                data-testid="button-confirm-delete"
                              >
                                {deleteListMutation.isPending ? "Deleting..." : "Delete"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {(!sortedPersonalLists || sortedPersonalLists.length === 0) && (
        <Card className="text-center py-8 border-dashed">
          <CardContent className="pt-0">
            <Gift className="w-10 h-10 mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
            <h3 className="font-semibold mb-1">No personal lists yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create a personal wishlist for birthdays, graduations, or any special occasion.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)} variant="outline" data-testid="button-create-first-list">
              <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
              Create Your First List
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!addingToListId} onOpenChange={(open) => !open && setAddingToListId(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
            <DialogDescription>
              Add a new item to your wishlist.
            </DialogDescription>
          </DialogHeader>
          <Form {...personalItemForm}>
            <form onSubmit={personalItemForm.handleSubmit(handlePersonalItemSubmit)} className="space-y-4">
              <FormField
                control={personalItemForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="What do you want?" 
                        {...field} 
                        data-testid="input-personal-item-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={personalItemForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add details like size, color, or specific version..." 
                        {...field} 
                        data-testid="input-personal-item-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={personalItemForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (optional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                          {...field} 
                          data-testid="input-personal-item-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={personalItemForm.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1"
                          {...field} 
                          data-testid="input-personal-item-quantity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={personalItemForm.control}
                name="link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link (optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="url"
                        placeholder="https://..." 
                        {...field} 
                        data-testid="input-personal-item-link"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={personalItemForm.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-personal-item-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="high">High Priority</SelectItem>
                        <SelectItem value="medium">Medium Priority</SelectItem>
                        <SelectItem value="low">Low Priority</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={addPersonalItemMutation.isPending}
                  data-testid="button-submit-personal-item"
                >
                  {addPersonalItemMutation.isPending ? "Adding..." : "Add Item"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {sharingList && (
        <PersonalListSharingDialog
          open={!!sharingList}
          onOpenChange={(open) => !open && setSharingList(null)}
          list={sharingList}
        />
      )}
    </div>
  );
}
