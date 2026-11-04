-- Fail explicitly instead of rewriting or hiding existing cross-scope data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM collection_tags ct
    JOIN collections c ON c.id = ct.collection_id
    JOIN tags t ON t.id = ct.tag_id
    WHERE c.museum_id <> t.museum_id
  ) THEN RAISE EXCEPTION 'Cross-museum collection_tags rows exist'; END IF;

  IF EXISTS (
    SELECT 1 FROM museum_admins ma
    JOIN admin_tiers at ON at.id = ma.tier_id
    WHERE at.museum_id <> ma.museum_id
  ) THEN RAISE EXCEPTION 'Cross-museum museum_admins rows exist'; END IF;

  IF EXISTS (
    SELECT 1 FROM cart_items ci
    JOIN carts c ON c.id = ci.cart_id
    JOIN products p ON p.id = ci.product_id
    WHERE c.museum_id <> p.museum_id
  ) THEN RAISE EXCEPTION 'Cross-museum cart_items rows exist'; END IF;

  IF EXISTS (
    SELECT 1 FROM invoice_items ii
    JOIN invoices i ON i.id = ii.invoice_id
    LEFT JOIN products p ON p.id = ii.product_id
    LEFT JOIN ticket_types tt ON tt.id = ii.ticket_type_id
    WHERE i.museum_id <> COALESCE(p.museum_id, tt.museum_id)
       OR (i.kind = 'merchandise' AND (ii.product_id IS NULL OR ii.ticket_type_id IS NOT NULL))
       OR (i.kind = 'ticket' AND (ii.ticket_type_id IS NULL OR ii.product_id IS NOT NULL))
  ) THEN RAISE EXCEPTION 'Inconsistent invoice_items rows exist'; END IF;

  IF EXISTS (
    SELECT 1 FROM tickets t
    JOIN invoices i ON i.id = t.invoice_id
    JOIN invoice_items ii ON ii.id = t.invoice_item_id
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    WHERE t.museum_id <> i.museum_id OR t.user_id <> i.user_id
       OR t.invoice_id <> ii.invoice_id OR t.museum_id <> tt.museum_id
       OR ii.ticket_type_id IS DISTINCT FROM t.ticket_type_id
       OR i.kind <> 'ticket'
  ) THEN RAISE EXCEPTION 'Inconsistent tickets rows exist'; END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "collection_tags" DROP CONSTRAINT "collection_tags_collection_id_collections_id_fk";
--> statement-breakpoint
ALTER TABLE "collection_tags" DROP CONSTRAINT "collection_tags_tag_id_tags_id_fk";
--> statement-breakpoint
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_cart_id_carts_id_fk";
--> statement-breakpoint
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "museum_admins" DROP CONSTRAINT "museum_admins_tier_id_admin_tiers_id_fk";
--> statement-breakpoint
ALTER TABLE "invoice_items" DROP CONSTRAINT "invoice_items_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "invoice_items" DROP CONSTRAINT "invoice_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "invoice_items" DROP CONSTRAINT "invoice_items_ticket_type_id_ticket_types_id_fk";
--> statement-breakpoint
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_museum_id_museums_id_fk";
--> statement-breakpoint
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_ticket_type_id_ticket_types_id_fk";
--> statement-breakpoint
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_invoice_item_id_invoice_items_id_fk";
--> statement-breakpoint
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "collection_tags" ADD COLUMN "museum_id" uuid;
--> statement-breakpoint
UPDATE "collection_tags" ct SET "museum_id" = c."museum_id" FROM "collections" c WHERE c."id" = ct."collection_id";
--> statement-breakpoint
ALTER TABLE "collection_tags" ALTER COLUMN "museum_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "museum_id" uuid;
--> statement-breakpoint
UPDATE "cart_items" ci SET "museum_id" = c."museum_id" FROM "carts" c WHERE c."id" = ci."cart_id";
--> statement-breakpoint
ALTER TABLE "cart_items" ALTER COLUMN "museum_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "museum_id" uuid;
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "invoice_kind" "invoice_kind";
--> statement-breakpoint
UPDATE "invoice_items" ii SET "museum_id" = i."museum_id", "user_id" = i."user_id", "invoice_kind" = i."kind" FROM "invoices" i WHERE i."id" = ii."invoice_id";
--> statement-breakpoint
ALTER TABLE "invoice_items" ALTER COLUMN "museum_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoice_items" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoice_items" ALTER COLUMN "invoice_kind" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "collection_tags" ADD CONSTRAINT "collection_tags_collection_museum_fk" FOREIGN KEY ("collection_id","museum_id") REFERENCES "public"."collections"("id","museum_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "collection_tags" ADD CONSTRAINT "collection_tags_tag_museum_fk" FOREIGN KEY ("tag_id","museum_id") REFERENCES "public"."tags"("id","museum_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_museum_fk" FOREIGN KEY ("cart_id","museum_id") REFERENCES "public"."carts"("id","museum_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_museum_fk" FOREIGN KEY ("product_id","museum_id") REFERENCES "public"."products"("id","museum_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "museum_admins" ADD CONSTRAINT "museum_admins_tier_museum_fk" FOREIGN KEY ("tier_id","museum_id") REFERENCES "public"."admin_tiers"("id","museum_id") ON DELETE SET NULL ("tier_id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_scope_fk" FOREIGN KEY ("invoice_id","museum_id","user_id","invoice_kind") REFERENCES "public"."invoices"("id","museum_id","user_id","kind") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_museum_fk" FOREIGN KEY ("product_id","museum_id") REFERENCES "public"."products"("id","museum_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_ticket_type_museum_fk" FOREIGN KEY ("ticket_type_id","museum_id") REFERENCES "public"."ticket_types"("id","museum_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_kind_target_check" CHECK (("invoice_kind" = 'merchandise' AND "product_id" IS NOT NULL AND "ticket_type_id" IS NULL) OR ("invoice_kind" = 'ticket' AND "ticket_type_id" IS NOT NULL AND "product_id" IS NULL));
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_type_museum_fk" FOREIGN KEY ("ticket_type_id","museum_id") REFERENCES "public"."ticket_types"("id","museum_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_item_invoice_scope_fk" FOREIGN KEY ("invoice_item_id","invoice_id","museum_id","user_id") REFERENCES "public"."invoice_items"("id","invoice_id","museum_id","user_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_invoice_scope_fk" FOREIGN KEY ("invoice_id","museum_id","user_id") REFERENCES "public"."invoices"("id","museum_id","user_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
