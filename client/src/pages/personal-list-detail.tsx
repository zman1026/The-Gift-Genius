import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Gift, 
  Cake, 
  GraduationCap, 
  Heart, 
  Baby, 
  Home as HomeIcon, 
  PartyPopper, 
  Calendar, 
  Trash2, 
  ExternalLink, 
  Edit, 
  ArrowLeft,
  Share2,
  Copy,
  Check,
  ShoppingBag,
  Package,
  Download
} from "lucide-react";
import { ImportAmazonPersonalListDialog } from "@/components/import-amazon-personal-list-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

const occasionTypes = [
  { value: "birthday", label: "Birthday", icon: Cake },
  { value: "graduation", label: "Graduation", icon: GraduationCap },
  { value: "wedding", label: "Wedding", icon: Heart },
  { value: "baby_shower", label: "Baby Shower", icon: Baby },
  { value: "anniversary", label: "Anniversary", icon: Heart },
  { value: "housewarming", label: "Housewarming", icon: HomeIcon },
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

const addItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(255),
  description: z.string().optional(),
  price: z.string().optional(),
  link: z.union([z.string().url("Must be a valid URL"), z.literal("")]).optional(),
  imageUrl: z.union([z.string().url("Must be a valid URL"), z.literal("")]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  quantity: z.coerce.number().int().positive().optional(),
});

type AddItemFormData = z.infer<typeof addItemSchema>;

const PRIORITIES = [
  { value: "high", label: "High Priority" },
  { value: "medium", label: "Medium Priority" },
  { value: "low", label: "Low Priority" },
] as const;

