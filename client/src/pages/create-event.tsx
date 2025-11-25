import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useFamily } from "@/contexts/FamilyContext";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { EVENT_THEMES } from "@shared/themes";

const createEventSchema = z.object({
  name: z.string().min(1, "Event name is required").max(255),
  date: z.date().optional(),
  eventType: z.string().min(1, "Event type is required"),
});

type CreateEventFormData = z.infer<typeof createEventSchema>;

export default function CreateEvent() {
  const { toast } = useToast();
  const { selectedFamilyId } = useFamily();
  const [, setLocation] = useLocation();
  const [selectedTheme, setSelectedTheme] = useState<string>("holiday");

  const form = useForm<CreateEventFormData>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      name: "",
      eventType: "holiday",
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: CreateEventFormData) => {
      if (!selectedFamilyId) throw new Error("No family selected");
      
      const theme = EVENT_THEMES[data.eventType];
      return apiRequest("POST", `/api/families/${selectedFamilyId}/events`, {
        name: data.name,
        date: data.date?.toISOString() || null,
        eventType: data.eventType,
        themePrimary: theme.themePrimary,
        themeAccent: theme.themeAccent,
      });
    },
    onSuccess: () => {
      toast({
        title: "Event created!",
        description: "Your event has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/families", selectedFamilyId, "events"] });
      setLocation("/");
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to create event";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateEventFormData) => {
    createEventMutation.mutate(data);
  };

  if (!selectedFamilyId) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Please select a group first</p>
      </div>
    );
  }

  const currentTheme = EVENT_THEMES[selectedTheme];

  return (
    <div className="p-3 md:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Create Event</h1>
            <p className="text-sm text-muted-foreground">
              Create a new occasion for your group
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>
              Choose a theme and customize your event
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="eventType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Type</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedTheme(value);
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-event-type">
                            <SelectValue placeholder="Select event type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(EVENT_THEMES).map(([key, theme]) => (
                            <SelectItem key={key} value={key} data-testid={`event-type-${key}`}>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: theme.themePrimary }}
                                />
                                {theme.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Each type comes with pre-configured theme colors
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4 p-4 rounded-lg border" style={{
                  backgroundColor: `${currentTheme.themePrimary}10`,
                  borderColor: `${currentTheme.themePrimary}40`,
                }}>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-2">Theme Preview</p>
                    <div className="flex gap-2">
                      <div 
                        className="w-12 h-12 rounded-md border-2" 
                        style={{ 
                          backgroundColor: currentTheme.themePrimary,
                          borderColor: 'var(--border)',
                        }}
                      />
                      <div 
                        className="w-12 h-12 rounded-md border-2" 
                        style={{ 
                          backgroundColor: currentTheme.themeAccent,
                          borderColor: 'var(--border)',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Christmas 2024, Sarah's Birthday"
                          data-testid="input-event-name"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Give your event a memorable name
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Event Date (Optional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className="justify-start text-left font-normal"
                              data-testid="button-select-date"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        When does this event occur?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/")}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createEventMutation.isPending}
                    data-testid="button-create-event"
                  >
                    {createEventMutation.isPending ? "Creating..." : "Create Event"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
