'use client';

// import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import ProgressBar from './ProgressBar';
// import { useState } from 'react';

// const COLORS = [
//   '#f2e8cf', // Light yellow
//   '#d98850', // Orange
//   '#93c47d', // Light green
//   '#b6985c', // Orange
//   '#e0af68', // Yellow-orange
//   '#9b703f'  // Brown
// ];

interface InsightsProps {
  linkClicks: number;
  postEngagement: number;
  messagingConversationsStarted: number;
  clicks: number;
}

interface AccountInfoProps {
  accountInfo?: {
    name?: string;
    balance?: number;
    currency?: string;
    todaySpend?: number;
    lifetimeSpend?: number;
    spendCap: number;
    accountStatus: number;
    totalCampaigns?: number;
    insights?: InsightsProps;
  };
}

const getStatusLabel = (status: number): string => {
  console.log('IN GET STATUS', status);
  switch (status) {
      case 1:
          return 'Active';
      case 2:
          return 'Disabled';
      case 3:
          return 'Pending Review';
      case 4:
          return 'Inactive';
      default:
          return 'Unknown';
  }
};
// interface ActiveShapeProps {
//   cx: number;
//   cy: number;
//   midAngle: number;
//   innerRadius: number;
//   outerRadius: number;
//   startAngle: number;
//   endAngle: number;
//   fill: string;
//   payload: { name: string; value: number };
//   percent: number;
//   value: number;
// }

