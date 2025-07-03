import { getLoggedInUser } from "@/lib/actions/user.actions";
import { fetchMetaPosts } from "@/lib/api/platforms/meta/fetchPosts";
import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        // const { searchParams } = new URL(request.url);
        // const pageId = searchParams.get("pageId");

        const supabase = await createSupabaseClient();
        const loggedIn = await getLoggedInUser();
        const userId = loggedIn?.id;

        const { data: integration, error: integrationError } = await supabase
            .from("platform_integrations")
            .select("id, platform_name")
            .eq("user_id", userId)
            .eq("platform_name", "meta")
            .single();




        const { data, error } = await supabase
            .from("meta_pages")
            .select("page_id, access_token")
            .eq("user_id", userId)
            .eq("platform_integration_id", integration?.id)


        const pageId = data?.[0]?.page_id;
        const accessToken = data?.[0]?.access_token;

        if (error) {
            return NextResponse.json(
                { success: false, error: "No Meta access token available" },
                { status: 401 }
            );
        }

        if (!pageId) {
            return NextResponse.json(
                { success: false, error: "Missing pageId parameter" },
                { status: 400 }
            );
        }

        if (!accessToken) {
            return NextResponse.json(
                { success: false, error: "No Meta access token available" },
                { status: 401 }
            );
        }

        // Fetch posts using our utility function
        const response = await fetchMetaPosts(pageId, accessToken);

        return NextResponse.json({
            success: true,
            posts: response.posts,
            paging: response.paging,
            hasMore: response.hasMore
        });
    } catch (error) {
        console.error("Error in /api/meta/posts:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}