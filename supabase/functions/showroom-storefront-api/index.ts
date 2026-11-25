import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
const sha = async (value: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    if (body.action !== "bootstrap") return json({ error: "Aksi tidak dikenal." }, 400);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      "unknown";
    const { data: allowed, error: rateError } = await db.rpc("showroom_take_rate_limit", {
      p_ip_hash: await sha(ip),
      p_max_hits: 60,
    });
    if (rateError) throw rateError;
    if (!allowed) return json({ error: "Terlalu banyak permintaan. Coba kembali sebentar lagi." }, 429);

    const [categories, products, images, variants, materials, dtfPrices, mockups, printingMethods, settings] =
      await Promise.all([
        db.from("showroom_categories").select("id,name,slug,description,image_path,sort_order,is_active").eq("is_active", true).order("sort_order"),
        db.from("showroom_products").select("id,category_id,name,slug,description,base_price,long_sleeve_price,material_id,model,weight_description,is_featured,is_best_seller,is_published,stock_mode,available_colors,size_surcharges,finishing_options").eq("is_published", true).order("created_at", { ascending: false }),
        db.from("showroom_product_images").select("id,product_id,storage_path,alt_text,sort_order,is_primary").order("sort_order"),
        db.from("showroom_product_variants").select("id,product_id,color,size,sku,price_adjustment,stock_quantity,is_available").eq("is_available", true),
        db.from("showroom_materials").select("id,name,description,surcharge,is_active").eq("is_active", true).order("name"),
        db.from("showroom_dtf_prices").select("id,size_code,label,width_cm,height_cm,price,is_active,sort_order").eq("is_active", true).order("sort_order"),
        db.from("showroom_garment_mockups").select("id,garment_type,color_name,color_hex,front_storage_path,back_storage_path,is_active").eq("is_active", true),
        db.from("showroom_printing_methods").select("id,name,description,pricing_type,base_price,is_active").eq("is_active", true),
        db.from("showroom_settings").select("key,value").in("key", ["brand", "instagram", "whatsapp", "payment"]),
      ]);

    for (const result of [categories, products, images, variants, materials, dtfPrices, mockups, printingMethods, settings]) {
      if (result.error) throw result.error;
    }

    const settingsMap = Object.fromEntries((settings.data || []).map((item) => [item.key, item.value]));
    return json({
      categories: categories.data || [],
      products: products.data || [],
      images: images.data || [],
      variants: variants.data || [],
      materials: materials.data || [],
      dtfPrices: dtfPrices.data || [],
      mockups: mockups.data || [],
      printingMethods: printingMethods.data || [],
      settings: settingsMap,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("showroom-storefront-api:", error);
    return json({ error: "Data showroom belum dapat dimuat." }, 500);
  }
});