const AccountInfo = ({ accountInfo }: AccountInfoProps) => {
  // const [activeIndex, setActiveIndex] = useState<number | number[]>([]);
  // const [activeIndex2, setActiveIndex2] = useState<number | number[]>([]);

  if (!accountInfo) {
    return <p>No data available for the selected metrics.</p>;
  }
  console.log(accountInfo.accountStatus);

  // const renderActiveShape = (props: any) => {
  //   const RADIAN = Math.PI / 180;
  //   const {
  //     cx,
  //     cy,
  //     midAngle,
  //     innerRadius,
  //     outerRadius,
  //     startAngle,
  //     endAngle,
  //     fill,
  //     payload,
  //     percent,
  //     value,
  //     name
  //   } = props;
  //   const sin = Math.sin(-RADIAN * midAngle);
  //   const cos = Math.cos(-RADIAN * midAngle);
  //   const sx = cx + (outerRadius + 15) * cos;
  //   const sy = cy + (outerRadius + 15) * sin;
  //   const mx = cx + (outerRadius + 40) * cos;
  //   const my = cy + (outerRadius + 55) * sin;
  //   const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  //   const ey = my;
  //   const textAnchor = cos >= 0 ? 'start' : 'end';

  //   return (
  //     <g>
  //       <Sector
  //         cx={cx}
  //         cy={cy}
  //         innerRadius={innerRadius}
  //         outerRadius={outerRadius}
  //         startAngle={startAngle}
  //         endAngle={endAngle}
  //         fill={fill}
  //       />
  //       <Sector
  //         cx={cx}
  //         cy={cy}
  //         startAngle={startAngle}
  //         endAngle={endAngle}
  //         innerRadius={outerRadius + 6}
  //         outerRadius={outerRadius + 10}
  //         fill={fill}
  //       />
  //       <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
  //       <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
  //       <text className="text-xl" x={ex + (cos >= 0 ? 1 : -1) * 14} y={ey} textAnchor={textAnchor} fill={fill}>{`${payload.name}:`}</text>
  //       <text x={ex + (cos >= 0 ? 1 : -1) * 10} y={ey} dy={25} textAnchor={textAnchor} fill={fill}>{`Value: ${value}`}</text>
  //       <text x={ex + (cos >= 0 ? 1 : -1) * 10} y={ey} dy={43} textAnchor={textAnchor} fill={fill}>
  //         {`Rate: ${(percent * 100).toFixed(2)}%`}
  //       </text>
  //     </g>
  //   );
  // };

  // const renderActiveShape2 = (props: any) => {
  //   const RADIAN = Math.PI / 180;
  //   const {
  //     cx,
  //     cy,
  //     innerRadius,
  //     outerRadius,
  //     startAngle,
  //     endAngle,
  //     fill,
  //     payload,
  //   } = props;

  //   return (
  //     <g>
  //       <text x={cx} y={cy} textAnchor="middle" fill={fill}>
  //         {payload.name}
  //       </text>
  //       <text x={cx} y={cy} dy={18} textAnchor="middle" fill={fill}>
  //         {payload.value}
  //       </text>
  //       <Sector
  //         cx={cx}
  //         cy={cy}
  //         innerRadius={innerRadius}
  //         outerRadius={outerRadius}
  //         startAngle={startAngle}
  //         endAngle={endAngle}
  //         fill={fill}
  //       />
  //       <Sector
  //         cx={cx}
  //         cy={cy}
  //         startAngle={startAngle}
  //         endAngle={endAngle}
  //         innerRadius={outerRadius + 6}
  //         outerRadius={outerRadius + 10}
  //         fill={fill}
  //       />
  //     </g>
  //   );
  // };


  // Data for TwoLevelPieChart
  // const dataInner = [
  //   { name: 'Ad Spend', value: accountInfo.lifetimeSpend || 0 },
  //   { name: 'SpendCap', value: (Math.min((accountInfo.lifetimeSpend || 0 / accountInfo.spendCap) * 100, 100)) },
  // ];

  // const dataOuter = [
  //   { name: 'Engagement', value: accountInfo?.insights?.postEngagement },
  //   { name: 'Clicks', value: accountInfo?.insights?.clicks },
  //   { name: 'Link Clicks', value: accountInfo?.insights?.linkClicks },
  // ];


  return (
    <section className="p-6">
      <div className="grid grid-cols-1">
        {/* Left Column: Account Details */}
        <div className="space-y-4">
          {/* Ad Account Name */}
          <div>
            <p className="text-m text-gray-900 dark:text-gray-300">Ad Account Name</p>
            <p className="text-3xl font-semibold text-gray-900 dark:text-gray-300">{accountInfo.name || 'N/A'}</p>
          </div>

          {/* Account Status */}
          <div>
            <p className="text-m text-gray-700 dark:text-gray-300">Account Status</p>
            <span
              className={`inline-block px-3 py-1 rounded-full text-center text-xl font-semibold ${accountInfo.accountStatus === 1
                ? 'bg-green-100 text-green-600'
                : accountInfo.accountStatus === 2
                  ? 'bg-red-100 text-red-600'
                  : accountInfo.accountStatus === 3
                    ? 'bg-yellow-100 text-yellow-600'
                    : 'bg-gray-100 text-gray-600'
                }`}
            >
              {getStatusLabel(accountInfo.accountStatus)}
            </span>
          </div>

          {/* Today's Spend */}
          <div>
            <p className="text-m text-gray-900 dark:text-gray-300">Today&apos;s Spend</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-gray-300">
              ${accountInfo.todaySpend?.toFixed(2) || '0.00'} {accountInfo.currency || 'USD'}
            </p>
          </div>

          {/* Lifetime Spend */}
          <div>
            <p className="text-m text-gray-900 dark:text-gray-300">Lifetime Spend</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-gray-300">
              ${accountInfo.lifetimeSpend?.toLocaleString() || '0.00'} {accountInfo.currency || 'USD'}
            </p>
            <ProgressBar value={accountInfo.lifetimeSpend || 0} max={accountInfo.spendCap || 1000} />
          </div>

          {/* Available Balance */}
          <div>
            <p className="text-m text-gray-900 dark:text-gray-300">Available Balance</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-gray-300">
              ${accountInfo.balance?.toFixed(2) || '0.00'} {accountInfo.currency || 'USD'}
            </p>
          </div>

          {/* Total Campaigns */}
          <div>
            <p className="text-m text-gray-900 dark:text-gray-300">Total Campaigns</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-gray-300">{accountInfo.totalCampaigns || '0'}</p>
          </div>
        </div>

        {/* Right Column: Pie Chart */}
        {/* <div className="md:col-span-2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {/* Inner Ring */}
        {/* <Pie
                data={dataOuter}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                fill="#8884d8"
                activeIndex={activeIndex2}
                activeShape={renderActiveShape2}
                onMouseEnter={(_, index) => setActiveIndex2(index)}
                paddingAngle={3}
              > */}
        {/* {dataOuter.map((entry, index) => (
                  <Cell key={`outer-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie> */}
        {/* Inner Ring */}
        {/* <Pie
                data={dataInner}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={90}
                outerRadius={110}
                fill="#82ca9d"
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                paddingAngle={5}
                labelLine={false}
              >
                {dataInner.map((entry, index) => (
                  <Cell key={`inner-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                ))}
              </Pie> */}
        {/* </PieChart>
          </ResponsiveContainer>
        </div> */}

      </div>
    </section>
  );
};

export default AccountInfo;