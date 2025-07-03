'use client';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import { useRef, useState } from 'react';
import {
    Button, Card, Group, Paper, Select, Stepper, Text, TextInput,
    NumberInput, FileInput, Stack, Divider, SimpleGrid, Title,
    Radio, Badge, ThemeIcon, Image, Box, Avatar, Flex,
    Center, Container, AspectRatio, Checkbox, MultiSelect
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import {
    IconUpload, IconPhoto, IconArrowRight, IconMapPin,
    IconCalendar, IconCurrencyDollar, IconCheck, IconBrandFacebook,
    IconSearch, IconChartBar, IconBuildingStore, IconSettings,
    IconCheckbox, IconMessageCircle, IconShoppingCart, IconDeviceMobile,
    IconForms, IconBrandAirtable, IconInfoCircle, IconRocket,
    IconArrowLeft, IconTarget
} from '@tabler/icons-react';

import { getDestinationConfig } from '../common/utils/destinationHelpers';
import { getStepIcon } from '../common/utils/iconHelpers';
import ObjectiveStep from '../common/steps/ObjectiveStep';
import { useCampaignForm } from '../common/hooks/useCampaignForm';
import { useFacebookPages } from '../common/hooks/useFacebookPages';
import { useObjectiveMapping } from '../common/hooks/useObjectiveMapping';
import { useCampaignSteps } from '../common/hooks/useCampaignSteps';
import CampaignDetailsStep from '../common/steps/CampaignDetailsStep';
import AdSetStep from '../common/steps/AdSetStep';
import CreativeAssetsStep from '../common/steps/CreativeAssetsStep';
import MediaSelectionModal from '../common/MediaSelectionModal';
import ReviewStep from '../common/steps/ReviewStep';

// Helper function for destination configs 

interface MetaCampaignBuilderProps {
    onBack: () => void;
}

export default function MetaCampaignBuilder({ onBack }: MetaCampaignBuilderProps) {
    // Custom hooks
    const form = useCampaignForm();
    const { active, setActive, nextStep, prevStep } = useCampaignSteps(form, 7);
    const { handleObjectiveChange, handleDestinationChange } = useObjectiveMapping(form);
    const { facebookPages, loadingPages, pagesError } = useFacebookPages(
        (fieldName: string, value: any) => form.setFieldValue(fieldName, value),
        active === 2
    );
    // Local state
    const [mediaModalOpened, setMediaModalOpened] = useState(false);
    console.log(form.values)
    return (
        <Container size="lg" py="xl">
            <Group justify="apart" mb="xl">
                <Stack gap={0}>
                    <Title order={2}>Create Manual Campaign</Title>
                    <Text c="dimmed">Full control over your Meta ad campaign settings</Text>
                </Stack>
                <Badge size="lg" color="blue" variant="filled">Meta Platform</Badge>
            </Group>
            <Paper p="xl" radius="md" withBorder>


                <Stepper
                    id='top'
                    active={active}
                    onStepClick={setActive}
                    color="blue"
                    size="sm"
                    iconSize={32}
                    allowNextStepsSelect={false}
                >
                    {/* Campaign Objective Step */}
                    <Stepper.Step
                        label="Campaign Objective"
                        description="Choose your goal"
                        icon={getStepIcon(0)}
                        completedIcon={getStepIcon(0)}
                    >
                        <ObjectiveStep
                            form={form}
                            handleObjectiveChange={handleObjectiveChange}
                            isSmart={false}
                        />

                        <Group justify="right" mt="md">
                            <Button
                                rightSection={<IconArrowRight size={16} />}
                                onClick={nextStep}
                            >
                                Continue
                            </Button>
                        </Group>
                    </Stepper.Step>

                    {/* Campaign Details Step */}
                    <Stepper.Step
                        label="Campaign Details"
                        description="Basic information"
                        icon={getStepIcon(1)}
                        completedIcon={getStepIcon(1)}
                    >
                        <CampaignDetailsStep
                            form={form}
                            handleDestinationChange={handleDestinationChange}
                            getDestinationConfig={getDestinationConfig}
                            isSmart={false} // This is false for manual campaigns
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
                    </Stepper.Step>

                    {/* Ad Set Step */}
                    <Stepper.Step
                        label="Ad Set"
                        description="Audience targeting"
                        icon={getStepIcon(2)}
                        completedIcon={getStepIcon(2)}
                    >
                        <AdSetStep
                            form={form}
                            facebookPages={facebookPages}
                            loadingPages={loadingPages}
                            pagesError={pagesError}
                            isSmart={false}
                        />

                        <Group justify="apart" mt="md">
                            <Button variant="light" onClick={prevStep}>
                                Back to Campaign Details
                            </Button>
                            <Button
                                rightSection={<IconArrowRight size={16} />}
                                onClick={nextStep}
                            >
                                Continue to Ad
                            </Button>
                        </Group>
                    </Stepper.Step>

                    {/* Creative Assets Step */}
                    <Stepper.Step
                        label="Creative Assets"
                        description="Images & videos"
                        icon={getStepIcon(3)}
                        completedIcon={getStepIcon(3)}
                    >
                        <CreativeAssetsStep
                            form={form}
                            setMediaModalOpened={setMediaModalOpened}
                            mediaModalOpened={mediaModalOpened}
                            isSmart={false}
                        />

                        <Group justify="apart" mt="md">
                            <Button variant="light" onClick={prevStep}>
                                Back to Ad Set
                            </Button>

                            <Button
                                rightSection={<IconArrowRight size={16} />}
                                onClick={nextStep}
                            >
                                Continue to Review
                            </Button>
                        </Group>
                        <MediaSelectionModal
                            opened={mediaModalOpened}
                            onClose={() => setMediaModalOpened(false)}
                            selectedIds={form.values.existingPostIds || []}
                            onSelectionChange={(ids) => form.setFieldValue('existingPostIds', ids)}
                        />
                    </Stepper.Step>

                    {/* Review Step */}
                    <Stepper.Step
                        label="Review"
                        description="Final review"
                        icon={getStepIcon(2)}
                        completedIcon={getStepIcon(2)}
                    >
                        <ReviewStep
                            form={form}
                            setActive={setActive}
                            isSmart={false}
                        />
                    </Stepper.Step>

                </Stepper>
                <Group mb="md">
                    <Button
                        variant="subtle"
                        leftSection={<IconArrowLeft size={16} />}
                        onClick={onBack}
                    >
                        Back to Platforms
                    </Button>
                </Group>
            </Paper>
        </Container>
    );
}