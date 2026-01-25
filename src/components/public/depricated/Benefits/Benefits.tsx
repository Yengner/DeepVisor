import { benefits } from "@/lib/static/benefits"
import BenefitSection from "./BenefitSection"


const Benefits: React.FC = () => {
    return (
        <div id="features">
            <h2 className="sr-only">Features</h2>
            {benefits.map((item, index) => {
                return <BenefitSection key={index} benefit={item} imageAtRight={index % 2 !== 0} />
            })}
        </div>
    )
}

export default Benefits