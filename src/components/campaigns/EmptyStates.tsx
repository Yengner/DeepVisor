'use client';

import { Button, Card, Stack, Text, Title, ThemeIcon } from '@mantine/core';
import { IconArrowRight, IconPlug, IconBuildingStore, IconPresentationAnalytics } from '@tabler/icons-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import product from '@/components/product/Product.module.css';

interface EmptyCampaignStateProps {
    type: 'platform' | 'adAccount' | 'campaigns';
    platformName?: string;
}

export function EmptyCampaignState({ type, platformName }: EmptyCampaignStateProps) {
    const t = useTranslations('emptyCampaigns');
    const platform = platformName ?? 'Meta';
    const config = {
        platform: {
            icon: <IconPlug size={30} />,
            title: t('platformTitle'),
            description: t('platformBody'),
            buttonText: t('platformButton'),
            buttonLink: '/integration',
        },
        adAccount: {
            icon: <IconBuildingStore size={30} />,
            title: t('accountTitle', { platform }),
            description: t('accountBody', { platform }),
            buttonText: t('accountButton'),
            buttonLink: '/integration',
        },
        campaigns: {
            icon: <IconPresentationAnalytics size={30} />,
            title: t('campaignsTitle'),
            description: t('campaignsBody'),
            buttonText: t('campaignsButton'),
            buttonLink: '/campaigns/create',
        },
    } as const;

    const content = config[type];

    return (
        <Card p="xl" withBorder radius="md" className={`${product.page} mx-auto mt-8 max-w-xl`}>
            <Stack align="center" gap="md">
                <ThemeIcon
                    size={48}
                    radius="sm"
                    color="signal"
                    style={{ background: 'var(--dv-primary-soft)', color: 'var(--dv-primary-strong)' }}
                >
                    {content.icon}
                </ThemeIcon>

                <Title order={2} ta="center" className="app-platform-page-title">
                    {content.title}
                </Title>

                <Text size="md" ta="center" mb="md" className="app-platform-page-copy">
                    {content.description}
                </Text>

                <Button
                  component={Link}
                  href={content.buttonLink}
                  size="md"
                  rightSection={<IconArrowRight size={16} />}
                  className="app-platform-page-action-primary"
                >
                  {content.buttonText}
                </Button>
            </Stack>
        </Card>
    );
}
