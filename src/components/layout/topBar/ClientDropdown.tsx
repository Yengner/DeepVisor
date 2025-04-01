"use client";
// This component gets the current connected Integrations from the user and match the ad accounts associated with that platform.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDownIcon } from "@radix-ui/react-icons";

type Platform = {
    id: string;
    platform_name: string;
};

interface LoggedInUser {
    id: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    business_name: string;
    email: string;
    created_at: string;
    updated_at: string;
}

type AdAccount = {
    id: string;
    name: string;
    platform_integration_id: string;
    ad_account_id: string;
};

interface DropdownProps {
    platforms: Platform[];
    adAccounts: AdAccount[];
    userInfo: LoggedInUser;
}

const ClientDropdown = ({ userInfo, platforms, adAccounts }: DropdownProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedTab, setSelectedTab] = useState("All");
    const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(platforms.length > 0 ? platforms[0] : null);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const router = useRouter();

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };
    const tabs = ["All", "Favorites", "Recents"];

    const filteredAdAccounts = selectedPlatform
        ? adAccounts.filter(
            (account) => account.platform_integration_id === selectedPlatform.id
        )
        : adAccounts;

    const handlePlatformSelect = (platform: Platform | null) => {
        setSelectedPlatform(platform);
    };

    const pathSegments = pathname.split("/").filter(Boolean);
    const constructUrl = (segments: string[], index: number) => "/" + segments.slice(0, index + 1).join("/");

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div className="relative"
            ref={dropdownRef}
        >
            {/* Breadcrumb Button */}
            <div
                className="flex items-center space-x-2 text-gray-700 font-medium bg-gray-100 px-4 py-2 rounded-md hover:bg-gray-200 cursor-pointer"
                onClick={toggleDropdown}
            >
                {pathSegments.map((segment, index) => (
                    <div key={index} className="flex items-center space-x-2">
                        <Link href={constructUrl(pathSegments, index)} passHref>
                            <span className="cursor-pointer hover:underline capitalize">
                                {segment.charAt(0).toUpperCase() + segment.slice(1)}
                            </span>
                        </Link>
                        {index < pathSegments.length - 1 && (
                            <span className="text-gray-400">/</span>
                        )}
                    </div>
                ))}
                <ChevronDownIcon className="w-4 h-4 ml-2 text-gray-700" />
            </div>
            {/* Dropdown Content */}
            {isOpen && (
                <div
                    className="fixed top-2 left-2 z-50 w-[800px] h-[500px] bg-white border border-l-gray-200 border-t-gray-100 shadow-xl flex flex-col"
                    ref={dropdownRef}
                >
                    {/* Top Section: Tabs */}
                    <div className="flex justify-between items-center border-b pl-3 pt-3 pr-3 ">
                        <div className="flex space-x-4">
                            {tabs.map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setSelectedTab(tab)}
                                    className={`font-semibold pb-2 hover:bg-gray-100 p-3 ${selectedTab === tab
                                        ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
                                        : "text-gray-600 hover:text-gray-900"
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        {/* Search Bar */}
                        <div className="relative bottom-2">
                            <input
                                type="text"
                                placeholder="Search"
                                className="px-4 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-300 "
                            />
                        </div>
                    </div>

                    {/* Middle Section: Platforms*/}

                    <div className="flex justify-between items-center border-b pl-3 pt-3 pr-3">
                        {/* Platforms */}
                        <div>
                            <ul className="flex space-x-4">
                                {platforms.map((platform) => (
                                    <li
                                        key={platform.id}
                                        onClick={() => handlePlatformSelect(platform)}
                                        className={`p-2 hover:bg-gray-100 cursor-pointer ${selectedPlatform?.id === platform.id ? "bg-blue-100 border-b-2 border-blue-600 -mb-[1px]" : ""}`}
                                    >
                                        <Image
                                            src={`/images/platforms/logo/${platform.platform_name.toLowerCase()}.png`} // Example path
                                            alt={platform.platform_name}
                                            width={35}
                                            height={35}
                                        />
                                        <span className="sr-only">{platform.platform_name}</span> {/* Accessible text */}
                                    </li>
                                ))}

                                {/* Integrate Button */}
                                <li
                                    onClick={() => router.push('/integration')}
                                    className="p-2 hover:bg-gray-100 cursor-pointer"
                                >
                                    <div className="flex items-center justify-center h-10 w-10 bg-gray-100 rounded-full">
                                        <svg
                                            className="w-6 h-6 text-gray-600"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            viewBox="0 0 24 24"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M12 4v16m8-8H4"
                                            />
                                        </svg>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        {/* Platforms search Bar */}
                        <div className="relative bottom-2">
                            <select
                                className="px-16 py-1 border text-sm text-center text-gray-400 rounded-md focus:ring-2 focus:ring-blue-300 appearance-none"
                                onChange={(e) => handlePlatformSelect(platforms.find(platform => platform.id === e.target.value) || null)}
                            >
                                <option value="">All Platforms</option>
                                {platforms.map((platform) => (
                                    <option key={platform.id} value={platform.id}>
                                        {platform.platform_name.charAt(0).toUpperCase() + platform.platform_name.slice(1)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>



                    {/* End Section: Business Name and Ad Accounts */}
                    <div className="grid grid-cols-4 flex-grow overflow-auto">
                        {/* Business + Ad Accounts */}
                        <div className="col-span-1 border-r">
                            <h3 className="text-sm text-center font-semibold text-gray-500 pt-3 pb-2 mb-3 border-b">
                                Analytics Accounts
                            </h3>
                            <ul className="space-y-2">
                                {selectedPlatform && (
                                    <li
                                        key={selectedPlatform.id}
                                        className={`flex flex-col px-4 py-3 cursor-pointer hover:bg-gray-100`}
                                    >
                                        <div className="flex items-center justify-between">
                                            {/* Business Name and Platform */}
                                            <div>
                                                <span className="block font-semibold text-gray-700">
                                                    {userInfo?.business_name || "Business Name"}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {selectedPlatform.platform_name.charAt(0).toUpperCase() +
                                                        selectedPlatform.platform_name.slice(1)}
                                                </span>
                                            </div>
                                            {/* Right Arrow Icon */}
                                            <div>
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className="w-4 h-4 text-gray-500"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </div>
                                        {/* View Platform Button */}
                                        <div className="mt-2 text-right">
                                            <Link
                                                href={`/reports/platforms/${selectedPlatform.platform_name.toLowerCase()}`}
                                                passHref
                                            >
                                                <button className="text-xs font-medium text-blue-600 hover:underline">
                                                    View Platform
                                                </button>
                                            </Link>
                                        </div>
                                    </li>
                                )}
                            </ul>
                        </div>

                        {/* Properties & Apps */}
                        <div className="col-span-3">
                            <h3 className="text-sm text-center font-semibold text-gray-500 pt-3 pb-2 mb-3 border-b">Properties & Apps</h3>
                            <ul className="space-y-2">
                                {filteredAdAccounts.map((account) => (
                                    <Link
                                        key={account.id}
                                        href={`/reports/platforms/${selectedPlatform?.platform_name.toLowerCase()}/${account.ad_account_id}`}
                                        passHref
                                    >
                                        <li className="flex items-center justify-between px-4 py-3 hover:bg-gray-100 cursor-pointer">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-700">{account.name}</span>
                                                <span className="text-xs text-gray-500">{account.ad_account_id}</span>
                                            </div>
                                            <button
                                                className="text-gray-400 hover:text-gray-600 px-3 py-1"
                                                title="Favorite"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                }}
                                            >
                                                ★
                                            </button>
                                        </li>
                                    </Link>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

            )
            }
        </div >
    );
};

export default ClientDropdown;