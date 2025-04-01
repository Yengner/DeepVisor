import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import "https://deno.land/std@0.191.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { PassGenerator } from "https://deno.land/x/passkit@v1.2.3/mod.ts";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("DATABASE_URL")!,
    Deno.env.get("SERVICE_ROLE_KEY")!
  );

  try {
    const { businessName, discountDetails, discountUrl, passId } = await req.json();

    if (!businessName || !discountDetails || !discountUrl || !passId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    // Fetch Certificates from Supabase Storage
    async function fetchCert(certName: string): Promise<Uint8Array> {
      const { data, error } = await supabase.storage.from("certs").download(certName);
      if (error) throw new Error(`Failed to fetch certificate: ${certName}`);
      return new Uint8Array(await data.arrayBuffer());
    }

    const wwdrCert = await fetchCert("wwdr.pem");
    const signerCert = await fetchCert("signerCert.pem");
    const signerKey = await fetchCert("signerKey.pem");
    const signerPassphrase = "Ernesto4754140$"

    // Generate Apple Wallet Pass
    const pass = new PassGenerator({
      passTypeIdentifier: "pass.com.deeppass.deepvisor",
      teamIdentifier: "B97WPWSV26", 
      organizationName: businessName,
      description: discountDetails,
      serialNumber: passId,
      barcode: {
        message: discountUrl,
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1"
      },
      backgroundColor: "rgb(0, 122, 255)"
    });

    const passFile = await pass.generate({
      wwdr: wwdrCert,
      signerCert,
      signerKey,
      signerKeyPassphrase: signerPassphrase
    });

    // Upload Pass to Supabase Storage
    const { data, error } = await supabase.storage.from("passes").upload(
      `passes/${passId}.pkpass`, passFile, { upsert: true }
    );

    if (error) throw error;

    const passUrl = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/passes/${passId}.pkpass`;

    return new Response(JSON.stringify({ success: true, passUrl }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
});
