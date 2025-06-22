'use client';

import { Stack, Alert, Text, Button, Group } from '@mantine/core';
import { IconBulb, IconAlertCircle } from '@tabler/icons-react';

interface RecommendationsProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recommendations: any[];
}

export default function Recommendations({ recommendations }: RecommendationsProps) {
    if (!recommendations || recommendations.length === 0) {
        return (
            <Alert
                icon={<IconAlertCircle size={16} />}
                title="No recommendations available"
                color="gray"
            >
                We&apos;ll generate personalized recommendations as we gather more data about your campaigns.
            </Alert>
        );
    }

    return (
        <Stack gap="xs" p="md">
            {recommendations.map((recommendation, index) => (
                <Alert
                    key={index}
                    icon={<IconBulb size={16} />}
                    title={recommendation.title || "Recommendation"}
                    color="yellow"
                    withCloseButton={false}
                    mb="xs"
                >
                    <Text size="sm" mb="xs">{recommendation.description}</Text>
                    {recommendation.action && (
                        <Group justify="right" mt="xs">
                            <Button
                                size="xs"
                                variant="light"
                                color="yellow"
                                onClick={() => alert(`Implement action: ${recommendation.action}`)}
                            >
                                {recommendation.action}
                            </Button>
                        </Group>
                    )}
                </Alert>
            ))}
        </Stack>
    );
}