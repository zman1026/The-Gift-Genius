import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useFamily } from "@/contexts/FamilyContext";
import { useLocation, useParams } from "wouter";
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
import { CalendarIcon, ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { EVENT_THEMES } from "@shared/themes";
import type { Event } from "@shared/schema";

const editEventSchema = z.object({
  name: z.string().min(1, "Event name is required").max(255),
  date: z.date().optional().nullable(),
  eventType: z.string().min(1, "Event type is required"),
});

type EditEventFormData = z.infer<typeof editEventSchema>;

export default function EditEvent() {
  const { toast } = useToast();
  const { selectedFamilyId } = useFamily();
  const [, setLocation] = useLocation();
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const [selectedTheme, setSelectedTheme] = useState<string>("holiday");

  const { data: event, isLoading: eventLoading } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
  });

  const form = useForm<EditEventFormData>({
    resolver: zodResolver(editEventSchema),
    defaultValues: {
      name: "",
      eventType: "holiday",
      date: null,
    },
  });

  useEffect(() => {
    if (event) {
      form.reset({
        name: event.name,
        eventType: event.eventType,
        date: event.date ? new Date(event.date) : null,
      });
      setSelectedTheme(event.eventType);
    }
  }, [event, form]);

  const updateEventMutation = useMutation({
    mutationFn: async (data: EditEventFormData) => {
      if (!eventId) throw new Error("No event ID");
      
      const theme = EVENT_THEMES[data.eventType];
      const themePrimary = theme?.themePrimary || event?.themePrimary || "#DC2626";
      const themeAccent = theme?.themeAccent || event?.themeAccent || "#15803D";
      
      return apiRequest("PUT", `/api/events/${eventId}`, {
        name: data.name,
        date: data.date?.toISOString() || null,
        eventType: data.eventType,
        themePrimary,
        themeAccent,
      });
    },
    onSuccess: () => {
      toast({
        title: "Event updated!",
        description: "Your event has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/families", selectedFamilyId, "events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      setLocation("/");
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to update event";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditEventFormData) => {
    updateEventMutation.mutate(data);
  };

  if (eventLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Event not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => setLocation("/")}
          data-testid="button-back-home"
        >
          Go Back
        </Button>
      </div>
    );
  }

  const currentTheme = EVENT_THEMES[selectedTheme] || EVENT_THEMES.holiday;

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
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit Event</h1>
            <p className="text-sm text-muted-foreground">
              Update your event details
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>
              Modify the event name, type, or date
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
                        value={field.value}
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
                                  aria-hidden="true"
                                />
                                {theme.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Changing the type will update the theme colors
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
                        aria-hidden="true"
                      />
                      <div 
                        className="w-12 h-12 rounded-md border-2" 
                        style={{ 
                          backgroundColor: currentTheme.themeAccent,
                          borderColor: 'var(--border)',
                        }}
                        aria-hidden="true"
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
                              <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value || undefined}
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
                    disabled={updateEventMutation.isPending}
                    data-testid="button-save-event"
                  >
                    {updateEventMutation.isPending ? "Saving..." : "Save Changes"}
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
