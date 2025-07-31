'use client';

import {
    Card, Group, Paper, Radio, Stack, Text, ThemeIcon, Title, Divider, Box,
    FileInput, SimpleGrid, Image, Badge, Button, AspectRatio, RingProgress,
    Center, TextInput, Select, Grid, Loader, Alert
} from '@mantine/core';
import {
    IconPhoto, IconUpload, IconBrandFacebook, IconSearch, IconChartBar,
    IconBuildingStore, IconSettings, IconTarget, IconMessageCircle
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import { UseFormReturnType } from '@mantine/form';
import { CampaignFormValues } from '@/lib/actions/meta/types';
import { useFilePreview } from '../hooks/useFilePreview';
import MediaSelectionModal from '../components/MediaSelectionModal';
import { useCreativePreview } from '../hooks/useCreativePreview';

interface CreativeAssetsStepProps {
    form: UseFormReturnType<CampaignFormValues>;
    platformData: {
        id: string;
        platform_name: string;
    };
    adAccountId: string;
    isSmart?: boolean;
}

interface SelectedCreative {
    id: string;
    name: string;
    thumbnail_url?: string;
    type: string;
    previewHtml?: string;
}

/**
 * Creative Assets step for campaign creation
 * Allows users to select content sources, upload media, and configure ad text
 */
export default function CreativeAssetsStep({
    form,
    platformData,
    adAccountId,
}: CreativeAssetsStepProps) {
    // Get current ad set index
    const idx = form.values.activeAdSetIdx ?? 0;
    console.log('Current ad set index:', idx);
    const creative = form.values.adSets?.[idx]?.creatives?.[0] || {};
    console.log('Current creative data:', creative);

    // Memoize uploadedFiles to avoid infinite update loop
    const uploadedFiles = useMemo(() => creative.uploadedFiles || [], [creative.uploadedFiles]);

    const [mediaModalOpened, setMediaModalOpened] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [selectedCreative, setSelectedCreative] = useState<SelectedCreative | null>(null);

    // Use memoized uploadedFiles
    const { filePreview, handleFilesChange } = useFilePreview(uploadedFiles);

    const {
        previews,
        loading: loadingPreview,
        error: previewError,
        hasLoaded: previewLoaded // eslint-disable-line @typescript-eslint/no-unused-vars
    } = useCreativePreview({
        platformId: platformData.id,
        creativeId: creative.existingCreativeIds?.[0],
        enabled: creative.contentSource === 'existing' && !!creative.existingCreativeIds?.[0],
        previewTypes: ['DESKTOP_FEED_STANDARD']
    });

    const previewHtml = previews?.DESKTOP_FEED_STANDARD?.body ||
        (previews && Object.values(previews)[0]?.body);

    const handleCreativeSelection = (creativeObj: SelectedCreative | null) => {
        if (!creativeObj) {
            form.setFieldValue(`adSets.${idx}.creatives.0.existingCreativeIds`, []);
            form.setFieldValue(`adSets.${idx}.creatives.0.selectedCreativeName`, '');
            form.setFieldValue(`adSets.${idx}.creatives.0.selectedCreativeThumbnail`, '');
            form.setFieldValue(`adSets.${idx}.creatives.0.existingCreatives`, []);
            setSelectedCreative(null);
            return;
        }
        form.setFieldValue(`adSets.${idx}.creatives.0.existingCreativeIds`, [creativeObj.id]);
        form.setFieldValue(`adSets.${idx}.creatives.0.selectedCreativeName`, creativeObj.name);
        form.setFieldValue(`adSets.${idx}.creatives.0.selectedCreativeThumbnail`, creativeObj.thumbnail_url || '');
        form.setFieldValue(`adSets.${idx}.creatives.0.existingCreatives`, [creativeObj.id]);
        setSelectedCreative(creativeObj);
    };

    const showCustomTextFields = creative.contentSource === 'upload' ||
        creative.contentSource === 'auto' ||
        (creative.contentSource === 'existing' &&
            (!creative.existingCreativeIds || creative.existingCreativeIds.length === 0));

    const placeholderAd = {
        headline: "Amazing Product Launch",
        primaryText: "Discover our new collection with exclusive discounts for early buyers!",
        description: "Free shipping on all orders",
        image: "https://images.unsplash.com/photo-1560769629-975ec94e6a86?q=80&w=500&auto=format&fit=crop",
    };

    const getPreviewImage = () => {
        if (creative.contentSource === 'upload' && filePreview.length > 0) {
            return filePreview[0];
        }
        else if (creative.contentSource === 'existing' && creative.existingCreativeIds?.length > 0) {
            return creative.adPrimaryText || placeholderAd.image;
        }
        return placeholderAd.image;
    };

    const getContentSourceOptions = () => {
        return ['upload', 'existing', 'auto'];
    };

    const handleOpenMediaModal = () => {
        setMediaModalOpened(true);
    };

    return (
        <Grid gutter="md">
            {/* Left column - form inputs */}
            <Grid.Col span={{ base: 14, md: 5.5 }}>
                <Card p="md" withBorder radius="md" mb="md" mt="lg" shadow="xs">
                    <Stack>
                        <Group justify="apart">
                            <Stack gap={0}>
                                <Text fw={500} size="lg">Ad Creative Selection</Text>
                                <Text size="sm" c="dimmed">
                                    Choose how to create your ad
                                </Text>
                            </Stack>
                            <ThemeIcon size={42} radius="md" color="blue" variant="light">
                                <IconPhoto size={24} />
                            </ThemeIcon>
                        </Group>

                        <Divider my="md" />

                        {/* Content Source Selection */}
                        <Radio.Group
                            label="Content Source"
                            description="Choose where your ad content comes from"
                            {...form.getInputProps(`adSets.${idx}.creatives.0.contentSource`)}
                        >
                            <Stack mt="xs" gap="md">
                                {getContentSourceOptions().includes('upload') && (
                                    <Paper
                                        withBorder
                                        p="md"
                                        radius="md"
                                        bg={creative.contentSource === 'upload' ? 'blue.0' : undefined}
                                        style={{
                                            cursor: 'pointer',
                                            borderColor: creative.contentSource === 'upload' ? 'var(--mantine-color-blue-6)' : undefined
                                        }}
                                        onClick={() => form.setFieldValue(`adSets.${idx}.creatives.0.contentSource`, 'upload')}
                                    >
                                        <Group align="flex-start">
                                            <Radio value="upload" />
                                            <Stack gap={0}>
                                                <Text fw={600}>Upload New Content</Text>
                                                <Text size="sm" c="dimmed">Upload your own images or videos for the ad</Text>
                                            </Stack>
                                        </Group>
                                    </Paper>
                                )}

                                {getContentSourceOptions().includes('existing') && (
                                    <Paper
                                        withBorder
                                        p="md"
                                        radius="md"
                                        bg={creative.contentSource === 'existing' ? 'blue.0' : undefined}
                                        style={{
                                            cursor: 'pointer',
                                            borderColor: creative.contentSource === 'existing' ? 'var(--mantine-color-blue-6)' : undefined
                                        }}
                                        onClick={() => form.setFieldValue(`adSets.${idx}.creatives.0.contentSource`, 'existing')}
                                    >
                                        <Group align="flex-start">
                                            <Radio value="existing" />
                                            <Stack gap={0}>
                                                <Text fw={600}>Use Existing Creatives</Text>
                                                <Text size="sm" c="dimmed">
                                                    Select from existing creatives in your account
                                                </Text>
                                            </Stack>
                                        </Group>
                                    </Paper>
                                )}

                                {getContentSourceOptions().includes('auto') && (
                                    <Paper
                                        withBorder
                                        p="md"
                                        radius="md"
                                        bg={creative.contentSource === 'auto' ? 'blue.0' : undefined}
                                        style={{
                                            cursor: 'pointer',
                                            borderColor: creative.contentSource === 'auto' ? 'var(--mantine-color-blue-6)' : undefined
                                        }}
                                        onClick={() => form.setFieldValue(`adSets.${idx}.creatives.0.contentSource`, 'auto')}
                                    >
                                        <Group align="flex-start">
                                            <Radio value="auto" />
                                            <Stack gap={0}>
                                                <Text fw={600}>AI Content Selection</Text>
                                                <Text size="sm" c="dimmed">
                                                    AI selects the best content for your campaign
                                                </Text>
                                            </Stack>
                                        </Group>
                                    </Paper>
                                )}
                            </Stack>
                        </Radio.Group>

                        {/* Upload Content Option */}
                        {creative.contentSource === 'upload' && (
                            <Stack mt="md">
                                <FileInput
                                    label="Upload Images/Videos"
                                    description="Recommended size: 1080x1080px. Max 10 files."
                                    placeholder="Select files"
                                    multiple
                                    accept="image/*,video/*"
                                    leftSection={<IconUpload size={16} />}
                                    size="md"
                                    onChange={(files) => {
                                        form.setFieldValue(`adSets.${idx}.creatives.0.uploadedFiles`, files || []);
                                        handleFilesChange(files || []);
                                    }}
                                />

                                {filePreview.length > 0 && (
                                    <>
                                        <Text size="sm" fw={500} mt="md">Preview</Text>
                                        <SimpleGrid cols={3} spacing="md">
                                            {filePreview.map((preview, index) => (
                                                <Box
                                                    key={index}
                                                    style={{
                                                        position: 'relative',
                                                        borderRadius: '8px',
                                                        overflow: 'hidden',
                                                    }}
                                                >
                                                    <Image
                                                        src={preview}
                                                        height={120}
                                                        fit="cover"
                                                        radius="md"
                                                        alt={`Preview ${index + 1}`}
                                                    />
                                                    <Badge
                                                        size="xs"
                                                        color="blue"
                                                        variant="filled"
                                                        style={{
                                                            position: 'absolute',
                                                            bottom: 5,
                                                            right: 5,
                                                            opacity: 0.9
                                                        }}
                                                    >
                                                        {index + 1}
                                                    </Badge>
                                                </Box>
                                            ))}
                                        </SimpleGrid>
                                    </>
                                )}
                            </Stack>
                        )}

                        {/* Select Existing Creatives Option */}
                        {creative.contentSource === 'existing' && (
                            <Stack mt="md">
                                <Text fw={500} size="sm">Use existing creative content</Text>

                                {/* Show selected creative if any */}
                                {creative.existingCreativeIds?.length > 0 ? (
                                    <Paper p="md" withBorder radius="md">
                                        <Stack gap="xs">
                                            <Group>
                                                <AspectRatio ratio={1} style={{ width: 80 }}>
                                                    <Image
                                                        src={creative.adPrimaryText || placeholderAd.image}
                                                        radius="md"
                                                        alt="Selected creative"
                                                        fit="cover"
                                                    />
                                                </AspectRatio>
                                                <Stack gap={0}>
                                                    <Text size="sm" fw={500}>{creative.adHeadline || "Selected Creative"}</Text>
                                                    <Text size="xs" c="dimmed">
                                                        ID: {creative.existingCreativeIds[0]?.slice(-8) || ""}
                                                    </Text>
                                                    <Button
                                                        variant="light"
                                                        size="xs"
                                                        mt={5}
                                                        onClick={handleOpenMediaModal}
                                                    >
                                                        Change
                                                    </Button>
                                                </Stack>
                                            </Group>
                                        </Stack>
                                    </Paper>
                                ) : (
                                    <Button
                                        leftSection={<IconPhoto size={16} />}
                                        onClick={handleOpenMediaModal}
                                        variant="filled"
                                        color="blue"
                                    >
                                        Browse Creative Content
                                    </Button>
                                )}
                            </Stack>
                        )}

                        {/* AI Content Selection Option */}
                        {creative.contentSource === 'auto' && (
                            <Box mt="md">
                                <Center my="md">
                                    <RingProgress
                                        size={120}
                                        thickness={12}
                                        roundCaps
                                        sections={[{ value: 100, color: 'blue' }]}
                                        label={
                                            <Center>
                                                <ThemeIcon color="blue" variant="light" radius="xl" size="xl">
                                                    <IconTarget size={22} />
                                                </ThemeIcon>
                                            </Center>
                                        }
                                    />
                                </Center>
                                <Paper p="md" withBorder radius="md" bg="blue.0" shadow="xs">
                                    <Stack gap="sm">
                                        <Title order={5}>How AI Content Selection Works:</Title>

                                        <Group>
                                            <ThemeIcon color="blue" variant="light" radius="xl">
                                                <IconSearch size={16} />
                                            </ThemeIcon>
                                            <Text size="sm">Our AI analyzes your <b>existing content</b> across your connected accounts</Text>
                                        </Group>

                                        <Group>
                                            <ThemeIcon color="blue" variant="light" radius="xl">
                                                <IconChartBar size={16} />
                                            </ThemeIcon>
                                            <Text size="sm">We identify your <b>best performing</b> images, videos, and ad copy</Text>
                                        </Group>

                                        <Group>
                                            <ThemeIcon color="blue" variant="light" radius="xl">
                                                <IconBuildingStore size={16} />
                                            </ThemeIcon>
                                            <Text size="sm">We also draw from our <b>industry-specific content library</b> when needed</Text>
                                        </Group>

                                        <Group>
                                            <ThemeIcon color="blue" variant="light" radius="xl">
                                                <IconSettings size={16} />
                                            </ThemeIcon>
                                            <Text size="sm">We create <b>multiple variations</b> to test and optimize performance</Text>
                                        </Group>
                                    </Stack>
                                </Paper>
                            </Box>
                        )}

                        <Divider my="md" />

                        {/* Ad Text and Details - Only show when needed */}
                        {showCustomTextFields && (
                            <Paper withBorder p="md" radius="md" shadow="xs">
                                <Group mb="md" justify="left">
                                    <ThemeIcon size="md" variant="filled" radius="md" color="violet">
                                        <IconMessageCircle size={18} />
                                    </ThemeIcon>
                                    <Title order={4}>Ad Content</Title>
                                </Group>

                                <Stack gap="md">
                                    <TextInput
                                        label="Headline"
                                        description="Main title of your ad (max 40 characters)"
                                        placeholder="e.g. Summer Sale - 50% Off Everything"
                                        maxLength={40}
                                        size="md"
                                        {...form.getInputProps(`adSets.${idx}.creatives.0.adHeadline`)}
                                    />

                                    <TextInput
                                        label="Primary Text"
                                        description="Main body text of your ad (max 125 characters)"
                                        placeholder="e.g. Don't miss our biggest sale of the year! Limited time offer."
                                        maxLength={125}
                                        size="md"
                                        {...form.getInputProps(`adSets.${idx}.creatives.0.adPrimaryText`)}
                                    />

                                    <TextInput
                                        label="Description"
                                        description="Additional details (max 30 characters)"
                                        placeholder="e.g. Free shipping on all orders"
                                        maxLength={30}
                                        size="md"
                                        {...form.getInputProps(`adSets.${idx}.creatives.0.adDescription`)}
                                    />

                                    {/* Call to Action Button */}
                                    <Select
                                        label="Call to Action"
                                        description="Button text for your ad"
                                        data={[
                                            { value: 'LEARN_MORE', label: 'Learn More' },
                                            { value: 'SHOP_NOW', label: 'Shop Now' },
                                            { value: 'SIGN_UP', label: 'Sign Up' },
                                            { value: 'BOOK_NOW', label: 'Book Now' },
                                            { value: 'CONTACT_US', label: 'Contact Us' },
                                            { value: 'GET_OFFER', label: 'Get Offer' },
                                        ]}
                                        size="md"
                                        {...form.getInputProps(`adSets.${idx}.creatives.0.adCallToAction`)}
                                    />
                                </Stack>
                            </Paper>
                        )}
                    </Stack>
                </Card>
            </Grid.Col>

            {/* Right column - ad preview with HTML preview when available */}
            <Grid.Col span={{ base: 14, md: 6.5 }}>
                <Box style={{ position: 'sticky', top: '20px' }}>
                    <Card p="md" withBorder radius="md" mb="md" mt="lg" shadow="xs">
                        <Stack>
                            <Group mb="md" justify="apart">
                                <Title order={4}>Ad Preview</Title>
                                <ThemeIcon size="md" radius="md" color="blue" variant="light">
                                    <IconBrandFacebook size={18} />
                                </ThemeIcon>
                            </Group>

                            {/* Show HTML preview if we have an existing creative selected */}
                            {creative.contentSource === 'existing' &&
                                creative.existingCreativeIds?.length > 0 && (
                                    <>
                                        {loadingPreview && (
                                            <Center py="xl">
                                                <Stack align="center">
                                                    <Loader size="sm" />
                                                    <Text size="sm" c="dimmed">Loading preview...</Text>
                                                </Stack>
                                            </Center>
                                        )}

                                        {previewError && (
                                            <Alert color="red" title="Preview Error" mb="md">
                                                {previewError}
                                            </Alert>
                                        )}

                                        {!loadingPreview && !previewError && previewHtml ? (
                                            <AspectRatio ratio={540 / 690} maw="100%">
                                                <Box
                                                    className="creative-preview"
                                                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                                                    style={{
                                                        border: '1px solid #eee',
                                                        borderRadius: '8px',
                                                        overflow: 'hidden',
                                                        width: '100%',
                                                        height: '100%'
                                                    }}
                                                />
                                            </AspectRatio>
                                        ) : (
                                            // Show Facebook-style preview if no HTML preview
                                            !loadingPreview && !previewError && (
                                                <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden', marginBottom: '16px' }}>
                                                    {/* Facebook header */}
                                                    <Group p="xs" justify="apart">
                                                        <Group>
                                                            <AspectRatio ratio={1} style={{ width: 40 }}>
                                                                <Image
                                                                    src="https://placehold.co/100/4267B2/FFFFFF?text=FB"
                                                                    radius="xl"
                                                                    alt="Facebook page"
                                                                />
                                                            </AspectRatio>
                                                            <Stack gap={0}>
                                                                <Text size="sm" fw={500}>Your Business</Text>
                                                                <Text size="xs" c="dimmed">Sponsored</Text>
                                                            </Stack>
                                                        </Group>
                                                    </Group>

                                                    {/* Ad text */}
                                                    <Text p="xs" size="sm">
                                                        {creative.adPrimaryText || placeholderAd.primaryText}
                                                    </Text>

                                                    {/* Ad image */}
                                                    <Image
                                                        src={getPreviewImage()}
                                                        alt="Ad preview"
                                                        height={180}
                                                        fit="cover"
                                                    />

                                                    {/* Ad headline & CTA */}
                                                    <Box p="xs">
                                                        <Text fw={500} size="sm">
                                                            {creative.adHeadline || placeholderAd.headline}
                                                        </Text>
                                                        <Text size="xs" c="dimmed" mb="xs">
                                                            {creative.adDescription || placeholderAd.description}
                                                        </Text>
                                                        <Button fullWidth size="sm">
                                                            {creative.adCallToAction === 'SHOP_NOW' ? 'Shop Now' :
                                                                creative.adCallToAction === 'LEARN_MORE' ? 'Learn More' :
                                                                    creative.adCallToAction === 'SIGN_UP' ? 'Sign Up' :
                                                                        creative.adCallToAction === 'BOOK_NOW' ? 'Book Now' :
                                                                            creative.adCallToAction === 'CONTACT_US' ? 'Contact Us' :
                                                                                creative.adCallToAction === 'GET_OFFER' ? 'Get Offer' :
                                                                                    'Learn More'}
                                                        </Button>
                                                    </Box>
                                                </Paper>
                                            )
                                        )}
                                    </>
                                )}

                            {/* Always show regular preview for uploaded content or auto */}
                            {(creative.contentSource !== 'existing' ||
                                !creative.existingCreativeIds?.length ||
                                (creative.contentSource === 'existing' && !previewHtml && !loadingPreview)) && (
                                    <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
                                        {/* Facebook header */}
                                        <Group p="xs" justify="apart">
                                            <Group>
                                                <AspectRatio ratio={1} style={{ width: 40 }}>
                                                    <Image
                                                        src="https://placehold.co/100/4267B2/FFFFFF?text=FB"
                                                        radius="xl"
                                                        alt="Facebook page"
                                                    />
                                                </AspectRatio>
                                                <Stack gap={0}>
                                                    <Text size="sm" fw={500}>Your Business</Text>
                                                    <Text size="xs" c="dimmed">Sponsored</Text>
                                                </Stack>
                                            </Group>
                                        </Group>

                                        {/* Ad text */}
                                        <Text p="xs" size="sm">
                                            {creative.adPrimaryText || placeholderAd.primaryText}
                                        </Text>

                                        {/* Ad image */}
                                        <Image
                                            src={getPreviewImage()}
                                            alt="Ad preview"
                                            height={180}
                                            fit="cover"
                                        />

                                        {/* Ad headline & CTA */}
                                        <Box p="xs">
                                            <Text fw={500} size="sm">
                                                {creative.adHeadline || placeholderAd.headline}
                                            </Text>
                                            <Text size="xs" c="dimmed" mb="xs">
                                                {creative.adDescription || placeholderAd.description}
                                            </Text>
                                            <Button fullWidth size="sm">
                                                {creative.adCallToAction === 'SHOP_NOW' ? 'Shop Now' :
                                                    creative.adCallToAction === 'LEARN_MORE' ? 'Learn More' :
                                                        creative.adCallToAction === 'SIGN_UP' ? 'Sign Up' :
                                                            creative.adCallToAction === 'BOOK_NOW' ? 'Book Now' :
                                                                creative.adCallToAction === 'CONTACT_US' ? 'Contact Us' :
                                                                    creative.adCallToAction === 'GET_OFFER' ? 'Get Offer' :
                                                                        'Learn More'}
                                            </Button>
                                        </Box>
                                    </Paper>
                                )}

                            <Paper p="md" withBorder radius="md" bg="blue.0">
                                <Text fw={500} size="sm" mb="xs">Ad Preview Notes</Text>
                                <Text size="xs">This is a simplified preview of how your ad might appear in Facebook News Feed. Actual appearance may vary.</Text>
                            </Paper>
                        </Stack>
                    </Card>
                </Box>
            </Grid.Col>

            {/* Media Selection Modal */}
            <MediaSelectionModal
                opened={mediaModalOpened}
                onClose={() => setMediaModalOpened(false)}
                onSelectCreative={handleCreativeSelection}
                objective={form.values.campaign.objective}
                destinationType={form.values.campaign.destinationType}
                platformId={platformData.id}
                adAccountId={adAccountId}
                initialSelectedId={creative.existingCreativeIds?.[0] || null}
            />
        </Grid>
    );
}