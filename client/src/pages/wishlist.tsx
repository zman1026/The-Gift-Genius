import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Gift, Plus, Trash2, Edit, ExternalLink } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const addItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(255),
  description: z.string().optional(),
  price: z.string().optional(),
  url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type AddItemFormData = z.infer<typeof addItemSchema>;

export default function Wishlist() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const form = useForm<AddItemFormData>({
    resolver: zodResolver(addItemSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      url: "",
      imageUrl: "",
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

  const { data: items, isLoading } = useQuery({
    queryKey: ["/api/wishlist"],
    retry: false,
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: AddItemFormData) => {
      return await apiRequest("POST", "/api/wishlist", {
        ...data,
        price: data.price ? parseFloat(data.price) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "Item added to your wishlist!",
      });
      setIsAddDialogOpen(false);
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
      return await apiRequest("PATCH", `/api/wishlist/${id}`, {
        ...data,
        price: data.price ? parseFloat(data.price) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
      toast({
        title: "Success",
        description: "Item updated successfully!",
      });
      setEditingItem(null);
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
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
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
    form.reset({
      name: item.name,
      description: item.description || "",
      price: item.price || "",
      url: item.url || "",
      imageUrl: item.imageUrl || "",
    });
  };

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setEditingItem(null);
    form.reset();
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-12 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  const hasItems = items && items.length > 0;

  return (
    <div className="p-6 md:p-8 lg:p-12 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground">
            My Wishlist
          </h1>
          <p className="text-muted-foreground mt-1">
            Add items you'd love to receive this Christmas
          </p>
        </div>
        <Dialog open={isAddDialogOpen || !!editingItem} onOpenChange={(open) => !open && handleCloseDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-item">
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Item" : "Add New Item"}</DialogTitle>
              <DialogDescription>
                {editingItem ? "Update the item details below" : "Add a new item to your wishlist manually"}
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
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/image.jpg" {...field} data-testid="input-item-image" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
      </div>

      {!hasItems ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Gift className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-xl mb-2 text-foreground">Your Wishlist is Empty</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Start adding items you'd love to receive. You can add them manually or search for products.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-item">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Item
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item: any) => (
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
                  <h3 className="font-semibold text-foreground line-clamp-2 mb-1">{item.name}</h3>
                  {item.price && (
                    <p className="text-lg font-bold text-primary">${parseFloat(item.price).toFixed(2)}</p>
                  )}
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
