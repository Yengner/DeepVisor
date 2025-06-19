'use client';

import { useState } from 'react';
import { Button, Card, Group, Stack, Text, Title, Badge, Table, Container, List, Tabs, LoadingOverlay } from '@mantine/core';
import { IconCheck, IconX, IconCircleCheck, IconAward, IconRocket, IconBuildingSkyscraper } from '@tabler/icons-react';
import { createCheckoutSession } from '@/lib/actions/stripe.actions';
import { useRouter } from 'next/navigation';
import { ErrorState } from '@/components/ui/states/ErrorState';
import toast from 'react-hot-toast';

export default function PlansPage() {
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const plans = [
        {
            code: 'TIER1',
            name: 'Tier 1 – Starter',
            price: '$50/month',
            description: 'Entry-level lead generation for new advertisers.',
            recommendation: 'Best for individuals or small businesses starting with ads.',
            color: '#F0F9FF',
            icon: <IconRocket size={24} />,
        },
        {
            code: 'TIER2',
            name: 'Tier 2 – Growth',
            price: '$150/month',
            description: 'Scale your campaigns with advanced insights.',
            recommendation: 'Ideal for growing businesses with multiple campaigns.',
            color: '#F0FFF4',
            icon: <IconAward size={24} />,
            popular: true,
        },
        {
            code: 'TIER3',
            name: 'Tier 3 – Premium',
            price: '$300/month',
            description: 'Full platform access with creative assistance.',
            recommendation: 'Perfect for established businesses with advanced needs.',
            color: '#F3F0FF',
            icon: <IconCircleCheck size={24} />,
        },
        {
            code: 'AGENCY',
            name: 'Agency Partnership',
            price: 'Custom Pricing',
            description: 'Work directly with the DeepVisor team for fully managed campaigns.',
            recommendation: 'For businesses that want a fully managed ad strategy.',
            color: '#FFF8F0',
            icon: <IconBuildingSkyscraper size={24} />,
        },
    ];

    const handleSelectPlan = (planCode: string) => {
        setSelectedPlan(planCode);
    };

    const handleCheckout = async () => {
        if (!selectedPlan || selectedPlan === 'AGENCY') return;

        try {
            setIsLoading(true);
            setError(null);

            toast.promise(
                createCheckoutSession(selectedPlan).then(({ url }) => {
                    if (url) {
                        router.push(url);
                    } else {
                        throw new Error("No checkout URL returned");
                    }
                }),
                {
                    loading: 'Preparing your checkout...',
                    success: 'Redirecting to secure checkout...',
                    error: 'Something went wrong. Please try again.'
                }
            );
        } catch (err) {
            setIsLoading(false);
            setError("We couldn't process your request at this time");

            // Show a toast notification
            toast.error("Checkout failed. Please try again later.", {
                duration: 5000,
                icon: '❌',
            });
        }
    };

    // If there's an error, display the error state
    if (error) {
        return (
            <ErrorState
                message={error}
                primaryAction={{
                    label: "Try Again",
                    href: "/select-plan"
                }}
            />
        );
    }

    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-50 py-10 relative">
            {/* LoadingOverlay that covers everything when loading */}
            <LoadingOverlay visible={isLoading} overlayProps={{ blur: 2 }} />

            <Container size="xl">
                <Stack>
                    <div className="text-center -mt-12 mb-16">
                        <Title order={1} className="mb-2">Choose Your DeepVisor Plan</Title>
                        <Text c="dimmed" size="lg" className="max-w-2xl mx-auto">
                            Select the subscription that best fits your business needs. You can upgrade or manage your subscription anytime.
                        </Text>
                    </div>

                    {/* Plan Cards */}
                    <div className="flex flex-wrap justify-center gap-6">
                        {plans.map((plan) => (
                            <Card
                                key={plan.code}
                                shadow="sm"
                                radius="lg"
                                withBorder
                                p="lg"
                                className="w-[280px] transition-all duration-200 hover:shadow-lg"
                                style={{
                                    borderColor: selectedPlan === plan.code ? '#1c7ed6' : 'transparent',
                                    borderWidth: selectedPlan === plan.code ? '2px' : '1px',
                                    backgroundColor: selectedPlan === plan.code ? '#EFF6FF' : plan.color,
                                    position: 'relative',
                                }}
                            >
                                {plan.popular && (
                                    <Badge
                                        color="green"
                                        className="absolute -top-0.5 -right-1"
                                        size="lg"
                                    >
                                        Popular Choice
                                    </Badge>
                                )}
                                <Stack>
                                    <Group>
                                        <Group>
                                            {plan.icon}
                                            <Title order={4}>{plan.name}</Title>
                                        </Group>
                                    </Group>

                                    <Title order={2} className="text-blue-600">
                                        {plan.price}
                                    </Title>

                                    <Text size="md">
                                        {plan.description}
                                    </Text>

                                    <Text c="dimmed" size="sm" className="mt-2">
                                        <strong>Recommended for:</strong><br />
                                        {plan.recommendation}
                                    </Text>

                                    {plan.code === 'AGENCY' ? (
                                        <Button
                                            fullWidth
                                            size="lg"
                                            variant="filled"
                                            color="blue"
                                            onClick={() => alert('Thank you for your interest! Our team will reach out shortly with a custom proposal.')}
                                        >
                                            Contact Agency
                                        </Button>
                                    ) : (
                                        <Button
                                            fullWidth
                                            size="lg"
                                            variant={selectedPlan === plan.code ? 'filled' : 'outline'}
                                            color="blue"
                                            onClick={() => handleSelectPlan(plan.code)}
                                        >
                                            {selectedPlan === plan.code ? 'Selected' : 'Choose Plan'}
                                        </Button>
                                    )}
                                </Stack>
                            </Card>
                        ))}
                    </div>

                    {/* Comparison Table */}
                    <div className="mt-12">
                        <Tabs defaultValue="features" variant="pills" className="mb-8">
                            <Tabs.List className="justify-center">
                                <Tabs.Tab value="features">Feature Comparison</Tabs.Tab>
                                <Tabs.Tab value="details">Detailed Specifications</Tabs.Tab>
                            </Tabs.List>

                            <Tabs.Panel value="features" pt="xl">
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                    {/* Feature Categories */}
                                    <div className="bg-gray-50 p-4 rounded-l-lg">
                                        <div className="h-16"></div> {/* Spacer for headers */}

                                        <div className="font-bold py-3 border-b">Account & Platform</div>
                                        <div className="py-3 border-b">Ad Account Connections</div>
                                        <div className="py-3 border-b">Platforms Supported</div>

                                        <div className="font-bold py-3 border-b mt-4">Analytics & Creative</div>
                                        <div className="py-3 border-b">Dashboard & Analytics</div>
                                        <div className="py-3 border-b">Ad Creative</div>

                                        <div className="font-bold py-3 border-b mt-4">AI & Automation</div>
                                        <div className="py-3 border-b">AI-Driven Automation</div>
                                        <div className="py-3 border-b">Campaign Creation</div>

                                        <div className="font-bold py-3 border-b mt-4">Support & Onboarding</div>
                                        <div className="py-3 border-b">Support Level</div>
                                        <div className="py-3">Setup & Onboarding</div>
                                    </div>

                                    {/* Plans */}
                                    {['TIER1', 'TIER2', 'TIER3', 'AGENCY'].map((planCode) => {
                                        const plan = plans.find(p => p.code === planCode)!;
                                        return (
                                            <div key={planCode}
                                                className={`p-4 ${planCode === 'TIER2' ? 'bg-green-50 border-green-200 border-2' : 'bg-white'} 
                                    ${planCode === 'AGENCY' ? 'rounded-r-lg' : ''}`}>
                                                {/* Header */}
                                                <div className="h-16 flex flex-col justify-center items-center text-center">
                                                    <Text fw={600}>{plan.name}</Text>
                                                    <Text className='text-blue-600' fw={700} size="lg">{plan.price}</Text>
                                                </div>

                                                {/* Feature Values */}
                                                <div className="font-bold py-3 border-b opacity-0">Account & Platform</div>
                                                <div className="py-3 border-b text-center">
                                                    {planCode === 'TIER1' && <Badge color="blue">1 Account</Badge>}
                                                    {planCode === 'TIER2' && <Badge color="green">5 Accounts</Badge>}
                                                    {planCode === 'TIER3' && <Badge color="violet">Unlimited</Badge>}
                                                    {planCode === 'AGENCY' && <Badge color="orange">Unlimited + Multi-Platform</Badge>}
                                                </div>
                                                <div className="py-3 border-b text-center">
                                                    {planCode === 'TIER1' && <Text>Meta Only</Text>}
                                                    {planCode === 'TIER2' && <Text>Meta + Google & TikTok</Text>}
                                                    {planCode === 'TIER3' && <Text>All Platforms</Text>}
                                                    {planCode === 'AGENCY' && <Text>All + Custom</Text>}
                                                </div>

                                                <div className="font-bold py-3 border-b mt-4 opacity-0">Analytics & Creative</div>
                                                <div className="py-3 border-b text-center">
                                                    {planCode === 'TIER1' && <IconCheck size={20} className="mx-auto" />}
                                                    {planCode === 'TIER2' && <IconCheck size={20} className="mx-auto text-green-500" />}
                                                    {planCode === 'TIER3' && <Text className="text-violet-500 font-medium">Custom Reports</Text>}
                                                    {planCode === 'AGENCY' && <Text className="text-orange-500 font-medium">Branded Dashboards</Text>}
                                                </div>
                                                <div className="py-3 border-b text-center">
                                                    {planCode === 'TIER1' && <Text>Your Assets</Text>}
                                                    {planCode === 'TIER2' && <Text>5 Custom/mo</Text>}
                                                    {planCode === 'TIER3' && <Text className="text-violet-500 font-medium">Unlimited</Text>}
                                                    {planCode === 'AGENCY' && <Text className="text-orange-500 font-medium">White-glove</Text>}
                                                </div>

                                                <div className="font-bold py-3 border-b mt-4 opacity-0">AI & Automation</div>
                                                <div className="py-3 border-b text-center">
                                                    {planCode === 'TIER1' && <IconX size={20} className="mx-auto text-red-500" />}
                                                    {planCode === 'TIER2' && <Text>Recommendations</Text>}
                                                    {planCode === 'TIER3' && <Text className="text-violet-500 font-medium">Full Automation</Text>}
                                                    {planCode === 'AGENCY' && <Text className="text-orange-500 font-medium">AI + Human Hybrid</Text>}
                                                </div>
                                                <div className="py-3 border-b text-center">
                                                    {planCode === 'TIER1' && <Text>Manual</Text>}
                                                    {planCode === 'TIER2' && <Text>Semi-automated</Text>}
                                                    {planCode === 'TIER3' && <Text className="text-violet-500 font-medium">One-click Launch</Text>}
                                                    {planCode === 'AGENCY' && <Text className="text-orange-500 font-medium">Fully Managed</Text>}
                                                </div>

                                                <div className="font-bold py-3 border-b mt-4 opacity-0">Support & Onboarding</div>
                                                <div className="py-3 border-b text-center">
                                                    {planCode === 'TIER1' && <Text>Email</Text>}
                                                    {planCode === 'TIER2' && <Text>Priority + Chat</Text>}
                                                    {planCode === 'TIER3' && <Text className="text-violet-500 font-medium">Dedicated Support</Text>}
                                                    {planCode === 'AGENCY' && <Text className="text-orange-500 font-medium">24/7 White-glove</Text>}
                                                </div>
                                                <div className="py-3 text-center">
                                                    {planCode === 'TIER1' && <Text>Self-guided</Text>}
                                                    {planCode === 'TIER2' && <Text>Guided Videos</Text>}
                                                    {planCode === 'TIER3' && <Text className="text-violet-500 font-medium">Personalized Call</Text>}
                                                    {planCode === 'AGENCY' && <Text className="text-orange-500 font-medium">Full Workshop</Text>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Tabs.Panel>

                            {/* Detailed Specifications Table */}
                            <Tabs.Panel value="details" pt="xl">
                                <div className="overflow-x-auto">
                                    <Table highlightOnHover className="min-w-full">
                                        <thead>
                                            <tr>
                                                <th className="whitespace-nowrap">Feature</th>
                                                <th className="whitespace-nowrap">Tier 1 – Starter</th>
                                                <th className="whitespace-nowrap">Tier 2 – Growth</th>
                                                <th className="whitespace-nowrap">Tier 3 – Premium</th>
                                                <th className="whitespace-nowrap">Agency Partnership</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* Account & Platform Section */}
                                            <tr className="bg-gray-400">
                                                <td colSpan={5} className="font-bold py-3">Account & Platform Features</td>
                                            </tr>
                                            <tr>
                                                <td className="font-medium">Ad Account Connections</td>
                                                <td>1 Meta Ad Account</td>
                                                <td>Up to 5 Meta Ad Accounts</td>
                                                <td>Unlimited Meta Ad Accounts</td>
                                                <td>Unlimited across Meta + Google Ads + TikTok (and more)</td>
                                            </tr>
                                            <tr>
                                                <td className="font-medium">Platforms Supported</td>
                                                <td>Meta only</td>
                                                <td>Meta + (soon) Google Ads & TikTok</td>
                                                <td>All supported platforms</td>
                                                <td>All platforms + custom integrations</td>
                                            </tr>

                                            {/* Analytics & Creative Section */}
                                            <tr className="bg-gray-300">
                                                <td colSpan={5} className="font-bold py-3">Analytics & Creative</td>
                                            </tr>
                                            <tr>
                                                <td className="font-medium">Dashboard & Analytics</td>
                                                <td>Basic performance metrics (spend, clicks, impressions)</td>
                                                <td>Advanced analytics: filters, date-range, split by campaign/ad set</td>
                                                <td>Custom dashboards & reports (drag-drop widgets, exportable PDF/CSV)</td>
                                                <td>Fully custom reporting, private branded dashboards</td>
                                            </tr>
                                            <tr>
                                                <td className="font-medium">Ad Creative</td>
                                                <td>Use your own assets</td>
                                                <td>Team-designed ad creatives (up to 5/month)</td>
                                                <td>Unlimited custom ad creatives by our in-house design team</td>
                                                <td>White-glove creative: video, carousel, dynamic ads, landing pages</td>
                                            </tr>

                                            {/* AI & Automation Section */}
                                            <tr className="bg-gray-200">
                                                <td colSpan={5} className="font-bold py-3">AI & Automation</td>
                                            </tr>
                                            <tr>
                                                <td className="font-medium">AI-Driven Automation</td>
                                                <td><IconX size={16} color="red" /></td>
                                                <td>Recommendations: algorithm suggests your top social posts as ads</td>
                                                <td>
                                                    <div>
                                                        <Text fw={500}>Full Automation:</Text>
                                                        <List size="xs" withPadding>
                                                            <List.Item>Input budget, location & goal</List.Item>
                                                            <List.Item>System finds best-performing organic posts</List.Item>
                                                            <List.Item>Creates & launches campaigns automatically</List.Item>
                                                            <List.Item>30-day re-ranking & creative swap</List.Item>
                                                        </List>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div>
                                                        <Text fw={500}>Full-Service AI + Human Hybrid:</Text>
                                                        <List size="xs" withPadding>
                                                            <List.Item>All Tier 3 automation features</List.Item>
                                                            <List.Item>Dedicated strategist optimizes targeting</List.Item>
                                                            <List.Item>Monthly performance reviews & strategy calls</List.Item>
                                                        </List>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="font-medium">Campaign Creation</td>
                                                <td>Manual set-up via wizard</td>
                                                <td>Semi-auto: wizard + AI suggestions</td>
                                                <td>Fully auto: one-click create & launch based on AI insights</td>
                                                <td>End-to-end managed campaigns by DeepVisor team</td>
                                            </tr>

                                            {/* Support Section */}
                                            <tr className="bg-gray-100">
                                                <td colSpan={5} className="font-bold py-3">Support & Onboarding</td>
                                            </tr>
                                            <tr>
                                                <td className="font-medium">Support</td>
                                                <td>Email support</td>
                                                <td>Priority email & chat</td>
                                                <td>Dedicated phone & email support; monthly strategy session</td>
                                                <td>24/7 white-glove support; direct line to your account manager</td>
                                            </tr>
                                        </tbody>
                                    </Table>
                                </div>
                            </Tabs.Panel>
                        </Tabs>
                    </div>

                    {selectedPlan && selectedPlan !== 'AGENCY' && (
                        <Button
                            fullWidth
                            size="xl"
                            mt="xl"
                            onClick={handleCheckout}
                            loading={isLoading}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Preparing Checkout...' : `Subscribe to ${plans.find(p => p.code === selectedPlan)?.name}`}
                        </Button>
                    )}
                </Stack>
            </Container>
        </div>
    );
}
