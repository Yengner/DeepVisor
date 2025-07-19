import { IStats } from "@/lib/static/types";
import { BsBarChartFill, BsFillStarFill } from "react-icons/bs";
import { HiOutlineBuildingOffice2 } from "react-icons/hi2";

export const stats: IStats[] = [
    {
        title: "50K+",
        icon: <BsBarChartFill size={34} className="text-blue-500" />,
        description: "Marketing metrics processed daily to deliver actionable insights."
    },
    {
        title: "5.0",
        icon: <BsFillStarFill size={34} className="text-yellow-500" />,
        description: "Star rating, reflecting client satisfaction across industries."
    },
    {
        title: "50+ Tampa Businesses",
        icon: <HiOutlineBuildingOffice2 size={34} className="text-emerald-500" />,
        description: "Partnering with local Tampa businesses to achieve measurable growth."
    }
];
