import { useState, useEffect } from 'react';
import {
    Modal,
    Text,
    Tabs,
    SimpleGrid,
    Paper,
    Image,
    Stack,
    Badge,
    Checkbox,
    Group,
    ThemeIcon,
    Button,
    Center,
    Loader,
    Pagination,
    ActionIcon,
    Divider,
    Box,
    AspectRatio
} from '@mantine/core';
import { IconBrandFacebook, IconBrandInstagram, IconAlertCircle, IconPhoto, IconCheck } from '@tabler/icons-react';

interface MediaSelectionModalProps {
    opened: boolean;
    onClose: () => void;
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
}

export default function MediaSelectionModal({
    opened,
    onClose,
    selectedIds,
    onSelectionChange
}: MediaSelectionModalProps) {
    const [activeTab, setActiveTab] = useState<string | null>('facebook');
    const [metaPosts, setMetaPosts] = useState<any[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(false);
    const [postsError, setPostsError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageId, setPageId] = useState<string | null>(null);

    const POSTS_PER_PAGE = 9;

    // Fetch posts when modal opens or page changes
    useEffect(() => {
        if (!opened || activeTab !== 'facebook') return;

        async function fetchPosts() {
            setLoadingPosts(true);
            setPostsError(null);

            try {
                // Add pagination parameters to API call
                const response = await fetch(`/api/meta/posts?page=${currentPage}&limit=${POSTS_PER_PAGE}`);
                const data = await response.json();

                if (response.ok && data.success) {
                    setMetaPosts(data.posts || []);
                    // Calculate total pages based on API response
                    if (data.paging) {
                        const totalCount = data.totalCount || data.posts.length * 3; // Estimate if not provided
                        setTotalPages(Math.ceil(totalCount / POSTS_PER_PAGE));
                    }
                } else {
                    setPostsError(data.error || 'Failed to load posts');
                }
            } catch (error) {
                console.error('Error fetching posts:', error);
                setPostsError('Network error while loading posts');
            } finally {
                setLoadingPosts(false);
            }
        }

        fetchPosts();
    }, [opened, currentPage, activeTab]);

    const togglePostSelection = (postId: string) => {
        const currentSelected = [...selectedIds];
        const index = currentSelected.indexOf(postId);

        if (index > -1) {
            currentSelected.splice(index, 1);
        } else {
            currentSelected.push(postId);
        }

        onSelectionChange(currentSelected);
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            size="xl"
            title="Select Media Content"
            centered
            styles={{
                body: {
                    paddingBottom: 60
                }
            }}
        >
            <Tabs value={activeTab} onChange={setActiveTab} mb="md">
                <Tabs.List>
                    <Tabs.Tab value="facebook" leftSection={<IconBrandFacebook size={16} />}>
                        Facebook Posts
                    </Tabs.Tab>
                    <Tabs.Tab value="instagram" leftSection={<IconBrandInstagram size={16} />} disabled>
                        Instagram Posts
                    </Tabs.Tab>
                </Tabs.List>

                {/* Move this panel INSIDE the Tabs component */}
                <Tabs.Panel value="facebook">
                    {/* Loading State */}
                    {loadingPosts && (
                        <Center py="xl">
                            <Stack align="center">
                                <Loader size="md" />
                                <Text size="sm" c="dimmed">Loading your Facebook posts...</Text>
                            </Stack>
                        </Center>
                    )}

                    {/* Error State */}
                    {postsError && (
                        <Paper p="md" withBorder bg="red.0">
                            <Group>
                                <ThemeIcon color="red" variant="light">
                                    <IconAlertCircle size={16} />
                                </ThemeIcon>
                                <Text size="sm">{postsError}</Text>
                            </Group>
                        </Paper>
                    )}

                    {/* Empty State */}
                    {!loadingPosts && !postsError && metaPosts.length === 0 && (
                        <Paper p="md" withBorder>
                            <Stack align="center" py="md">
                                <ThemeIcon color="blue" variant="light" size="lg">
                                    <IconPhoto size={24} />
                                </ThemeIcon>
                                <Text c="dimmed" size="sm" ta="center">
                                    No posts with images found on your Facebook page.
                                </Text>
                            </Stack>
                        </Paper>
                    )}

                    {/* Posts Grid */}
                    {!loadingPosts && metaPosts.length > 0 && (
                        <>
                            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                                {metaPosts.map((post) => (
                                    <Paper
                                        key={post.id}
                                        p="xs"
                                        withBorder
                                        style={{
                                            cursor: 'pointer',
                                            borderColor: selectedIds.includes(post.id) ? 'var(--mantine-color-blue-6)' : undefined,
                                            borderWidth: selectedIds.includes(post.id) ? '2px' : '1px',
                                            position: 'relative'
                                        }}
                                        onClick={() => togglePostSelection(post.id)}
                                    >
                                        {selectedIds.includes(post.id) && (
                                            <ThemeIcon
                                                color="blue"
                                                size="md"
                                                radius="xl"
                                                style={{
                                                    position: 'absolute',
                                                    top: '5px',
                                                    right: '5px',
                                                    zIndex: 2
                                                }}
                                            >
                                                <IconCheck size={16} />
                                            </ThemeIcon>
                                        )}

                                        <Stack gap="xs">
                                            <AspectRatio ratio={1}>
                                                <Image
                                                    src={
                                                        post.full_picture ||
                                                        (post.attachments?.data[0]?.media?.image?.src) ||
                                                        'https://placehold.co/400x400/e2e8f0/475569?text=No+Image'
                                                    }
                                                    alt={post.message?.substring(0, 20) || 'Post'}
                                                    radius="md"
                                                    fit="cover"
                                                />
                                            </AspectRatio>

                                            {post.message && (
                                                <Text size="xs" lineClamp={2}>
                                                    {post.message}
                                                </Text>
                                            )}

                                            <Group justify="space-between" align="center">
                                                <Text size="xs" c="dimmed">
                                                    {new Date(post.created_time).toLocaleDateString()}
                                                </Text>
                                                <Checkbox
                                                    checked={selectedIds.includes(post.id)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        togglePostSelection(post.id);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </Group>
                                        </Stack>
                                    </Paper>
                                ))}
                            </SimpleGrid>

                            {/* Pagination */}
                            <Center mt="xl">
                                <Pagination
                                    total={totalPages}
                                    value={currentPage}
                                    onChange={setCurrentPage}
                                    withEdges
                                />
                            </Center>
                        </>
                    )}
                </Tabs.Panel>

                {/* Add a placeholder panel for Instagram */}
                <Tabs.Panel value="instagram">
                    <Center py="xl">
                        <Stack align="center">
                            <ThemeIcon size="xl" variant="light" color="gray">
                                <IconBrandInstagram size={24} />
                            </ThemeIcon>
                            <Text size="sm" c="dimmed">Instagram integration coming soon</Text>
                        </Stack>
                    </Center>
                </Tabs.Panel>
            </Tabs>

            {/* Fixed Action Bar remains the same */}
            <Box
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '10px 16px',
                    background: 'white',
                    borderTop: '1px solid var(--mantine-color-gray-3)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    zIndex: 100
                }}
            >
                <Badge size="lg" color="blue">
                    {selectedIds.length} items selected
                </Badge>

                <Group>
                    <Button variant="light" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={onClose} color="blue">
                        Confirm Selection
                    </Button>
                </Group>
            </Box>
        </Modal>
    );
}