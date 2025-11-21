import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useFamily } from "@/contexts/FamilyContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Gift, Plus, Trash2, Edit, ExternalLink, AlertCircle, Circle, ArrowUp, Search, Upload } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { ObjectUploader } from "@/components/ObjectUploader";
import { UnifiedAddItemDialog } from "@/components/unified-add-item-dialog";
import type { UploadResult } from "@uppy/core";

const addItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(255),
  description: z.string().optional(),
  price: z.string().optional(),
  url: z.union([z.string().url("Must be a valid URL"), z.literal("")]).optional(),
  // Allow both absolute URLs and relative paths for object storage images
  imageUrl: z.union([z.string().min(1), z.literal("")]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  quantity: z.coerce.number().int().positive().optional(),
  category: z.string().optional(),
  itemType: z.enum(["product", "experience", "service", "membership", "other"]).optional(),
});

type AddItemFormData = z.infer<typeof addItemSchema>;

const PRIORITIES = [
  { value: "high", label: "Must-Have!", icon: ArrowUp },
  { value: "medium", label: "Would Love", icon: Circle },
  { value: "low", label: "Just a Thought", icon: AlertCircle },
] as const;

export default function Wishlist() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { selectedFamilyId } = useFamily();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>("");
  
  const form = useForm<AddItemFormData>({
    resolver: zodResolver(addItemSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      url: "",
      imageUrl: "",
      priority: "medium",
      quantity: 1,
      category: undefined,
      itemType: "product",
    },
  });
  
  // Use a ref to always get the current selectedFamilyId (prevents stale closure bugs)
  const selectedFamilyIdRef = useRef(selectedFamilyId);
  useEffect(() => {
    selectedFamilyIdRef.current = selectedFamilyId;
    // Clear editing state when family changes to prevent editing items from wrong family
    setEditingItem(null);
    setIsAddDialogOpen(false);
    form.reset();
  }, [selectedFamilyId, form]);

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

  const { data: items, isLoading } = useQuery({
    queryKey: ["/api/wishlist", selectedFamilyId],
    queryFn: async () => {
      if (!selectedFamilyId) return [];
      const response = await fetch(`/api/wishlist?familyId=${selectedFamilyId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch wishlist");
      }
      return response.json();
    },
    enabled: !!selectedFamilyId,
    retry: false,
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: AddItemFormData) => {
      return await apiRequest("POST", "/api/wishlist", {
        ...data,
        // Backend expects price as string or null, not number
        price: data.price || null,
        familyId: selectedFamilyIdRef.current,
      });
    },
    onSuccess: () => {
      const currentFamilyId = selectedFamilyIdRef.current;
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist", currentFamilyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats", currentFamilyId] });
      toast({
        title: "Success",
        description: "Item added to your wishlist!",
      });
      setIsAddDialogOpen(false);
      setUploadedImageUrl("");
      form.reset();
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
        description: error.message || "Failed to add item",
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AddItemFormData }) => {
      // Build payload, preserving existing values when form fields are empty
      const payload: any = {
        name: data.name,
        description: data.description || null,
        price: data.price || null,
        url: data.url || null,
        priority: data.priority,
        quantity: data.quantity,
        category: data.category || null,
        itemType: data.itemType,
      };
      
      // Only include imageUrl if it has a value (preserve existing if empty)
      if (data.imageUrl) {
        payload.imageUrl = data.imageUrl;
      }
      
      return await apiRequest("PATCH", `/api/wishlist/${id}`, payload);
    },
    onSuccess: async () => {
      const currentFamilyId = selectedFamilyIdRef.current;
      // Wait for refetch to complete before closing dialog
      await queryClient.invalidateQueries({ queryKey: ["/api/wishlist", currentFamilyId] });
      toast({
        title: "Success",
        description: "Item updated successfully!",
      });
      setEditingItem(null);
      setUploadedImageUrl("");
      form.reset();
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
        description: error.message || "Failed to update item",
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/wishlist/${id}`, {});
    },
    onSuccess: () => {
      const currentFamilyId = selectedFamilyIdRef.current;
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist", currentFamilyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats", currentFamilyId] });
      toast({
        title: "Success",
        description: "Item removed from wishlist",
      });
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
        description: error.message || "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddItemFormData) => {
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data });
    } else {
      addItemMutation.mutate(data);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    // Preserve the original imageUrl for comparison
    setUploadedImageUrl(item.imageUrl || "");
    form.reset({
      name: item.name,
      description: item.description || "",
      price: item.price || "",
      url: item.url || "",
      imageUrl: item.imageUrl || "",
      priority: item.priority || "medium",
      quantity: item.quantity || 1,
      category: item.category || undefined,
      itemType: item.itemType || "product",
    });
  };

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setEditingItem(null);
    setUploadedImageUrl("");
    form.reset();
  };

  const handleGetUploadParameters = async () => {
    const res = await apiRequest("POST", "/api/objects/upload", {});
    const data = await res.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFileUrl = result.successful[0].uploadURL;
      
      try {
        // Set ACL policy for the uploaded image
        const res = await apiRequest("PUT", "/api/wishlist-images", {
          imageUrl: uploadedFileUrl,
        });
        const data = await res.json();
        
        // Update form with the normalized object path
        setUploadedImageUrl(data.objectPath);
        form.setValue("imageUrl", data.objectPath);
        
        toast({
          title: "Success",
          description: "Image uploaded successfully!",
        });
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to process uploaded image",
          variant: "destructive",
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-12 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  const hasItems = items && items.length > 0;
  
  // Filter and sort by priority
  const filteredItems = items ? items
    .filter((item: any) => {
      if (!selectedPriority) return true;
      return item.priority === selectedPriority;
    })
    .sort((a: any, b: any) => {
      // Sort by priority: high -> medium -> low
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = a.priority || 'medium';
      const bPriority = b.priority || 'medium';
      return priorityOrder[aPriority as keyof typeof priorityOrder] - priorityOrder[bPriority as keyof typeof priorityOrder];
    }) : [];
  
  const hasFilteredItems = filteredItems && filteredItems.length > 0;

  return (
    <div className="p-4 md:p-8 lg:p-12 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl md:text-4xl font-semibold text-foreground">
            My Wishlist
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Add items you'd love to receive this Christmas
          </p>
        </div>
        <div className="flex gap-2 md:gap-3">
          <Button onClick={() => setIsAddDialogOpen(true)} className="flex-1 md:flex-initial" data-testid="button-add-manually">
            <Plus className="w-4 h-4 md:mr-2" />
            <span className="md:inline">Add Item</span>
          </Button>
        </div>
      </div>

      {/* Unified Add Item Dialog */}
      <UnifiedAddItemDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        familyId={selectedFamilyId || ""}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/wishlist", selectedFamilyId] });
          queryClient.invalidateQueries({ queryKey: ["/api/stats", selectedFamilyId] });
          toast({
            title: "Success",
            description: "Item added to your wishlist!",
          });
        }}
      />

      {/* Edit Item Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Item" : "Add New Item"}</DialogTitle>
              <DialogDescription>
                {editingItem ? "Update the item details below" : "Add a new item to your wishlist"}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Wireless Headphones" {...field} data-testid="input-item-name" />
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell your family more about this item..."
                          className="resize-none h-24"
                          {...field}
                          data-testid="input-item-description"
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
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="29.99" {...field} data-testid="input-item-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/product" {...field} data-testid="input-item-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <FormLabel>Item Image</FormLabel>
                  <div className="flex items-center gap-4">
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={10485760}
                      onGetUploadParameters={handleGetUploadParameters}
                      onComplete={handleUploadComplete}
                      buttonVariant="outline"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Image
                    </ObjectUploader>
                    {uploadedImageUrl && (
                      <span className="text-sm text-muted-foreground">Image uploaded</span>
                    )}
                  </div>
                  {uploadedImageUrl && (
                    <div className="relative w-32 h-32 border rounded-md overflow-hidden">
                      <img
                        src={uploadedImageUrl}
                        alt="Uploaded preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {editingItem?.imageUrl && !uploadedImageUrl && (
                    <div className="relative w-32 h-32 border rounded-md overflow-hidden">
                      <img
                        src={editingItem.imageUrl}
                        alt="Current item"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => <input type="hidden" {...field} data-testid="input-item-image-url" />}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="itemType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-item-type-edit">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="product" data-testid="option-product-edit">Product</SelectItem>
                          <SelectItem value="experience" data-testid="option-experience-edit">Experience</SelectItem>
                          <SelectItem value="service" data-testid="option-service-edit">Service</SelectItem>
                          <SelectItem value="membership" data-testid="option-membership-edit">Membership</SelectItem>
                          <SelectItem value="other" data-testid="option-other-edit">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-priority">
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="high">Must-Have!</SelectItem>
                            <SelectItem value="medium">Would Love</SelectItem>
                            <SelectItem value="low">Just a Thought</SelectItem>
                          </SelectContent>
                        </Select>
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
                          <Input type="number" min="1" placeholder="1" {...field} data-testid="input-item-quantity" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="toys">Toys</SelectItem>
                            <SelectItem value="clothes">Clothes</SelectItem>
                            <SelectItem value="electronics">Electronics</SelectItem>
                            <SelectItem value="books">Books</SelectItem>
                            <SelectItem value="home">Home</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={addItemMutation.isPending || updateItemMutation.isPending} data-testid="button-submit-item">
                    {addItemMutation.isPending || updateItemMutation.isPending ? "Saving..." : editingItem ? "Update Item" : "Add to Wishlist"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCloseDialog} data-testid="button-cancel-item">
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

      {hasItems && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={selectedPriority === null ? "default" : "outline"}
            className="cursor-pointer hover-elevate active-elevate-2"
            onClick={() => setSelectedPriority(null)}
            data-testid="filter-all"
          >
            All Priorities
          </Badge>
          {PRIORITIES.map((priority) => {
            const Icon = priority.icon;
            return (
              <Badge
                key={priority.value}
                variant={selectedPriority === priority.value ? (priority.value === "high" ? "destructive" : "default") : "outline"}
                className="cursor-pointer hover-elevate active-elevate-2"
                onClick={() => setSelectedPriority(priority.value)}
                data-testid={`filter-${priority.value}`}
              >
                <Icon className="w-3 h-3 mr-1" />
                {priority.label}
              </Badge>
            );
          })}
        </div>
      )}

      {!hasItems ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Gift className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-xl mb-2 text-foreground">Your Wishlist is Empty</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Start adding items you'd love to receive. Search for products or add them manually.
            </p>
            <div className="flex gap-3">
              <Link href="/search">
                <Button data-testid="button-search-first-gift">
                  <Search className="w-4 h-4 mr-2" />
                  Search for Your First Gift
                </Button>
              </Link>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-item">
                <Plus className="w-4 h-4 mr-2" />
                Manually Add
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !hasFilteredItems ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Gift className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-xl mb-2 text-foreground">No items with this priority</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Try selecting a different priority filter or add new items.
            </p>
            <Button onClick={() => setSelectedPriority(null)} variant="outline" data-testid="button-clear-filter">
              Show All Items
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filteredItems.map((item: any) => (
            <Card key={item.id} className="overflow-hidden hover-elevate" data-testid={`wishlist-item-${item.id}`}>
              <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Gift className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}
              </div>
              <CardContent className="p-4 space-y-3">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-foreground line-clamp-2 flex-1">{item.name}</h3>
                    {item.priority && (
                      <Badge 
                        variant={item.priority === "high" ? "destructive" : item.priority === "medium" ? "default" : "secondary"} 
                        className="shrink-0"
                        data-testid={`badge-priority-${item.id}`}
                      >
                        {item.priority === "high" && <ArrowUp className="w-3 h-3 mr-1" />}
                        {item.priority === "medium" && <Circle className="w-3 h-3 mr-1" />}
                        {item.priority === "low" && <AlertCircle className="w-3 h-3 mr-1" />}
                        {item.priority === "high" ? "Must-Have!" : item.priority === "medium" ? "Would Love" : "Just a Thought"}
                      </Badge>
                    )}
                  </div>
                  {item.price && (
                    <p className="text-lg font-bold text-primary">${parseFloat(item.price).toFixed(2)}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {item.category && (
                      <Badge variant="outline" data-testid={`badge-category-${item.id}`}>
                        {item.category}
                      </Badge>
                    )}
                    {item.quantity && item.quantity !== 1 && (
                      <Badge variant="outline" data-testid={`badge-quantity-${item.id}`}>
                        Qty: {item.quantity}
                      </Badge>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3 mt-2">{item.description}</p>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  {item.url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(item.url, '_blank')}
                      data-testid={`button-view-${item.id}`}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(item)}
                    data-testid={`button-edit-${item.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteItemMutation.mutate(item.id)}
                    disabled={deleteItemMutation.isPending}
                    data-testid={`button-delete-${item.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
