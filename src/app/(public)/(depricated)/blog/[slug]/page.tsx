// // src/app/(public)/blog/[slug]/page.tsx

// import { Metadata } from "next";
// import Image from "next/image";

// const blogPosts = {
//   "maximize-roi": {
//     title: "How to Maximize ROI on Your Ad Campaigns",
//     author: "Jane Doe",
//     date: "2025-01-01",
//     content: (
//       <>
//         <p>Maximizing your return on investment (ROI) is essential…</p>
//         {/* … */}
//       </>
//     ),
//     image: "/images/blog/maximize-roi.jpg",
//   },
// };

// export async function generateStaticParams() {
//   return Object.keys(blogPosts).map((slug) => ({ slug }));
// }

// export async function generateMetadata({
//   params,
// }: {
//   params: { slug: string };
// }): Promise<Metadata> {
//   const post = blogPosts[params.slug as keyof typeof blogPosts];
//   return {
//     title: post?.title ?? "Post Not Found",
//     description: post
//       ? `Read about ${post.title}`
//       : "This blog post does not exist.",
//   };
// }

// // ——— FIX HERE ———
// // 1) Mark component async
// // 2) Declare params as Promise<{slug:string}>
// export default async function BlogPost(
//   props: { params: Promise<{ slug: string }> }
// ) {
//   // 3) Await the params before using
//   const { slug } = await props.params;
//   const post = blogPosts[slug as keyof typeof blogPosts];

//   if (!post) {
//     return <div>Post not found.</div>;
//   }

//   return (
//     <article className="prose lg:prose-xl mx-auto p-4">
//       <h1 className="text-3xl font-bold mb-4">{post.title}</h1>
//       <p className="text-sm text-gray-600 mb-6">
//         By {post.author} | {post.date}
//       </p>
//       <div className="markdown-body mb-8">{post.content}</div>
//       <div className="rounded-lg overflow-hidden relative h-64">
//         <Image
//           src={post.image}
//           alt={post.title}
//           fill
//           sizes="(max-width: 768px) 100vw, 1200px"
//           className="object-cover"
//           priority
//         />
//       </div>
//     </article>
//   );
// }

import React from 'react'

const blog = () => {
  return (
    <div>blog</div>
  )
}

export default blog