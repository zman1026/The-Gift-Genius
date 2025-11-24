import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration: Assign all wishlist items without eventId to their family's default/first active event
 * 
 * This ensures all existing wishlist items are associated with an event,
 * making the eventId effectively required going forward.
 */
export async function assignItemsToEvents() {
  console.log("Starting migration: Assigning items to events...");

  try {
    // Find all wishlist items without an eventId
    const itemsWithoutEvent = await db.execute(sql`
      SELECT id, family_id 
      FROM wishlist_items 
      WHERE event_id IS NULL
    `);

    if (itemsWithoutEvent.rows.length === 0) {
      console.log("No items without eventId found. Migration complete.");
      return { success: true, itemsUpdated: 0 };
    }

    console.log(`Found ${itemsWithoutEvent.rows.length} items without eventId`);

    // Group items by familyId to batch updates
    const itemsByFamily = new Map<string, string[]>();
    for (const row of itemsWithoutEvent.rows) {
      const familyId = row.family_id as string;
      const itemId = row.id as string;
      
      if (!itemsByFamily.has(familyId)) {
        itemsByFamily.set(familyId, []);
      }
      itemsByFamily.get(familyId)!.push(itemId);
    }

    console.log(`Processing ${itemsByFamily.size} families...`);

    let totalUpdated = 0;
    
    // For each family, find the first active event and assign all items to it
    for (const [familyId, itemIds] of itemsByFamily.entries()) {
      // Get the first active event for this family (ordered by createdAt)
      const familyEvent = await db.execute(sql`
        SELECT id 
        FROM events 
        WHERE family_id = ${familyId} 
          AND is_active = true
        ORDER BY created_at ASC
        LIMIT 1
      `);

      if (familyEvent.rows.length === 0) {
        console.warn(`No active event found for family ${familyId}. Skipping ${itemIds.length} items.`);
        continue;
      }

      const eventId = familyEvent.rows[0].id as string;

      // Update all items for this family to use this event
      await db.execute(sql`
        UPDATE wishlist_items
        SET event_id = ${eventId}
        WHERE id = ANY(${itemIds})
      `);

      totalUpdated += itemIds.length;
      console.log(`Assigned ${itemIds.length} items to event ${eventId} for family ${familyId}`);
    }

    console.log(`Migration complete! Updated ${totalUpdated} items.`);
    return { success: true, itemsUpdated: totalUpdated };

  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// Run migration if executed directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] === __filename) {
  assignItemsToEvents()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
