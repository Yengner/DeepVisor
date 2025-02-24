import React from 'react'
import clsx from 'clsx'
import { ctaDetails } from '@/lib/static/cta'


const FreeEstimateButton = ({ dark }: { dark?: boolean }) => {
    return (
        <a href={ctaDetails.freeEstimateUrl}>
            <button
                type="button"
                className={clsx("flex items-center justify-center min-w-[205px] mt-3 px-6 h-14 rounded-full w-full sm:w-fit", { "text-white bg-primary-accent": dark, "text-primary bg-primary-accent": !dark })}>
                <div>
                    <div className="-mt-1 font-sans text-xl font-semibold">
                        Free Estimate
                    </div>
                </div>
            </button>
        </a>
    )
}

export default FreeEstimateButton