export default function PersonalListDetail() {
  const [, params] = useRoute("/personal-lists/:listId");
  const [, navigate] = useLocation();
  const listId = params?.listId;
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const form = useForm<AddItemFormData>({
    resolver: zodResolver(addItemSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      link: "",
      imageUrl: "",
      priority: "medium",
      quantity: 1,
    },
  });

  useEffect(() => {
    if (editingItem) {
      form.reset({
        name: editingItem.name || "",
        description: editingItem.description || "",
        price: editingItem.price || "",
        link: editingItem.link || "",
        imageUrl: editingItem.imageUrl || "",
        priority: editingItem.priority || "medium",
        quantity: editingItem.quantity || 1,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        price: "",
        link: "",
        imageUrl: "",
        priority: "medium",
        quantity: 1,
      });
    }
  }, [editingItem, form]);

  const { data: listData, isLoading } = useQuery<any>({
    queryKey: ["/api/personal-lists", listId],
    enabled: isAuthenticated && !!listId,
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: AddItemFormData) => {
      return await apiRequest("POST", `/api/personal-lists/${listId}/items`, {
        ...data,
        price: data.price ? parseFloat(data.price) : undefined,
        imageUrl: data.imageUrl || undefined,
        link: data.link || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal-lists", listId] });
      toast({
        title: "Item added",
        description: "The item has been added to your list.",
      });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add item",
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: AddItemFormData }) => {
      return await apiRequest("PATCH", `/api/personal-lists/${listId}/items/${itemId}`, {
        ...data,
        price: data.price ? parseFloat(data.price) : undefined,
        imageUrl: data.imageUrl || undefined,
        link: data.link || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal-lists", listId] });
      toast({
        title: "Item updated",
        description: "The item has been updated.",
      });
      setEditingItem(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update item",
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return await apiRequest("DELETE", `/api/personal-lists/${listId}/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal-lists", listId] });
      toast({
        title: "Item deleted",
        description: "The item has been removed from your list.",
      });
      setDeletingItemId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: AddItemFormData) => {
    if (editingItem) {
      updateItemMutation.mutate({ itemId: editingItem.id, data });
    } else {
      addItemMutation.mutate(data);
    }
  };

  const handleCopyShareLink = () => {
    if (listData?.publicSlug) {
      const shareUrl = `${window.location.origin}/lists/${listData.publicSlug}`;
      navigator.clipboard.writeText(shareUrl);
      setCopiedSlug(true);
      toast({
        title: "Link copied",
        description: "Share link has been copied to clipboard.",
      });
      setTimeout(() => setCopiedSlug(false), 2000);
    }
  };

  const getOccasionIcon = (type: string) => {
    const occasion = occasionTypes.find(o => o.value === type);
    return occasion?.icon || Gift;
  };

  const getOccasionLabel = (type: string) => {
    const occasion = occasionTypes.find(o => o.value === type);
    return occasion?.label || type;
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive" className="text-xs">High</Badge>;
      case "low":
        return <Badge variant="secondary" className="text-xs">Low</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Medium</Badge>;
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-40 w-full mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!listData) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Card className="text-center py-12">
          <CardContent>
            <Gift className="w-12 h-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-lg font-semibold mb-2">List not found</h3>
            <p className="text-muted-foreground mb-4">
              This list may have been deleted or you don't have access to it.
            </p>
            <Link href="/personal-lists">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                Back to My Lists
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const Icon = getOccasionIcon(listData.occasionType);
  const themeColors = listData.themeColors || occasionThemes[listData.occasionType] || occasionThemes.other;
  const items = listData.items || [];

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/personal-lists">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
            Back to My Lists
          </Button>
        </Link>
        
        <Card className="overflow-hidden">
          <div 
            className="h-2"
            style={{ backgroundColor: themeColors.primary }}
          />
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div 
                  className="p-3 rounded-xl shrink-0"
                  style={{ backgroundColor: themeColors.background }}
                >
                  <Icon 
                    className="w-6 h-6" 
                    style={{ color: themeColors.primary }}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <CardTitle className="text-xl" data-testid="text-list-name">
                    {listData.name}
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="secondary">
                      {getOccasionLabel(listData.occasionType)}
                    </Badge>
                    {listData.date && (
                      <span className="text-xs flex items-center gap-1">
                        <Calendar className="w-3 h-3" aria-hidden="true" />
                        {format(new Date(listData.date), "MMM d, yyyy")}
                      </span>
                    )}
                  </CardDescription>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopyShareLink}
                data-testid="button-share"
              >
                {copiedSlug ? (
                  <Check className="w-4 h-4 mr-2" aria-hidden="true" />
                ) : (
                  <Share2 className="w-4 h-4 mr-2" aria-hidden="true" />
                )}
                {copiedSlug ? "Copied!" : "Share"}
              </Button>
            </div>
            {listData.description && (
              <p className="text-muted-foreground mt-3">{listData.description}</p>
            )}
          </CardHeader>
        </Card>
      </div>

      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="text-lg font-semibold" data-testid="text-items-heading">
          Items ({items.length})
        </h2>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => setIsImportDialogOpen(true)} 
            data-testid="button-import-amazon"
          >
            <Download className="w-4 h-4 mr-2" aria-hidden="true" />
            Import Amazon List
          </Button>
          <Dialog open={isAddDialogOpen || !!editingItem} onOpenChange={(open) => {
            if (!open) {
              setIsAddDialogOpen(false);
              setEditingItem(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-item">
                <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                Add Item
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Item" : "Add Item"}</DialogTitle>
              <DialogDescription>
                {editingItem ? "Update the item details." : "Add a new item to your wishlist."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="What do you want?" 
                          {...field} 
                          data-testid="input-item-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
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
                            data-testid="input-item-price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1" 
                            {...field} 
                            data-testid="input-item-quantity"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Link (optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://..." 
                          {...field} 
                          data-testid="input-item-link"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL (optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://..." 
                          {...field} 
                          data-testid="input-item-image"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-item-priority">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRIORITIES.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
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
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Color, size, or other preferences..." 
                          {...field} 
                          data-testid="input-item-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={addItemMutation.isPending || updateItemMutation.isPending}
                    data-testid="button-submit-item"
                  >
                    {addItemMutation.isPending || updateItemMutation.isPending 
                      ? "Saving..." 
                      : editingItem 
                        ? "Update Item" 
                        : "Add Item"
                    }
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <ImportAmazonPersonalListDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        listId={listId!}
        listName={listData.name}
      />

      {items.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-lg font-semibold mb-2">No items yet</h3>
            <p className="text-muted-foreground mb-4">
              Start adding items to your wishlist!
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-item">
              <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
              Add Your First Item
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item: any) => (
            <Card 
              key={item.id} 
              className="overflow-hidden hover-elevate"
              data-testid={`card-item-${item.id}`}
            >
              <div className="flex">
                {item.imageUrl && (
                  <div className="w-24 h-24 shrink-0">
                    <img 
                      src={item.imageUrl} 
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <CardContent className="flex-1 p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-medium truncate" data-testid={`text-item-name-${item.id}`}>
                        {item.name}
                      </h3>
                      {item.price && (
                        <p className="text-sm text-muted-foreground">
                          ${parseFloat(item.price).toFixed(2)}
                          {item.quantity > 1 && ` x ${item.quantity}`}
                        </p>
                      )}
                    </div>
                    {getPriorityBadge(item.priority)}
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 mt-auto">
                    {item.link && (
                      <a 
                        href={item.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        View
                      </a>
                    )}
                    <div className="flex gap-1 ml-auto">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => setEditingItem(item)}
                        data-testid={`button-edit-item-${item.id}`}
                      >
                        <Edit className="w-4 h-4" aria-hidden="true" />
                      </Button>
                      <Dialog open={deletingItemId === item.id} onOpenChange={(open) => !open && setDeletingItemId(null)}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => setDeletingItemId(item.id)}
                            data-testid={`button-delete-item-${item.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" aria-hidden="true" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Delete Item</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to delete "{item.name}"?
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setDeletingItemId(null)}>
                              Cancel
                            </Button>
                            <Button 
                              variant="destructive" 
                              onClick={() => deleteItemMutation.mutate(item.id)}
                              disabled={deleteItemMutation.isPending}
                              data-testid="button-confirm-delete-item"
                            >
                              {deleteItemMutation.isPending ? "Deleting..." : "Delete"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
