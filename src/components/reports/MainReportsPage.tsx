"use client";

import React, { useState } from "react";
import { useReportsSidebar } from "./ReportSidebarContext";
import DynamicReportPDF from "./pdf_generator/DynamicReportPDF";
// import dynamic from "next/dynamic";
import TopAdAccountsTable from "./TopAdAccounts";
import TopCampaignsTable from "./TopCampaignsTable";
import TopAdSetsTable from "./TopAdSetTable";
import TopAdsTable from "./TopAdsTable";

// const PDFDownloadLink = dynamic(
//   () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
//   {
//     ssr: false,
//     loading: () => <p>Loading...</p>,

//   }
// );
// const PDFViewer = dynamic(
//   () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
//   {
//     ssr: false,
//     loading: () => <p>Loading...</p>,

//   }
// );

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MainReport = ({ metrics }: { metrics: any }) => {
  const { isReportsSidebarOpen } = useReportsSidebar();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedAdAccount, setSelectedAdAccount] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<"7" | "30" | "90">("30");

  const { topAdAccounts, topCampaigns_metrics, topAdset_metrics, topAd_metrics } = metrics;
  // Enhanced Dummy Data
  const dummyData = {
    businessInfo: {
      name: "Awesome Business Co.",
      contact: "contact@business.com",
    },
    platform: selectedPlatform || "All Platforms",
    timeRange,
    platforms: [
      { name: "Meta", spend: 1200, clicks: 5000, adAccounts: ["Account 1", "Account 2"] },
      { name: "Google", spend: 800, clicks: 3000, adAccounts: ["Account A", "Account B"] },
    ],
    adAccounts: [
      { name: "Account 1", platform: "Meta", spend: 700, clicks: 3000 },
      { name: "Account 2", platform: "Meta", spend: 500, clicks: 2000 },
      { name: "Account A", platform: "Google", spend: 400, clicks: 1500 },
      { name: "Account B", platform: "Google", spend: 400, clicks: 1500 },
    ],
  };

  const handlePlatformClick = (platform: string) => {
    setSelectedPlatform(platform === selectedPlatform ? null : platform);
    setSelectedAdAccount(null);
  };

  const handleAdAccountClick = (adAccount: string) => {
    setSelectedAdAccount(adAccount === selectedAdAccount ? null : adAccount);
  };

  return (
    <div
      className={`transition-all duration-300 ${isReportsSidebarOpen ? "w-[calc(100%-4rem)]" : "w-[calc(100%-4rem)]"
        } `}
    >
      {/* Header Section */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Reports Overview</h1>
        <p className="text-gray-600 mt-2">
          View and analyze data across all platforms and ad accounts.
        </p>
      </div>
      {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> */}
        {/* Filters Panel */}
        {/* <div className="bg-white shadow-md rounded-lg p-4 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Filters</h2> */}

          {/* Platform Selection */}
          {/* <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Select Platform</h3>
            <div className="grid grid-cols-3 gap-2">
              {dummyData.platforms.map((platform) => (
                <button
                  key={platform.name}
                  onClick={() => handlePlatformClick(platform.name)}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${selectedPlatform === platform.name
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-800"
                    } hover:bg-blue-500 hover:text-white`}
                >
                  {platform.name}
                </button>
              ))}
            </div>
          </div> */}

          {/* Ad Account Selection */}
          {/* {selectedPlatform && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Select Ad Account ({selectedPlatform})
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {dummyData.adAccounts
                  .filter((acc) => acc.platform === selectedPlatform)
                  .map((account) => (
                    <button
                      key={account.name}
                      onClick={() => handleAdAccountClick(account.name)}
                      className={`px-4 py-2 rounded-md text-sm font-medium ${selectedAdAccount === account.name
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-800"
                        } hover:bg-blue-500 hover:text-white`}
                    >
                      {account.name}
                    </button>
                  ))}
              </div>
            </div>
          )} */}

          {/* Time Range Selection */}
          {/* <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Select Time Range</h3>
            <div className="grid grid-cols-3 gap-2">
              {["7", "30", "90"].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range as "7" | "30" | "90")}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${timeRange === range
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-800"
                    } hover:bg-blue-500 hover:text-white`}
                >
                  {range === "7" ? "Last 7 Days" : range === "30" ? "Last 30 Days" : "Last 90 Days"}
                </button>
              ))}
            </div>
          </div>
        </div> */}

        {/* PDF Report Section */}
        {/* <div className="bg-white shadow-md rounded-lg p-4 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">PDF Report</h2>
          <PDFViewer style={{ width: "100%", height: "300px" }}>
            <DynamicReportPDF data={dummyData} />
          </PDFViewer>
        </div> */}
      {/* </div> */}

      {/* Top Ad Accounts, Campaigns, Adsets, Ads */}
      <div className="pt-10 grid grid-cols-2 lg:grid-cols-3 gap-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2 mt-4 underline underline-offset-8 [text-decoration-style:dotted]">
          Ad Accounts
        </h2>
        <div className="col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <TopAdAccountsTable adAccounts={topAdAccounts} />
        </div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2 mt-4 underline underline-offset-8 [text-decoration-style:dotted]">
          Campaigns
        </h2>
        <div className="col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <TopCampaignsTable campaigns={topCampaigns_metrics} />
        </div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2 mt-4 underline underline-offset-8 [text-decoration-style:dotted]">
          Ad Sets
        </h2>
        <div className="col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <TopAdSetsTable adSets={topAdset_metrics} />
        </div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2 mt-4 underline underline-offset-8 [text-decoration-style:dotted]">
          Ads
        </h2>
        <div className="col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <TopAdsTable ads={topAd_metrics} />
        </div>
      </div>
    </div >
  );
};

export default MainReport;
