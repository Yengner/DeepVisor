import { NextResponse } from "next/server";
// import { PKPass } from "passkit-generator";
// import fs from "fs";
// import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

// function hexToRgbUtil(hexColor: string): string {
//     if (!hexColor) return "rgb(255, 255, 255)";

//     hexColor = hexColor.replace(/^#/, "");

//     // Convert 3-character HEX to 6-character HEX (e.g., #FFF → #FFFFFF)
//     if (hexColor.length === 3) {
//         hexColor = hexColor
//             .split("")
//             .map((char) => char + char)
//             .join("");
//     }

    // Convert HEX to RGB
//     const bigint = parseInt(hexColor, 16);
//     const r = (bigint >> 16) & 255;
//     const g = (bigint >> 8) & 255;
//     const b = bigint & 255;

//     return `rgb(${r}, ${g}, ${b})`;
// }

//eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(req: Request) {
    // const supabase = await createSupabaseClient()

    try {
        // Parse request body
        // const {
        //     // type,
        //     businessName,
        //     discountDetails,
        //     // discountUrl,
        //     foregroundColorHex,
        //     backgroundColorHex,
        //     // locations,
        //     passId,
        // } = await req.json();
        // console.log(discountDetails)
        // // Ensure required fields are present
        // if (!businessName) {
        //     return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        // }

        // console.log("📌 Generating Apple Wallet pass...");

        // const pass = await PKPass.from({
        //     model: "/Users/yb/Desktop/deepvisor/public/custom.pass",
        //     certificates: {
        //         wwdr: fs.readFileSync("/Users/yb/Desktop/deepvisor/src/certs/wwdr.pem"),
        //         signerCert: fs.readFileSync("/Users/yb/Desktop/deepvisor/src/certs/signerCert.pem"),
        //         signerKey: fs.readFileSync("/Users/yb/Desktop/deepvisor/src/certs/signerKey.pem"),
        //         signerKeyPassphrase: process.env.SIGNER_PASSPHRASE!,
        //     },
        // }, {
        //     organizationName: businessName,
        //     authenticationToken: process.env.TEMP_ACCESSTOKEN,
        //     logoText: businessName,
        //     serialNumber: (Math.random()).toLocaleString(),
        //     description: `${businessName} Discount`,
        //     foregroundColor: hexToRgbUtil(foregroundColorHex) || "rgb(255, 255, 255)",
        //     backgroundColor: hexToRgbUtil(backgroundColorHex) || "rgb(0, 0, 0)",

        // })


        // pass.primaryFields.push({
        //     "key": "offer",
        //     "label": "Discount",
        //     "value": discountDetails
        // })

        // pass.auxiliaryFields.push(
        //     {
        //         key: "expires",
        //         label: "EXPIRES",
        //         value: "2025-04-24T10:00-05:00",
        //         isRelative: true,
        //         dateStyle: "PKDateStyleShort"
        //     }
        // )

        // // pass.setExpirationDate(new Date("2025-12-30T10:00-05:00"));

        // pass.setBarcodes({
        //     message: "https://www.google.com/", // this will be integrated with the pos systems 
        //     format: "PKBarcodeFormatQR",
        //     messageEncoding: "iso-8859-1"

        // })
        // const buffer = pass.getAsBuffer();

        // console.log("✅ Created the buffer, uploading to Supabase...");


        // const filePath = `${passId}/
        // `;


        // Upload Pass to Supabase Storage
        // const { error } = await supabase.storage
        //     .from("passes")
        //     .upload(`${filePath}.pkpass`, buffer, { upsert: true });

        // if (error) {
        //     throw error;
        // }

        // Generate public URL for the pass
        // const passUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/passes/${filePath}.pkpass`;
        // console.log(passUrl)
        // console.log(`✅ Pass uploaded successfully: ${passUrl}`);

        // return NextResponse.json({ success: true, passUrl }, { status: 200 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error("❌ Error generating pass:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
