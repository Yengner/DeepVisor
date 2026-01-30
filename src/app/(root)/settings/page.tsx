"use client";

import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconBell,
  IconDatabase,
  IconLock,
  IconPlug,
  IconTrash,
  IconUser,
} from "@tabler/icons-react";

const integrationsPreview = [
  { name: "Meta", status: "Connected", color: "green" },
  { name: "Google Ads", status: "Available", color: "blue" },
  { name: "TikTok", status: "Coming soon", color: "gray" },
];

export default function SettingsPage() {
  return (
    <Container size="xl" pb="xl">
      <Stack gap="xl">
        <Group justify="apart" align="center">
          <Stack gap={6}>
            <Title order={2}>Settings</Title>
            <Text size="sm" c="dimmed">
              Manage personal details, security, integrations, and data preferences in one place.
            </Text>
          </Stack>
          <Badge variant="light" color="green" size="lg">
            Account active
          </Badge>
        </Group>

        <Group gap="xs">
          <Button component="a" href="#profile" variant="subtle" size="xs">
            Profile
          </Button>
          <Button component="a" href="#security" variant="subtle" size="xs">
            Security
          </Button>
          <Button component="a" href="#notifications" variant="subtle" size="xs">
            Notifications
          </Button>
          <Button component="a" href="#integrations" variant="subtle" size="xs">
            Integrations
          </Button>
          <Button component="a" href="#data" variant="subtle" size="xs">
            Data & Privacy
          </Button>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <Card withBorder radius="md" p="md">
            <Group>
              <ThemeIcon size="lg" variant="light" color="blue" radius="md">
                <IconUser size={18} />
              </ThemeIcon>
              <div>
                <Text fw={600}>Profile</Text>
                <Text size="xs" c="dimmed">
                  Personal info, role, company
                </Text>
              </div>
            </Group>
          </Card>
          <Card withBorder radius="md" p="md">
            <Group>
              <ThemeIcon size="lg" variant="light" color="grape" radius="md">
                <IconLock size={18} />
              </ThemeIcon>
              <div>
                <Text fw={600}>Security</Text>
                <Text size="xs" c="dimmed">
                  Password, 2FA, sessions
                </Text>
              </div>
            </Group>
          </Card>
          <Card withBorder radius="md" p="md">
            <Group>
              <ThemeIcon size="lg" variant="light" color="cyan" radius="md">
                <IconPlug size={18} />
              </ThemeIcon>
              <div>
                <Text fw={600}>Integrations</Text>
                <Text size="xs" c="dimmed">
                  Manage connected platforms
                </Text>
              </div>
            </Group>
          </Card>
          <Card withBorder radius="md" p="md">
            <Group>
              <ThemeIcon size="lg" variant="light" color="orange" radius="md">
                <IconDatabase size={18} />
              </ThemeIcon>
              <div>
                <Text fw={600}>Data & Privacy</Text>
                <Text size="xs" c="dimmed">
                  Exports, logs, deletion
                </Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>

        <Card withBorder radius="md" p="lg" id="profile">
          <Group align="center" mb="md">
            <ThemeIcon size="lg" variant="light" color="blue" radius="md">
              <IconUser size={18} />
            </ThemeIcon>
            <div>
              <Title order={4}>Personal information</Title>
              <Text size="sm" c="dimmed">
                Update how your account appears across the platform.
              </Text>
            </div>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput label="First name" placeholder="Jordan" />
            <TextInput label="Last name" placeholder="Lee" />
            <TextInput label="Email" placeholder="you@company.com" />
            <TextInput label="Role" placeholder="Marketing Lead" />
          </SimpleGrid>
          <TextInput mt="md" label="Company" placeholder="DeepVisor" />
          <Textarea mt="md" label="Company goals" placeholder="Tell us what success looks like." minRows={3} />
          <Group justify="apart" mt="lg">
            <Text size="xs" c="dimmed">
              Changes apply immediately after saving.
            </Text>
            <Button>Save changes</Button>
          </Group>
        </Card>

        <Card withBorder radius="md" p="lg" id="security">
          <Group align="center" mb="md">
            <ThemeIcon size="lg" variant="light" color="grape" radius="md">
              <IconLock size={18} />
            </ThemeIcon>
            <div>
              <Title order={4}>Security</Title>
              <Text size="sm" c="dimmed">
                Keep your account protected with fresh credentials and MFA.
              </Text>
            </div>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <PasswordInput label="New password" placeholder="••••••••" />
            <PasswordInput label="Confirm password" placeholder="••••••••" />
          </SimpleGrid>
          <Divider my="md" />
          <Stack gap="sm">
            <Switch label="Enable two-factor authentication" description="Add a second step when signing in." />
            <Switch label="Email me on new device logins" description="Get alerted if a new device signs in." defaultChecked />
          </Stack>
          <Group justify="apart" mt="lg">
            <Text size="xs" c="dimmed">
              We recommend rotating passwords every 90 days.
            </Text>
            <Button variant="light">Update password</Button>
          </Group>
        </Card>

        <Card withBorder radius="md" p="lg" id="notifications">
          <Group align="center" mb="md">
            <ThemeIcon size="lg" variant="light" color="cyan" radius="md">
              <IconBell size={18} />
            </ThemeIcon>
            <div>
              <Title order={4}>Notifications</Title>
              <Text size="sm" c="dimmed">
                Control how often DeepVisor sends updates.
              </Text>
            </div>
          </Group>
          <Stack gap="sm">
            <Switch label="Weekly performance summary" defaultChecked />
            <Switch label="Guardrail alerts" defaultChecked />
            <Switch label="Product updates" />
            <Switch label="Investor/partner updates" />
          </Stack>
          <Group justify="apart" mt="lg">
            <Text size="xs" c="dimmed">
              Notifications are sent to your primary email.
            </Text>
            <Button variant="light">Save preferences</Button>
          </Group>
        </Card>

        <Card withBorder radius="md" p="lg" id="integrations">
          <Group align="center" mb="md">
            <ThemeIcon size="lg" variant="light" color="blue" radius="md">
              <IconPlug size={18} />
            </ThemeIcon>
            <div>
              <Title order={4}>Integrations</Title>
              <Text size="sm" c="dimmed">
                Manage connected ad platforms and data sync status.
              </Text>
            </div>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            {integrationsPreview.map((integration) => (
              <Card key={integration.name} withBorder radius="md" p="md">
                <Group justify="apart">
                  <Text fw={600}>{integration.name}</Text>
                  <Badge color={integration.color} variant="light">
                    {integration.status}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mt="xs">
                  Manage connection details and permissions.
                </Text>
              </Card>
            ))}
          </SimpleGrid>
          <Group justify="apart" mt="lg">
            <Text size="xs" c="dimmed">
              Keep platform permissions up to date.
            </Text>
            <Button component={Link} href="/integration" variant="light">
              Manage integrations
            </Button>
          </Group>
        </Card>

        <Card withBorder radius="md" p="lg" id="data">
          <Group align="center" mb="md">
            <ThemeIcon size="lg" variant="light" color="orange" radius="md">
              <IconDatabase size={18} />
            </ThemeIcon>
            <div>
              <Title order={4}>Data & privacy</Title>
              <Text size="sm" c="dimmed">
                Export, review, or delete your account data.
              </Text>
            </div>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Card withBorder radius="md" p="md">
              <Text fw={600}>Data export</Text>
              <Text size="xs" c="dimmed" mt="xs">
                Download a CSV export of your performance data.
              </Text>
              <Button variant="light" mt="md">
                Request export
              </Button>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text fw={600}>Activity log</Text>
              <Text size="xs" c="dimmed" mt="xs">
                Review platform syncs, approvals, and account events.
              </Text>
              <Button component={Link} href="/reports" variant="light" mt="md">
                View data log
              </Button>
            </Card>
          </SimpleGrid>
          <Divider my="lg" />
          <Alert
            icon={<IconAlertTriangle size={18} />}
            title="Danger zone"
            color="red"
            variant="light"
          >
            Deleting your account removes all connected data and cannot be undone.
          </Alert>
          <Group justify="apart" mt="lg">
            <Text size="xs" c="dimmed">
              Account deletions are final and remove all integrations.
            </Text>
            <Button color="red" leftSection={<IconTrash size={16} />}>
              Delete account
            </Button>
          </Group>
        </Card>
      </Stack>
    </Container>
  );
}
