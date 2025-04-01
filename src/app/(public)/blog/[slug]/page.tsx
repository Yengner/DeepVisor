import { Metadata } from "next";
import BlogLayout from "../BlogLayout";
import BlogContent from "../BlogContent";

// Mock Data: Replace this with a CMS or database fetch
const blogPosts = {
  "maximize-roi": {
    title: "How to Maximize ROI on Your Ad Campaigns",
    author: "Jane Doe",
    date: "2025-01-01",
    content: (
      <>
        <p>
          Maximizing your return on investment (ROI) is essential for any
          successful ad campaign. In this post, we&apos;ll share actionable tips to
          achieve better results.
        </p>
        <h2 className="text-xl font-semibold mt-6">1. Target the Right Audience</h2>
        <p>
          Use audience insights to focus your ads on demographics that are most
          likely to convert.
        </p>
        <h2 className="text-xl font-semibold mt-6">2. Optimize Ad Copy</h2>
        <p>
          Write clear, engaging, and persuasive ad copy that aligns with your
          audience&apos;s needs.
        </p>
      </>
    ),
    image: "/images/blog/maximize-roi.jpg",
  },
};

// Generate static paths for SSG
export async function generateStaticParams() {
  return Object.keys(blogPosts).map((slug) => ({ slug }));
}

// Add metadata (Optional)
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = blogPosts[params.slug as keyof typeof blogPosts];
  return {
    title: post ? post.title : "Post Not Found",
    description: post
      ? `Read about ${post.title}`
      : "This blog post does not exist.",
  };
}

// BlogPost Component
export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Await the params to resolve the Promise
  const resolvedParams = await params;
  const { slug } = resolvedParams;

  // Mock Data: Replace this with a CMS or database fetch
  const blogPosts = {
    "maximize-roi": {
      title: "How to Maximize ROI on Your Ad Campaigns",
      author: "Jane Doe",
      date: "2025-01-01",
      content: (
        <>
          <p>
            Maximizing your return on investment (ROI) is essential for any
            successful ad campaign. In this post, we&apos;ll share actionable tips
            to achieve better results.
          </p>
          <h2 className="text-xl font-semibold mt-6">
            1. Target the Right Audience
          </h2>
          <p>
            Use audience insights to focus your ads on demographics that are
            most likely to convert.
          </p>
          <h2 className="text-xl font-semibold mt-6">2. Optimize Ad Copy</h2>
          <p>
            Write clear, engaging, and persuasive ad copy that aligns with your
            audience&apos;s needs.
          </p>
        </>
      ),
      image: "/images/blog/maximize-roi.jpg",
    },
  };

  const post = blogPosts[slug as keyof typeof blogPosts];

  if (!post) {
    return <div>Post not found.</div>;
  }

  return (
    <div>
      <h1>{post.title}</h1>
      <p>By {post.author}</p>
      <p>Date: {post.date}</p>
      {post.content}
      <img src={post.image} alt={post.title} />
    </div>
  );
}
