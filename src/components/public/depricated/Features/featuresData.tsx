type Feature = {
  id: number;
  icon: string;
  title: string;
  description: string;
};

const featuresData: Feature[] = [
  {
    id: 1,
    icon: "/images/icon/icon-01.svg",
    title: "AI-Powered Recommendations",
    description:
      "Leverage advanced algorithms to identify top-performing posts and suggest the best for ad campaigns, optimizing ROI effortlessly.",
  },
  {
    id: 2,
    icon: "/images/icon/icon-02.svg",
    title: "Multi-Platform Integration",
    description:
      "Seamlessly manage campaigns across Meta, TikTok, Google Ads, YouTube, Twitter, Reddit, and more from a single unified dashboard.",
  },
  {
    id: 3,
    icon: "/images/icon/icon-03.svg",
    title: "Transparent Agency Services",
    description:
      "Empower clients with real-time access to campaign statistics, ensuring trust and collaboration through full transparency.",
  },
  {
    id: 4,
    icon: "/images/icon/icon-04.svg",
    title: "One-Click Ad Setup",
    description:
      "Simplify ad creation with a step-by-step wizard to launch high-impact campaigns across multiple platforms with ease.",
  },
  {
    id: 5,
    icon: "/images/icon/icon-05.svg",
    title: "Unified Analytics Dashboard",
    description:
      "Centralized insights let businesses compare and analyze campaign performance across platforms, driving data-driven decisions.",
  },
  {
    id: 6,
    icon: "/images/icon/icon-06.svg",
    title: "Scalable and Cost-Effective",
    description:
      "Flexible pricing plans and a robust architecture make DeepVisor suitable for small businesses and enterprises alike.",
  },
];

export default featuresData;