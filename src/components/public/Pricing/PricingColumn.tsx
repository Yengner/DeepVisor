import { IPricing } from "@/lib/static/types";
import clsx from "clsx";
import { BsFillCheckCircleFill } from "react-icons/bs";

interface Props {
    tier: IPricing;
    highlight?: boolean;
}

const PricingColumn: React.FC<Props> = ({ tier, highlight }: Props) => {
    const { name, price, features } = tier;

    const handleButtonClick = () => {
        if (price === "Contact Us") {
            window.location.href = "/contact-us";
        } else {
            window.location.href = `/payment?plan=${name.toLowerCase().replace(/\s+/g, "-")}`;
        }
    };

    return (
        <div className={clsx("w-full max-w-sm mx-auto bg-white rounded-xl border border-gray-200 lg:max-w-full", { "shadow-lg": highlight })}>
            <div className="p-6 border-b border-gray-200 rounded-t-xl">
                <h3 className="text-2xl font-semibold mb-4">{name}</h3>
                <p className="text-3xl md:text-5xl font-bold mb-6">
                    <span className={clsx({ "text-secondary": highlight })}>
                        {typeof price === 'number' ? `$${price}` : price}
                    </span>
                    {typeof price === 'number' && <span className="text-lg font-normal text-gray-600">/mo</span>}
                </p>
                <button
                    className={clsx("w-full py-3 px-4 rounded-full transition-colors", { "bg-primary-accent hover:bg-hero-background": highlight, "bg-primary-accent hover:bg-gray-200": !highlight })}
                    onClick={handleButtonClick}
                    disabled={price !== "Contact Us"} // Disable button for "Coming Soon"
                >
                    {price === "Contact Us" ? "Coming Soon" : "Coming Soon"}
                </button>
            </div>
            <div className="p-6 mt-1">
                <p className="font-bold mb-1">FEATURES</p>
                <ul className="space-y-4 mb-8">
                    {features.map((feature, index) => (
                        <li key={index} className="flex items-center">
                            <BsFillCheckCircleFill className="h-5 w-5 text-secondary mr-2" />
                            <span className="text-gray-700 leading-tight">{feature}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default PricingColumn;
