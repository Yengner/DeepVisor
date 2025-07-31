// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logApiCallResult(apiCallName: string, data: any, debug: boolean = false) {
    console.log(`\n=== ${apiCallName} ===`);
    if (data instanceof Error) {
        console.error('Error:', data.message);
        if (debug && data.stack) {
            console.error('Stack:', data.stack);
        }
    } else if (debug) {
        console.log('Data:', JSON.stringify(data, null, 2));
    } else {
        console.log('Data:', data);
    }
}
