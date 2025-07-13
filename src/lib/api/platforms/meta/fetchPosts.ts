import { fetchWithValidation } from "@/lib/actions/common/apiUtils";

export interface MetaPost {
    id: string;
    message?: string;
    caption?: string;
    created_time: string;
    permalink_url?: string;
    full_picture?: string;
    media_url?: string;
    media_type?: string;
    attachments?: {
        data: Array<{
            media_type: string;
            media: {
                image?: { src: string };
                source?: string;
            };
            title?: string;
            description?: string;
            subattachments?: {
                data: Array<{
                    media: {
                        image: { src: string };
                    };
                }>;
            };
        }>;
    };
    insights?: {
        data: Array<{
            name: string;
            period: string;
            values: Array<{
                value: number;
            }>;
        }>;
    };
}

export interface PostsResponse {
    posts: MetaPost[];
    paging?: {
        cursors: {
            before: string;
            after: string;
        };
        next?: string;
    };
    hasMore: boolean;
}

interface FacebookApiResponse {
    data: MetaPost[];
    paging?: {
        cursors: {
            before: string;
            after: string;
        };
        next?: string;
    };
}

/**
 * Fetches posts with media content from a Facebook Page
 *
 * @param pageId - Facebook Page ID to fetch posts from
 * @param accessToken - Valid Facebook access token
 * @param limit - Maximum number of posts to fetch (default: 25) 
 * @param after - Pagination cursor for fetching next page of results
 * @param mediaOnly - If true, only returns posts containing images or videos
 * @returns Posts data with pagination information
 */
export const fetchMetaPosts = async (
    pageId: string,
    accessToken: string,
    limit = 25,
    after?: string,
    mediaOnly = true
): Promise<PostsResponse> => {
    const API_BASE_URL = process.env.FACEBOOK_GRAPH_API_BASE_URL || "https://graph.facebook.com";

    // Build the API URL with all required fields and pagination
    let url = `${API_BASE_URL}/${pageId}/posts?fields=id,message,created_time,permalink_url,full_picture,attachments{media_type,media,title,description,subattachments},insights.metric(post_impressions,post_reactions_by_type_total)&limit=${limit}`;

    // Add pagination cursor if provided
    if (after) {
        url += `&after=${after}`;
    }

    try {
        const response = await fetchWithValidation<FacebookApiResponse>(url, accessToken);

        if (!response || !response.data) {
            throw new Error("Failed to fetch posts or no data returned");
        }

        let posts = response.data as MetaPost[];

        // Filter to only include posts with media content if requested
        if (mediaOnly) {
            posts = posts.filter(
                (post) =>
                    // Has a full picture
                    post.full_picture ||
                    // Or has attachments with media
                    (post.attachments?.data &&
                        post.attachments.data.some(
                            (att) =>
                                // Has direct media
                                (att.media && (att.media.image || att.media.source)) ||
                                // Or has subattachments with media
                                (att.subattachments?.data && att.subattachments.data.some((sub) => sub.media?.image))
                        ))
            );
        }

        return {
            posts,
            paging: response.paging,
            hasMore: Boolean(response.paging?.next),
        };
    } catch (error) {
        // Log the error but rethrow with a more specific message
        console.error("Error fetching Meta posts:", error);

        if (error instanceof Error) {
            // If we have a specific error message, include it
            throw new Error(`Failed to fetch Facebook posts: ${error.message}`);
        } else {
            throw new Error("Failed to fetch Facebook posts: Unknown error");
        }
    }
};

/**
 * Fetches all posts with media content, handling pagination automatically
 * Use this when you need to fetch all available posts
 */
export const fetchAllMetaPosts = async (
    pageId: string,
    accessToken: string,
    mediaOnly = true,
    maxPosts = 100 // Safety limit to prevent excessive API calls
): Promise<MetaPost[]> => {
    let allPosts: MetaPost[] = [];
    let after: string | undefined;
    let hasMore = true;
    let requestCount = 0;
    const limit = 25; // Posts per request

    while (hasMore && allPosts.length < maxPosts && requestCount < 5) {
        const response = await fetchMetaPosts(pageId, accessToken, limit, after, mediaOnly);
        allPosts = [...allPosts, ...response.posts];

        // Update pagination info
        after = response.paging?.cursors.after;
        hasMore = response.hasMore;

        // Safety check to prevent infinite loops
        requestCount++;

        // If we've reached the maximum post count, exit
        if (allPosts.length >= maxPosts) {
            break;
        }
    }

    return allPosts;
};