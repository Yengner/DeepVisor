'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Badge,
    Button,
    Container,
    Group,
    Paper,
    Stack,
    Stepper,
    Text,
    ThemeIcon,
    Title,
} from '@mantine/core';
import { IconArrowLeft, IconArrowRight, IconBrush, IconLayersIntersect, IconTargetArrow } from '@tabler/icons-react';
import type { CampaignTreeNode } from '@/lib/server/data';
import { useMetaCampaignForm } from '../hooks/useMetaCampaignForm';
import AdSetStep from '../steps/AdSetStep';
import CreativeAssetsStep from '../steps/CreativeAssetsStep';
import ManualMetaAdSetReview from '../components/ManualMetaAdSetReview';

interface ManualMetaAdSetBuilderProps {
    platformData: {
        id: string;
        platform_name: string;
    };
    adAccountId: string;
    existingCampaign: CampaignTreeNode;
}

export default function ManualMetaAdSetBuilder({
    platformData,
    adAccountId,
    existingCampaign,
}: ManualMetaAdSetBuilderProps) {
    const router = useRouter();
    const form = useMetaCampaignForm(platformData.id, adAccountId, false, null);
    const [active, setActive] = useState(0);
    const initializedKeyRef = useRef<string | null>(null);
    const handleBackToStarter = () => {
        router.push('/campaigns/create?scope=adset');
    };

    useEffect(() => {
        const initKey = existingCampaign.id;
        if (initializedKeyRef.current === initKey) {
            return;
        }

        initializedKeyRef.current = initKey;
        form.setFieldValue('creationScope', 'adset');
        form.setFieldValue('parentCampaignExternalId', existingCampaign.id);
        form.setFieldValue('parentAdSetExternalId', null);
        form.setFieldValue('step', 'adset');
        form.setFieldValue('activeAdSetIdx', 0);
        form.setFieldValue('adSetSubStep', 'adset');
        form.setFieldValue('campaign.campaignName', existingCampaign.name);
        if (existingCampaign.objective) {
            form.setFieldValue('campaign.objective', existingCampaign.objective);
        }
        if (!form.values.adSets[0]?.adSetName) {
            form.setFieldValue('adSets.0.adSetName', `${existingCampaign.name} - New ad set`);
        }
    }, [existingCampaign.id, existingCampaign.name, existingCampaign.objective]);

    const openAdSetStep = () => {
        form.setFieldValue('step', 'adset');
        form.setFieldValue('adSetSubStep', 'adset');
        form.setFieldValue('activeAdSetIdx', 0);
        setActive(0);
    };

    const openCreativeStep = () => {
        form.setFieldValue('step', 'adset');
        form.setFieldValue('adSetSubStep', 'creative');
        form.setFieldValue('activeAdSetIdx', 0);
        setActive(1);
    };

    return (
        <Container size="lg" py="xl">
            <Stack gap="xl">
                <Group justify="apart" align="flex-start">
                    <Stack gap="xs">
                        <Badge w="fit-content" size="lg" variant="light" color="blue">
                            Add Ad Set
                        </Badge>
                        <Title order={2}>Build a new ad set inside {existingCampaign.name}</Title>
                        <Text c="dimmed" maw={760}>
                            You are working inside an existing campaign now, so the flow is focused on
                            audience targeting and the first creative instead of the full campaign setup.
                        </Text>
                    </Stack>
                    <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={handleBackToStarter}>
                        Choose a different campaign
                    </Button>
                </Group>

                <Paper withBorder radius="xl" p="lg">
                    <Group gap="md" wrap="wrap">
                        <Group gap="sm">
                            <ThemeIcon color="blue" variant="light" radius="xl">
                                <IconLayersIntersect size={18} />
                            </ThemeIcon>
                            <Stack gap={0}>
                                <Text size="sm" fw={700}>Parent campaign</Text>
                                <Text size="sm" c="dimmed">{existingCampaign.name}</Text>
                            </Stack>
                        </Group>
                        <Badge variant="light" color="violet">
                            {existingCampaign.objective || 'LEADS'}
                        </Badge>
                        <Badge variant="light" color="gray">
                            {existingCampaign.adset_metrics.length} existing ad sets
                        </Badge>
                    </Group>
                </Paper>

                <Paper withBorder radius="xl" p="xl">
                    <Stepper
                        id="top"
                        active={active}
                        onStepClick={setActive}
                        allowNextStepsSelect={false}
                        color="blue"
                        iconSize={34}
                    >
                        <Stepper.Step
                            label="Ad Set"
                            description="Targeting and delivery"
                            icon={<IconTargetArrow size={18} />}
                        >
                            <AdSetStep form={form} isSmart={false} />
                            <Group justify="apart" mt="md">
                                <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={handleBackToStarter}>
                                    Back
                                </Button>
                                <Button rightSection={<IconArrowRight size={16} />} onClick={openCreativeStep}>
                                    Continue to creative
                                </Button>
                            </Group>
                        </Stepper.Step>

                        <Stepper.Step
                            label="Creative"
                            description="First ad creative"
                            icon={<IconBrush size={18} />}
                        >
                            <CreativeAssetsStep
                                form={form}
                                platformData={platformData}
                                adAccountId={adAccountId}
                                isSmart={false}
                            />
                            <Group justify="apart" mt="md">
                                <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={openAdSetStep}>
                                    Back to ad set
                                </Button>
                                <Button rightSection={<IconArrowRight size={16} />} onClick={() => setActive(2)}>
                                    Review
                                </Button>
                            </Group>
                        </Stepper.Step>

                        <Stepper.Step
                            label="Review"
                            description="Ready to submit"
                            icon={<IconLayersIntersect size={18} />}
                        >
                            <ManualMetaAdSetReview
                                values={form.values}
                                campaignName={existingCampaign.name}
                                onBack={openCreativeStep}
                            />
                        </Stepper.Step>
                    </Stepper>
                </Paper>
            </Stack>
        </Container>
    );
}
