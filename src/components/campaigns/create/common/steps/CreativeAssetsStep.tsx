'use client';

import {
    Card, Group, Paper, Radio, Stack, Text, ThemeIcon, Title, Divider, Box,
    FileInput, SimpleGrid, Image, Badge, Button, AspectRatio, RingProgress,
    Center, TextInput, Select, Grid
} from '@mantine/core';
import {
    IconPhoto, IconUpload, IconBrandFacebook, IconSearch, IconChartBar,
    IconBuildingStore, IconSettings, IconTarget, IconBrandWhatsapp,
    IconMessageCircle, IconMapPin, IconDeviceImac
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { UseFormReturnType } from '@mantine/form';
import { MetaPost, useMetaPosts } from '../hooks/useMetaPosts';
import { CampaignFormValues } from '@/lib/actions/meta/types';

interface CreativeAssetsStepProps {
    form: UseFormReturnType<CampaignFormValues>;
    setMediaModalOpened: (opened: boolean) => void;
    mediaModalOpened: boolean;
    isSmart?: boolean;
}

/**
 * Creative Assets step for campaign creation
 * Allows users to select content sources, upload media, and configure ad text
 */
export default function CreativeAssetsStep({
    form,
    setMediaModalOpened,
    mediaModalOpened,
    isSmart = false
}: CreativeAssetsStepProps) {
    // State for file previews
    const [filePreview, setFilePreview] = useState<string[]>([]);

    // Fetch meta posts
    const { metaPosts, loadingPosts, postsError } = useMetaPosts(form.values.contentSource);

    // Static placeholder ads for preview
    const placeholderAd = {
        headline: "Amazing Product Launch",
        primaryText: "Discover our new collection with exclusive discounts for early buyers!",
        description: "Free shipping on all orders",
        image: "https://images.unsplash.com/photo-1560769629-975ec94e6a86?q=80&w=500&auto=format&fit=crop",
    };

    // Handle file uploads
    useEffect(() => {
        if (form.values.uploadedFiles && form.values.uploadedFiles.length > 0) {
            const newPreviews = Array.from(form.values.uploadedFiles).map(file =>
                URL.createObjectURL(file)
            );
            setFilePreview(newPreviews);

            return () => {
                // Clean up the URL objects
                newPreviews.forEach(url => URL.revokeObjectURL(url));
            };
        }
    }, [form.values.uploadedFiles]);

    // Get display image based on content source
    const getPreviewImage = () => {
        if (form.values.contentSource === 'upload' && filePreview.length > 0) {
            return filePreview[0];
        }
        else if (form.values.contentSource === 'existing' && form.values.existingPostIds?.length > 0) {
            const selectedPost = metaPosts.find(post => post.id === form.values.existingPostIds[0]);
            return selectedPost?.full_picture || placeholderAd.image;
        }
        return placeholderAd.image;
    };

    return (
        <Grid gutter="md">
            {/* Left column - form inputs */}
            <Grid.Col span={{ base: 12, md: 8 }}>
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

                        <Radio.Group
                            label="Content Source"
                            description="Choose where your ad content comes from"
                            {...form.getInputProps('contentSource')}
                        >
                            <Stack mt="xs" gap="md">
                                <Paper
                                    withBorder
                                    p="md"
                                    radius="md"
                                    bg={form.values.contentSource === 'upload' ? 'blue.0' : undefined}
                                    style={{
                                        cursor: 'pointer',
                                        borderColor: form.values.contentSource === 'upload' ? 'var(--mantine-color-blue-6)' : undefined
                                    }}
                                    onClick={() => form.setFieldValue('contentSource', 'upload')}
                                >
                                    <Group align="flex-start">
                                        <Radio value="upload" />
                                        <Stack gap={0}>
                                            <Text fw={600}>Upload New Content</Text>
                                            <Text size="sm" c="dimmed">Upload your own images or videos for the ad</Text>
                                        </Stack>
                                    </Group>
                                </Paper>

                                <Paper
                                    withBorder
                                    p="md"
                                    radius="md"
                                    bg={form.values.contentSource === 'existing' ? 'blue.0' : undefined}
                                    style={{
                                        cursor: 'pointer',
                                        borderColor: form.values.contentSource === 'existing' ? 'var(--mantine-color-blue-6)' : undefined
                                    }}
                                    onClick={() => form.setFieldValue('contentSource', 'existing')}
                                >
                                    <Group align="flex-start">
                                        <Radio value="existing" />
                                        <Stack gap={0}>
                                            <Text fw={600}>Select Existing Posts</Text>
                                            <Text size="sm" c="dimmed">Choose specific posts from your Facebook page</Text>
                                        </Stack>
                                    </Group>
                                </Paper>

                                <Paper
                                    withBorder
                                    p="md"
                                    radius="md"
                                    bg={form.values.contentSource === 'auto' ? 'blue.0' : undefined}
                                    style={{
                                        cursor: 'pointer',
                                        borderColor: form.values.contentSource === 'auto' ? 'var(--mantine-color-blue-6)' : undefined
                                    }}
                                    onClick={() => form.setFieldValue('contentSource', 'auto')}
                                >
                                    <Group align="flex-start">
                                        <Radio value="auto" />
                                        <Stack gap={0}>
                                            <Text fw={600}>AI Content Selection</Text>
                                            <Text size="sm" c="dimmed">Let our AI automatically select the best content for your campaign</Text>
                                        </Stack>
                                    </Group>
                                </Paper>
                            </Stack>
                        </Radio.Group>

                        {/* Upload Content Option */}
                        {form.values.contentSource === 'upload' && (
                            <Stack mt="md">
                                <FileInput
                                    label="Upload Images/Videos"
                                    description="Recommended size: 1080x1080px. Max 10 files."
                                    placeholder="Select files"
                                    multiple
                                    accept="image/*,video/*"
                                    leftSection={<IconUpload size={16} />}
                                    size="md"
                                    onChange={(files) => form.setFieldValue('uploadedFiles', files || [])}
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

                        {/* Select Existing Posts Option */}
                        {form.values.contentSource === 'existing' && (
                            <Stack mt="md">
                                <Group justify="space-between">
                                    <Text fw={500} size="sm">Select content from your social media accounts</Text>

                                    <Button
                                        leftSection={<IconPhoto size={16} />}
                                        onClick={() => setMediaModalOpened(true)}
                                        variant="filled"
                                        color="blue"
                                    >
                                        Browse & Select Posts
                                    </Button>
                                </Group>

                                {/* Preview of selected content */}
                                {form.values.existingPostIds && form.values.existingPostIds.length > 0 ? (
                                    <Paper p="md" withBorder shadow="xs">
                                        <Group justify="space-between">
                                            <Group>
                                                <ThemeIcon size="lg" radius="md" color="blue" variant="light">
                                                    <IconBrandFacebook size={20} />
                                                </ThemeIcon>
                                                <Text fw={500}>{form.values.existingPostIds.length} posts selected</Text>
                                            </Group>

                                            <Button
                                                variant="subtle"
                                                size='compact-md'
                                                onClick={() => setMediaModalOpened(true)}
                                            >
                                                Change Selection
                                            </Button>
                                        </Group>

                                        {/* Mini preview of selected posts - using the format you provided */}
                                        {metaPosts.length > 0 && (
                                            <Box mt="md">
                                                <Text size="xs" c="dimmed" mb="xs">Selected posts preview:</Text>
                                                <Group gap="md" align="center">
                                                    {metaPosts
                                                        .filter(post => form.values.existingPostIds?.includes(post.id))
                                                        .slice(0, 7)
                                                        .map(post => (
                                                            <Paper
                                                                key={post.id}
                                                                radius="md"
                                                                withBorder
                                                                style={{
                                                                    overflow: 'hidden',
                                                                    width: 100,
                                                                    height: 100,
                                                                    position: 'relative',
                                                                }}
                                                            >
                                                                <AspectRatio ratio={1} style={{ width: '100%', height: '100%' }}>
                                                                    <Image
                                                                        src={
                                                                            post.full_picture ||
                                                                            (post.attachments?.data[0]?.media?.image?.src) ||
                                                                            'https://placehold.co/100x100/e2e8f0/475569?text=Post'
                                                                        }
                                                                        fit="cover"
                                                                        style={{ width: '100%', height: '100%' }}
                                                                        radius="md"
                                                                        alt={post.message?.substring(0, 20) || 'Facebook post'}
                                                                    />
                                                                </AspectRatio>
                                                                <Badge
                                                                    size="xs"
                                                                    color="blue"
                                                                    variant="filled"
                                                                    style={{
                                                                        position: 'absolute',
                                                                        bottom: 5,
                                                                        left: 5,
                                                                        opacity: 0.9
                                                                    }}
                                                                >
                                                                    <IconBrandFacebook size={10} style={{ marginRight: 4 }} />FB
                                                                </Badge>
                                                            </Paper>
                                                        ))}

                                                    {form.values.existingPostIds && form.values.existingPostIds.length > 7 && (
                                                        <Paper
                                                            radius="md"
                                                            withBorder
                                                            style={{
                                                                width: 100,
                                                                height: 100,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                background: 'var(--mantine-color-blue-0)',
                                                                position: 'relative',
                                                            }}
                                                        >
                                                            <Stack gap={0} align="center">
                                                                <Text size="xl" fw={700} c="blue">+{form.values.existingPostIds.length - 7}</Text>
                                                                <Text size="xs" c="dimmed">more posts</Text>
                                                            </Stack>
                                                        </Paper>
                                                    )}
                                                </Group>
                                            </Box>
                                        )}
                                    </Paper>
                                ) : (
                                    <Paper p="md" withBorder shadow="xs">
                                        <Stack align="center" py="md">
                                            <ThemeIcon color="blue" variant="light" size="lg">
                                                <IconPhoto size={24} />
                                            </ThemeIcon>
                                            <Text c="dimmed" size="sm" ta="center">
                                                No posts selected yet
                                            </Text>
                                            <Button
                                                variant="light"
                                                size="xs"
                                                onClick={() => setMediaModalOpened(true)}
                                            >
                                                Browse Posts
                                            </Button>
                                        </Stack>
                                    </Paper>
                                )}
                            </Stack>
                        )}

                        {/* AI Content Selection Option */}
                        {form.values.contentSource === 'auto' && (
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

                        {/* Ad Text and Details */}
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
                                    {...form.getInputProps('adHeadline')}
                                />

                                <TextInput
                                    label="Primary Text"
                                    description="Main body text of your ad (max 125 characters)"
                                    placeholder="e.g. Don't miss our biggest sale of the year! Limited time offer."
                                    maxLength={125}
                                    size="md"
                                    {...form.getInputProps('adPrimaryText')}
                                />

                                <TextInput
                                    label="Description"
                                    description="Additional details (max 30 characters)"
                                    placeholder="e.g. Free shipping on all orders"
                                    maxLength={30}
                                    size="md"
                                    {...form.getInputProps('adDescription')}
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
                                    {...form.getInputProps('adCallToAction')}
                                />
                            </Stack>
                        </Paper>
                    </Stack>
                </Card>
            </Grid.Col>

            {/* Right column - simplified ad preview */}
            <Grid.Col span={{ base: 12, md: 4 }}>
                <Box style={{ position: 'sticky', top: '20px' }}>
                    <Card p="md" withBorder radius="md" mb="md" mt="lg" shadow="xs">
                        <Stack>
                            <Group mb="md" justify="apart">
                                <Title order={4}>Ad Preview</Title>
                                <ThemeIcon size="md" radius="md" color="blue" variant="light">
                                    <IconBrandFacebook size={18} />
                                </ThemeIcon>
                            </Group>

                            {/* Simple Facebook-style ad preview */}
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
                                    {form.values.primaryText || placeholderAd.primaryText}
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
                                        {form.values.adHeadline || placeholderAd.headline}
                                    </Text>
                                    <Text size="xs" c="dimmed" mb="xs">
                                        {form.values.adDescription || placeholderAd.description}
                                    </Text>
                                    <Button fullWidth size="sm">
                                        {form.values.adCallToAction === 'SHOP_NOW' ? 'Shop Now' :
                                            form.values.adCallToAction === 'LEARN_MORE' ? 'Learn More' :
                                                form.values.adCallToAction === 'SIGN_UP' ? 'Sign Up' :
                                                    form.values.adCallToAction === 'BOOK_NOW' ? 'Book Now' :
                                                        form.values.adCallToAction === 'CONTACT_US' ? 'Contact Us' :
                                                            form.values.adCallToAction === 'GET_OFFER' ? 'Get Offer' :
                                                                'Learn More'}
                                    </Button>
                                </Box>
                            </Paper>

                            <Paper p="md" withBorder radius="md" bg="blue.0">
                                <Text fw={500} size="sm" mb="xs">Ad Preview Notes</Text>
                                <Text size="xs">This is a simplified preview of how your ad might appear in Facebook News Feed. Actual appearance may vary.</Text>
                            </Paper>
                        </Stack>
                    </Card>
                </Box>
            </Grid.Col>
        </Grid>
    );
}