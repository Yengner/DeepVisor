// 'use client';

// // React imports
// import { useState } from 'react';

// // Mantine components and icons
// import { Badge, Button, Container, Group, Paper, Stack, Stepper, Title, Text, ThemeIcon } from '@mantine/core';
// import { IconArrowLeft, IconArrowRight, IconRobot, IconSparkles } from '@tabler/icons-react';

// // Utility functions and types
// import { getDestinationConfig } from '../common/utils/destinationHelpers';
// import { getStepIcon } from '../common/utils/iconHelpers';

// // Custom hooks
// import { useCampaignForm } from '../../platforms/meta/hooks/useCampaignForm';
// import { useFacebookPages } from '../../platforms/meta/hooks/useFacebookPages';
// import { useObjectiveMapping } from '../../platforms/meta/hooks/useObjectiveMapping';
// import { useCampaignSteps } from '../../platforms/meta/hooks/useCampaignSteps';

// // Common steps and components
// import ObjectiveStep from '../common/steps/ObjectiveStep';
// import CampaignDetailsStep from '../common/steps/CampaignDetailsStep';
// import AdSetStep from '../common/steps/AdSetStep';
// import CreativeAssetsStep from '../common/steps/CreativeAssetsStep';
// import ReviewStep from '../common/steps/ReviewStep';
// import MediaSelectionModal from '../common/MediaSelectionModal';

// interface SmartCampaignBuilderProps {
//     onBack: () => void;
// }

// export default function SmartCampaignBuilder({ onBack }: SmartCampaignBuilderProps) {
//     // Custom hooks with isSmart=true for smart campaign mode
//     const form = useCampaignForm(true);
//     const { active, setActive, nextStep, prevStep } = useCampaignSteps(form, 5);
//     const { handleObjectiveChange, handleDestinationChange } = useObjectiveMapping(form);
//     const { facebookPages, loadingPages, pagesError } = useFacebookPages(
//         (fieldName: string, value: any) => form.setFieldValue(fieldName, value),
//         active === 2
//     );

//     // Local state
//     const [mediaModalOpened, setMediaModalOpened] = useState(false);

//     return (
//         <Container size="lg" py="xl">
//             <Group justify="apart" mb="xl">
//                 <Stack gap={0}>
//                     <Group align="center">
//                         <Title order={2}>Create AI-Powered Campaign</Title>
//                         <ThemeIcon color="blue" variant="light" size="lg" radius="xl">
//                             <IconSparkles size={18} />
//                         </ThemeIcon>
//                     </Group>
//                     <Text c="dimmed">Let AI optimize your Meta campaign for best performance</Text>
//                 </Stack>
//                 <Badge size="lg" color="indigo" variant="filled" leftSection={<IconRobot size={14} />}>
//                     Smart Campaign
//                 </Badge>
//             </Group>

//             <Paper p="xl" radius="md" withBorder>
//                 <Stepper
//                     id='top'
//                     active={active}
//                     onStepClick={setActive}
//                     color="indigo"
//                     size="sm"
//                     iconSize={32}
//                     allowNextStepsSelect={false}
//                 >
//                     {/* Campaign Objective Step */}
//                     <Stepper.Step
//                         label="Campaign Objective"
//                         description="Choose your goal"
//                         icon={getStepIcon(0)}
//                         completedIcon={getStepIcon(0)}
//                     >
//                         <ObjectiveStep
//                             form={form}
//                             handleObjectiveChange={handleObjectiveChange}
//                             isSmart={true}
//                         />

//                         <Group justify="right" mt="md">
//                             <Button
//                                 color="indigo"
//                                 rightSection={<IconArrowRight size={16} />}
//                                 onClick={nextStep}
//                             >
//                                 Continue
//                             </Button>
//                         </Group>
//                     </Stepper.Step>

//                     {/* Campaign Details Step */}
//                     <Stepper.Step
//                         label="Campaign Details"
//                         description="Basic information"
//                         icon={getStepIcon(1)}
//                         completedIcon={getStepIcon(1)}
//                     >
//                         <CampaignDetailsStep
//                             form={form}
//                             handleDestinationChange={handleDestinationChange}
//                             getDestinationConfig={getDestinationConfig}
//                             isSmart={true}
//                             setPresetModalOpened={() => { }}  // Not needed for smart campaigns
//                         />

//                         <Group justify="apart" mt="md">
//                             <Button variant="light" color="indigo" onClick={prevStep}>
//                                 Back to Objective
//                             </Button>
//                             <Button
//                                 color="indigo"
//                                 rightSection={<IconArrowRight size={16} />}
//                                 onClick={nextStep}
//                             >
//                                 Continue to Audience
//                             </Button>
//                         </Group>
//                     </Stepper.Step>

