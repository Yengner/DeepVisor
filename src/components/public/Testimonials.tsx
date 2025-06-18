import React from 'react';
import Image from 'next/image';
import { testimonials } from '@/lib/static/testimonials';

const Testimonials: React.FC = () => {
    return (
        <div className="bg-gradient-to-r from-blue-300 to-indigo-400 py-16 px-8 rounded-lg shadow-lg">
            <div className="grid gap-14 max-w-lg w-full mx-auto lg:gap-8 lg:grid-cols-3 lg:max-w-full">
                {testimonials.map((testimonial, index) => (
                    <div
                        key={index}
                        className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300"
                    >
                        <div className="flex items-center mb-4 w-full justify-center lg:justify-start">
                            <Image
                                src={testimonial.avatar}
                                alt={`${testimonial.name} avatar`}
                                width={50}
                                height={50}
                                className="rounded-full shadow-md"
                            />
                            <div className="ml-4">
                                <h3 className="text-lg font-semibold text-gray-800">{testimonial.name}</h3>
                                <p className="text-sm text-gray-600">{testimonial.role}</p>
                            </div>
                        </div>
                        <p className="text-gray-700 text-center lg:text-left">&quot;{testimonial.message}&quot;</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Testimonials;