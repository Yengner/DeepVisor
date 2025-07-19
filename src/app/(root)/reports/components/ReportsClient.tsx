'use client';

import { Box } from "@mantine/core";
import { ReactFlowProvider } from "@xyflow/react";
import FlowWithProvider from "./FlowWithProvider";
// import FlowWithProvider from "./FlowWithProvider";

export default function ReportsClient({ rawData }: any) {
    return (
        <Box
            style={{
                height: '100%',   // Fill viewport height
                width: '100%',    // Fill viewport width
                overflow: 'hidden',
                background: '#f8fafc',
            }}
        >
            <ReactFlowProvider>
                <FlowWithProvider rawData={rawData} />
            </ReactFlowProvider>

        </Box>
    );
}