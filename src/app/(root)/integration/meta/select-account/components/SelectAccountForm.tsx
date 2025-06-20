'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, Text, Title, Container, Radio, Stack, Group, Alert } from '@mantine/core';
import { IconInfoCircle, IconCheck } from '@tabler/icons-react';
import toast from 'react-hot-toast';

export default function SelectAccountPage() {
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [accounts, setAccounts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    const platformIntegrationId = searchParams.get('platformIntegrationId');
    const tier = searchParams.get('tier');

    useEffect(() => {
        try {
            const accountsParam = searchParams.get('accounts');
            if (accountsParam) {
                const parsedAccounts = JSON.parse(decodeURIComponent(accountsParam));
                setAccounts(parsedAccounts);

                // Auto-select if only one account
                if (parsedAccounts.length === 1) {
                    setSelectedAccount(parsedAccounts[0].id);
                }
            }
        } catch (error) {
            console.error('Error parsing accounts:', error);
            toast.error('Could not load account information');
        }
    }, [searchParams]);

    const handleSubmit = async () => {
        if (!selectedAccount) {
            toast.error('Please select an account');
            return;
        }

        setIsLoading(true);

        try {
            // Save the selected account
            const response = await fetch('/api/integrations/save-selected-account', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    platformIntegrationId,
                    accountId: selectedAccount,
                    platform: 'meta'
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save account selection');
            }

            toast.success('Account connected successfully!');
            router.push('/dashboard?newConnection=true');
        } catch (error) {
            console.error('Error saving account selection:', error);
            toast.error('Failed to connect account. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Container size="sm" py="xl">
            <Card shadow="sm" p="lg" radius="md" withBorder>
                <Title order={2} mb="md">Select Meta Ad Account</Title>

                <Alert icon={<IconInfoCircle />} title="Account Limit" color="blue" mb="lg">
                    Your {tier || 'current'} subscription allows connecting one Meta ad account.
                    Please select which account you&apos;d like to use with DeepVisor.
                </Alert>

                <Radio.Group
                    value={selectedAccount}
                    onChange={setSelectedAccount}
                    name="accountSelection"
                    label="Available Ad Accounts"
                    description="Select one account to connect"
                    withAsterisk
                >
                    <Stack mt="md">
                        {accounts.map(account => (
                            <Radio
                                key={account.id}
                                value={account.id}
                                label={
                                    <div>
                                        <Text fw={500}>{account.name}</Text>
                                        <Text size="xs" c="dimmed">ID: {account.id}</Text>
                                    </div>
                                }
                            />
                        ))}
                    </Stack>
                </Radio.Group>

                <Group justify="right" mt="xl">
                    <Button variant="default" onClick={() => router.push('/dashboard')}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        loading={isLoading}
                        disabled={!selectedAccount}
                        leftSection={<IconCheck size={16} />}
                    >
                        Connect Selected Account
                    </Button>
                </Group>
            </Card>
        </Container>
    );
}