//                     {/* Ad Set Step - Simplified for Smart Campaigns */}
//                     <Stepper.Step
//                         label="Audience"
//                         description="Basic targeting"
//                         icon={getStepIcon(2)}
//                         completedIcon={getStepIcon(2)}
//                     >
//                         <Paper withBorder p="md" radius="md" bg="indigo.0" mb="lg">
//                             <Group>
//                                 <ThemeIcon size="lg" color="indigo" variant="light" radius="xl">
//                                     <IconRobot size={20} />
//                                 </ThemeIcon>
//                                 <Stack gap={0}>
//                                     <Text fw={600}>AI-Powered Audience Optimization</Text>
//                                     <Text size="sm">
//                                         Our AI will automatically test multiple audience combinations
//                                         and optimize for your {form.values.objective} objective.
//                                     </Text>
//                                 </Stack>
//                             </Group>
//                         </Paper>

//                         <AdSetStep
//                             form={form}
//                             facebookPages={facebookPages}
//                             loadingPages={loadingPages}
//                             pagesError={pagesError}
//                             isSmart={true}
//                         />

//                         <Group justify="apart" mt="md">
//                             <Button variant="light" color="indigo" onClick={prevStep}>
//                                 Back to Campaign Details
//                             </Button>
//                             <Button
//                                 color="indigo"
//                                 rightSection={<IconArrowRight size={16} />}
//                                 onClick={nextStep}
//                             >
//                                 Continue to Creative
//                             </Button>
//                         </Group>
//                     </Stepper.Step>

//                     {/* Creative Assets Step - Simplified for Smart Campaigns */}
//                     <Stepper.Step
//                         label="Creative Assets"
//                         description="Ad content"
//                         icon={getStepIcon(3)}
//                         completedIcon={getStepIcon(3)}
//                     >
//                         <Paper withBorder p="md" radius="md" bg="indigo.0" mb="lg">
//                             <Group>
//                                 <ThemeIcon size="lg" color="indigo" variant="light" radius="xl">
//                                     <IconSparkles size={20} />
//                                 </ThemeIcon>
//                                 <Stack gap={0}>
//                                     <Text fw={600}>AI-Optimized Creative Testing</Text>
//                                     <Text size="sm">
//                                         We'll automatically create multiple ad variations and test them
//                                         to find the best performers for your objective.
//                                     </Text>
//                                 </Stack>
//                             </Group>
//                         </Paper>

//                         <CreativeAssetsStep
//                             form={form}
//                             setMediaModalOpened={setMediaModalOpened}
//                             mediaModalOpened={mediaModalOpened}
//                             isSmart={true}
//                         />

//                         <Group justify="apart" mt="md">
//                             <Button variant="light" color="indigo" onClick={prevStep}>
//                                 Back to Audience
//                             </Button>

//                             <Button
//                                 color="indigo"
//                                 rightSection={<IconArrowRight size={16} />}
//                                 onClick={nextStep}
//                             >
//                                 Continue to Review
//                             </Button>
//                         </Group>
//                         <MediaSelectionModal
//                             opened={mediaModalOpened}
//                             onClose={() => setMediaModalOpened(false)}
//                             selectedIds={form.values.existingCreativeIds || []}
//                             onSelectionChange={(ids) => form.setFieldValue('existingCreativeIds', ids)}
//                         />
//                     </Stepper.Step>

//                     {/* Review Step */}
//                     <Stepper.Step
//                         label="Review"
//                         description="Final review"
//                         icon={getStepIcon(4)}
//                         completedIcon={getStepIcon(4)}
//                     >
//                         <Paper withBorder p="md" radius="md" bg="indigo.0" mb="lg">
//                             <Group>
//                                 <ThemeIcon size="lg" color="indigo" variant="light" radius="xl">
//                                     <IconRobot size={20} />
//                                 </ThemeIcon>
//                                 <Stack gap={0}>
//                                     <Text fw={600}>Smart Campaign Ready for Launch</Text>
//                                     <Text size="sm">
//                                         Our AI will automatically manage and optimize your campaign for
//                                         best performance. We'll create multiple ad variations, test different
//                                         audiences, and continuously refine your campaign.
//                                     </Text>
//                                 </Stack>
//                             </Group>
//                         </Paper>

//                         <ReviewStep
//                             form={form}
//                             setActive={setActive}
//                             isSmart={true}
//                         />
//                     </Stepper.Step>

//                 </Stepper>
//                 <Group mb="md">
//                     <Button
//                         variant="subtle"
//                         color="indigo"
//                         leftSection={<IconArrowLeft size={16} />}
//                         onClick={onBack}
//                     >
//                         Back to Platforms
//                     </Button>
//                 </Group>
//             </Paper>
//         </Container>
//     );
// }