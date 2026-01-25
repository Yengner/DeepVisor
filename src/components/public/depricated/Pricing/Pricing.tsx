import { tiers } from "@/lib/static/pricing";
import PricingColumn from "./PricingColumn";


const Pricing: React.FC = () => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {tiers.map((tier, index) => (
                <PricingColumn key={tier.name} tier={tier} highlight={index === 3} />
            ))}
        </div>
    )
}

export default Pricing