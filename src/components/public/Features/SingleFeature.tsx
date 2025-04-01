'use client';

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";

type Feature = {
  id: number;
  icon: string;
  title: string;
  description: string;
};

const SingleFeature = ({ feature }: { feature: Feature }) => {
  const { icon, title, description } = feature;

  return (
    <>
      <motion.div
        variants={{
          hidden: {
            opacity: 0,
            y: -10,
          },

          visible: {
            opacity: 1,
            y: 0,
          },
        }}
        initial="hidden"
        whileInView="visible"
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
        className="animate_top z-40 rounded-lg border border-gray-100 bg-gray-100 p-6 shadow-solid-3 transition-all hover:shadow-solid-4 xl:p-10"
      >
        <div className="relative flex h-16 w-16 items-center justify-center rounded-[4px] bg-primary-accent">
          <Image src={icon} width={36} height={36} alt="title" />
        </div>
        <h3 className="mb-5 mt-7 text-xl font-semibold text-black xl:text-itemtitle">
          {title}
        </h3>
        <p>{description}</p>
      </motion.div>
    </>
  );
};

export default SingleFeature;
