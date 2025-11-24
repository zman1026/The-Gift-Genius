import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useFamily } from "@/contexts/FamilyContext";
import { useEvent } from "@/contexts/EventContext";
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
import { Gift, Plus, Trash2, Edit, ExternalLink, AlertCircle, Circle, ArrowUp, Search, Upload, SlidersHorizontal, X, CheckSquare, Square, Filter } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { ObjectUploader } from "@/components/ObjectUploader";
import { UnifiedAddItemDialog } from "@/components/unified-add-item-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  const { selectedEventId } = useEvent();
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
  
  // Filter dialog state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Detail view state
  const [viewingItem, setViewingItem] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Ref to avoid stale closure in mutation onSuccess
  const viewingItemRef = useRef<any>(null);
  
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
  
  // Keep viewingItemRef in sync to avoid stale closure in mutation onSuccess
  useEffect(() => {
    viewingItemRef.current = viewingItem;
  }, [viewingItem]);

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
    queryKey: ["/api/wishlist", selectedFamilyId, selectedEventId, sortBy, sortOrder, priorityFilter, itemTypeFilter],
    queryFn: async () => {
      if (!selectedFamilyId || !selectedEventId) return [];
      
      // Build query string with filters
      const params = new URLSearchParams({ 
        familyId: selectedFamilyId,
        eventId: selectedEventId,
      });
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
    enabled: !!selectedFamilyId && !!selectedEventId,
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
    onSuccess: async (updatedItem) => {
      const currentFamilyId = selectedFamilyIdRef.current;
      
      toast({
        title: "Success",
        description: "Item updated successfully!",
      });
      
      // Use ref to avoid stale closure - check if we're viewing this item in detail view
      if (viewingItemRef.current) {
        // Update the viewing item with the fresh data from the server
        setViewingItem(updatedItem);
        setIsEditMode(false);
        setUploadedImageUrl("");
      } else {
        // Otherwise, we're in the old edit dialog - close it
        setEditingItem(null);
        setUploadedImageUrl("");
        form.reset();
      }
      
      // Invalidate queries after UI update to refresh the list
      await queryClient.invalidateQueries({ queryKey: ["/api/wishlist", currentFamilyId] });
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
    mutationFn: async ({ itemIds, count, familyId, eventId }: { itemIds: string[]; count: number; familyId: string; eventId: string }) => {
      return { response: await apiRequest("POST", "/api/wishlist/bulk-delete", { itemIds, familyId, eventId }), count };
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
    mutationFn: async ({ itemIds, priority, count, familyId, eventId }: { itemIds: string[]; priority: string; count: number; familyId: string; eventId: string }) => {
      return { response: await apiRequest("PATCH", "/api/wishlist/bulk-priority", { itemIds, priority, familyId, eventId }), count };
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
    if (selectedItems.size === 0 || !selectedFamilyId || !selectedEventId) return;
    const count = selectedItems.size;
    bulkDeleteMutation.mutate({ itemIds: Array.from(selectedItems), count, familyId: selectedFamilyId, eventId: selectedEventId });
  };

  const handleBulkUpdatePriority = (priority: string) => {
    if (selectedItems.size === 0 || !selectedFamilyId || !selectedEventId) return;
    const count = selectedItems.size;
    bulkUpdatePriorityMutation.mutate({ itemIds: Array.from(selectedItems), priority, count, familyId: selectedFamilyId, eventId: selectedEventId });
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
  
  const handleCardClick = (item: any, e: React.MouseEvent) => {
    // Don't open detail view if clicking on checkbox
    const target = e.target as HTMLElement;
    if (target.closest('button[role="checkbox"]')) {
      return;
    }
    setViewingItem(item);
    setIsEditMode(false);
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
  
  const handleCloseDetailView = () => {
    setViewingItem(null);
    setIsEditMode(false);
    setShowDeleteConfirm(false);
    setUploadedImageUrl("");
    form.reset();
  };
  
  const handleToggleEditMode = () => {
    setIsEditMode(!isEditMode);
  };
  
  const handleSaveEdit = (data: AddItemFormData) => {
    if (!viewingItem) return;
    updateItemMutation.mutate({ id: viewingItem.id, data });
  };
  
  const handleDeleteFromDetail = () => {
    if (!viewingItem) return;
    deleteItemMutation.mutate(viewingItem.id, {
      onSuccess: () => {
        handleCloseDetailView();
      }
    });
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
  
  // Check if sort/filter settings differ from defaults
  const hasActiveSettings = 
    sortBy !== "createdAt" || 
    sortOrder !== "desc" || 
    priorityFilter !== "all" || 
    itemTypeFilter !== "all";
  
  // Clear all filters (but keep sort preferences)
  const clearFilters = () => {
    setPriorityFilter("all");
    setItemTypeFilter("all");
  };
  
  // Reset all sort and filter settings to defaults
  const resetAllSettings = () => {
    setSortBy("createdAt");
    setSortOrder("desc");
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
        <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-manually">
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
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
        <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" data-testid="button-open-filters">
              <Filter className="w-4 h-4 mr-2" />
              Filter & Sort
              {hasActiveSettings && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  Active
                </Badge>
              )}
            </Button>
          </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh]">
              <SheetHeader>
                <SheetTitle>Sort & Filter</SheetTitle>
                <SheetDescription>
                  Customize how your wishlist items are organized
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                {/* Sort By */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Sort By</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger data-testid="select-sort-by">
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
                <div className="space-y-3">
                  <label className="text-sm font-medium">Order</label>
                  <Select value={sortOrder} onValueChange={setSortOrder}>
                    <SelectTrigger data-testid="select-sort-order">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Priority Filter */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger data-testid="select-filter-priority">
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
                <div className="space-y-3">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={itemTypeFilter} onValueChange={setItemTypeFilter}>
                    <SelectTrigger data-testid="select-filter-type">
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
                
                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  {hasActiveSettings && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        resetAllSettings();
                      }}
                      className="flex-1"
                      data-testid="button-reset-all"
                    >
                      Reset All
                    </Button>
                  )}
                  <Button
                    onClick={() => setIsFilterOpen(false)}
                    className="flex-1"
                    data-testid="button-done-filters"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </SheetContent>
        </Sheet>
      )}

      {/* Item Detail Sheet */}
      <Sheet open={!!viewingItem} onOpenChange={(open) => { if (!open) handleCloseDetailView(); }}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
          {viewingItem && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle>{isEditMode ? "Edit Item" : viewingItem.name}</SheetTitle>
                <SheetDescription>
                  {isEditMode ? "Update the item details below" : "View and manage your wishlist item"}
                </SheetDescription>
              </SheetHeader>
              
              {!isEditMode ? (
                <div className="space-y-6">
                  {/* Image */}
                  {viewingItem.imageUrl && (
                    <div className="w-full aspect-video rounded-md overflow-hidden bg-muted">
                      <img
                        src={viewingItem.imageUrl}
                        alt={viewingItem.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  
                  {/* Details Grid */}
                  <div className="space-y-4">
                    {viewingItem.price && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Price</p>
                        <p className="text-2xl font-bold text-primary">${parseFloat(viewingItem.price).toFixed(2)}</p>
                      </div>
                    )}
                    
                    {viewingItem.description && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Description</p>
                        <p className="text-base text-foreground whitespace-pre-wrap">{viewingItem.description}</p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      {viewingItem.priority && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Priority</p>
                          <Badge variant={viewingItem.priority === "high" ? "destructive" : viewingItem.priority === "medium" ? "default" : "secondary"}>
                            {viewingItem.priority === "high" && <ArrowUp className="w-3 h-3 mr-1" />}
                            {viewingItem.priority === "medium" && <Circle className="w-3 h-3 mr-1" />}
                            {viewingItem.priority === "low" && <AlertCircle className="w-3 h-3 mr-1" />}
                            {viewingItem.priority === "high" ? "Must-Have!" : viewingItem.priority === "medium" ? "Would Love" : "Just a Thought"}
                          </Badge>
                        </div>
                      )}
                      
                      {viewingItem.quantity && viewingItem.quantity !== 1 && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Quantity</p>
                          <p className="text-base text-foreground">{viewingItem.quantity}</p>
                        </div>
                      )}
                    </div>
                    
                    {viewingItem.itemType && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Type</p>
                        <Badge variant="outline" className="capitalize">
                          {viewingItem.itemType}
                        </Badge>
                      </div>
                    )}
                    
                    {viewingItem.category && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Category</p>
                        <p className="text-base text-foreground">{viewingItem.category}</p>
                      </div>
                    )}
                    
                    {viewingItem.url && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Product Link</p>
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => window.open(viewingItem.url, '_blank')}
                          data-testid="button-view-product-link"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View Product
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={handleToggleEditMode}
                      data-testid="button-edit-item-detail"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    {!showDeleteConfirm ? (
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => setShowDeleteConfirm(true)}
                        data-testid="button-delete-item-detail"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    ) : (
                      <div className="flex-1 flex gap-2">
                        <Button
                          variant="destructive"
                          className="flex-1"
                          onClick={handleDeleteFromDetail}
                          disabled={deleteItemMutation.isPending}
                          data-testid="button-confirm-delete"
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowDeleteConfirm(false)}
                          data-testid="button-cancel-delete"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSaveEdit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Wireless Headphones" {...field} data-testid="input-item-name-detail" />
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
                              data-testid="input-item-description-detail"
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
                            <Input type="number" step="0.01" placeholder="29.99" {...field} data-testid="input-item-price-detail" />
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
                            <Input placeholder="https://example.com/product" {...field} data-testid="input-item-url-detail" />
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
                      <FormField
                        control={form.control}
                        name="imageUrl"
                        render={({ field }) => <input type="hidden" {...field} data-testid="input-item-image-url-detail" />}
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
                              <SelectTrigger data-testid="select-item-type-detail">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="product">Product</SelectItem>
                              <SelectItem value="experience">Experience</SelectItem>
                              <SelectItem value="service">Service</SelectItem>
                              <SelectItem value="membership">Membership</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
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
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-priority-detail">
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PRIORITIES.map((priority) => (
                                <SelectItem key={priority.value} value={priority.value}>
                                  {priority.label}
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
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" step="1" placeholder="1" {...field} data-testid="input-item-quantity-detail" />
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
                          <FormLabel>Category (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Electronics" {...field} data-testid="input-item-category-detail" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setIsEditMode(false)}
                        data-testid="button-cancel-edit-detail"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={updateItemMutation.isPending}
                        data-testid="button-save-edit-detail"
                      >
                        Save Changes
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {!selectedEventId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 md:py-24 text-center">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
              <AlertCircle className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-xl mb-2 text-foreground">No Event Selected</h3>
            <p className="text-muted-foreground mb-6 max-w-md px-4">
              Please select an event from the dropdown above to view and manage wishlist items for that occasion.
            </p>
          </CardContent>
        </Card>
      ) : !hasItems ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 md:py-24 text-center">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Gift className="w-12 h-12 text-primary" />
            </div>
            <h3 className="font-semibold text-xl mb-2 text-foreground">Your Wishlist is Empty</h3>
            <p className="text-muted-foreground mb-6 max-w-md px-4">
              Start adding items you'd love to receive. Click "Add Item" above to get started.
            </p>
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
            <Card 
              key={item.id} 
              className="flex flex-col h-full overflow-hidden hover-elevate cursor-pointer" 
              onClick={(e) => handleCardClick(item, e)}
              data-testid={`wishlist-item-${item.id}`}
            >
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
              </CardContent>
            </Card>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
