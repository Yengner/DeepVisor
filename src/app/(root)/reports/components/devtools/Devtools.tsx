export function RightSidebar({ selectedNode }: { selectedNode: any }) {
    if (!selectedNode) {
        return (
            <div className="p-4 text-gray-500">
                Select a campaign node to see details here.
            </div>
        );
    }

    // Only show name and a summary of data presence
    const { id, type, data } = selectedNode;
    const fieldsToCheck = [
        'clicks', 'impressions', 'spend', 'leads', 'reach', 'link_clicks', 'messages', 'cpm', 'ctr', 'cpc', 'start_date', 'end_date'
    ];

    return (
        <div className="p-4">
            <div className="mb-2 text-xs text-gray-500">Node ID: <span className="font-mono">{id}</span></div>
            <div className="mb-2 text-xs text-gray-500">Type: <span className="font-mono">{type || 'default'}</span></div>
            <h2 className="font-bold mb-2">{data.name || data.label}</h2>
            <div className="mb-2">
                <div className="font-semibold text-sm mb-1">Data fields present:</div>
                <ul className="text-xs">
                    {fieldsToCheck.map((field) => (
                        <li key={field}>
                            {field}: {data[field] !== undefined && data[field] !== null ? '✅' : '❌'}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
