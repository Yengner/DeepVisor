import Image from 'next/image';
import React from 'react';

interface BlogContentProps {
  title: string;
  author: string;
  date: string;
  content: React.ReactNode;
  image?: string;
}

export default function BlogContent({ title, author, date, content, image }: BlogContentProps) {
  return (
    <div className="space-y-6">
      {/* Blog Title */}
      <h1 className="text-3xl font-bold text-gray-800">{title}</h1>

      {/* Blog Metadata */}
      <p className="text-sm text-gray-500">
        By <span className="font-semibold">{author}</span> on {new Date(date).toLocaleDateString()}
      </p>

      {/* Featured Image */}
      {image && (
        <div className="rounded-lg overflow-hidden">
          <Image
            src={image}
            alt={title}
            width={1200}
            height={675}
            className="w-full h-auto object-cover"
            priority // for LCP
          />
        </div>
      )}

      {/* Blog Content */}
      <div className="text-gray-700 leading-7">{content}</div>
    </div>
  );
}
