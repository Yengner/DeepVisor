'use client';

import { Badge, Button, Container, Group, Paper, Stack, Stepper as MantineStepper, Title, Text, Modal } from '@mantine/core';
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import { useObjectiveMapping } from '../hooks/useObjectiveMapping';
import { useCampaignSteps } from '../../../common/useCampaignSteps';
import { useMetaCampaignForm } from '../hooks/useMetaCampaignForm';
import { getStepIcon } from '../utils/iconHelpers';
import ObjectiveStep from '../steps/ObjectiveStep';
import CampaignDetailsStep from '../steps/CampaignDetailsStep';
import { getDestinationConfig } from '../utils/destinationHelpers';
import AdSetStep from '../steps/AdSetStep';
import CreativeAssetsStep from '../steps/CreativeAssetsStep';
import { useMetaPages } from '../hooks/useMetaPages';
import ReviewStep from '../steps/ReviewStep';
import MetaCampaignFlowPreview from '../components/MetaCampaignFlowPreview';
import { useState } from 'react';


interface MetaCampaignBuilderProps {
    platformData: {
        id: string;
        platform_name: string;
    }
    adAccountId: string;
    onBack: () => void;
}

/**
 * 
 * @param {MetaCampaignBuilderProps} props - Properties for the MetaCampaignBuilder component
 * @returns 
 */

