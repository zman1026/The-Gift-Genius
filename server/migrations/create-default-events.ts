import { db } from "../db";
import { families, events, wishlistItems, activityLogs } from "@shared/schema";
import { eq, isNull } from "drizzle-orm";
import { EVENT_THEMES } from "@shared/themes";

/**
 * Migration script to create default events for existing families
 * and link existing wishlist items and activity logs to those events
 */
async function migrateToEvents() {
  console.log("Starting event migration...");

  try {
    // Get all families
    const allFamilies = await db.select().from(families);
    console.log(`Found ${allFamilies.length} families`);

    for (const family of allFamilies) {
      // Check if family already has any events
      const existingEvents = await db
        .select()
        .from(events)
        .where(eq(events.familyId, family.id));

      if (existingEvents.length > 0) {
        console.log(`Family "${family.name}" already has ${existingEvents.length} event(s), skipping...`);
        continue;
      }

      // Create a default "Holiday 2024" event for this family
      const holidayTheme = EVENT_THEMES.holiday;
      const [defaultEvent] = await db.insert(events).values({
        familyId: family.id,
        name: "Holiday 2024",
        eventType: "holiday",
        themePrimary: holidayTheme.themePrimary,
        themeAccent: holidayTheme.themeAccent,
        isActive: true,
        date: new Date("2024-12-25"), // Default to Christmas 2024
      }).returning();

      console.log(`Created default event "${defaultEvent.name}" for family "${family.name}"`);

      // Link all existing wishlist items for this family to the new event
      const updatedItems = await db
        .update(wishlistItems)
        .set({ eventId: defaultEvent.id })
        .where(
          eq(wishlistItems.familyId, family.id)
        )
        .returning();

      console.log(`Linked ${updatedItems.length} wishlist items to event "${defaultEvent.name}"`);

      // Link all existing activity logs for this family to the new event
      const updatedLogs = await db
        .update(activityLogs)
        .set({ eventId: defaultEvent.id })
        .where(
          eq(activityLogs.familyId, family.id)
        )
        .returning();

      console.log(`Linked ${updatedLogs.length} activity logs to event "${defaultEvent.name}"`);
    }

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// Run migration if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  migrateToEvents()
    .then(() => {
      console.log("Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}

export { migrateToEvents };
