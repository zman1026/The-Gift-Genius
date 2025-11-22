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
import { Checkbox } from "@/components/ui/checkbox";
import { Gift, Plus, Trash2, Edit, ExternalLink, AlertCircle, Circle, ArrowUp, Search, Upload, SlidersHorizontal, X, CheckSquare, Square } from "lucide-react";
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
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>("");
  
  // Sort and filter state
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [itemTypeFilter, setItemTypeFilter] = useState<string>("all");
  
  // Bulk selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
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
    // Clear selected items to prevent stale IDs when switching families
    setSelectedItems(new Set());
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
    queryKey: ["/api/wishlist", selectedFamilyId, sortBy, sortOrder, priorityFilter, itemTypeFilter],
    queryFn: async () => {
      if (!selectedFamilyId) return [];
      
      // Build query string with filters
      const params = new URLSearchParams({ familyId: selectedFamilyId });
      if (sortBy) params.append("sort", sortBy);
      if (sortOrder) params.append("order", sortOrder);
      if (priorityFilter && priorityFilter !== "all") params.append("priority", priorityFilter);
      if (itemTypeFilter && itemTypeFilter !== "all") params.append("itemType", itemTypeFilter);
      
      const response = await fetch(`/api/wishlist?${params.toString()}`, {
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

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async ({ itemIds, count, familyId }: { itemIds: string[]; count: number; familyId: string }) => {
      return { response: await apiRequest("POST", "/api/wishlist/bulk-delete", { itemIds, familyId }), count };
    },
    onSuccess: (data) => {
      const currentFamilyId = selectedFamilyIdRef.current;
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist", currentFamilyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats", currentFamilyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities", currentFamilyId] });
      setSelectedItems(new Set());
      toast({
        title: "Success",
        description: `${data.count} item(s) deleted`,
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
        description: error.message || "Failed to delete items",
        variant: "destructive",
      });
    },
  });

  // Bulk update priority mutation
  const bulkUpdatePriorityMutation = useMutation({
    mutationFn: async ({ itemIds, priority, count, familyId }: { itemIds: string[]; priority: string; count: number; familyId: string }) => {
      return { response: await apiRequest("PATCH", "/api/wishlist/bulk-priority", { itemIds, priority, familyId }), count };
    },
    onSuccess: (data) => {
      const currentFamilyId = selectedFamilyIdRef.current;
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist", currentFamilyId] });
      setSelectedItems(new Set());
      toast({
        title: "Success",
        description: `${data.count} item(s) updated`,
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
        description: error.message || "Failed to update priorities",
        variant: "destructive",
      });
    },
  });

  // Bulk selection helper functions
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const selectAllItems = () => {
    if (items && items.length > 0) {
      setSelectedItems(new Set(items.map((item: any) => item.id)));
    }
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedItems.size === 0 || !selectedFamilyId) return;
    const count = selectedItems.size;
    bulkDeleteMutation.mutate({ itemIds: Array.from(selectedItems), count, familyId: selectedFamilyId });
  };

  const handleBulkUpdatePriority = (priority: string) => {
    if (selectedItems.size === 0 || !selectedFamilyId) return;
    const count = selectedItems.size;
    bulkUpdatePriorityMutation.mutate({ itemIds: Array.from(selectedItems), priority, count, familyId: selectedFamilyId });
  };

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {[...Array(12)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const hasItems = items && items.length > 0;
  
  // Check if any filters are active
  const hasActiveFilters = priorityFilter !== "all" || itemTypeFilter !== "all";
  
  // Clear all filters (but keep sort preferences)
  const clearFilters = () => {
    setPriorityFilter("all");
    setItemTypeFilter("all");
  };

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
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-medium text-sm">Sort & Filter</h3>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="ml-auto h-7 text-xs"
                  data-testid="button-clear-filters"
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Sort By */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Sort By</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-9" data-testid="select-sort-by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">Date Added</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="price">Price</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Sort Order */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Order</label>
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger className="h-9" data-testid="select-sort-order">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Priority Filter */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Priority</label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-9" data-testid="select-filter-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="high">Must-Have!</SelectItem>
                    <SelectItem value="medium">Would Love</SelectItem>
                    <SelectItem value="low">Just a Thought</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Item Type Filter */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Type</label>
                <Select value={itemTypeFilter} onValueChange={setItemTypeFilter}>
                  <SelectTrigger className="h-9" data-testid="select-filter-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="experience">Experience</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="membership">Membership</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
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
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Gift className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-xl mb-2 text-foreground">No items match your filters</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Try adjusting your filters or add new items.
            </p>
            <Button onClick={clearFilters} variant="outline" data-testid="button-clear-filter">
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Bulk action toolbar */}
          {selectedItems.size > 0 && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">
                      {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllItems}
                      data-testid="button-select-all"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelection}
                      data-testid="button-clear-selection"
                    >
                      Clear
                    </Button>
                    <Select onValueChange={handleBulkUpdatePriority}>
                      <SelectTrigger className="w-36 h-9" data-testid="select-bulk-priority">
                        <SelectValue placeholder="Set Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">Must-Have!</SelectItem>
                        <SelectItem value="medium">Would Love</SelectItem>
                        <SelectItem value="low">Just a Thought</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={bulkDeleteMutation.isPending}
                      data-testid="button-bulk-delete"
                    >
                      <Trash2 className="w-3 h-3 mr-2" />
                      Delete {selectedItems.size}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {items.map((item: any) => (
            <Card key={item.id} className="flex flex-col h-full overflow-hidden hover-elevate" data-testid={`wishlist-item-${item.id}`}>
              <div className="aspect-square bg-muted relative overflow-hidden">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Gift className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
                {/* Selection checkbox */}
                <div className="absolute top-2 left-2 z-10">
                  <Checkbox
                    checked={selectedItems.has(item.id)}
                    onCheckedChange={() => toggleItemSelection(item.id)}
                    className="bg-background/90 backdrop-blur-sm border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    data-testid={`checkbox-select-${item.id}`}
                  />
                </div>
                {item.priority && (
                  <Badge 
                    variant={item.priority === "high" ? "destructive" : item.priority === "medium" ? "default" : "secondary"} 
                    className="absolute top-2 right-2 text-xs h-5"
                    data-testid={`badge-priority-${item.id}`}
                  >
                    {item.priority === "high" && <ArrowUp className="w-2.5 h-2.5 mr-0.5" />}
                    {item.priority === "medium" && <Circle className="w-2.5 h-2.5 mr-0.5" />}
                    {item.priority === "low" && <AlertCircle className="w-2.5 h-2.5 mr-0.5" />}
                    {item.priority === "high" ? "Must-Have!" : item.priority === "medium" ? "Would Love" : "Just a Thought"}
                  </Badge>
                )}
              </div>
              <CardContent className="flex flex-col gap-2 grow p-3">
                <div className="flex-1 min-h-0">
                  <h3 className="font-semibold text-sm text-foreground line-clamp-2">{item.name}</h3>
                  {item.price && (
                    <p className="text-base font-bold text-primary">${parseFloat(item.price).toFixed(2)}</p>
                  )}
                  {item.quantity && item.quantity !== 1 && (
                    <Badge variant="outline" className="text-xs h-5 mt-1" data-testid={`badge-quantity-${item.id}`}>
                      Qty: {item.quantity}
                    </Badge>
                  )}
                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.description}</p>
                  )}
                </div>
                <div className="flex gap-1.5 mt-auto">
                  {item.url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(item.url, '_blank')}
                      data-testid={`button-view-${item.id}`}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      View
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleEdit(item)}
                    data-testid={`button-edit-${item.id}`}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => deleteItemMutation.mutate(item.id)}
                    disabled={deleteItemMutation.isPending}
                    data-testid={`button-delete-${item.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