export default function ManualMetaCampaignBuilder({ platformData, adAccountId, onBack }: MetaCampaignBuilderProps) {
    const form = useMetaCampaignForm(platformData.id, adAccountId, false);
    const { handleDestinationChange } = useObjectiveMapping(form);
    const { active, setActive, nextStep, prevStep } = useCampaignSteps(form, 4);

    const [flowModalOpen, setFlowModalOpen] = useState(false);

    // Helper: Are we in the Ad Set step?
    const isAdSetStep = active === 2;
    // Helper: Are we in the Ad Set list view?
    const isAdSetList = isAdSetStep && form.values.step === 'list';
    // Helper: Are we editing an Ad Set?
    const isEditingAdSet = isAdSetStep && form.values.step === 'adset' && form.values.activeAdSetIdx !== null;
    // Helper: Are we in Creative substep?
    const isCreativeSubStep = isAdSetStep && form.values.adSetSubStep === 'creative' && isEditingAdSet;

    // Handler: After finishing creative, go back to list
    const handleFinishCreative = () => {
        form.setFieldValue('step', 'list');
        form.setFieldValue('adSetSubStep', 'adset');
        form.setFieldValue('activeAdSetIdx', null);
    };

    // Handler: Continue to Review from Ad Set list
    const handleContinueToReview = () => {
        setActive(3); // Go to Review step
    };

    return (
        <form>
            <Container size='lg' py='xl'>
                {/* --- React Flow Preview Modal --- */}

                {/* <Modal
                    opened={flowModalOpen}
                    onClose={() => setFlowModalOpen(false)}
                    size="xl"
                    centered
                    title="Campaign Structure Preview"
                    overlayProps={{
                        blur: 2,
                        backgroundOpacity: 0.5,
                    }}
                    styles={{
                        content: { padding: 0, minHeight: 420, minWidth: 700 },
                        header: { borderBottom: '1px solid #eee' },
                    }}
                >
                    <div style={{ padding: 24 }}>
                        <MetaCampaignFlowPreview
                            campaign={form.values.campaign.campaignName ? campaign : null}
                            adSets={adSets}
                            creatives={creatives}
                        />
                    </div>
                </Modal> */}

                {/* --- Campaign Builder Header --- */}
                <Group justify="apart" align="center" mb="xl">
                    <Stack gap={0}>
                        <Title order={2}>Create Manual Campaign</Title>
                        <Text c="dimmed">Full control over your Meta ad campaign settings</Text>
                    </Stack>
                    <Group>
                        <Badge size="lg" color="blue" variant="filled">Meta Platform</Badge>
                        <Button
                            variant="outline"
                            color="blue"
                            ml="md"
                            onClick={() => setFlowModalOpen(true)}
                        >
                            Preview Campaign Structure
                        </Button>
                    </Group>
                </Group>


                {/* --- Campaign Steps --- */}
                <Paper p="xl" radius="md" withBorder>
                    <MantineStepper
                        id='top'
                        active={active}
                        onStepClick={setActive}
                        color="blue"
                        size="sm"
                        iconSize={32}
                        allowNextStepsSelect={false}
                    >
                        {/* Campaign Objective Step */}
                        <MantineStepper.Step
                            label="Campaign Objective"
                            description="Choose your goal"
                            icon={getStepIcon(0)}
                            completedIcon={getStepIcon(0)}
                        >
                            <ObjectiveStep
                                form={form}
                                isFast={false}
                            />

                            <Group justify="right" mt="md">
                                <Button
                                    rightSection={<IconArrowRight size={16} />}
                                    onClick={nextStep}
                                >
                                    Continue
                                </Button>
                            </Group>
                        </MantineStepper.Step>

                        {/* Campaign Details Step */}
                        <MantineStepper.Step
                            label="Campaign Details"
                            description="Basic information"
                            icon={getStepIcon(1)}
                            completedIcon={getStepIcon(1)}
                        >
                            <CampaignDetailsStep
                                form={form}
                                handleDestinationChange={handleDestinationChange}
                                getDestinationConfig={getDestinationConfig}
                                isSmart={false}
                            />

                            <Group justify="apart" mt="md">
                                <Button variant="light" onClick={prevStep}>
                                    Back to Objective
                                </Button>
                                <Button
                                    rightSection={<IconArrowRight size={16} />}
                                    onClick={nextStep}
                                >
                                    Continue to Ad Set
                                </Button>
                            </Group>
                        </MantineStepper.Step>

                        {/* Ad Set Step */}
                        <MantineStepper.Step
                            label="Ad Set"
                            description="Audience targeting"
                            icon={getStepIcon(2)}
                            completedIcon={getStepIcon(2)}
                        >
                            {/* Ad Set List View */}
                            {isAdSetList && (
                                <>
                                    <AdSetStep
                                        form={form}
                                        isSmart={false}
                                    />

                                    <Group justify="apart" mt="md">
                                        <Button variant="light" onClick={prevStep}>
                                            Back to Campaign Details
                                        </Button>
                                        <Button
                                            rightSection={<IconArrowRight size={16} />}
                                            onClick={handleContinueToReview}
                                            disabled={form.values.adSets.length === 0}
                                        >
                                            Continue to Review
                                        </Button>
                                    </Group>
                                </>
                            )}

                            {/* Ad Set Edit View */}
                            {isEditingAdSet && form.values.adSetSubStep === 'adset' && (
                                <>
                                    <AdSetStep
                                        form={form}
                                        isSmart={false}
                                    />

                                    <Group justify="apart" mt="md">
                                        <Button variant="light" onClick={() => {
                                            form.setFieldValue('step', 'list');
                                            form.setFieldValue('activeAdSetIdx', null);
                                        }}>
                                            Back to Ad Set List
                                        </Button>
                                        <Button
                                            rightSection={<IconArrowRight size={16} />}
                                            onClick={() => form.setFieldValue('adSetSubStep', 'creative')}
                                        >
                                            Continue to Creative
                                        </Button>
                                    </Group>
                                </>
                            )}

                            {/* Creative Assets Substep */}
                            {isCreativeSubStep && (
                                <>
                                    <CreativeAssetsStep
                                        form={form}
                                        platformData={platformData}
                                        adAccountId={adAccountId}
                                        isSmart={false}
                                    />

                                    <Group justify="apart" mt="md">
                                        <Button variant="light" onClick={() => form.setFieldValue('adSetSubStep', 'adset')}>
                                            Back to Ad Set
                                        </Button>
                                        <Button
                                            variant="outline"
                                            color="blue"
                                            onClick={handleFinishCreative}
                                        >
                                            Save & Return to Ad Set List
                                        </Button>
                                    </Group>
                                </>
                            )}
                        </MantineStepper.Step>

                        {/* Review Step */}
                        <MantineStepper.Step
                            label="Review"
                            description="Final review"
                            icon={getStepIcon(3)}
                            completedIcon={getStepIcon(3)}
                        >
                            <ReviewStep
                                form={form}
                                setActive={setActive}
                                isSmart={false}
                            />
                        </MantineStepper.Step>

                    </MantineStepper>
                </Paper>
                <Group mb="md" pt="lg">
                    <Button
                        variant="subtle"
                        leftSection={<IconArrowLeft size={16} />}
                        onClick={onBack}
                    >
                        Back to Platforms
                    </Button>
                </Group>
            </Container>
        </form>
    );
}